import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildBenchmarkReport } from '../commands/benchmark';
import { stringifyBenchmarkNdjson } from '../lib/benchmark/ndjson';
import type { BenchmarkManifest, BenchmarkObservation, BenchmarkOutcome } from '../lib/benchmark/types';
import { hashMarginIdentity } from '../lib/benchmark/identity';

function sampleObservation(arm: 'base' | 'candidate', tokens: number): BenchmarkObservation {
  return {
    v: 2, kind: 'benchmark_observation', source: 'benchmark_v2', key: `k-${arm}`, fixtureId: 'fixture-a', repeat: 1,
    provider: 'codex', providerLabel: 'codex', requestedModel: 'gpt-5.4-mini', actualModel: 'gpt-5.4-mini', modelSatisfied: true, modelVerified: true, modelVerificationSource: 'provider_echo',
    provenance: 'synthetic', status: 'success', statusClass: 'measured', decisionEligible: false, decisionIneligibleReason: 'synthetic run',
    pairId: 'pair-1', blockId: 'pair-1', arm, pairStatus: 'paired', fixture: { fixtureId: 'fixture-a', fixtureClass: 'workflow', fixtureHash: 'fh', promptHash: 'ph', treatmentHash: 'th', variant: null }, manifestHash: 'mh',
    metrics: { outcomeLabel: 'pass', outcomeScore: 1, wallMs: 5, ttftMs: null, outputBytes: 12, tokens: { inputTokens: 1, outputTokens: 2, totalTokens: tokens, costUsd: null, cacheReadTokens: null, cacheWriteTokens: null, reasoningTokens: null, costSource: 'unknown' }, contextOccupancy: null, contextCompactionBytes: null, toolCalls: 0, toolErrors: 0, toolRetries: 0, approvals: 0, subagentCount: 0, subagentDepth: 0, hookCalls: 0, hookLatencyMs: null, hookContextBytes: null },
    providerExtensions: {}, legacy: { baselineEligible: null, attemptedComplete: null, actualPolicy: 'read_only', policySatisfied: true, coverage: null, hardChecksPassed: null, hardChecksTotal: null, finalAnswer: '<script>\u001b[31mboom</script>`x`', note: null, commitSha: 'abc', providerFootprintArtifactHash: null },
  };
}

