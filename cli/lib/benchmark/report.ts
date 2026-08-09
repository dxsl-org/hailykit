import { decideBenchmarkOutcome } from './decision-policy';
import type { PrivateHoldoutManifest } from './fixture-schema';
import { hashMarginIdentity } from './identity';
import { loadBenchmarkArtifact } from './legacy-reasoning';
import { computePairedStatistics } from './statistics';
import type { BenchmarkObservation } from './types';

export interface BenchmarkReportContext {
  holdoutManifest?: PrivateHoldoutManifest | null;
  holdoutArtifactText?: string | null;
  providerFootprintArtifactHash?: string | null;
  minimumEffectivePairs?: number;
}
export interface BenchmarkReport {
  schemaVersion: 2;
  decision: 'go' | 'no_go' | 'inconclusive';
  manifest: { hash: string; source: string; provider: string; requestedModel: string; provenance: string; fixtureSplits: string[] };
  rows: { total: number; measured: number; decisionEligible: number; completePairs: number; incompletePairs: number };
  quality: ReturnType<typeof computePairedStatistics> & { margin: number | null; status: string };
  safety: { status: string; criticalFlagCount: number; modelsVerified: boolean; judgeRequired: boolean; judgeCalibrated: boolean };
  efficiency: ReturnType<typeof computePairedStatistics> & { status: string };
  provenance: { providerFootprint: string; privateHoldout: string; calibrationComplete: boolean; marginIdentityValid: boolean; budget: unknown };
  reasons: string[];
  markdown: string;
}

export function buildBenchmarkReport(text: string, context: BenchmarkReportContext = {}): BenchmarkReport {
  const { manifest, observations } = loadBenchmarkArtifact(text);
  const qualityStats = computePairedStatistics(observations, 'outcomeScore');
  const efficiencyStats = computePairedStatistics(observations, 'totalTokens');
  const evaluations = observations.map(evaluationMeta).filter((entry): entry is EvaluationMeta => entry !== null);
  const eligibleRows = observations.filter((row) => row.decisionEligible);
  const evaluationCoverageComplete = eligibleRows.every((row) => evaluationMeta(row) !== null);
  const criticalFlagCount = evaluations.reduce((sum, entry) => sum + entry.criticalFlags.length, 0);
  const judgeRequired = !evaluationCoverageComplete || evaluations.some((entry) => !entry.deterministicComplete);
  const judgeCalibrated = evaluationCoverageComplete && (!judgeRequired || evaluations.filter((entry) => !entry.deterministicComplete).every((entry) => entry.judgeEvidence === 'calibrated'));
  const providerFootprint = manifest.legacy.providerFootprintArtifactHash && context.providerFootprintArtifactHash === manifest.legacy.providerFootprintArtifactHash
    ? 'complete'
    : 'inconclusive';
  const calibrationComplete = manifest.calibration.completedLiveBatches >= manifest.calibration.firstDecisionBatch;
  const marginIdentityValid = manifest.marginRegistry.identityHash === hashMarginIdentity(manifest);
  const observedHoldoutHash = context.holdoutManifest && context.holdoutArtifactText
    ? validatePrivateHoldoutArtifact(context.holdoutArtifactText, context.holdoutManifest)
    : null;
  const holdout = context.holdoutManifest && observedHoldoutHash ? { expectedHash: context.holdoutManifest.fixtureSetHash, observedHash: observedHoldoutHash, containsRawPrompts: context.holdoutManifest.containsRawPrompts } : null;
  const policy = decideBenchmarkOutcome({
    quality: qualityStats, efficiency: efficiencyStats,
    margin: { value: manifest.marginRegistry.threshold, frozen: manifest.marginRegistry.frozen, identityValid: marginIdentityValid },
    calibrationComplete, holdout, criticalFlagCount,
    modelsVerified: observations.filter((row) => row.provenance === 'live').every((row) => row.modelVerified && row.modelSatisfied),
    providerFootprint, judgeRequired, judgeCalibrated, minimumEffectivePairs: context.minimumEffectivePairs ?? 5,
  });
  const base = {
    schemaVersion: 2 as const, decision: policy.decision,
    manifest: { hash: escapeReportText(manifest.manifestHash), source: escapeReportText(manifest.source), provider: escapeReportText(manifest.providerLabel), requestedModel: escapeReportText(manifest.requestedModel), provenance: escapeReportText(manifest.provenance), fixtureSplits: fixtureSplits(observations) },
    rows: { total: observations.length, measured: observations.filter((row) => row.statusClass === 'measured').length, decisionEligible: observations.filter((row) => row.decisionEligible).length, completePairs: qualityStats.completePairs, incompletePairs: qualityStats.incompletePairs },
    quality: { ...qualityStats, margin: manifest.marginRegistry.threshold, status: policy.qualityStatus },
    safety: { status: criticalFlagCount ? 'fail' : judgeCalibrated ? 'pass' : 'inconclusive', criticalFlagCount, modelsVerified: observations.filter((row) => row.provenance === 'live').every((row) => row.modelVerified && row.modelSatisfied), judgeRequired, judgeCalibrated },
    efficiency: { ...efficiencyStats, status: policy.efficiencyStatus },
    provenance: { providerFootprint, privateHoldout: holdout ? (holdout.expectedHash === holdout.observedHash ? 'matched' : 'mismatch') : 'missing', calibrationComplete, marginIdentityValid, budget: workflowBudget(observations) },
    reasons: policy.reasons.map(escapeReportText),
  };
  return { ...base, markdown: renderBenchmarkMarkdown(base) };
}

