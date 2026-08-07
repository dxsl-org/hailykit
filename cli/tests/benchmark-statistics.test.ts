import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decideBenchmarkOutcome, type DecisionPolicyInput } from '../lib/benchmark/decision-policy';
import { computePairedStatistics } from '../lib/benchmark/statistics';
import type { BenchmarkObservation } from '../lib/benchmark/types';

function row(pairId: string, arm: 'base' | 'candidate', score: number, tokens: number, options: { fixtureId?: string; provider?: 'codex' | 'claude'; eligible?: boolean; output?: string; pairStatus?: BenchmarkObservation['pairStatus'] } = {}): BenchmarkObservation {
  const provider = options.provider ?? 'codex';
  const fixtureId = options.fixtureId ?? pairId;
  return {
    v: 2, kind: 'benchmark_observation', source: 'benchmark_v2', key: `${pairId}:${arm}`, fixtureId, repeat: 1,
    provider, providerLabel: provider, requestedModel: provider === 'codex' ? 'gpt-5.4-mini' : 'claude-sonnet', actualModel: provider === 'codex' ? 'gpt-5.4-mini' : 'claude-sonnet',
    modelSatisfied: true, modelVerified: true, modelVerificationSource: 'provider_echo', provenance: 'live', status: 'success', statusClass: 'measured',
    decisionEligible: options.eligible ?? true, decisionIneligibleReason: null, pairId, blockId: pairId, arm, pairStatus: options.pairStatus ?? 'paired',
    fixture: { fixtureId, fixtureClass: 'workflow', fixtureHash: `fh:${fixtureId}`, promptHash: `ph:${fixtureId}`, treatmentHash: 'th', variant: null }, manifestHash: 'manifest',
    metrics: { outcomeLabel: score === 1 ? 'pass' : 'fail', outcomeScore: score, wallMs: 10, ttftMs: null, outputBytes: 20, tokens: { inputTokens: 1, outputTokens: 2, totalTokens: tokens, costUsd: 0.1, cacheReadTokens: null, cacheWriteTokens: null, reasoningTokens: null, costSource: 'provider' }, contextOccupancy: null, contextCompactionBytes: null, toolCalls: 0, toolErrors: 0, toolRetries: 0, approvals: 0, subagentCount: 0, subagentDepth: 0, hookCalls: 0, hookLatencyMs: null, hookContextBytes: null },
    providerExtensions: { outputDigest: options.output ?? `${pairId}:${arm}` }, legacy: { baselineEligible: null, attemptedComplete: true, actualPolicy: 'read_only', policySatisfied: true, coverage: null, hardChecksPassed: null, hardChecksTotal: null, finalAnswer: null, note: null, commitSha: 'abc', providerFootprintArtifactHash: null },
  };
}
function pairs(values: Array<[number, number, number, number]>): BenchmarkObservation[] {
  return values.flatMap(([baseScore, candidateScore, baseTokens, candidateTokens], index) => {
    const id = `p${index + 1}`;
    return [row(id, 'base', baseScore, baseTokens), row(id, 'candidate', candidateScore, candidateTokens)];
  });
}
function policy(quality = computePairedStatistics(pairs([[1, 1, 100, 80], [1, 1, 110, 85], [1, 1, 90, 70]]), 'outcomeScore'), efficiency = computePairedStatistics(pairs([[1, 1, 100, 80], [1, 1, 110, 85], [1, 1, 90, 70]]), 'totalTokens'), overrides: Partial<DecisionPolicyInput> = {}): DecisionPolicyInput {
  return { quality, efficiency, margin: { value: 0.1, frozen: true, identityValid: true }, calibrationComplete: true, holdout: { expectedHash: 'holdout', observedHash: 'holdout', containsRawPrompts: false }, criticalFlagCount: 0, modelsVerified: true, providerFootprint: 'complete', judgeRequired: false, judgeCalibrated: false, minimumEffectivePairs: 2, ...overrides };
}

test('fixture-block bootstrap and paired permutation are deterministic', () => {
  const rows = pairs([[1, 1, 100, 80], [0, 1, 100, 90], [1, 1, 90, 70]]);
  const first = computePairedStatistics(rows, 'outcomeScore', { seed: 42, iterations: 500 });
  const second = computePairedStatistics(rows, 'outcomeScore', { seed: 42, iterations: 500 });
  assert.deepEqual(first.ci95, second.ci95);
  assert.equal(first.completePairs, 3);
  assert.equal(first.effectivePairs, 3);
  assert.ok(first.permutationPValue !== null);
});

test('decision policy returns GO only after quality and efficiency confidence gates', () => {
  assert.equal(decideBenchmarkOutcome(policy()).decision, 'go');
  assert.equal(decideBenchmarkOutcome(policy(undefined, undefined, { holdout: null })).decision, 'inconclusive');
  assert.equal(decideBenchmarkOutcome(policy(undefined, undefined, { calibrationComplete: false })).decision, 'inconclusive');
});

test('proven quality regression and critical safety flags return NO-GO', () => {
  const quality = computePairedStatistics(pairs([[1, 0, 100, 70], [1, 0, 100, 70], [1, 0, 100, 70]]), 'outcomeScore');
  const efficiency = computePairedStatistics(pairs([[1, 1, 100, 70], [1, 1, 100, 70], [1, 1, 100, 70]]), 'totalTokens');
  assert.equal(decideBenchmarkOutcome(policy(quality, efficiency)).decision, 'no_go');
  assert.equal(decideBenchmarkOutcome(policy(undefined, undefined, { criticalFlagCount: 1 })).decision, 'no_go');
});

test('incomplete, degenerate, and cross-provider evidence cannot produce GO', () => {
  const incompleteRows = [row('p1', 'base', 1, 100), row('p1', 'candidate', 1, 80, { eligible: false, pairStatus: 'missing_pair' })];
  const incomplete = computePairedStatistics(incompleteRows, 'outcomeScore');
  assert.equal(decideBenchmarkOutcome(policy(incomplete)).decision, 'inconclusive');
  const repeated = [row('r1', 'base', 1, 100, { fixtureId: 'same', output: 'same' }), row('r1', 'candidate', 1, 90, { fixtureId: 'same', output: 'same' }), row('r2', 'base', 1, 100, { fixtureId: 'same', output: 'same' }), row('r2', 'candidate', 1, 90, { fixtureId: 'same', output: 'same' })];
  assert.equal(computePairedStatistics(repeated, 'outcomeScore').degenerateRepeats, true);
  const cross = computePairedStatistics([row('x', 'base', 1, 100, { provider: 'codex' }), row('x', 'candidate', 1, 70, { provider: 'claude' })], 'totalTokens');
  assert.equal(cross.descriptiveOnly, true);
  assert.equal(decideBenchmarkOutcome(policy(undefined, cross)).decision, 'inconclusive');
});
