import fs from 'node:fs';
import path from 'node:path';
import { validateInstalledArtifactSnapshot } from '../lib/benchmark/artifact-snapshot';
import { applyBenchmarkEvidence } from '../lib/benchmark/evidence-application';
import { runOfflineHookBenchmark } from '../lib/benchmark/hook-benchmark';
import { generateProviderInstallSnapshots } from '../lib/benchmark/installed-snapshots';
import { importLegacyReasoningNdjson } from '../lib/benchmark/legacy-reasoning';
import { stringifyBenchmarkNdjson, writeBenchmarkNdjson } from '../lib/benchmark/ndjson';
import { buildBenchmarkReport, type BenchmarkReport } from '../lib/benchmark/report';
import { createBenchmarkReportContext } from '../lib/benchmark/report-context';
import { collectStaticFootprint } from '../lib/benchmark/static-footprint';
import { buildWorkflowManifestHash, loadWorkflowFixtures, resolveWorkflowManifest, type WorkflowTreatmentManifest } from '../lib/benchmark/treatment-manifest';
import type { BenchmarkEvent, BenchmarkObservation, BenchmarkOutcome } from '../lib/benchmark/types';
import { buildWorkflowBenchmarkManifest, runWorkflowBenchmark } from '../lib/benchmark/workflow-runner';
import { assertWorkflowProviderPreflight, expectedWorkflowProviderConfigHash, runLiveWorkflowProvider } from '../lib/benchmark/workflow-provider';
import { hashMarginIdentity } from '../lib/benchmark/identity';
import { emit, fail, ok, type Envelope } from '../lib/json-output';

export interface BenchmarkCommandContext { positionals: string[]; options: Record<string, string | boolean>; }

export async function cmdBenchmark(ctx: BenchmarkCommandContext): Promise<number> {
  const action = ctx.positionals[0];
  const json = ctx.options.json === true;
  try {
    switch (action) {
      case 'static':
        return emitArtifact('benchmark-static', staticArtifact(ctx), ctx);
      case 'hooks':
        return emitArtifact('benchmark-hooks', runOfflineHookBenchmark(repo(ctx)), ctx);
      case 'import-reasoning':
        return emitArtifact('benchmark-import-reasoning', importLegacyReasoningNdjson(readRequired(ctx, 1)), ctx);
      case 'plan':
        return emitPlan(ctx);
      case 'run':
        return emitArtifact('benchmark-run', await runArtifact(ctx), ctx);
      case 'compare':
        return emitReportEnvelope('benchmark-compare', reportFromContext(readRequired(ctx, 1), ctx), json);
      case 'report':
        return emitRenderedReport(reportFromContext(readRequired(ctx, 1), ctx), ctx);
      default:
        throw new Error('usage: hailykit benchmark <static|hooks|plan|run|compare|report|import-reasoning>');
    }
  } catch (error) {
    emit(fail('benchmark', error instanceof Error ? error.message : String(error)), json, (env) => console.error(env.data.error));
    return 1;
  }
}

function staticArtifact(ctx: BenchmarkCommandContext) {
  const claudePath = opt(ctx, 'claude-snapshot');
  const codexPath = opt(ctx, 'codex-snapshot');
  if (claudePath || codexPath) {
    return collectStaticFootprint({
      repoRoot: repo(ctx),
      baseRef: opt(ctx, 'base-ref'),
      claudeSnapshot: loadSnapshot(claudePath),
      codexSnapshot: loadSnapshot(codexPath),
    });
  }
  const generated = generateProviderInstallSnapshots(repo(ctx));
  try {
    return collectStaticFootprint({
      repoRoot: repo(ctx),
      baseRef: opt(ctx, 'base-ref'),
      claudeSnapshot: generated.claude,
      codexSnapshot: generated.codex,
    });
  } finally {
    generated.cleanup();
  }
}

async function runArtifact(ctx: BenchmarkCommandContext) {
  const manifestPath = requiredPath(ctx, 1);
  const manifest = readJson<WorkflowTreatmentManifest>(manifestPath);
  const live = ctx.options.live === true;
  if (live && ctx.options['ack-budget'] !== true) throw new Error('live benchmark run requires --ack-budget');
  if (live !== manifest.liveEquivalent || (manifest.provenance === 'live') !== live) throw new Error('CLI --live must match manifest liveEquivalent and provenance=live');
  if (live) assertWorkflowProviderPreflight(repo(ctx), resolveWorkflowManifest(repo(ctx), manifest));
  const responses = live ? null : readJson<Record<string, unknown>>(requiredOption(ctx, 'responses'));
  const artifact = await runWorkflowBenchmark(repo(ctx), manifest, { runTrial: live ? runLiveWorkflowProvider : (request) => syntheticResponse(responses!, request.fixture.fixtureId, request.pairId, request.arm) });
  const observations = applyBenchmarkEvidence(opt(ctx, 'evidence') ?? null, manifest, artifact.observations);
  const text = stringifyBenchmarkNdjson([artifact.manifest, ...observations]);
  const report = buildBenchmarkReport(text);
  const outcome: BenchmarkOutcome = { v: 2, kind: 'benchmark_outcome', source: 'benchmark_v2', decision: report.decision, reasons: report.reasons, observedMeanScore: report.quality.meanDelta, threshold: report.quality.margin, comparedRows: report.quality.completePairs };
  return { manifest: artifact.manifest, observations, outcome };
}