function renderBenchmarkMarkdown(report: Omit<BenchmarkReport, 'markdown'>): string {
  return [
    '# HailyKit Benchmark Report', '', `Decision: \`${report.decision.toUpperCase()}\``, `Manifest: \`${report.manifest.hash}\``,
    `Source: \`${report.manifest.source}\` | Provider: \`${report.manifest.provider}\` | Model: \`${report.manifest.requestedModel}\` | Provenance: \`${report.manifest.provenance}\``,
    `Fixture splits: ${report.manifest.fixtureSplits.join(', ') || 'unrecorded'}`, `Rows: total=${report.rows.total} measured=${report.rows.measured} decisionEligible=${report.rows.decisionEligible} completePairs=${report.rows.completePairs} incompletePairs=${report.rows.incompletePairs}`, '',
    '## Quality', `- status: ${report.quality.status}`, `- registered margin: ${format(report.quality.margin)}`, `- mean delta: ${format(report.quality.meanDelta)}`, `- bootstrap ci95: ${range(report.quality.ci95)}`, `- effective pairs: ${report.quality.effectivePairs}`, `- permutation p: ${format(report.quality.permutationPValue)}`, `- flake rate: ${format(report.quality.flakeRate)}`, '',
    '## Safety', `- status: ${report.safety.status}`, `- critical flags: ${report.safety.criticalFlagCount}`, `- models verified: ${yesNo(report.safety.modelsVerified)}`, `- judge required/calibrated: ${yesNo(report.safety.judgeRequired)}/${yesNo(report.safety.judgeCalibrated)}`, '',
    '## Efficiency', `- status: ${report.efficiency.status}`, `- mean token delta: ${format(report.efficiency.meanDelta)}`, `- bootstrap ci95: ${range(report.efficiency.ci95)}`, `- descriptive only: ${yesNo(report.efficiency.descriptiveOnly)}`, '',
    '## Provenance', `- provider footprint: ${report.provenance.providerFootprint}`, `- private holdout: ${report.provenance.privateHoldout}`, `- calibration complete: ${yesNo(report.provenance.calibrationComplete)}`, `- margin identity valid: ${yesNo(report.provenance.marginIdentityValid)}`, `- budget: ${escapeReportText(JSON.stringify(report.provenance.budget ?? null))}`, '',
    '## Decision Reasons', ...(report.reasons.length ? report.reasons.map((reason) => `- ${reason}`) : ['- none']),
  ].join('\n');
}

