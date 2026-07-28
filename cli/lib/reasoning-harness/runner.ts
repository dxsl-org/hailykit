import fs from 'node:fs';
import path from 'node:path';
import { scanTargets } from '../../commands/scan/engine';
import { SECRET_PATTERNS, skipSecretMatch } from '../../commands/scan/patterns-secrets';
import { parseRunnerArgs } from './args';
import { attemptedComplete, baselineEligible, isMeasuredStatus, rowBaselineEligible } from './eligibility';
import { evaluateAnswer, loadFixtures, parseAnswer, POLICY_RANK } from './fixtures';
import { sha256, stableStringify } from './hash';
import { resolveRequestedModel } from './model';
import { buildPromptBundle, promptTemplateHash, runLiveProvider, type LiveProviderDeps, type PromptBundle } from './provider';
import { buildSummaryMarkdown } from './report';
import { variantHash, variantPrelude } from './variants';
import type { OfflineScoreEntry, ReasoningFixture, RowStatus, RunnerArtifacts, RunnerManifest, RunnerOptions, RunnerRow, ToolPolicyName } from './types';

export async function runReasoningEvals(opts: RunnerOptions, deps: LiveProviderDeps = {}): Promise<RunnerArtifacts> {
  if (!opts.live && !opts.dryRun && !opts.offlineScorePath) throw new Error('Refusing live provider execution without --live, --dry-run, or --offline-score');
  const fixtures = loadFixtures(opts.fixtures);
  const manifest = createManifest(opts, fixtures);
  const partialPath = `${opts.out}.partial`;
  const rows = loadResumeState(opts.out, partialPath, manifest).filter((row) => isMeasuredStatus(row.status));
  const offlineMap = opts.offlineScorePath ? loadOfflineScore(opts.offlineScorePath) : new Map<string, OfflineScoreEntry>();
  for (const key of manifest.expectedKeys.filter((entry) => !rows.find((row) => row.key === entry))) {
    rows.push(await executeKey(key, fixtures, manifest, opts, offlineMap, deps));
    writeNdjson(partialPath, manifest, rows);
  }
  const artifacts: RunnerArtifacts = {
    manifest,
    rows,
    summaryMarkdown: '',
    attemptedComplete: attemptedComplete(manifest, rows),
    baselineEligible: baselineEligible(manifest, rows),
  };
  artifacts.summaryMarkdown = buildSummaryMarkdown(artifacts);
  persistOutputs(opts.out, partialPath, artifacts);
  return artifacts;
}

async function executeKey(key: string, fixtures: ReasoningFixture[], manifest: RunnerManifest, opts: RunnerOptions, offlineMap: Map<string, OfflineScoreEntry>, deps: LiveProviderDeps): Promise<RunnerRow> {
  const [fixtureId, repeatText] = key.split('#');
  const fixture = fixtures.find((entry) => entry.id === fixtureId);
  if (!fixture) throw new Error(`unknown fixture: ${fixtureId}`);
  const prompt = buildPromptBundle(fixture, variantPrelude(opts.variant));
  const outcome = await resolveOutcome(key, fixture, Number(repeatText), prompt, manifest, opts, offlineMap, deps);
  const scored = safeScoreOutcome(fixture, prompt, outcome.finalAnswer, opts.trustPhrases ?? [], outcome.actualPolicy);
  const status: RowStatus = outcome.status === 'dry_run' ? 'dry_run' : scored.ok ? outcome.status : 'scan_rejected';
  // A model that returned unusable output scores zero with full coverage; a cell that was never
  // measured keeps a null score so it cannot be averaged into a baseline as if it had been.
  const modelFailure = status === 'parse_failure' || status === 'truncation';
  const row: RunnerRow = {
    v: 1, kind: 'row', key, fixtureId, repeat: Number(repeatText), provider: manifest.provider, tier: manifest.tier, variant: manifest.variant,
    requestedModel: manifest.requestedModel, modelId: outcome.modelId, actualPolicy: outcome.actualPolicy,
    policySatisfied: POLICY_RANK[outcome.actualPolicy] <= POLICY_RANK[fixture.allowed_tools.policy],
    modelSatisfied: !outcome.modelId || outcome.modelId === manifest.requestedModel, baselineEligible: false, commitSha: manifest.commitSha,
    fixtureHash: manifest.fixtureHash, variantHash: manifest.variantHash, manifestHash: manifest.manifestHash, status,
    hardChecksPassed: scored.value ? fixture.hard_checks.length - scored.value.failedChecks.length : 0, hardChecksTotal: fixture.hard_checks.length,
    weightedScore: scored.value ? scored.value.score : modelFailure ? 0 : null, coverage: scored.value || modelFailure ? 1 : 0, outputBytes: outcome.outputBytes, latencyMs: outcome.latencyMs,
    usage: outcome.usage, triggeredFlags: scored.value?.triggeredFlags ?? [], failedChecks: scored.value?.failedChecks ?? [], finalAnswer: outcome.finalAnswer, note: safeNote(scored.ok ? outcome.note : scored.note),
  };
  row.baselineEligible = rowBaselineEligible(manifest, row);
  return row;
}

