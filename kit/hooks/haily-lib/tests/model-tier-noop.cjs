#!/usr/bin/env node
/**
 * model-tier-noop.cjs - Tests the null/unknown-model no-op path across every
 * HL_MODEL_TIER consumer added in the depth-tier phase.
 *
 * Contract under test: an unresolvable model id (non-Claude, no model-map
 * match) must never make a consumer guess a tier — each one must behave
 * exactly as if no tier were known at all (empty string / null / fail-safe
 * default thresholds).
 */

const assert = require('node:assert/strict');
const path = require('node:path');

const { canonicalTier, tierRank } = require(path.join(__dirname, '..', 'model.cjs'));
const { buildThinkSection } = require(path.join(__dirname, '..', 'subagent.cjs'));
const { resolveThresholds } = require(path.join(__dirname, '..', '..', 'haily-optimize.cjs'));

const tests = [];
function test(desc, fn) { tests.push({ desc, fn }); }

// ── model.cjs: canonicalTier / tierRank ─────────────────────────────────────
test('unknown model id resolves to null (never guesses a tier)', () => {
  assert.equal(canonicalTier('some-random-model-xyz'), null);
});
test('empty model id resolves to null', () => {
  assert.equal(canonicalTier(''), null);
  assert.equal(canonicalTier(undefined), null);
});
test('known Claude id normalizes deep to ultra (never leaks the literal "deep")', () => {
  assert.equal(canonicalTier('claude-fable-5'), 'ultra');
});
test('known non-Claude id resolves via model-map reverse lookup', () => {
  assert.equal(canonicalTier('claude-opus-4-8'), 'thinking');
});
test('tierRank of an unknown/empty tier is -1 (fails "< thinking" guards safely)', () => {
  assert.equal(tierRank(''), -1);
  assert.equal(tierRank('bogus'), -1);
  assert.ok(tierRank('bogus') < tierRank('thinking'));
});

// ── subagent.cjs: buildThinkSection ─────────────────────────────────────────
test('buildThinkSection returns [] when HL_MODEL_TIER is unset', () => {
  assert.deepEqual(buildThinkSection({}), []);
});
test('buildThinkSection returns [] for ultra (already max reasoning budget)', () => {
  assert.deepEqual(buildThinkSection({ HL_MODEL_TIER: 'ultra' }), []);
});
test('buildThinkSection returns [] for an unrecognized tier string', () => {
  assert.deepEqual(buildThinkSection({ HL_MODEL_TIER: 'deep' }), []);
});
test('buildThinkSection injects the directive for thinking/medium/fast', () => {
  for (const tier of ['thinking', 'medium', 'fast']) {
    const lines = buildThinkSection({ HL_MODEL_TIER: tier });
    assert.ok(lines.length > 0, `expected a directive for tier ${tier}`);
    assert.ok(lines.join('\n').toLowerCase().includes('ultrathink'));
  }
});

// ── haily-optimize.cjs: resolveThresholds ───────────────────────────────────
test('resolveThresholds stays at the fail-safe 400/8/200 default when HL_MODEL_TIER is unset', () => {
  delete process.env.HL_MODEL_TIER;
  assert.deepEqual(resolveThresholds(), { locDelta: 400, fileCount: 8, singleFileLoc: 200 });
});
test('resolveThresholds stays at 400/8/200 for an unrecognized tier value', () => {
  process.env.HL_MODEL_TIER = 'bogus';
  assert.deepEqual(resolveThresholds(), { locDelta: 400, fileCount: 8, singleFileLoc: 200 });
  delete process.env.HL_MODEL_TIER;
});
test('resolveThresholds tightens to 250/5/150 below the ultra tier', () => {
  process.env.HL_MODEL_TIER = 'medium';
  assert.deepEqual(resolveThresholds(), { locDelta: 250, fileCount: 5, singleFileLoc: 150 });
  delete process.env.HL_MODEL_TIER;
});

console.log('Testing HL_MODEL_TIER no-op path across model.cjs / subagent.cjs / haily-optimize.cjs...\n');

let passed = 0;
let failed = 0;

for (const { desc, fn } of tests) {
  try {
    fn();
    console.log(`\x1b[32m✓\x1b[0m ${desc}`);
    passed++;
  } catch (e) {
    console.log(`\x1b[31m✗\x1b[0m ${desc}: ${e.message}`);
    failed++;
  }
}

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