function syntheticResponse(rows: Record<string, unknown>, fixtureId: string, pairId: string, arm: string) {
  const repeat = pairId.split('#').pop();
  const key = `${fixtureId}#${repeat}#${arm}`;
  const value = rows[key];
  if (!value) throw new Error(`missing synthetic response for ${key}`);
  return value as never;
}

function emitPlan(ctx: BenchmarkCommandContext): number {
  const resolved = resolveWorkflowManifest(repo(ctx), readJson<WorkflowTreatmentManifest>(requiredPath(ctx, 1)));
  const fixtures = loadWorkflowFixtures(resolved);
  const manifestHash = buildWorkflowManifestHash(resolved, fixtures);
  const benchmarkManifest = buildWorkflowBenchmarkManifest(resolved, fixtures, manifestHash, new Date().toISOString());
  return emitSimple(
    'benchmark-plan',
    {
      baseCommitSha: resolved.baseCommitSha,
      candidateCommitSha: resolved.candidateCommitSha,
      projectedCalls: resolved.budget.projectedCalls,
      projectedSpendUsd: resolved.budget.projectedSpendUsd,
      liveEquivalent: resolved.liveEquivalent,
      fixtureRoot: path.basename(resolved.fixtureRoot),
      evaluatorEvidenceHash: resolved.evaluatorEvidenceHash,
      manifestHash,
      expectedMarginIdentity: hashMarginIdentity(benchmarkManifest),
      expectedConfigSnapshotHash: expectedWorkflowProviderConfigHash(resolved),
    },
    ctx.options.json === true,
  );
}

function reportFromContext(text: string, ctx: BenchmarkCommandContext): BenchmarkReport {
  return buildBenchmarkReport(text, createBenchmarkReportContext(ctx.options));
}
function emitArtifact(tool: string, artifact: { manifest?: unknown; observations: unknown[]; outcome?: unknown }, ctx: BenchmarkCommandContext): number {
  const events = [artifact.manifest, ...artifact.observations, artifact.outcome].filter(Boolean) as BenchmarkEvent[];
  const out = opt(ctx, 'out');
  if (out) writeBenchmarkNdjson(path.resolve(out), events);
  return emitSimple(
    tool,
    {
      out: out ? path.basename(out) : null,
      manifestHash: String((artifact.manifest as { manifestHash?: string })?.manifestHash ?? ''),
      rows: artifact.observations.length,
    },
    ctx.options.json === true,
  );
}
function emitRenderedReport(report: BenchmarkReport, ctx: BenchmarkCommandContext): number {
  const format = opt(ctx, 'format') || (ctx.options.json === true ? 'json' : 'md');
  if (format !== 'json' && format !== 'md') throw new Error('--format must be md or json');
  const payload = format === 'json' ? JSON.stringify(report, null, 2) : `${report.markdown}\n`;
  const out = opt(ctx, 'out');
  if (out) fs.writeFileSync(path.resolve(out), payload, 'utf8');
  else process.stdout.write(payload);
  return 0;
}
function emitReportEnvelope(tool: string, report: BenchmarkReport, json: boolean): number {
  emit(ok(tool, report), json, (env: Envelope<BenchmarkReport>) => console.log(env.data.markdown));
  return 0;
}
function emitSimple<T>(tool: string, data: T, json: boolean): number {
  emit(ok(tool, data), json, (env) => console.log(JSON.stringify(env.data, null, 2)));
  return 0;
}
function loadSnapshot(filePath: string | undefined) {
  return filePath ? validateInstalledArtifactSnapshot(readJson(path.resolve(filePath))) : null;
}
function readRequired(ctx: BenchmarkCommandContext, index: number): string {
  return fs.readFileSync(requiredPath(ctx, index), 'utf8');
}
function requiredPath(ctx: BenchmarkCommandContext, index: number): string {
  const filePath = ctx.positionals[index];
  if (!filePath) throw new Error('benchmark input path is required');
  return path.resolve(filePath);
}
function requiredOption(ctx: BenchmarkCommandContext, key: string): string {
  const value = opt(ctx, key);
  if (!value) throw new Error(`benchmark requires --${key}`);
  return path.resolve(value);
}
function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}
function opt(ctx: BenchmarkCommandContext, key: string): string | undefined {
  const value = ctx.options[key];
  return typeof value === 'string' && value.trim() ? value : undefined;
}
function repo(ctx: BenchmarkCommandContext): string {
  const positional = ctx.positionals[0] === 'static' || ctx.positionals[0] === 'hooks'
    ? ctx.positionals[1]
    : undefined;
  return path.resolve(opt(ctx, 'repo') ?? positional ?? '.');
}
export { buildBenchmarkReport } from '../lib/benchmark/report';
