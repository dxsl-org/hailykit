import type { BenchmarkLegacyFields, BenchmarkMeasuredProviderMetrics, BenchmarkMetrics, BenchmarkObservation, BenchmarkOutcome } from './types';
import { BENCHMARK_MODEL_SOURCES, BENCHMARK_OUTCOME_LABELS, BENCHMARK_PAIR_STATUSES, BENCHMARK_PROVENANCE, BENCHMARK_STATUSES, BENCHMARK_STATUS_CLASSES, assertKeys, asRecord, optNonNegative, optString, reqBoolean, reqEnum, reqInt, reqNonNegative, reqString } from './schema-helpers';

const TOKEN_KEYS = ['inputTokens', 'outputTokens', 'totalTokens', 'costUsd', 'cacheReadTokens', 'cacheWriteTokens', 'reasoningTokens', 'costSource'] as const;
const METRIC_KEYS = ['outcomeLabel', 'outcomeScore', 'wallMs', 'ttftMs', 'outputBytes', 'tokens', 'contextOccupancy', 'contextCompactionBytes', 'toolCalls', 'toolErrors', 'toolRetries', 'approvals', 'subagentCount', 'subagentDepth', 'hookCalls', 'hookLatencyMs', 'hookContextBytes'] as const;
const LEGACY_KEYS = ['baselineEligible', 'attemptedComplete', 'actualPolicy', 'policySatisfied', 'coverage', 'hardChecksPassed', 'hardChecksTotal', 'finalAnswer', 'note', 'commitSha', 'providerFootprintArtifactHash'] as const;
const OUTCOME_KEYS = ['v', 'kind', 'source', 'decision', 'reasons', 'observedMeanScore', 'threshold', 'comparedRows'] as const;

export function validateMetrics(value: unknown): BenchmarkMetrics {
  const record = asRecord(value, 'metrics');
  assertKeys(record, METRIC_KEYS, 'metrics');
  return {
    outcomeLabel: reqEnum(record.outcomeLabel, BENCHMARK_OUTCOME_LABELS, 'metrics.outcomeLabel'),
    outcomeScore: record.outcomeScore === null ? null : boundedScore(record.outcomeScore, 'metrics.outcomeScore'),
    ...validateMeasuredProviderMetrics(record),
  };
}

export function validateMeasuredProviderMetrics(value: Record<string, unknown>): BenchmarkMeasuredProviderMetrics {
  return {
    wallMs: optNonNegative(value.wallMs, 'metrics.wallMs'),
    ttftMs: optNonNegative(value.ttftMs, 'metrics.ttftMs'),
    outputBytes: optNonNegative(value.outputBytes, 'metrics.outputBytes'),
    tokens: validateTokens(value.tokens),
    contextOccupancy: optNonNegative(value.contextOccupancy, 'metrics.contextOccupancy'),
    contextCompactionBytes: optNonNegative(value.contextCompactionBytes, 'metrics.contextCompactionBytes'),
    toolCalls: optNonNegative(value.toolCalls, 'metrics.toolCalls'),
    toolErrors: optNonNegative(value.toolErrors, 'metrics.toolErrors'),
    toolRetries: optNonNegative(value.toolRetries, 'metrics.toolRetries'),
    approvals: optNonNegative(value.approvals, 'metrics.approvals'),
    subagentCount: value.subagentCount === null ? null : reqInt(value.subagentCount, 'metrics.subagentCount'),
    subagentDepth: value.subagentDepth === null ? null : reqInt(value.subagentDepth, 'metrics.subagentDepth'),
    hookCalls: optNonNegative(value.hookCalls, 'metrics.hookCalls'),
    hookLatencyMs: optNonNegative(value.hookLatencyMs, 'metrics.hookLatencyMs'),
    hookContextBytes: optNonNegative(value.hookContextBytes, 'metrics.hookContextBytes'),
  };
}

