import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { compareCells } from '../lib/reasoning-harness/compare';

function cell(dir: string, name: string, over: Record<string, unknown>, scores: Array<number | null>): string {
  const manifest = {
    v: 1, kind: 'manifest', provider: 'ollama', tier: 'fast', requestedModel: 'qwen2.5:3b',
    variant: 'none', repeats: 1, commitSha: 'abc', fixtureDir: dir, fixtureIds: [],
    fixtureHash: 'fixture-aaa', variantHash: 'var-a', manifestHash: 'man-' + name,
    promptDigest: 'prompt-aaa', expectedKeys: [], createdAt: '2026-01-01T00:00:00Z',
    executionMode: 'live', offlineSourceHash: null, approvedOfflineSource: null,
    live: true, dryRun: false, offlineScorePath: null, ...over,
  };
  const rows = scores.map((score, i) => ({
    v: 1, kind: 'row', key: `f${i}#1`, fixtureId: `f${i}`, repeat: 1, status: score === null ? 'auth_failure' : 'success',
    weightedScore: score, outputBytes: 400 + i, hardChecksPassed: 0, hardChecksTotal: 1,
    coverage: score === null ? 0 : 1, latencyMs: 10, usage: {}, triggeredFlags: [], failedChecks: [],
    finalAnswer: null, note: null,
  }));
  const file = path.join(dir, `${name}.ndjson`);
  fs.writeFileSync(file, [manifest, ...rows].map((x) => JSON.stringify(x)).join('\n') + '\n', 'utf8');
  return file;
}

function tmp(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'reasoning-compare-'));
}

test('cells scored under different fixture definitions are refused', () => {
  const dir = tmp();
  const a = cell(dir, 'a', { variant: 'none' }, [1, 1, 0]);
  const b = cell(dir, 'b', { variant: 'full-injection', fixtureHash: 'fixture-bbb' }, [1, 0, 0]);
  assert.throws(() => compareCells([a, b]), /fixture identity differs/);
});

test('cells scored under different prompt templates are refused', () => {
  const dir = tmp();
  const a = cell(dir, 'a', {}, [1, 1, 0]);
  const b = cell(dir, 'b', { variant: 'full-injection', promptDigest: 'prompt-bbb' }, [1, 0, 0]);
  assert.throws(() => compareCells([a, b]), /prompt template differs/);
});

test('an artifact predating promptDigest is reported unverified, not blocked', () => {
  const dir = tmp();
  // manifestHash legitimately differs between variants, so it must never stand in for the
  // template digest — doing so made every valid pair look like a template change.
  const a = cell(dir, 'a', { variant: 'none', promptDigest: undefined }, [1, 1, 0]);
  const b = cell(dir, 'b', { variant: 'full-injection', promptDigest: undefined }, [1, 0, 0]);
  const result = compareCells([a, b]);
  assert.equal(result.promptDigestVerified, false);
  assert.equal(result.promptDigest, 'unrecorded');
});

test('a recorded promptDigest that matches is reported verified', () => {
  const dir = tmp();
  const a = cell(dir, 'a', { variant: 'none' }, [1, 1, 0]);
  const b = cell(dir, 'b', { variant: 'full-injection' }, [1, 0, 0]);
  assert.equal(compareCells([a, b]).promptDigestVerified, true);
});

test('matching cells summarize, and report the power the widest gap needs', () => {
  const dir = tmp();
  const a = cell(dir, 'a', { variant: 'none' }, [1, 1, 1, 1, 0]);
  const b = cell(dir, 'b', { variant: 'full-injection' }, [1, 0, 0, 0, 0]);
  const result = compareCells([a, b]);
  assert.equal(result.fixtureHash, 'fixture-aaa');
  assert.deepEqual(result.cells.map((c) => c.solved), [4, 1]);
  assert.deepEqual(result.cells.map((c) => c.variant), ['none', 'full-injection']);
  // A 4/5 vs 1/5 gap on five rows is nowhere near readable; the number must say so.
  assert.equal(result.power.length, 1);
  assert.equal(result.power[0].readable, false, `expected underpowered, needed ${result.power[0].neededPerArm}`);
});

