import { decisionEligibilityReason, evaluateBenchmarkOutcome, hashBenchmarkIdentity } from './identity';
import { parseBenchmarkNdjson } from './ndjson';
import type { BenchmarkEvent, BenchmarkManifest, BenchmarkObservation } from './types';
import type { RunnerManifest, RunnerRow } from '../reasoning-harness/types';

export function importLegacyReasoningNdjson(text: string): { manifest: BenchmarkManifest; observations: BenchmarkObservation[]; outcome: BenchmarkEvent } {
  const [rawManifest, ...rawRows] = text.trim().split('\n').filter(Boolean).map((line) => JSON.parse(line) as RunnerManifest | RunnerRow);
  if (rawManifest.kind !== 'manifest') throw new Error('legacy reasoning artifact must start with a manifest');
  const draftManifest = convertManifest(rawManifest, []);
  const observations = rawRows.filter(isRunnerRow).map((row) => convertRow(rawManifest, draftManifest, row));
  const manifest = convertManifest(rawManifest, observations);
  return { manifest, observations, outcome: evaluateBenchmarkOutcome(manifest, observations) };
}

export function loadBenchmarkArtifact(text: string): { manifest: BenchmarkManifest; observations: BenchmarkObservation[] } {
  const first = JSON.parse(text.trim().split('\n').find(Boolean) ?? 'null') as { v?: number; kind?: string } | null;
  if (first?.v === 1 && first.kind === 'manifest') return importLegacyReasoningNdjson(text);
  const events = parseBenchmarkNdjson(text);
  if (events[0]?.kind === 'benchmark_manifest') {
    return {
      manifest: events[0] as BenchmarkManifest,
      observations: events.filter((entry): entry is BenchmarkObservation => entry.kind === 'benchmark_observation'),
    };
  }
  throw new Error('benchmark artifact must begin with a benchmark manifest');
}

function convertManifest(manifest: RunnerManifest, observations: BenchmarkObservation[]): BenchmarkManifest {
  const provider = manifest.provider === 'claude' || manifest.provider === 'codex' ? manifest.provider : null;
  const attemptedComplete = completedKeys(manifest, observations);
  const baselineEligible = attemptedComplete && observations.every((entry) => entry.legacy.baselineEligible === true);
  return {
    v: 2,
    kind: 'benchmark_manifest',
    source: 'legacy_reasoning_v1',
    provider,
    providerLabel: manifest.provider,
    tier: manifest.tier,
    requestedModel: manifest.requestedModel,
    fixture: {
      fixtureId: manifest.fixtureIds[0] ?? 'legacy-fixture-set',
      fixtureClass: null,
      fixtureHash: manifest.fixtureHash,
      promptHash: manifest.promptDigest,
      treatmentHash: manifest.variantHash,
      variant: manifest.variant,
    },
    provenance: manifest.executionMode === 'dry-run' ? 'dry-run' : manifest.executionMode,
    createdAt: manifest.createdAt,
    manifestHash: hashBenchmarkIdentity({
      source: 'legacy_reasoning_v1',
      providerLabel: manifest.provider,
      tier: manifest.tier,
      fixtureHash: manifest.fixtureHash,
      promptHash: manifest.promptDigest,
      treatmentHash: manifest.variantHash,
      requestedModel: manifest.requestedModel,
      provenance: manifest.executionMode === 'dry-run' ? 'dry-run' : manifest.executionMode,
    }),
    modelVerificationWaiver: false,
    marginRegistry: { metric: 'outcomeScore', threshold: 1, exploratoryBatches: 2, firstDecisionBatch: 3, frozen: false, frozenAt: null, identityHash: 'legacy-unfrozen' },
    calibration: { completedLiveBatches: 0, firstDecisionBatch: 3 },
    snapshot: null,
    legacy: { attemptedComplete, baselineEligible, commitSha: manifest.commitSha, providerFootprintArtifactHash: null },
  };
}

function convertRow(rawManifest: RunnerManifest, manifest: BenchmarkManifest, row: RunnerRow): BenchmarkObservation {
  const modelVerified = row.modelId !== null;
  const reason = decisionEligibilityReason({
    provenance: manifest.provenance,
    statusClass: isMeasuredStatus(row.status) ? 'measured' : 'unmeasured',
    modelSatisfied: row.modelSatisfied,
    modelVerified,
  });
  return {
    v: 2,
    kind: 'benchmark_observation',
    source: 'legacy_reasoning_v1',
    key: row.key,
    fixtureId: row.fixtureId,
    repeat: row.repeat,
    provider: manifest.provider,
    providerLabel: rawManifest.provider,
    requestedModel: rawManifest.requestedModel,
    actualModel: row.modelId,
    modelSatisfied: row.modelSatisfied,
    modelVerified,
    modelVerificationSource: modelVerified ? 'provider_echo' : rawManifest.provider === 'claude' ? 'legacy_missing' : 'unknown',
    provenance: manifest.provenance,
    status: row.status,
    statusClass: isMeasuredStatus(row.status) ? 'measured' : 'unmeasured',
    decisionEligible: reason === null,
    decisionIneligibleReason: reason,
    pairId: null,
    blockId: null,
    arm: rawManifest.variant,
    pairStatus: 'unpaired',
    fixture: manifest.fixture,
    manifestHash: manifest.manifestHash,
    metrics: {
      outcomeLabel: row.weightedScore === 1 ? 'pass' : row.weightedScore === 0 ? 'fail' : 'not_measured',
      outcomeScore: row.weightedScore,
      wallMs: row.latencyMs,
      ttftMs: null,
      outputBytes: row.outputBytes,
      tokens: {
        inputTokens: row.usage.inputTokens ?? null,
        outputTokens: row.usage.outputTokens ?? null,
        totalTokens: row.usage.totalTokens ?? null,
        costUsd: row.usage.costUsd ?? null,
        cacheReadTokens: null,
        cacheWriteTokens: null,
        reasoningTokens: null,
        costSource: row.usage.costUsd === null ? 'unknown' : 'provider',
      },
      contextOccupancy: null,
      contextCompactionBytes: null,
      toolCalls: null,
      toolErrors: null,
      toolRetries: null,
      approvals: null,
      subagentCount: null,
      subagentDepth: null,
      hookCalls: null,
      hookLatencyMs: null,
      hookContextBytes: null,
    },
    providerExtensions: {},
    legacy: {
      baselineEligible: row.baselineEligible,
      attemptedComplete: null,
      actualPolicy: row.actualPolicy,
      policySatisfied: row.policySatisfied,
      coverage: row.coverage,
      hardChecksPassed: row.hardChecksPassed,
      hardChecksTotal: row.hardChecksTotal,
      finalAnswer: row.finalAnswer,
      note: row.note,
      commitSha: row.commitSha,
      providerFootprintArtifactHash: null,
    },
  };
}

function isMeasuredStatus(status: RunnerRow['status']): boolean {
  return status === 'success' || status === 'parse_failure' || status === 'truncation';
}

function isRunnerRow(value: RunnerManifest | RunnerRow): value is RunnerRow {
  return value.kind === 'row';
}

function completedKeys(manifest: RunnerManifest, observations: BenchmarkObservation[]): boolean {
  if (observations.length !== manifest.expectedKeys.length) return false;
  const seen = new Set(observations.map((entry) => entry.key));
  return seen.size === observations.length && manifest.expectedKeys.every((key) => seen.has(key));
}
