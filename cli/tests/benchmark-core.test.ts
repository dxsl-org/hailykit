import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { evaluateBenchmarkOutcome, hashMarginIdentity } from '../lib/benchmark/identity';
import { importLegacyReasoningNdjson } from '../lib/benchmark/legacy-reasoning';
import { parseBenchmarkNdjson } from '../lib/benchmark/ndjson';
import { validateBenchmarkObservation } from '../lib/benchmark/schema';
import { writeBenchmarkNdjson } from '../lib/benchmark/ndjson';
import { resolveModelVerification } from '../lib/benchmark/provider-contract';
import type { BenchmarkManifest, BenchmarkObservation } from '../lib/benchmark/types';

function tmp(): string { return fs.mkdtempSync(path.join(os.tmpdir(), 'benchmark-core-')); }

function manifest(overrides: Partial<BenchmarkManifest> = {}): BenchmarkManifest {
  const base: BenchmarkManifest = {
    v: 2,
    kind: 'benchmark_manifest',
    source: 'benchmark_v2',
    provider: 'codex',
    providerLabel: 'codex',
    tier: 'fast',
    requestedModel: 'gpt-5.4-mini',
    fixture: {
      fixtureId: 'fixture-a',
      fixtureClass: 'evidence_trap',
      fixtureHash: 'fixture-hash',
      promptHash: 'prompt-hash',
      treatmentHash: 'treatment-hash',
      variant: 'legacy',
    },
    provenance: 'live',
    createdAt: '2026-08-07T00:00:00.000Z',
    manifestHash: 'manifest-hash',
    modelVerificationWaiver: false,
    marginRegistry: { metric: 'outcomeScore', threshold: 0.9, exploratoryBatches: 2, firstDecisionBatch: 3, frozen: true, frozenAt: '2026-08-07T00:00:00.000Z', identityHash: '' },
    calibration: { completedLiveBatches: 3, firstDecisionBatch: 3 },
    snapshot: null,
    legacy: { attemptedComplete: true, baselineEligible: true, commitSha: 'abc123' },
  };
  base.marginRegistry.identityHash = hashMarginIdentity(base);
  return { ...base, ...overrides };
}

function observation(overrides: Partial<BenchmarkObservation> = {}): BenchmarkObservation {
  const baseManifest = manifest();
  return {
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
    arm: 'legacy',
    pairStatus: 'paired',
    fixture: baseManifest.fixture,
    manifestHash: baseManifest.manifestHash,
    metrics: {
      outcomeLabel: 'pass',
      outcomeScore: 1,
      wallMs: 20,
      ttftMs: null,
      outputBytes: 120,
      tokens: { inputTokens: 1, outputTokens: 2, totalTokens: 3, costUsd: null, cacheReadTokens: null, cacheWriteTokens: null, reasoningTokens: null, costSource: 'unknown' },
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
    },
    ...overrides,
  };
}

test('schema rejects unknown fields and invalid dry-run eligibility', () => {
  assert.throws(() => validateBenchmarkObservation({ ...observation(), extraField: true }), /unknown fields/);
  assert.throws(() => validateBenchmarkObservation({ ...observation(), provenance: 'dry-run', decisionEligible: true }), /decision-eligible/);
});