test('power is reported per model, never for the gap between models', () => {
  const dir = tmp();
  // A weak model and a strong one, each with two variants. The widest gap in the table is
  // between the models — expected, and not the hypothesis. Reporting its power once made an
  // underpowered within-model comparison look readable.
  const files = [
    cell(dir, 'weak-none', { requestedModel: 'weak', variant: 'none' }, [1, 0, 0, 0, 0]),
    cell(dir, 'weak-full', { requestedModel: 'weak', variant: 'full-injection' }, [0, 0, 0, 0, 0]),
    cell(dir, 'strong-none', { requestedModel: 'strong', variant: 'none' }, [1, 1, 1, 1, 1]),
    cell(dir, 'strong-full', { requestedModel: 'strong', variant: 'full-injection' }, [1, 1, 1, 1, 0]),
  ];
  const { power } = compareCells(files);
  assert.equal(power.length, 2, 'one row per model, not one per pair of cells');
  assert.deepEqual(power.map((p) => p.model), ['weak', 'strong']);
  for (const p of power) {
    assert.equal(p.from, 'none');
    assert.equal(p.to, 'full-injection');
    assert.equal(p.readable, false, `${p.model}: a one-fixture gap on five rows is not readable`);
  }
});

test('a null-scored row is excluded from the mean but still counted as a row', () => {
  const dir = tmp();
  const a = cell(dir, 'a', { variant: 'none' }, [1, 1, null]);
  const b = cell(dir, 'b', { variant: 'full-injection' }, [1, 1, 1]);
  const [first] = compareCells([a, b]).cells;
  assert.equal(first.rows, 3);
  assert.equal(first.parsed, 2, 'the unmeasured row must not count as parsed');
  assert.equal(first.meanScore, 1, 'an unmeasured row must not drag the mean toward zero');
});

test('a single cell is not a comparison', () => {
  const dir = tmp();
  assert.throws(() => compareCells([cell(dir, 'a', {}, [1])]), /at least two cells/);
});

test('rates use measured rows, not attempted ones', () => {
  const dir = tmp();
  // Same four solved answers in both arms; the first arm additionally has two rows the provider
  // never measured. Dividing by attempted rows would report 4/6 against 4/4 and hand back a power
  // figure for a gap that does not exist.
  const a = cell(dir, 'a', { variant: 'none' }, [1, 1, 1, 1, null, null]);
  const b = cell(dir, 'b', { variant: 'full-injection' }, [1, 1, 1, 1]);
  const result = compareCells([a, b]);
  assert.deepEqual(result.cells.map((c) => c.measured), [4, 4]);
  assert.deepEqual(result.cells.map((c) => c.rows), [6, 4]);
  assert.equal(result.power[0].neededPerArm, null, 'identical measured rates mean there is no gap to power');
});

test('a cell that measured nothing is refused rather than scored zero', () => {
  const dir = tmp();
  // An exhausted quota or a cell that timed out on every row: solved is zero for reasons that
  // have nothing to do with the model, and comparing it would publish that zero as a result.
  const a = cell(dir, 'a', { variant: 'none' }, [1, 1, 0]);
  const dead = cell(dir, 'dead', { variant: 'legacy' }, [null, null, null]);
  assert.throws(() => compareCells([a, dead]), /measured no rows/);
});

test('median output length ignores rows the model never answered', () => {
  const dir = tmp();
  // The unmeasured row carries outputBytes 0 here and could carry an error envelope's bytes
  // elsewhere. Either way it is not an answer, and letting it into this column makes an
  // environment failure read as the model becoming terser.
  const a = cell(dir, 'a', { variant: 'none' }, [1, 1, 1, null, null]);
  const b = cell(dir, 'b', { variant: 'full-injection' }, [1, 1, 1]);
  const [first, second] = compareCells([a, b]).cells;
  assert.equal(first.medianOutputBytes, second.medianOutputBytes,
    'three answered rows of the same sizes must give the same median regardless of unmeasured rows');
});
