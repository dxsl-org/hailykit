import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { cmdBenchmark } from '../commands/benchmark';
import { findCommand } from '../commands/registry';
import { loadBenchmarkArtifact } from '../lib/benchmark/legacy-reasoning';

function makeTempDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function writeJson(filePath: string, value: unknown): void {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

function initRepo(dir: string): void {
  fs.writeFileSync(path.join(dir, 'treatment.md'), '# Treatment\n', 'utf8');
  execFileSync('git', ['init'], { cwd: dir, stdio: 'ignore' });
  execFileSync('git', ['config', 'user.email', 'benchmark@example.com'], { cwd: dir, stdio: 'ignore' });
  execFileSync('git', ['config', 'user.name', 'Benchmark Command'], { cwd: dir, stdio: 'ignore' });
  execFileSync('git', ['add', '.'], { cwd: dir, stdio: 'ignore' });
  execFileSync('git', ['commit', '-m', 'init'], { cwd: dir, stdio: 'ignore' });
}

test('registry exposes benchmark with required value-flags', () => {
  const spec = findCommand('benchmark');
  assert.ok(spec);
  for (const flag of ['base-ref', 'backend', 'claude-snapshot', 'codex-snapshot', 'responses', 'evidence', 'repo', 'out', 'format', 'holdout-manifest', 'holdout-artifact', 'provider-footprint-artifact', 'min-pairs']) {
    assert.ok(spec!.valueFlags.includes(flag), `missing value-flag ${flag}`);
  }
});

test('static command generates real temporary Claude and Codex install footprints', async () => {
  const dir = makeTempDir('hl-bench-static-cmd-');
  const out = path.join(dir, 'static.ndjson');
  const code = await cmdBenchmark({ positionals: ['static', process.cwd()], options: { out, json: true } });
  assert.equal(code, 0);
  const artifact = loadBenchmarkArtifact(fs.readFileSync(out, 'utf8'));
  const installedProviders = new Set(artifact.observations.flatMap((row) => {
    const value = row.providerExtensions.static;
    const provider = value && typeof value === 'object' ? (value as Record<string, unknown>).provider : null;
    return provider === 'claude' || provider === 'codex' ? [provider] : [];
  }));
  assert.deepEqual(installedProviders, new Set(['claude', 'codex']));
});

test('hooks command emits source and generated Codex wrapper V2 rows', async () => {
  const dir = makeTempDir('hl-bench-hooks-cmd-');
  const out = path.join(dir, 'hooks.ndjson');
  const code = await cmdBenchmark({ positionals: ['hooks', process.cwd()], options: { out, json: true } });
  assert.equal(code, 0);
  const artifact = loadBenchmarkArtifact(fs.readFileSync(out, 'utf8'));
  assert.equal(artifact.manifest.source, 'hook');
  assert.ok(artifact.observations.some((row) => row.arm === 'claude-source'));
  assert.ok(artifact.observations.some((row) => row.arm === 'codex-installed'));
});

test('run rejects live-equivalent workflow manifest without acknowledged budget', async () => {
  const dir = makeTempDir('hl-bench-cmd-');
  const fixtureRoot = path.join(dir, 'fixtures');
  fs.mkdirSync(fixtureRoot);
  writeJson(path.join(fixtureRoot, 'fixture.json'), {
    fixtureId: 'f1',
    fixtureClass: 'workflow',
    promptHash: 'p1',
  });
  writeJson(path.join(dir, 'manifest.json'), {
    provider: 'codex', tier: 'fast', requestedModel: 'gpt-5.4-mini', policy: 'read_only', provenance: 'live',
    liveEquivalent: true, budgetAcknowledged: false, budget: { projectedCalls: 2, projectedSpendUsd: 0.5, maxCalls: 2, maxSpendUsd: 1, maxWallMs: 1000, maxOutputBytes: 1000 },
    baseRef: 'HEAD', candidateRef: 'HEAD', fixtureRoot: path.relative(dir, fixtureRoot), fixturePaths: ['fixture.json'], repeats: 1, randomSeed: 1,
    cliVersion: 'test', configSnapshotHash: 'cfg', componentClass: 'workflow', ablations: [],
    marginRegistry: { metric: 'outcomeScore', threshold: 0.1, exploratoryBatches: 2, firstDecisionBatch: 3, frozen: false, frozenAt: null, identityHash: 'm1' },
  });
  writeJson(path.join(dir, 'responses.json'), {});
  const code = await cmdBenchmark({ positionals: ['run', path.join(dir, 'manifest.json')], options: { responses: path.join(dir, 'responses.json'), json: true } });
  assert.equal(code, 1);
});

test('run rejects codex-app-server backend for offline workflow runs', async () => {
  const dir = makeTempDir('hl-bench-backend-offline-');
  const fixtureRoot = path.join(dir, 'fixtures');
  fs.mkdirSync(fixtureRoot);
  writeJson(path.join(fixtureRoot, 'fixture.json'), {
    fixtureId: 'f1',
    fixtureClass: 'workflow',
    promptHash: 'p1',
  });
  initRepo(dir);
  writeJson(path.join(dir, 'manifest.json'), {
    provider: 'codex', tier: 'fast', requestedModel: 'gpt-5.4-mini', policy: 'read_only', provenance: 'synthetic',
    liveEquivalent: false, budgetAcknowledged: false, budget: { projectedCalls: 2, projectedSpendUsd: 0.5, maxCalls: 2, maxSpendUsd: 1, maxWallMs: 1000, maxOutputBytes: 1000 },
    baseRef: 'HEAD', candidateRef: 'HEAD', fixtureRoot: path.relative(dir, fixtureRoot), fixturePaths: ['fixture.json'], repeats: 1, randomSeed: 1,
    cliVersion: 'test', configSnapshotHash: 'cfg', componentClass: 'workflow', ablations: [], backend: 'provider',
    marginRegistry: { metric: 'outcomeScore', threshold: 0.1, exploratoryBatches: 2, firstDecisionBatch: 3, frozen: false, frozenAt: null, identityHash: 'm1' },
    calibration: { completedLiveBatches: 0, firstDecisionBatch: 3 }, evaluatorEvidenceHash: 'e1', treatmentFiles: { base: ['treatment.md'], candidate: ['treatment.md'] },
  });
  writeJson(path.join(dir, 'responses.json'), {});
  const code = await cmdBenchmark({
    positionals: ['run', path.join(dir, 'manifest.json')],
    options: { backend: 'codex-app-server', responses: path.join(dir, 'responses.json'), json: true },
  });
  assert.equal(code, 1);
});

test('run rejects codex-app-server backend for non-codex providers', async () => {
  const dir = makeTempDir('hl-bench-backend-claude-');
  const fixtureRoot = path.join(dir, 'fixtures');
  fs.mkdirSync(fixtureRoot);
  writeJson(path.join(fixtureRoot, 'fixture.json'), {
    fixtureId: 'f1',
    fixtureClass: 'workflow',
    promptHash: 'p1',
    prompt: 'prompt',
  });
  initRepo(dir);
  writeJson(path.join(dir, 'manifest.json'), {
    provider: 'claude', tier: 'fast', requestedModel: 'claude-sonnet', policy: 'read_only', provenance: 'live',
    liveEquivalent: true, budgetAcknowledged: true, budget: { projectedCalls: 2, projectedSpendUsd: 0.5, maxCalls: 2, maxSpendUsd: 1, maxWallMs: 1000, maxOutputBytes: 1000 },
    baseRef: 'HEAD', candidateRef: 'HEAD', fixtureRoot: path.relative(dir, fixtureRoot), fixturePaths: ['fixture.json'], repeats: 1, randomSeed: 1,
    cliVersion: 'test', configSnapshotHash: 'cfg', componentClass: 'workflow', ablations: [], backend: 'provider',
    marginRegistry: { metric: 'outcomeScore', threshold: 0.1, exploratoryBatches: 2, firstDecisionBatch: 3, frozen: false, frozenAt: null, identityHash: 'm1' },
    calibration: { completedLiveBatches: 0, firstDecisionBatch: 3 }, evaluatorEvidenceHash: 'e1', treatmentFiles: { base: ['treatment.md'], candidate: ['treatment.md'] },
  });
  const code = await cmdBenchmark({
    positionals: ['run', path.join(dir, 'manifest.json')],
    options: { backend: 'codex-app-server', live: true, 'ack-budget': true, json: true },
  });
  assert.equal(code, 1);
});

test('import-reasoning converts legacy V1 NDJSON into benchmark V2 output', async () => {
  const dir = makeTempDir('hl-bench-import-');
  const legacy = path.join(dir, 'legacy.ndjson');
  const out = path.join(dir, 'converted.ndjson');
  fs.writeFileSync(legacy, [
    JSON.stringify({ v: 1, kind: 'manifest', provider: 'gemini', tier: 'thinking', requestedModel: 'gemini-2.5-pro', executionMode: 'dry-run', fixtureIds: ['fixture-a'], fixtureHash: 'fh', promptDigest: 'ph', variantHash: 'vh', variant: 'legacy', createdAt: '2026-08-07T00:00:00.000Z', expectedKeys: ['fixture-a#1'], commitSha: 'abc123' }),
    JSON.stringify({ v: 1, kind: 'row', key: 'fixture-a#1', fixtureId: 'fixture-a', repeat: 1, status: 'success', weightedScore: 1, latencyMs: 10, outputBytes: 12, usage: { inputTokens: 1, outputTokens: 2, totalTokens: 3, costUsd: null }, modelId: null, modelSatisfied: true, baselineEligible: false, actualPolicy: 'read_only', policySatisfied: true, coverage: 1, hardChecksPassed: 1, hardChecksTotal: 1, finalAnswer: 'ok', note: null, commitSha: 'abc123' }),
  ].join('\n'));
  const code = await cmdBenchmark({ positionals: ['import-reasoning', legacy], options: { out, json: true } });
  assert.equal(code, 0);
  const artifact = loadBenchmarkArtifact(fs.readFileSync(out, 'utf8'));
  assert.equal(artifact.manifest.source, 'legacy_reasoning_v1');
  assert.equal(artifact.observations.length, 1);
});