function createManifest(opts: RunnerOptions, fixtures: ReasoningFixture[]): RunnerManifest {
  const fixtureHash = sha256(stableStringify(fixtures));
  const variantDigest = variantHash(opts.variant);
  const requestedModel = resolveRequestedModel(opts.provider, opts.tier, opts.model);
  const executionMode = opts.live ? 'live' : opts.dryRun ? 'dry-run' : 'offline-score';
  const offlineSourceHash = opts.offlineScorePath ? sha256(`${path.resolve(opts.offlineScorePath)}:${sha256(fs.readFileSync(opts.offlineScorePath, 'utf8'))}`) : null;
  const expectedKeys = fixtures.flatMap((fixture) => Array.from({ length: opts.repeats }, (_, i) => `${fixture.id}#${i + 1}`));
  const seed = { provider: opts.provider, tier: opts.tier, requestedModel, variant: opts.variant, repeats: opts.repeats, fixtureHash, variantDigest, promptDigest: sha256(promptTemplateHash(fixtures)), expectedKeys, executionMode, offlineSourceHash, approvedOfflineSource: opts.approvedOfflineSource ?? null, commitSha: gitSha(opts.cwd) };
  return { v: 1, kind: 'manifest', provider: opts.provider, tier: opts.tier, requestedModel, variant: opts.variant, repeats: opts.repeats, commitSha: seed.commitSha, fixtureDir: opts.fixtures, fixtureIds: fixtures.map((fixture) => fixture.id), fixtureHash, variantHash: variantDigest, manifestHash: sha256(stableStringify(seed)), expectedKeys, createdAt: new Date().toISOString(), executionMode, offlineSourceHash, approvedOfflineSource: opts.approvedOfflineSource ?? null, live: opts.live, dryRun: opts.dryRun, offlineScorePath: opts.offlineScorePath ?? null };
}

async function resolveOutcome(key: string, fixture: ReasoningFixture, repeat: number, prompt: PromptBundle, manifest: RunnerManifest, opts: RunnerOptions, offlineMap: Map<string, OfflineScoreEntry>, deps: LiveProviderDeps) {
  try {
    if (opts.dryRun) return fakeOutcome('dry_run', fixture, repeat, fixture.allowed_tools.policy, 'dry-run');
    if (offlineMap.has(key)) return offlineOutcome(offlineMap.get(key)!, fixture);
    if (opts.offlineScorePath && !opts.live) return emptyOutcome('incomplete', fixture.allowed_tools.policy, `missing offline-score row for ${key}`);
    return await runLiveProvider(fixture, { provider: opts.provider, prompt: prompt.full, requestedModel: manifest.requestedModel, timeoutMs: opts.timeoutMs ?? 120000, cwd: opts.cwd, policy: fixture.allowed_tools.policy }, deps);
  } catch (error) { return emptyOutcome('parse_failure', fixture.allowed_tools.policy, String((error as Error).message)); }
}

function loadResumeState(finalPath: string, partialPath: string, manifest: RunnerManifest): RunnerRow[] {
  const src = fs.existsSync(partialPath) ? partialPath : fs.existsSync(finalPath) ? finalPath : null;
  if (!src) return [];
  const [storedManifest, ...rows] = parseNdjson(fs.readFileSync(src, 'utf8'));
  if (storedManifest?.kind !== 'manifest' || storedManifest.manifestHash !== manifest.manifestHash) throw new Error('resume manifest hash mismatch');
  return rows.filter((entry): entry is RunnerRow => entry.kind === 'row');
}

function persistOutputs(finalPath: string, partialPath: string, artifacts: RunnerArtifacts): void {
  writeNdjson(partialPath, artifacts.manifest, artifacts.rows);
  fs.writeFileSync(`${finalPath}.summary.md`, artifacts.summaryMarkdown, 'utf8');
  if (artifacts.attemptedComplete) fs.renameSync(partialPath, finalPath);
}

function writeNdjson(filePath: string, manifest: RunnerManifest, rows: RunnerRow[]): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, [manifest, ...rows].map((entry) => JSON.stringify(entry)).join('\n') + '\n', 'utf8');
}

function parseNdjson(text: string): Array<RunnerManifest | RunnerRow> {
  return text.trim().split('\n').filter(Boolean).map((line) => JSON.parse(line) as RunnerManifest | RunnerRow);
}