test('legacy importer preserves eligibility and identity hashes without fabricating usage', () => {
  const text = [
    JSON.stringify({
      v: 1, kind: 'manifest', provider: 'claude', tier: 'fast', requestedModel: 'claude-haiku',
      variant: 'legacy', repeats: 1, commitSha: 'abc123', fixtureDir: 'fixtures', fixtureIds: ['fixture-a'],
      fixtureHash: 'fixture-hash', variantHash: 'variant-hash', promptDigest: 'prompt-hash', manifestHash: 'legacy-hash',
      expectedKeys: ['fixture-a#1'], createdAt: '2026-08-07T00:00:00.000Z', executionMode: 'live', offlineSourceHash: null,
      approvedOfflineSource: null, live: true, dryRun: false, offlineScorePath: null,
    }),
    JSON.stringify({
      v: 1, kind: 'row', key: 'fixture-a#1', fixtureId: 'fixture-a', repeat: 1, provider: 'claude', tier: 'fast',
      variant: 'legacy', requestedModel: 'claude-haiku', modelId: null, actualPolicy: 'none', policySatisfied: true,
      modelSatisfied: true, baselineEligible: true, commitSha: 'abc123', fixtureHash: 'fixture-hash', variantHash: 'variant-hash',
      manifestHash: 'legacy-hash', status: 'success', hardChecksPassed: 1, hardChecksTotal: 1, weightedScore: 1, coverage: 1,
      outputBytes: 30, latencyMs: 10, usage: { inputTokens: null, outputTokens: null, totalTokens: null, costUsd: null },
      triggeredFlags: [], failedChecks: [], finalAnswer: 'answer', note: null,
    }),
  ].join('\n');
  const result = importLegacyReasoningNdjson(text);
  assert.equal(result.manifest.legacy.attemptedComplete, true);
  assert.equal(result.manifest.legacy.baselineEligible, true);
  assert.equal(result.manifest.fixture.fixtureHash, 'fixture-hash');
  assert.equal(result.manifest.fixture.promptHash, 'prompt-hash');
  assert.equal(result.manifest.fixture.treatmentHash, 'variant-hash');
  assert.equal(result.observations[0].metrics.tokens.inputTokens, null);
  assert.equal(result.observations[0].modelVerified, false);
});

test('writer redacts hashed fields and rejects forbidden canary content', () => {
  const dir = tmp();
  const file = path.join(dir, 'artifact.ndjson');
  writeBenchmarkNdjson(file, [manifest(), observation({ legacy: { ...observation().legacy, finalAnswer: 'private answer', note: 'line one\nline two' } })]);
  const text = fs.readFileSync(file, 'utf8');
  assert.match(text, /sha256:/);
  assert.match(text, /line one line two/);
  assert.throws(() => writeBenchmarkNdjson(file, [{ ...manifest(), prompt: 'plain prompt body' } as unknown as BenchmarkManifest], ['canary-secret']), /forbidden field: prompt/);
});

test('decision outcome stays inconclusive before calibration, on margin drift, and for unpaired rows', () => {
  const liveTooEarly = evaluateBenchmarkOutcome(manifest({ calibration: { completedLiveBatches: 0, firstDecisionBatch: 3 } }), [observation()]);
  assert.equal(liveTooEarly.decision, 'inconclusive');
  const drifted = evaluateBenchmarkOutcome(manifest({ marginRegistry: { ...manifest().marginRegistry, identityHash: 'drifted' } }), [observation()]);
  assert.equal(drifted.decision, 'inconclusive');
  const unpaired = evaluateBenchmarkOutcome(manifest(), [observation({ pairStatus: 'unpaired', pairId: null })]);
  assert.equal(unpaired.decision, 'inconclusive');
});

test('claude defaults to modelVerified=false when actual model cannot be proven', () => {
  const verification = resolveModelVerification('claude', 'claude-sonnet', null, false);
  assert.equal(verification.modelVerified, false);
  assert.equal(verification.modelVerificationSource, 'legacy_missing');
});

test('V2 NDJSON parser validates schema version and nested source/provider rules', () => {
  assert.throws(() => parseBenchmarkNdjson(`${JSON.stringify({ ...manifest(), v: 3 })}\n`), /benchmark manifest.v must equal 2/);
  assert.throws(() => parseBenchmarkNdjson(`${JSON.stringify({ ...manifest({ source: 'static', provider: null, providerLabel: 'static' }), marginRegistry: { ...manifest().marginRegistry, extra: true } })}\n`), /unknown fields/);
  assert.throws(() => parseBenchmarkNdjson(`${JSON.stringify({ ...manifest({ source: 'hook', provider: 'codex', providerLabel: 'hook' }) })}\n`), /cannot use a benchmark provider on hook source/);
  assert.throws(() => parseBenchmarkNdjson(`${JSON.stringify({ ...manifest({ source: 'benchmark_v2', provider: 'codex', providerLabel: 'hook' }) })}\n`), /providerLabel to match provider/);
  assert.throws(() => parseBenchmarkNdjson(`${JSON.stringify(observation({ fixtureId: 'fixture-b', fixture: { ...manifest().fixture, fixtureId: 'fixture-a' } }))}\n`), /fixtureId must match/);
});
