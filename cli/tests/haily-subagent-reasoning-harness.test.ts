import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const HOOK_LIB = path.resolve(__dirname, '..', '..', 'kit', 'hooks', 'haily-lib');

const subagent = require(path.join(HOOK_LIB, 'subagent.cjs')) as {
  JUDGMENT_AGENTS: string[];
  getSections(agentType: string): string[];
  buildReasoningHarness(env: Record<string, string>, config?: unknown): string[];
};
const model = require(path.join(HOOK_LIB, 'model.cjs')) as {
  canonicalTier(id: string): string | null;
};

/** Same 4-bytes-per-token proxy docs/token-overhead.md uses for injected sections. */
function estimateTokens(lines: string[]): number {
  return Math.ceil(Buffer.byteLength(lines.join('\n'), 'utf8') / 4);
}

const BUDGETS: Record<string, number> = { fast: 120, medium: 120, thinking: 80 };
const MECHANICAL_AGENTS = ['haily-git-manager', 'haily-mcp-manager', 'haily-tester', 'haily-reporter'];
const APEX_AGENTS = ['haily-judge', 'haily-advisor'];
const CAPPED_AGENTS = ['haily-api-designer', 'haily-test-architect'];

/** The harness ships off; every positive assertion must opt in explicitly. */
const ON = { reasoningHarness: { enabled: true } };

test('every eligible tier stays inside its runtime token budget', () => {
  for (const [tier, budget] of Object.entries(BUDGETS)) {
    const lines = subagent.buildReasoningHarness({ HL_MODEL_TIER: tier, HL_SESSION_MODEL: 'claude-haiku-4-5' }, ON);
    const tokens = estimateTokens(lines);
    assert.ok(tokens > 0, `tier ${tier} produced no harness`);
    assert.ok(tokens <= budget, `tier ${tier} used ${tokens} est. tokens, budget ${budget}`);
  }
});

test('the compressed thinking form is materially smaller than the full form', () => {
  const full = estimateTokens(subagent.buildReasoningHarness({ HL_MODEL_TIER: 'fast' }, ON));
  const compressed = estimateTokens(subagent.buildReasoningHarness({ HL_MODEL_TIER: 'thinking' }, ON));
  assert.ok(compressed < full, `expected compressed (${compressed}) < full (${full})`);
});

test('every judgment agent routes the reasoning section', () => {
  for (const agent of subagent.JUDGMENT_AGENTS) {
    assert.ok(subagent.getSections(agent).includes('reasoning'), `${agent} is missing the reasoning key`);
  }
});

test('mechanical, apex, capped, and unknown agents never route it', () => {
  for (const agent of [...MECHANICAL_AGENTS, ...APEX_AGENTS, ...CAPPED_AGENTS, 'not-a-real-agent', '']) {
    assert.ok(!subagent.getSections(agent).includes('reasoning'), `${agent} must not receive the harness`);
  }
});

test('the reasoning section is ordered ahead of output economy, and econ is never dropped', () => {
  for (const agent of subagent.JUDGMENT_AGENTS) {
    const keys = subagent.getSections(agent);
    assert.equal(keys.filter((key) => key === 'econ').length, 1, `${agent} lost or duplicated econ`);
    assert.ok(keys.indexOf('reasoning') < keys.indexOf('econ'), `${agent} ordered reasoning after econ`);
  }
});

test('a flat provider map resolves its model to the highest mapped tier, never fast', () => {
  // kit/model-map.json maps all four gemini tiers to gemini-2.5-pro; resolving that
  // to `fast` would hand a capable model the weak-model harness.
  assert.equal(model.canonicalTier('gemini-2.5-pro'), 'ultra');
});

test('a duplicate top-tier mapping resolves to ultra, not thinking', () => {
  // codex maps both thinking and ultra to gpt-5.6-sol.
  assert.equal(model.canonicalTier('gpt-5.6-sol'), 'ultra');
});

test('an exact match still beats a fuzzy substring match', () => {
  // codex fast is gpt-5.6-luna and medium is gpt-5.6-terra — the base id must not
  // fuzzy-match into the longer one's tier.
  assert.equal(model.canonicalTier('gpt-5.6-terra'), 'medium');
  assert.equal(model.canonicalTier('gpt-5.6-luna'), 'fast');
});

test('installed hooks can resolve GPT tiers from the central kit model map', () => {
  const source = fs.readFileSync(path.join(process.cwd(), 'kit', 'hooks', 'haily-lib', 'model.cjs'), 'utf8');
  assert.match(source, /\.hailykit['"], 'kit['"], 'model-map\.json'/);
});

test('an unresolvable model id yields no tier, so the harness no-ops', () => {
  assert.equal(model.canonicalTier('totally-unknown-model'), null);
  assert.deepEqual(subagent.buildReasoningHarness({ HL_MODEL_TIER: '' }), []);
});

test('the harness ships off — an eligible tier injects nothing without the opt-in', () => {
  for (const tier of Object.keys(BUDGETS)) {
    assert.deepEqual(subagent.buildReasoningHarness({ HL_MODEL_TIER: tier }), [], `tier ${tier} injected by default`);
    assert.deepEqual(subagent.buildReasoningHarness({ HL_MODEL_TIER: tier }, {}), []);
    assert.deepEqual(subagent.buildReasoningHarness({ HL_MODEL_TIER: tier }, { reasoningHarness: { enabled: 'true' } }), []);
  }
});

test('the harness never asks for private reasoning to be disclosed', () => {
  for (const tier of Object.keys(BUDGETS)) {
    // Opted in on purpose: asserting against an empty array would pass vacuously.
    const text = subagent.buildReasoningHarness({ HL_MODEL_TIER: tier }, ON).join('\n').toLowerCase();
    assert.ok(text.length > 0, `tier ${tier} produced nothing to inspect`);
    for (const banned of ['chain-of-thought', 'chain of thought', 'show your reasoning', 'think out loud']) {
      assert.ok(!text.includes(banned), `tier ${tier} requests disclosed reasoning: ${banned}`);
    }
  }
});