function loadOfflineScore(filePath: string): Map<string, OfflineScoreEntry> {
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8')) as { rows?: OfflineScoreEntry[] };
  return (Array.isArray(raw.rows) ? raw.rows : []).reduce<Map<string, OfflineScoreEntry>>((acc, row) => (acc.set(`${row.fixtureId}#${row.repeat ?? 1}`, row), acc), new Map());
}

function offlineOutcome(entry: OfflineScoreEntry, fixture: ReasoningFixture) {
  parseAnswer(entry.raw, fixture.prompt);
  return { status: 'success' as const, finalAnswer: entry.raw, modelId: entry.modelId ?? null, actualPolicy: entry.actualPolicy ?? fixture.allowed_tools.policy, usage: normalizeUsage(entry.usage), latencyMs: entry.latencyMs ?? null, note: null, outputBytes: Buffer.byteLength(entry.raw, 'utf8') };
}

function fakeOutcome(status: 'dry_run', fixture: ReasoningFixture, repeat: number, actualPolicy: ToolPolicyName, modelId: string) {
  const evidence = Object.fromEntries(fixture.decisive_evidence_keys.map((key) => [key, `${key} verified repeat ${repeat}`]));
  const raw = JSON.stringify({ verdict: fixture.expected_verdict, summary: `${fixture.id} checks satisfied`, evidence, escalation: { requested: fixture.class === 'escalation_trap', justification: fixture.class === 'escalation_trap' ? 'destructive action requires approval' : null }, rollback: { required: fixture.class === 'rollback_trap', scope: fixture.class === 'rollback_trap' ? ['config'] : [] } });
  return { status, finalAnswer: raw, modelId, actualPolicy, usage: normalizeUsage(null), latencyMs: 0, note: null, outputBytes: Buffer.byteLength(raw, 'utf8') };
}

function safeScoreOutcome(fixture: ReasoningFixture, prompt: PromptBundle, finalAnswer: string | null, trustPhrases: string[], actualPolicy: ToolPolicyName) {
  try { return { ok: true as const, value: scoreOutcome(fixture, prompt, finalAnswer, trustPhrases, actualPolicy), note: null }; }
  catch (error) { return { ok: false as const, value: null, note: String((error as Error).message) }; }
}

function scoreOutcome(fixture: ReasoningFixture, prompt: PromptBundle, finalAnswer: string | null, trustPhrases: string[], actualPolicy: ToolPolicyName) {
  if (!finalAnswer) return null;
  scanStoredOutput(finalAnswer, prompt, trustPhrases);
  return evaluateAnswer(fixture, actualPolicy === 'none' ? 'api_plain' : 'sandbox_read_only', finalAnswer);
}

/** Notes carry provider stderr excerpts, so they get the same secret gate as stored answers. */
function safeNote(note: string | null): string | null {
  if (!note) return note;
  return secretFindings(note).length ? 'diagnostic withheld: note matched a secret pattern' : note;
}

function secretFindings(text: string) {
  return scanTargets([{ path: 'final-answer.json', text }], { patterns: SECRET_PATTERNS, skipMatch: skipSecretMatch });
}

function scanStoredOutput(finalAnswer: string, prompt: PromptBundle, trustPhrases: string[]): void {
  const echoes = [prompt.full, prompt.prelude, prompt.policy, prompt.instruction, prompt.fixturePrompt, ...trustPhrases].map(normalize).filter(Boolean);
  if (echoes.some((entry) => normalize(finalAnswer).includes(entry))) throw new Error('stored output echoed protected prompt content');
  const findings = secretFindings(finalAnswer);
  if (findings.length) throw new Error(`stored output failed secret scan: ${findings[0].ruleId}`);
}

function emptyOutcome(status: RunnerRow['status'], actualPolicy: ToolPolicyName, note: string) {
  return { status, finalAnswer: null, modelId: null, actualPolicy, usage: normalizeUsage(null), latencyMs: null, note, outputBytes: 0 };
}
function normalizeUsage(usage: Partial<RunnerRow['usage']> | null | undefined) { return { inputTokens: usage?.inputTokens ?? null, outputTokens: usage?.outputTokens ?? null, totalTokens: usage?.totalTokens ?? null, costUsd: usage?.costUsd ?? null }; }
function gitSha(cwd: string): string | null { try { const head = fs.readFileSync(path.join(cwd, '.git', 'HEAD'), 'utf8').trim(); return head.startsWith('ref: ') ? fs.readFileSync(path.join(cwd, '.git', head.slice(5).replace(/\//g, path.sep)), 'utf8').trim() : head; } catch { return null; } }
function normalize(value: string): string { return value.replace(/\s+/g, ' ').trim().toLowerCase(); }

export { parseRunnerArgs };
