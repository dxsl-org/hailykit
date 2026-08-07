import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseBenchmarkNdjson } from '../lib/benchmark/ndjson';
import { validateBenchmarkManifest } from '../lib/benchmark/schema';
import type { BenchmarkManifest } from '../lib/benchmark/types';

function manifest(overrides: Partial<BenchmarkManifest> = {}): BenchmarkManifest {
  return {
    v: 2,
    kind: 'benchmark_manifest',
    source: 'benchmark_v2',
    provider: 'codex',
    providerLabel: 'codex',
    tier: 'fast',
    requestedModel: 'gpt-5.4-mini',
    fixture: { fixtureId: 'fixture-a', fixtureClass: null, fixtureHash: 'fixture-hash', promptHash: 'prompt-hash', treatmentHash: 'treatment-hash', variant: 'legacy' },
    provenance: 'live',
    createdAt: '2026-08-07T00:00:00.000Z',
    manifestHash: 'manifest-hash',
    modelVerificationWaiver: false,
    marginRegistry: { metric: 'outcomeScore', threshold: 0.9, exploratoryBatches: 2, firstDecisionBatch: 3, frozen: true, frozenAt: '2026-08-07T00:00:00.000Z', identityHash: 'identity-hash' },
    calibration: { completedLiveBatches: 3, firstDecisionBatch: 3 },
    snapshot: null,
    legacy: { attemptedComplete: true, baselineEligible: true, commitSha: 'abc123', providerFootprintArtifactHash: null },
    ...overrides,
  };
}

function observation(metrics: Record<string, unknown>): string {
  return JSON.stringify({
    v: 2,
    kind: 'benchmark_observation',
    source: 'benchmark_v2',
    key: 'fixture-a#1',
    fixtureId: 'fixture-a',
    repeat: 1,
    provider: 'codex',
    providerLabel: 'codex',
    requestedModel: 'gpt-5.4-mini',
    actualModel: 'gpt-5.4-mini',
    modelSatisfied: true,
    modelVerified: true,
    modelVerificationSource: 'provider_echo',
    provenance: 'live',
    status: 'success',
    statusClass: 'measured',
    decisionEligible: true,
    decisionIneligibleReason: null,
    pairId: 'pair-1',
    blockId: 'block-1',
    arm: 'a',
    pairStatus: 'paired',
    fixture: manifest().fixture,
    manifestHash: 'manifest-hash',
    metrics,
    providerExtensions: {},
    legacy: {
      baselineEligible: true,
      attemptedComplete: true,
      actualPolicy: 'none',
      policySatisfied: true,
      coverage: 1,
      hardChecksPassed: 1,
      hardChecksTotal: 1,
      finalAnswer: null,
      note: null,
      commitSha: 'abc123',
      providerFootprintArtifactHash: null,
    },
  });
}

test('static and hook sources validate without pretending to be eval providers', () => {
  assert.equal(validateBenchmarkManifest(manifest({ source: 'static', provider: null, providerLabel: 'static' })).source, 'static');
  assert.equal(validateBenchmarkManifest(manifest({ source: 'hook', provider: null, providerLabel: 'hook' })).source, 'hook');
  assert.equal(validateBenchmarkManifest(manifest({ source: 'legacy_reasoning_v1', provider: null, providerLabel: 'gemini' })).providerLabel, 'gemini');
});

test('NDJSON parser rejects nested metric drift and bad JSON lines', () => {
  const brokenMetric = observation({
    outcomeLabel: 'pass',
    outcomeScore: 2,
    wallMs: 1,
    ttftMs: null,
    outputBytes: 1,
    tokens: {
      inputTokens: null,
      outputTokens: null,
      totalTokens: null,
      costUsd: null,
      cacheReadTokens: null,
      cacheWriteTokens: null,
      reasoningTokens: null,
      costSource: 'unknown',
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
  });
  assert.throws(() => parseBenchmarkNdjson(`${brokenMetric}\n`), /outcomeScore must be <= 1/);
  assert.throws(() => parseBenchmarkNdjson('not json\n'), /line 1 is not valid JSON/);
});
