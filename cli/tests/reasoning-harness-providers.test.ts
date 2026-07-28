import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fixtureDir, loadFixtures, parseFixtureJson, validateProviderEligibility } from '../lib/reasoning-harness/fixtures';
import { resolveRequestedModel } from '../lib/reasoning-harness/model';
import { getAdapter } from '../lib/reasoning-harness/providers';
import { extractAnswer } from '../lib/reasoning-harness/providers/answer-json';
import { parseRunnerArgs, runReasoningEvals } from '../lib/reasoning-harness/runner';

const ANSWER = '{"verdict":"fail","summary":"credentials are out of scope","evidence":{"scope_boundary":"credentials request is out of scope"},"escalation":{"requested":false,"justification":null},"rollback":{"required":false,"scope":[]}}';

function oneFixtureDir(fileName = 'framing-trap.json'): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'reasoning-providers-'));
  fs.copyFileSync(path.join(fixtureDir(), fileName), path.join(dir, fileName));
  return dir;
}

test('every declared provider resolves to an adapter', () => {
  for (const id of ['codex', 'gemini', 'ollama'] as const) assert.equal(getAdapter(id).id, id);
});

test('ollama enforces no-tool for every requested policy because /api/generate has no tool loop', () => {
  const ollama = getAdapter('ollama');
  assert.equal(ollama.enforcedPolicy('none'), 'none');
  assert.equal(ollama.enforcedPolicy('read_only'), 'none');
});

test('cli adapters enforce no-tool only for none rows, read-only otherwise', () => {
  for (const id of ['codex', 'gemini'] as const) {
    assert.equal(getAdapter(id).enforcedPolicy('none'), 'none');
    assert.equal(getAdapter(id).enforcedPolicy('read_only'), 'read_only');
  }
});

test('a provider holding less capability than the fixture allows stays eligible', () => {
  // Synthesized: every shipped fixture is `none`, but the ordering rule that lets a
  // no-tool provider score a read-only fixture must still be covered.
  const source = JSON.parse(fs.readFileSync(path.join(fixtureDir(), 'evidence-trap.json'), 'utf8')) as Record<string, unknown>;
  source.allowed_tools = { policy: 'read_only', allowed: ['read_repo'], forbidden: ['write_repo', 'network', 'spawn_agent', 'escalated_fs'] };
  const readOnlyFixture = parseFixtureJson(JSON.stringify(source));
  assert.equal(readOnlyFixture.allowed_tools.policy, 'read_only');
  assert.equal(validateProviderEligibility(readOnlyFixture, 'api_plain'), true);
  assert.equal(validateProviderEligibility(readOnlyFixture, 'sandbox_read_only'), true);
});

test('a provider holding more capability than the fixture allows is rejected', () => {
  const noneFixture = loadFixtures(oneFixtureDir())[0];
  assert.equal(noneFixture.allowed_tools.policy, 'none');
  assert.equal(validateProviderEligibility(noneFixture, 'sandbox_read_only'), false);
  assert.equal(validateProviderEligibility(noneFixture, 'workspace_agent'), false);
});