export function validateObservationLegacy(value: unknown): BenchmarkLegacyFields {
  const record = asRecord(value, 'legacy');
  assertKeys(record, LEGACY_KEYS, 'legacy');
  return {
    baselineEligible: record.baselineEligible === null ? null : reqBoolean(record.baselineEligible, 'legacy.baselineEligible'),
    attemptedComplete: record.attemptedComplete === null ? null : reqBoolean(record.attemptedComplete, 'legacy.attemptedComplete'),
    actualPolicy: record.actualPolicy === null ? null : reqEnum(record.actualPolicy, ['none', 'read_only'], 'legacy.actualPolicy') as BenchmarkLegacyFields['actualPolicy'],
    policySatisfied: record.policySatisfied === null ? null : reqBoolean(record.policySatisfied, 'legacy.policySatisfied'),
    coverage: record.coverage === null ? null : boundedScore(record.coverage, 'legacy.coverage'),
    hardChecksPassed: record.hardChecksPassed === null ? null : reqInt(record.hardChecksPassed, 'legacy.hardChecksPassed'),
    hardChecksTotal: record.hardChecksTotal === null ? null : reqInt(record.hardChecksTotal, 'legacy.hardChecksTotal'),
    finalAnswer: optString(record.finalAnswer, 'legacy.finalAnswer'),
    note: optString(record.note, 'legacy.note'),
    commitSha: optString(record.commitSha, 'legacy.commitSha'),
    providerFootprintArtifactHash: record.providerFootprintArtifactHash === null || record.providerFootprintArtifactHash === undefined
      ? null
      : reqString(record.providerFootprintArtifactHash, 'legacy.providerFootprintArtifactHash'),
  };
}

export function validateObservationEnums(record: Record<string, unknown>): Pick<BenchmarkObservation, 'provenance' | 'status' | 'statusClass' | 'modelVerificationSource' | 'pairStatus'> {
  return {
    provenance: reqEnum(record.provenance, BENCHMARK_PROVENANCE, 'benchmark observation.provenance'),
    status: reqEnum(record.status, BENCHMARK_STATUSES, 'benchmark observation.status'),
    statusClass: reqEnum(record.statusClass, BENCHMARK_STATUS_CLASSES, 'benchmark observation.statusClass'),
    modelVerificationSource: reqEnum(record.modelVerificationSource, BENCHMARK_MODEL_SOURCES, 'benchmark observation.modelVerificationSource'),
    pairStatus: reqEnum(record.pairStatus, BENCHMARK_PAIR_STATUSES, 'benchmark observation.pairStatus'),
  };
}

export function validateBenchmarkOutcome(value: unknown): BenchmarkOutcome {
  const record = asRecord(value, 'benchmark outcome');
  assertKeys(record, OUTCOME_KEYS, 'benchmark outcome');
  if (!Array.isArray(record.reasons) || record.reasons.some((entry) => typeof entry !== 'string')) throw new Error('benchmark outcome.reasons must be a string array');
  return {
    v: 2,
    kind: 'benchmark_outcome',
    source: reqEnum(record.source, ['benchmark_v2', 'legacy_reasoning_v1', 'static', 'hook'], 'benchmark outcome.source'),
    decision: reqEnum(record.decision, ['go', 'no_go', 'inconclusive'], 'benchmark outcome.decision'),
    reasons: record.reasons as string[],
    observedMeanScore: record.observedMeanScore === null ? null : boundedScore(record.observedMeanScore, 'benchmark outcome.observedMeanScore'),
    threshold: record.threshold === null ? null : boundedScore(record.threshold, 'benchmark outcome.threshold'),
    comparedRows: reqInt(record.comparedRows, 'benchmark outcome.comparedRows'),
  };
}

function validateTokens(value: unknown): BenchmarkMetrics['tokens'] {
  const record = asRecord(value, 'metrics.tokens');
  assertKeys(record, TOKEN_KEYS, 'metrics.tokens');
  return {
    inputTokens: optNonNegative(record.inputTokens, 'metrics.tokens.inputTokens'),
    outputTokens: optNonNegative(record.outputTokens, 'metrics.tokens.outputTokens'),
    totalTokens: optNonNegative(record.totalTokens, 'metrics.tokens.totalTokens'),
    costUsd: optNonNegative(record.costUsd, 'metrics.tokens.costUsd'),
    cacheReadTokens: optNonNegative(record.cacheReadTokens, 'metrics.tokens.cacheReadTokens'),
    cacheWriteTokens: optNonNegative(record.cacheWriteTokens, 'metrics.tokens.cacheWriteTokens'),
    reasoningTokens: optNonNegative(record.reasoningTokens, 'metrics.tokens.reasoningTokens'),
    costSource: reqEnum(record.costSource, ['provider', 'derived', 'unknown'], 'metrics.tokens.costSource'),
  };
}

function boundedScore(value: unknown, name: string): number {
  const score = reqNonNegative(value, name);
  if (score > 1) throw new Error(`${name} must be <= 1`);
  return score;
}
