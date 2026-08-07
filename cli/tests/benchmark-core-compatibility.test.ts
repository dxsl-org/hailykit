import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { compareCells } from '../lib/reasoning-harness/compare';
import { parseRunnerArgs, runReasoningEvals } from '../lib/reasoning-harness/runner';
import { writeBenchmarkNdjson } from '../lib/benchmark/ndjson';
import type { BenchmarkManifest, BenchmarkObservation } from '../lib/benchmark/types';
import { fixtureDir } from '../lib/reasoning-harness/fixtures';

function tmp(): string { return fs.mkdtempSync(path.join(os.tmpdir(), 'benchmark-compat-')); }
function oneFixtureDir(fileName = 'framing-trap.json'): string {
  const dir = tmp();
  fs.copyFileSync(path.join(fixtureDir(), fileName), path.join(dir, fileName));
  return dir;
}

test('legacy parser still accepts gemini and ollama providers', () => {
  assert.equal(parseRunnerArgs(['--provider', 'gemini', '--out', 'x.ndjson']).provider, 'gemini');
  assert.equal(parseRunnerArgs(['--provider', 'ollama', '--out', 'x.ndjson']).provider, 'ollama');
});

test('dry-run compatibility still works for gemini and ollama', async () => {
  const geminiDir = oneFixtureDir();
  const ollamaDir = oneFixtureDir();
  const gemini = await runReasoningEvals({ cwd: process.cwd(), fixtures: geminiDir, out: path.join(geminiDir, 'out.ndjson'), provider: 'gemini', tier: 'fast', variant: 'legacy', repeats: 1, live: false, dryRun: true });
  const ollama = await runReasoningEvals({ cwd: process.cwd(), fixtures: ollamaDir, out: path.join(ollamaDir, 'out.ndjson'), provider: 'ollama', tier: 'fast', variant: 'legacy', repeats: 1, live: false, dryRun: true, model: 'qwen2.5:3b' });
  assert.equal(gemini.rows[0].status, 'dry_run');
  assert.equal(ollama.rows[0].status, 'dry_run');
});

test('compare bridge reads V2 benchmark NDJSON without weakening legacy summaries', () => {
  const dir = tmp();
  const first: BenchmarkManifest = {
    v: 2, kind: 'benchmark_manifest', source: 'benchmark_v2', provider: 'codex', providerLabel: 'codex', tier: 'fast', requestedModel: 'gpt-5.4-mini',
    fixture: { fixtureId: 'fixture-a', fixtureClass: null, fixtureHash: 'fixture-hash', promptHash: 'prompt-hash', treatmentHash: 'treatment-hash', variant: 'legacy' },
    provenance: 'live', createdAt: '2026-08-07T00:00:00.000Z', manifestHash: 'm-a', modelVerificationWaiver: false,
    marginRegistry: { metric: 'outcomeScore', threshold: 0.9, exploratoryBatches: 2, firstDecisionBatch: 3, frozen: true, frozenAt: '2026-08-07T00:00:00.000Z', identityHash: 'wrong' },
    calibration: { completedLiveBatches: 3, firstDecisionBatch: 3 }, snapshot: null, legacy: { attemptedComplete: true, baselineEligible: true, commitSha: 'abc', providerFootprintArtifactHash: null },
  };
  const second: BenchmarkManifest = { ...first, manifestHash: 'm-b', fixture: { ...first.fixture, variant: 'none' } };
  const row = (variant: 'legacy' | 'none', score: number): BenchmarkObservation => ({
    v: 2, kind: 'benchmark_observation', source: 'benchmark_v2', key: `${variant}#1`, fixtureId: 'fixture-a', repeat: 1, provider: 'codex', providerLabel: 'codex',
    requestedModel: 'gpt-5.4-mini', actualModel: 'gpt-5.4-mini', modelSatisfied: true, modelVerified: true, modelVerificationSource: 'provider_echo',
    provenance: 'live', status: 'success', statusClass: 'measured', decisionEligible: false, decisionIneligibleReason: 'legacy comparison rows are not paired', pairId: null, blockId: null, arm: variant,
    pairStatus: 'unpaired', fixture: { ...first.fixture, variant }, manifestHash: variant === 'legacy' ? 'm-a' : 'm-b',
    metrics: { outcomeLabel: score ? 'pass' : 'fail', outcomeScore: score, wallMs: 10, ttftMs: null, outputBytes: 100, tokens: { inputTokens: null, outputTokens: null, totalTokens: null, costUsd: null, cacheReadTokens: null, cacheWriteTokens: null, reasoningTokens: null, costSource: 'unknown' }, contextOccupancy: null, contextCompactionBytes: null, toolCalls: null, toolErrors: null, toolRetries: null, approvals: null, subagentCount: null, subagentDepth: null, hookCalls: null, hookLatencyMs: null, hookContextBytes: null },
    providerExtensions: {}, legacy: { baselineEligible: true, attemptedComplete: true, actualPolicy: 'none', policySatisfied: true, coverage: 1, hardChecksPassed: 1, hardChecksTotal: 1, finalAnswer: null, note: null, commitSha: 'abc', providerFootprintArtifactHash: null },
  });
  const a = path.join(dir, 'a.ndjson');
  const b = path.join(dir, 'b.ndjson');
  writeBenchmarkNdjson(a, [first, row('legacy', 1)]);
  writeBenchmarkNdjson(b, [second, row('none', 0)]);
  const result = compareCells([a, b]);
  assert.deepEqual(result.cells.map((entry) => entry.variant), ['legacy', 'none']);
  assert.equal(result.promptDigestVerified, true);
  assert.equal(result.decision?.value, 'inconclusive');
});