test('report escapes HTML, markdown, ANSI, and control characters', () => {
  const manifest: BenchmarkManifest = {
    v: 2, kind: 'benchmark_manifest', source: 'benchmark_v2', provider: 'codex', providerLabel: 'codex', tier: 'fast', requestedModel: '<script>\u001b[31mmodel</script>`x`',
    fixture: { fixtureId: 'fixture-a', fixtureClass: 'workflow', fixtureHash: 'fh', promptHash: 'ph', treatmentHash: 'th', variant: null }, provenance: 'synthetic', createdAt: '2026-08-07T00:00:00.000Z', manifestHash: 'mh',
    modelVerificationWaiver: false, marginRegistry: { metric: 'outcomeScore', threshold: 0.1, exploratoryBatches: 2, firstDecisionBatch: 3, frozen: false, frozenAt: null, identityHash: 'm1' }, calibration: { completedLiveBatches: 0, firstDecisionBatch: 3 }, snapshot: null,
    legacy: { attemptedComplete: null, baselineEligible: null, commitSha: null, providerFootprintArtifactHash: null },
  };
  const outcome: BenchmarkOutcome = { v: 2, kind: 'benchmark_outcome', source: 'benchmark_v2', decision: 'inconclusive', reasons: ['<b>raw</b>'], observedMeanScore: null, threshold: null, comparedRows: 2 };
  const report = buildBenchmarkReport(stringifyBenchmarkNdjson([manifest, sampleObservation('base', 10), sampleObservation('candidate', 8), outcome]));
  assert.match(report.markdown, /&lt;script&gt;/);
  assert.doesNotMatch(report.markdown, /\u001b\[/);
  assert.doesNotMatch(report.markdown, /<script>/);
  assert.match(JSON.stringify(report), /&lt;script&gt;/);
});

test('report reaches GO only with matched live decision artifacts and confidence gates', () => {
  const manifest: BenchmarkManifest = {
    v: 2, kind: 'benchmark_manifest', source: 'benchmark_v2', provider: 'codex', providerLabel: 'codex', tier: 'fast', requestedModel: 'gpt-5.4-mini',
    fixture: { fixtureId: 'suite', fixtureClass: 'workflow', fixtureHash: 'suite-fh', promptHash: 'suite-ph', treatmentHash: 'suite-th', variant: null },
    provenance: 'live', createdAt: '2026-08-07T00:00:00.000Z', manifestHash: 'mh', modelVerificationWaiver: false,
    marginRegistry: { metric: 'outcomeScore', threshold: 0.1, exploratoryBatches: 2, firstDecisionBatch: 3, frozen: true, frozenAt: '2026-08-07T00:00:00.000Z', identityHash: '' },
    calibration: { completedLiveBatches: 3, firstDecisionBatch: 3 }, snapshot: null, legacy: { attemptedComplete: true, baselineEligible: true, commitSha: 'abc', providerFootprintArtifactHash: 'static-hash' },
  };
  manifest.marginRegistry.identityHash = hashMarginIdentity(manifest);
  const rows = [1, 2, 3].flatMap((index) => {
    const pairId = `p${index}`;
    return (['base', 'candidate'] as const).map((arm) => {
      const row = sampleObservation(arm, arm === 'base' ? 100 : 70);
      return {
        ...row, key: `${pairId}:${arm}`, fixtureId: pairId, repeat: 1, provenance: 'live' as const, decisionEligible: true,
        decisionIneligibleReason: null, pairId, blockId: pairId, manifestHash: manifest.manifestHash,
        fixture: { fixtureId: pairId, fixtureClass: 'workflow', fixtureHash: `fh-${pairId}`, promptHash: `ph-${pairId}`, treatmentHash: manifest.fixture.treatmentHash, variant: null },
        providerExtensions: { outputDigest: `sha256:${String(arm === 'base' ? index : index + 3).repeat(64)}`, evaluation: { deterministicComplete: true, criticalFlags: [], failedChecks: [], scopeDrift: false, unnecessaryWork: false, judgeEvidence: 'none', fixtureSplit: 'private-hash-only-holdout' } },
      };
    });
  });
  const text = stringifyBenchmarkNdjson([manifest, ...rows]);
  const withoutProof = buildBenchmarkReport(text, { minimumEffectivePairs: 2 });
  assert.equal(withoutProof.decision, 'inconclusive');
  const report = buildBenchmarkReport(text, { minimumEffectivePairs: 2, providerFootprintArtifactHash: 'static-hash', holdoutManifest: { schemaVersion: 1, fixtureSetHash: 'suite-fh', promptCount: 3, containsRawPrompts: false }, holdoutArtifactText: text });
  assert.equal(report.decision, 'go');
  assert.equal(report.quality.status, 'pass');
  assert.equal(report.efficiency.status, 'pass');
});

test('report rejects a hash-only claim that is not backed by evaluated private holdout rows', () => {
  const manifest: BenchmarkManifest = {
    v: 2, kind: 'benchmark_manifest', source: 'benchmark_v2', provider: 'codex', providerLabel: 'codex', tier: 'fast', requestedModel: 'gpt-5.4-mini',
    fixture: { fixtureId: 'suite', fixtureClass: 'workflow', fixtureHash: 'suite-fh', promptHash: 'suite-ph', treatmentHash: 'suite-th', variant: null },
    provenance: 'live', createdAt: '2026-08-07T00:00:00.000Z', manifestHash: 'mh', modelVerificationWaiver: false,
    marginRegistry: { metric: 'outcomeScore', threshold: 0.1, exploratoryBatches: 2, firstDecisionBatch: 3, frozen: false, frozenAt: null, identityHash: 'x' },
    calibration: { completedLiveBatches: 0, firstDecisionBatch: 3 }, snapshot: null, legacy: { attemptedComplete: true, baselineEligible: true, commitSha: 'abc', providerFootprintArtifactHash: null },
  };
  const text = stringifyBenchmarkNdjson([manifest, sampleObservation('base', 10), sampleObservation('candidate', 8)]);
  assert.throws(() => buildBenchmarkReport(text, {
    holdoutManifest: { schemaVersion: 1, fixtureSetHash: 'suite-fh', promptCount: 1, containsRawPrompts: false },
    holdoutArtifactText: text,
  }), /evaluated private holdout rows/);
});

test('private holdout proof rejects unapproved extension aliases', () => {
  const manifest: BenchmarkManifest = {
    v: 2, kind: 'benchmark_manifest', source: 'benchmark_v2', provider: 'codex', providerLabel: 'codex', tier: 'fast', requestedModel: 'gpt-5.4-mini',
    fixture: { fixtureId: 'suite', fixtureClass: 'workflow', fixtureHash: 'suite-fh', promptHash: 'suite-ph', treatmentHash: 'suite-th', variant: null },
    provenance: 'live', createdAt: '2026-08-07T00:00:00.000Z', manifestHash: 'mh', modelVerificationWaiver: false,
    marginRegistry: { metric: 'outcomeScore', threshold: 0.1, exploratoryBatches: 2, firstDecisionBatch: 3, frozen: false, frozenAt: null, identityHash: 'x' },
    calibration: { completedLiveBatches: 0, firstDecisionBatch: 3 }, snapshot: null, legacy: { attemptedComplete: true, baselineEligible: true, commitSha: 'abc', providerFootprintArtifactHash: null },
  };
  const row = sampleObservation('base', 10);
  row.fixtureId = 'fixture-a';
  row.provenance = 'live';
  row.statusClass = 'measured';
  row.decisionEligible = true;
  row.providerExtensions = { taskText: 'private prompt', evaluation: { fixtureSplit: 'private-hash-only-holdout' } };
  const text = stringifyBenchmarkNdjson([manifest, row]);
  assert.throws(() => buildBenchmarkReport(text, {
    holdoutManifest: { schemaVersion: 1, fixtureSetHash: 'suite-fh', promptCount: 1, containsRawPrompts: false }, holdoutArtifactText: text,
  }), /unapproved fields/);
});

test('private holdout proof allows app-server provenance fields', () => {
  const manifest: BenchmarkManifest = {
    v: 2, kind: 'benchmark_manifest', source: 'benchmark_v2', backend: 'codex_app_server', provider: 'codex', providerLabel: 'codex', tier: 'fast', requestedModel: 'gpt-5.4-mini',
    fixture: { fixtureId: 'suite', fixtureClass: 'workflow', fixtureHash: 'suite-fh', promptHash: 'suite-ph', treatmentHash: 'suite-th', variant: null },
    provenance: 'live', createdAt: '2026-08-07T00:00:00.000Z', manifestHash: 'mh', modelVerificationWaiver: false,
    marginRegistry: { metric: 'outcomeScore', threshold: 0.1, exploratoryBatches: 2, firstDecisionBatch: 3, frozen: false, frozenAt: null, identityHash: 'x' },
    calibration: { completedLiveBatches: 0, firstDecisionBatch: 3 }, snapshot: null, legacy: { attemptedComplete: true, baselineEligible: true, commitSha: 'abc', providerFootprintArtifactHash: null },
  };
  const row = {
    ...sampleObservation('base', 10),
    backend: 'codex_app_server' as const,
    provenance: 'live' as const,
    decisionEligible: true,
    decisionIneligibleReason: null,
    providerExtensions: {
      workflow: {
        componentClass: 'workflow',
        cliVersion: '0.142.5',
        treatmentDigest: 'a'.repeat(64),
        treatmentBytes: 10,
        treatmentFileCount: 1,
        ablationCount: 0,
        backend: 'codex_app_server',
      },
      appServer: { modelProvider: 'openai', protocol: 'v2', contextCompactions: 0 },
      evaluation: { fixtureSplit: 'private-hash-only-holdout' },
    },
  };
  const text = stringifyBenchmarkNdjson([manifest, row]);
  const report = buildBenchmarkReport(text, {
    holdoutManifest: { schemaVersion: 1, fixtureSetHash: 'suite-fh', promptCount: 1, containsRawPrompts: false },
    holdoutArtifactText: text,
  });
  assert.equal(report.decision, 'inconclusive');
});

test('report requires the provider-footprint artifact hash to match the manifest binding', () => {
  const manifest: BenchmarkManifest = {
    v: 2, kind: 'benchmark_manifest', source: 'benchmark_v2', provider: 'codex', providerLabel: 'codex', tier: 'fast', requestedModel: 'gpt-5.4-mini',
    fixture: { fixtureId: 'suite', fixtureClass: 'workflow', fixtureHash: 'suite-fh', promptHash: 'suite-ph', treatmentHash: 'suite-th', variant: null },
    provenance: 'live', createdAt: '2026-08-07T00:00:00.000Z', manifestHash: 'mh', modelVerificationWaiver: false,
    marginRegistry: { metric: 'outcomeScore', threshold: 0.1, exploratoryBatches: 2, firstDecisionBatch: 3, frozen: true, frozenAt: '2026-08-07T00:00:00.000Z', identityHash: '' },
    calibration: { completedLiveBatches: 3, firstDecisionBatch: 3 }, snapshot: null, legacy: { attemptedComplete: true, baselineEligible: true, commitSha: 'abc', providerFootprintArtifactHash: 'bound-hash' },
  };
  manifest.marginRegistry.identityHash = hashMarginIdentity(manifest);
  const text = stringifyBenchmarkNdjson([
    manifest,
    {
      ...sampleObservation('base', 10),
      provenance: 'live',
      decisionEligible: true,
      decisionIneligibleReason: null,
      providerExtensions: { evaluation: { deterministicComplete: true, criticalFlags: [], failedChecks: [], scopeDrift: false, unnecessaryWork: false, judgeEvidence: 'none', fixtureSplit: 'private-hash-only-holdout' } },
    },
    {
      ...sampleObservation('candidate', 8),
      provenance: 'live',
      decisionEligible: true,
      decisionIneligibleReason: null,
      providerExtensions: { evaluation: { deterministicComplete: true, criticalFlags: [], failedChecks: [], scopeDrift: false, unnecessaryWork: false, judgeEvidence: 'none', fixtureSplit: 'private-hash-only-holdout' } },
    },
  ]);
  const report = buildBenchmarkReport(text, { minimumEffectivePairs: 1, providerFootprintArtifactHash: 'wrong-hash', holdoutManifest: { schemaVersion: 1, fixtureSetHash: 'suite-fh', promptCount: 1, containsRawPrompts: false }, holdoutArtifactText: text });
  assert.equal(report.decision, 'inconclusive');
});
