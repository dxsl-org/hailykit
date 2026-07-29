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
const { buildReasoningHarness } = require(path.join(__dirname, '..', 'subagent.cjs'));
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

// ── subagent.cjs: buildReasoningHarness ─────────────────────────────────────
// Opt-in config; every positive case must pass it explicitly.
const ON = { reasoningHarness: { enabled: true } };

test('buildReasoningHarness is OFF by default — no config means no injection', () => {
  for (const tier of ['fast', 'medium', 'thinking']) {
    assert.deepEqual(buildReasoningHarness({ HL_MODEL_TIER: tier }), [], `tier ${tier} injected without opt-in`);
  }
  assert.deepEqual(buildReasoningHarness({ HL_MODEL_TIER: 'fast' }, {}), []);
  assert.deepEqual(buildReasoningHarness({ HL_MODEL_TIER: 'fast' }, { reasoningHarness: {} }), []);
});
test('buildReasoningHarness treats a non-true enabled value as off', () => {
  for (const value of ['true', 1, {}, null]) {
    assert.deepEqual(buildReasoningHarness({ HL_MODEL_TIER: 'fast' }, { reasoningHarness: { enabled: value } }), []);
  }
});
test('buildReasoningHarness returns [] when HL_MODEL_TIER is unset', () => {
  assert.deepEqual(buildReasoningHarness({}, ON), []);
});
test('buildReasoningHarness returns [] for ultra (already max reasoning budget)', () => {
  assert.deepEqual(buildReasoningHarness({ HL_MODEL_TIER: 'ultra' }, ON), []);
});
test('buildReasoningHarness returns [] for an unrecognized tier string', () => {
  assert.deepEqual(buildReasoningHarness({ HL_MODEL_TIER: 'deep' }, ON), []);
});
test('buildReasoningHarness injects the sequence for thinking/medium/fast', () => {
  for (const tier of ['thinking', 'medium', 'fast']) {
    const text = buildReasoningHarness({ HL_MODEL_TIER: tier }, ON).join('\n').toLowerCase();
    assert.ok(text.includes('## reasoning procedure'), `expected a harness for tier ${tier}`);
    for (const step of ['floor', 'ground', 'attack', 'deliver']) {
      assert.ok(text.includes(step), `tier ${tier} missing step ${step}`);
    }
  }
});
test('ultrathink is added only when the session model is Claude family', () => {
  const claude = buildReasoningHarness({ HL_MODEL_TIER: 'fast', HL_SESSION_MODEL: 'claude-haiku-4-5' }, ON).join('\n');
  const other = buildReasoningHarness({ HL_MODEL_TIER: 'fast', HL_SESSION_MODEL: 'qwen2.5:3b' }, ON).join('\n');
  const unknown = buildReasoningHarness({ HL_MODEL_TIER: 'fast' }).join('\n');
  assert.ok(claude.includes('ultrathink:'));
  assert.ok(!other.includes('ultrathink'));
  assert.ok(!unknown.includes('ultrathink'));
});
test('the harness prescribes no output format (Phase 3 baseline regression)', () => {
  for (const tier of ['thinking', 'medium', 'fast']) {
    const text = buildReasoningHarness({ HL_MODEL_TIER: tier }, ON).join('\n').toLowerCase();
    assert.ok(!text.includes('confidence (high'), `tier ${tier} reintroduced a confidence format`);
    assert.ok(!text.includes('file:line'), `tier ${tier} reintroduced a citation format`);
    assert.ok(text.includes('report contract') || tier === 'thinking', 'full form must defer to the report contract');
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