test('gemini json output yields answer, serving model, and token usage', () => {
  const stdout = `Loaded cached credentials.\n${JSON.stringify({
    response: `Here you go:\n\`\`\`json\n${ANSWER}\n\`\`\``,
    stats: { models: { 'gemini-2.5-pro': { tokens: { prompt: 900, candidates: 120, total: 1020 } } } },
  })}`;
  const parsed = getAdapter('gemini').parse(stdout);
  assert.equal(parsed.modelId, 'gemini-2.5-pro');
  assert.equal(parsed.usage.totalTokens, 1020);
  assert.equal(JSON.parse(parsed.answer!).verdict, 'fail');
});

test('ollama json output yields answer, model, and eval counts', () => {
  const stdout = JSON.stringify({ model: 'qwen2.5:3b', response: ANSWER, prompt_eval_count: 340, eval_count: 96 });
  const parsed = getAdapter('ollama').parse(stdout);
  assert.equal(parsed.modelId, 'qwen2.5:3b');
  assert.equal(parsed.usage.inputTokens, 340);
  assert.equal(parsed.usage.totalTokens, 436);
});

test('answer extraction never fuses a schema echo with the real answer', () => {
  const echoed = `{"verdict":"string","summary":"string"}\nFinal answer:\n${ANSWER}`;
  const parsed = JSON.parse(extractAnswer(echoed)!);
  assert.equal(parsed.verdict, 'fail');
  assert.equal(Object.keys(parsed).length, 5);
});

test('unparseable model output is a scored zero with full coverage, not an invalid cell', async () => {
  const dir = oneFixtureDir();
  const result = await runReasoningEvals({
    cwd: process.cwd(), fixtures: dir, out: path.join(dir, 'out.ndjson'), provider: 'ollama', tier: 'fast', variant: 'legacy', repeats: 1, live: true, dryRun: false, model: 'qwen2.5:3b',
  }, { runner: () => ({ ok: true, status: 0, stdout: '{"model":"qwen2.5:3b","response":"I cannot comply."}', stderr: '' }) });
  assert.equal(result.rows[0].status, 'parse_failure');
  assert.equal(result.rows[0].weightedScore, 0);
  assert.equal(result.rows[0].coverage, 1);
  assert.equal(result.rows[0].hardChecksPassed, 0);
  assert.equal(result.baselineEligible, true);
});

test('a transport failure leaves a null score so it cannot be averaged as measured', async () => {
  const dir = oneFixtureDir();
  const result = await runReasoningEvals({
    cwd: process.cwd(), fixtures: dir, out: path.join(dir, 'out.ndjson'), provider: 'ollama', tier: 'fast', variant: 'legacy', repeats: 1, live: true, dryRun: false, model: 'qwen2.5:3b',
  }, { runner: () => ({ ok: false, status: null, stdout: '', stderr: 'fetch failed', error: 'tool_not_found' as const }) });
  assert.equal(result.rows[0].status, 'unavailable_cli');
  assert.equal(result.rows[0].weightedScore, null);
  assert.equal(result.rows[0].coverage, 0);
  assert.equal(result.baselineEligible, false);
});

test('ollama scoring a read-only fixture is policy-satisfied and baseline-eligible', async () => {
  const dir = oneFixtureDir('evidence-trap.json');
  const answer = '{"verdict":"fail","summary":"retry failure is evidenced","evidence":{"snippet_line":"if (attempt < 3) return chargeAgain();","root_cause":"retry loop hides the payment failure"},"escalation":{"requested":false,"justification":null},"rollback":{"required":false,"scope":[]}}';
  const result = await runReasoningEvals({
    cwd: process.cwd(), fixtures: dir, out: path.join(dir, 'out.ndjson'), provider: 'ollama', tier: 'fast', variant: 'legacy', repeats: 1, live: true, dryRun: false, model: 'qwen2.5:3b',
  }, { runner: () => ({ ok: true, status: 0, stdout: JSON.stringify({ model: 'qwen2.5:3b', response: answer, prompt_eval_count: 300, eval_count: 90 }), stderr: '' }) });
  assert.equal(result.rows[0].actualPolicy, 'none');
  assert.equal(result.rows[0].policySatisfied, true);
  assert.equal(result.baselineEligible, true);
});

test('an answer that merely mentions credentials is not misread as an auth failure', async () => {
  const dir = oneFixtureDir();
  const credentialTalk = '{"verdict":"fail","summary":"the api key request is unauthorized and out of scope","evidence":{"scope_boundary":"production database credentials are outside the copy task"},"escalation":{"requested":false,"justification":null},"rollback":{"required":false,"scope":[]}}';
  const result = await runReasoningEvals({
    cwd: process.cwd(), fixtures: dir, out: path.join(dir, 'out.ndjson'), provider: 'ollama', tier: 'fast', variant: 'legacy', repeats: 1, live: true, dryRun: false, model: 'qwen2.5:3b',
  }, { runner: () => ({ ok: true, status: 0, stdout: JSON.stringify({ model: 'qwen2.5:3b', response: credentialTalk }), stderr: '' }) });
  assert.equal(result.rows[0].status, 'success');
});

test('an out-of-quota provider message is an auth_failure, not a scored row', async () => {
  const dir = oneFixtureDir();
  const result = await runReasoningEvals({
    cwd: process.cwd(), fixtures: dir, out: path.join(dir, 'out.ndjson'), provider: 'codex', tier: 'fast', variant: 'legacy', repeats: 1, live: true, dryRun: false,
  }, { runner: () => ({ ok: false, status: 1, stdout: '', stderr: "ERROR: You've hit your usage limit." }) });
  assert.equal(result.rows[0].status, 'auth_failure');
});

test('resume retries an environment failure instead of baking it in as a measurement', async () => {
  const dir = oneFixtureDir();
  const out = path.join(dir, 'out.ndjson');
  const opts = {
    cwd: process.cwd(), fixtures: dir, out, provider: 'ollama' as const, tier: 'fast' as const, variant: 'legacy' as const, repeats: 1, live: true, dryRun: false, model: 'qwen2.5:3b',
  };
  const refused = await runReasoningEvals(opts, { runner: () => ({ ok: false, status: 1, stdout: '', stderr: 'rate limit exceeded, please log in again' }) });
  assert.equal(refused.rows[0].status, 'auth_failure');
  assert.equal(refused.baselineEligible, false);

  const retried = await runReasoningEvals(opts, { runner: () => ({ ok: true, status: 0, stdout: JSON.stringify({ model: 'qwen2.5:3b', response: ANSWER }), stderr: '' }) });
  assert.equal(retried.rows.length, 1);
  assert.equal(retried.rows[0].status, 'success');
  assert.equal(retried.baselineEligible, true);
});

test('a measured row is never re-run on resume', async () => {
  const dir = oneFixtureDir();
  const out = path.join(dir, 'out.ndjson');
  const opts = {
    cwd: process.cwd(), fixtures: dir, out, provider: 'ollama' as const, tier: 'fast' as const, variant: 'legacy' as const, repeats: 1, live: true, dryRun: false, model: 'qwen2.5:3b',
  };
  await runReasoningEvals(opts, { runner: () => ({ ok: true, status: 0, stdout: JSON.stringify({ model: 'qwen2.5:3b', response: ANSWER }), stderr: '' }) });
  let calls = 0;
  const resumed = await runReasoningEvals(opts, { runner: () => { calls++; return { ok: true, status: 0, stdout: '', stderr: '' }; } });
  assert.equal(calls, 0);
  assert.equal(resumed.rows[0].status, 'success');
});

test('a note carrying a secret is withheld rather than persisted', async () => {
  const dir = oneFixtureDir();
  const result = await runReasoningEvals({
    cwd: process.cwd(), fixtures: dir, out: path.join(dir, 'out.ndjson'), provider: 'ollama', tier: 'fast', variant: 'legacy', repeats: 1, live: true, dryRun: false, model: 'qwen2.5:3b',
  }, { runner: () => ({ ok: false, status: 1, stdout: '', stderr: 'unauthorized for sk-ant-api03-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' }) });
  assert.equal(result.rows[0].status, 'auth_failure');
  assert.doesNotMatch(result.rows[0].note ?? '', /sk-ant-api03/);
});

test('the model override lands in the requested model and changes run identity', () => {
  const mapped = parseRunnerArgs(['--out', 'a.ndjson', '--provider', 'ollama']);
  const pinned = parseRunnerArgs(['--out', 'a.ndjson', '--provider', 'ollama', '--model', 'qwen2.5:3b']);
  assert.equal(mapped.model, undefined);
  assert.equal(resolveRequestedModel('ollama', 'fast', pinned.model), 'qwen2.5:3b');
  assert.notEqual(resolveRequestedModel('ollama', 'fast'), 'qwen2.5:3b');
});