interface EvaluationMeta { deterministicComplete: boolean; criticalFlags: string[]; judgeEvidence: string; }
function evaluationMeta(row: BenchmarkObservation): EvaluationMeta | null { const value = row.providerExtensions.evaluation; if (!value || typeof value !== 'object' || Array.isArray(value)) return null; const record = value as Record<string, unknown>; return { deterministicComplete: record.deterministicComplete === true, criticalFlags: Array.isArray(record.criticalFlags) ? record.criticalFlags.filter((entry): entry is string => typeof entry === 'string') : [], judgeEvidence: typeof record.judgeEvidence === 'string' ? record.judgeEvidence : 'none' }; }
function inferProviderFootprint(rows: BenchmarkObservation[]): 'complete' | 'inconclusive' { const providers = new Set(rows.flatMap((row) => { const value = row.providerExtensions.static; if (!value || typeof value !== 'object') return []; const provider = (value as Record<string, unknown>).provider; return provider === 'claude' || provider === 'codex' ? [provider] : []; })); return providers.has('claude') && providers.has('codex') ? 'complete' : 'inconclusive'; }
function fixtureSplits(rows: BenchmarkObservation[]): string[] { return [...new Set(rows.flatMap((row) => { const value = row.providerExtensions.evaluation; const split = value && typeof value === 'object' ? (value as Record<string, unknown>).fixtureSplit : null; return typeof split === 'string' ? [escapeReportText(split)] : []; }))]; }
function workflowBudget(rows: BenchmarkObservation[]): unknown { for (const row of rows) { const value = row.providerExtensions.workflow; if (value && typeof value === 'object' && !Array.isArray(value)) return (value as Record<string, unknown>).budget ?? null; } return null; }
function validatePrivateHoldoutArtifact(text: string, expected: PrivateHoldoutManifest): string {
  for (const line of text.split('\n').filter(Boolean)) assertNoRawPromptFields(JSON.parse(line));
  const artifact = loadBenchmarkArtifact(text);
  if (artifact.manifest.source !== 'benchmark_v2') throw new Error('private holdout artifact must use benchmark_v2');
  if (!['live', 'offline-score'].includes(artifact.manifest.provenance)) throw new Error('private holdout artifact provenance is not decision-grade');
  if (artifact.manifest.fixture.fixtureHash !== expected.fixtureSetHash) throw new Error('private holdout artifact fixture set does not match manifest');
  for (const row of artifact.observations) assertSafeHoldoutExtensions(row.providerExtensions);
  const fixtureIds = new Set(artifact.observations.map((row) => row.fixtureId));
  if (fixtureIds.size !== expected.promptCount) throw new Error('private holdout artifact prompt count does not match manifest');
  if (!artifact.observations.length || !artifact.observations.every(isPrivateHoldoutEvaluation)) {
    throw new Error('private holdout artifact requires evaluated private holdout rows');
  }
  return artifact.manifest.fixture.fixtureHash;
}
function isPrivateHoldoutEvaluation(row: BenchmarkObservation): boolean {
  const value = row.providerExtensions.evaluation;
  return row.statusClass === 'measured' && row.decisionEligible && Boolean(value && typeof value === 'object'
    && (value as Record<string, unknown>).fixtureSplit === 'private-hash-only-holdout');
}
function assertNoRawPromptFields(value: unknown): void {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (/^(prompt|rawPrompt|fixturePrompt|promptText)$/i.test(key) && typeof child === 'string' && child.trim()) {
      throw new Error('private holdout artifact contains a raw prompt field');
    }
    assertNoRawPromptFields(child);
  }
}
function assertSafeHoldoutExtensions(extensions: Record<string, unknown>): void {
  assertAllowedKeys(extensions, ['evaluation', 'outputDigest', 'workflow', 'appServer'], 'private holdout extensions');
  if (extensions.outputDigest !== undefined && !isOutputDigest(extensions.outputDigest)) throw new Error('private holdout outputDigest must be a hash');
  if (extensions.evaluation) {
    const evaluation = objectValue(extensions.evaluation, 'private holdout evaluation');
    assertAllowedKeys(evaluation, ['deterministicComplete', 'criticalFlags', 'failedChecks', 'scopeDrift', 'unnecessaryWork', 'judgeEvidence', 'fixtureSplit', 'fixtureMetadataHash'], 'private holdout evaluation');
  }
  if (extensions.workflow) {
    const workflow = objectValue(extensions.workflow, 'private holdout workflow');
    assertAllowedKeys(workflow, ['baseCommitSha', 'candidateCommitSha', 'budget', 'evaluatorEvidenceHash', 'createdAt', 'componentClass', 'cliVersion', 'configSnapshotHash', 'ablations', 'backend', 'treatmentBytes', 'treatmentDigest', 'treatmentFiles', 'treatmentFileCount', 'ablationCount', 'projectedSpendReserveUsd'], 'private holdout workflow');
    for (const key of ['baseCommitSha', 'candidateCommitSha', 'evaluatorEvidenceHash', 'configSnapshotHash', 'treatmentDigest']) {
      if (workflow[key] !== undefined && !isHash(workflow[key])) throw new Error(`private holdout workflow.${key} must be a hash`);
    }
    if (typeof workflow.componentClass !== 'string' || !/^[A-Za-z0-9._/-]{1,64}$/.test(workflow.componentClass)) throw new Error('private holdout componentClass is invalid');
    if (typeof workflow.cliVersion !== 'string' || !/^[A-Za-z0-9._() +:-]{1,80}$/.test(workflow.cliVersion)) throw new Error('private holdout cliVersion is invalid');
  }
  if (extensions.appServer) {
    const appServer = objectValue(extensions.appServer, 'private holdout appServer');
    assertAllowedKeys(appServer, ['modelProvider', 'protocol', 'contextCompactions'], 'private holdout appServer');
  }
}
function assertAllowedKeys(record: Record<string, unknown>, allowed: string[], name: string): void {
  const unexpected = Object.keys(record).filter((key) => !allowed.includes(key));
  if (unexpected.length) throw new Error(`${name} contains unapproved fields: ${unexpected.join(', ')}`);
}
function objectValue(value: unknown, name: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${name} must be an object`);
  return value as Record<string, unknown>;
}
function isHash(value: unknown): boolean { return typeof value === 'string' && /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i.test(value); }
function isOutputDigest(value: unknown): boolean { return isHash(value) || (typeof value === 'string' && /^sha256:[a-f0-9]{64}$/i.test(value)); }
export function escapeReportText(value: unknown): string { return String(value ?? '').replace(/\u001b\[[0-9;]*m/g, '').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/[`*_#[\]|]/g, '\\$&'); }
function yesNo(value: boolean): string { return value ? 'yes' : 'no'; }
function format(value: number | null): string { return value === null ? 'n/a' : Number(value.toFixed(4)).toString(); }
function range(value: [number, number] | null): string { return value ? `${format(value[0])}..${format(value[1])}` : 'n/a'; }
