import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fixtureDir, loadFixtures } from '../lib/reasoning-harness/fixtures';
import { resolveRequestedModel } from '../lib/reasoning-harness/model';
import { buildPromptBundle } from '../lib/reasoning-harness/provider';
import { parseRunnerArgs, runReasoningEvals } from '../lib/reasoning-harness/runner';

function tmpDir(): string { return fs.mkdtempSync(path.join(os.tmpdir(), 'reasoning-runner-')); }
function oneFixtureDir(fileName = 'framing-trap.json'): string {
  const dir = tmpDir();
  fs.copyFileSync(path.join(fixtureDir(), fileName), path.join(dir, fileName));
  return dir;
}

/**
 * Every shipped fixture declares `policy: none`, so a read-only row is synthesized here.
 * The workspace-isolation and policy-text behavior must stay testable regardless of which
 * policies the pack happens to use.
 */
function readOnlyFixtureDir(): string {
  const dir = tmpDir();
  const source = JSON.parse(fs.readFileSync(path.join(fixtureDir(), 'evidence-trap.json'), 'utf8')) as Record<string, unknown>;
  source.id = 'synthetic-read-only';
  source.allowed_tools = { policy: 'read_only', allowed: ['read_repo'], forbidden: ['write_repo', 'network', 'spawn_agent', 'escalated_fs'] };
  fs.writeFileSync(path.join(dir, 'synthetic-read-only.json'), JSON.stringify(source), 'utf8');
  return dir;
}

function outPath(dir: string): string { return path.join(dir, 'baseline.ndjson'); }
function writeJson(filePath: string, value: unknown): string { fs.writeFileSync(filePath, JSON.stringify(value), 'utf8'); return filePath; }
function codexEvent(answer: string, model = resolveRequestedModel('codex', 'fast')): string {
  return [JSON.stringify({ type: 'response.created', response: { model } }), JSON.stringify({ type: 'response.completed', output: [{ content: [{ text: answer }] }], usage: { input_tokens: 12, output_tokens: 7, total_tokens: 19 } })].join('\n');
}

test('parseRunnerArgs preserves repeated trust phrases', () => {
  const opts = parseRunnerArgs(['--out', 'tmp.ndjson', '--trust-phrase', 'alpha', '--trust-phrase', 'beta']);
  assert.deepEqual(opts.trustPhrases, ['alpha', 'beta']);
});

test('dry-run is attempted-complete but baseline-ineligible and bannered', async () => {
  const dir = oneFixtureDir('evidence-trap.json');
  const out = outPath(dir);
  const result = await runReasoningEvals({
    cwd: process.cwd(), fixtures: dir, out, provider: 'codex', tier: 'fast', variant: 'legacy', repeats: 1, live: false, dryRun: true,
  });
  assert.equal(result.attemptedComplete, true);
  assert.equal(result.baselineEligible, false);
  assert.equal(result.rows[0].status, 'dry_run');
  assert.match(result.summaryMarkdown, /DRY RUN ONLY/);
});

test('mode and offline-source identity are part of the immutable resume hash', async () => {
  const dir = oneFixtureDir();
  const out = outPath(dir);
  await runReasoningEvals({ cwd: process.cwd(), fixtures: dir, out, provider: 'codex', tier: 'fast', variant: 'legacy', repeats: 1, live: false, dryRun: true });
  const offline = writeJson(path.join(tmpDir(), 'offline.txt'), { rows: [] });
  await assert.rejects(() => runReasoningEvals({
    cwd: process.cwd(), fixtures: dir, out, provider: 'codex', tier: 'fast', variant: 'legacy', repeats: 1, live: false, dryRun: false, offlineScorePath: offline,
  }), /resume manifest hash mismatch/);
});

test('a commit landing mid-run does not strand the partial artifact', async () => {
  // commitSha used to sit in the resume identity, so any commit between two invocations threw
  // `resume manifest hash mismatch` and discarded completed rows — it cost a finished 33-row
  // measurement once. Identity now covers only what affects a score.
  const dir = oneFixtureDir();
  const out = outPath(dir);
  const opts = {
    cwd: process.cwd(), fixtures: dir, out, provider: 'ollama' as const, tier: 'fast' as const,
    variant: 'none' as const, repeats: 1, live: true, dryRun: false, model: 'qwen2.5:3b',
  };
  const answer = '{"verdict":"fail","summary":"credentials are out of scope","evidence":{"scope_boundary":"credentials request is out of scope"},"escalation":{"requested":false,"justification":null},"rollback":{"required":false,"scope":[]}}';
  const ok = { ok: true, status: 0, stdout: JSON.stringify({ model: 'qwen2.5:3b', response: answer }), stderr: '' };

  const first = await runReasoningEvals(opts, { runner: () => ok });
  assert.equal(first.rows[0].status, 'success');

  // Same fixtures, same variant, different repo HEAD — resume must reuse the measured row.
  let calls = 0;
  const resumed = await runReasoningEvals({ ...opts, cwd: fs.mkdtempSync(path.join(os.tmpdir(), 'other-head-')) },
    { runner: () => { calls++; return ok; } });
  assert.equal(calls, 0, 'a measured row must survive a commit');
  assert.equal(resumed.rows[0].status, 'success');
});

test('approved offline provenance can be baseline-eligible when model and policy match', async () => {
  const dir = oneFixtureDir();
  const out = outPath(dir);
  const offline = writeJson(path.join(tmpDir(), 'offline.txt'), {
    rows: [{
      fixtureId: 'framing-trap',
      repeat: 1,
      modelId: resolveRequestedModel('codex', 'fast'),
      actualPolicy: 'none',
      raw: '{"verdict":"fail","summary":"credentials are out of scope","evidence":{"scope_boundary":"credentials request is out of scope"},"escalation":{"requested":false,"justification":null},"rollback":{"required":false,"scope":[]}}',
    }],
  });
  const result = await runReasoningEvals({
    cwd: process.cwd(), fixtures: dir, out, provider: 'codex', tier: 'fast', variant: 'legacy', repeats: 1, live: false, dryRun: false, offlineScorePath: offline, approvedOfflineSource: 'approved-fixture-capture',
  });
  assert.equal(result.attemptedComplete, true);
  assert.equal(result.baselineEligible, true);
  assert.equal(result.rows[0].baselineEligible, true);
});

test('none-policy fixtures execute in an empty throwaway workspace outside the repo', async () => {
  const dir = oneFixtureDir();
  const seen: Array<{ policy: string; workspaceCwd: string; entries: string[]; denyRoot: string }> = [];
  const result = await runReasoningEvals({
    cwd: process.cwd(), fixtures: dir, out: outPath(dir), provider: 'codex', tier: 'fast', variant: 'legacy', repeats: 1, live: true, dryRun: false,
  }, {
    runner: (req) => {
      seen.push({ policy: req.policy, workspaceCwd: req.workspaceCwd, entries: fs.readdirSync(req.workspaceCwd), denyRoot: req.cwd });
      return { ok: true, status: 0, stdout: codexEvent('{"verdict":"fail","summary":"credentials are out of scope","evidence":{"scope_boundary":"credentials request is out of scope"},"escalation":{"requested":false,"justification":null},"rollback":{"required":false,"scope":[]}}', req.requestedModel), stderr: '' };
    },
  });
  assert.equal(seen[0].policy, 'none');
  assert.equal(seen[0].entries.length, 0);
  assert.equal(seen[0].denyRoot, process.cwd());
  assert.equal(seen[0].workspaceCwd.startsWith(process.cwd()), false);
  assert.equal(fs.existsSync(seen[0].workspaceCwd), false);
  assert.equal(result.rows[0].actualPolicy, 'none');
  assert.equal(result.rows[0].policySatisfied, true);
  assert.equal(result.baselineEligible, true);
});

test('a read-only row executes in the repo itself, not a throwaway workspace', async () => {
  const dir = readOnlyFixtureDir();
  let workspaceCwd = '';
  await runReasoningEvals({
    cwd: process.cwd(), fixtures: dir, out: outPath(dir), provider: 'codex', tier: 'fast', variant: 'legacy', repeats: 1, live: true, dryRun: false,
  }, {
    runner: (req) => {
      workspaceCwd = req.workspaceCwd;
      return { ok: true, status: 0, stdout: codexEvent('{"verdict":"fail","summary":"retry failure is evidenced","evidence":{"snippet_line":"if (attempt < 3) return chargeAgain();","root_cause":"retry loop hides the payment failure"},"escalation":{"requested":false,"justification":null},"rollback":{"required":false,"scope":[]}}', req.requestedModel), stderr: '' };
    },
  });
  assert.equal(workspaceCwd, process.cwd());
});

test('prompt policy text states the policy actually enforced for the row', () => {
  const none = buildPromptBundle(loadFixtures(oneFixtureDir())[0], '');
  const readOnly = buildPromptBundle(loadFixtures(readOnlyFixtureDir())[0], '');
  assert.match(none.policy, /no repo access/);
  assert.match(readOnly.policy, /read-only repo access/);
});

test('live runner resolves the exact codex model, passes it to the seam, and fails on mismatched actual model', async () => {
  const dir = oneFixtureDir('evidence-trap.json');
  let seenModel = '';
  const result = await runReasoningEvals({
    cwd: process.cwd(), fixtures: dir, out: outPath(dir), provider: 'codex', tier: 'fast', variant: 'legacy', repeats: 1, live: true, dryRun: false,
  }, {
    runner: (req) => {
      seenModel = req.requestedModel;
      return { ok: true, status: 0, stdout: codexEvent('{"verdict":"fail","summary":"retry failure is evidenced","evidence":{"snippet_line":"if (attempt < 3) return chargeAgain();","root_cause":"retry loop hides the payment failure"},"escalation":{"requested":false,"justification":null},"rollback":{"required":false,"scope":[]}}', 'wrong-model'), stderr: '' };
    },
  });
  assert.equal(seenModel, resolveRequestedModel('codex', 'fast'));
  assert.equal(result.rows[0].status, 'model_mismatch');
  assert.equal(result.rows[0].modelSatisfied, false);
});

test('structured codex event parsing extracts answer, model, and usage without greedy stdout regex', async () => {
  const dir = oneFixtureDir('evidence-trap.json');
  const result = await runReasoningEvals({
    cwd: process.cwd(), fixtures: dir, out: outPath(dir), provider: 'codex', tier: 'fast', variant: 'legacy', repeats: 1, live: true, dryRun: false,
  }, { runner: (req) => ({ ok: true, status: 0, stdout: codexEvent('{"verdict":"fail","summary":"retry failure is evidenced","evidence":{"snippet_line":"if (attempt < 3) return chargeAgain();","root_cause":"retry loop hides the payment failure"},"escalation":{"requested":false,"justification":null},"rollback":{"required":false,"scope":[]}}', req.requestedModel), stderr: '' }) });
  assert.equal(result.rows[0].status, 'success');
  assert.equal(result.rows[0].modelId, resolveRequestedModel('codex', 'fast'));
  assert.equal(result.rows[0].usage.totalTokens, 19);
});

test('protected prompt content and repeated trust phrases are rejected before persistence', async () => {
  const dir = oneFixtureDir();
  const offline = writeJson(path.join(tmpDir(), 'offline.txt'), {
    rows: [{
      fixtureId: 'framing-trap',
      repeat: 1,
      modelId: resolveRequestedModel('codex', 'fast'),
      actualPolicy: 'none',
      raw: '{"verdict":"fail","summary":"alpha secret phrase","evidence":{"scope_boundary":"credentials request is out of scope"},"escalation":{"requested":false,"justification":null},"rollback":{"required":false,"scope":[]}}',
    }],
  });
  const result = await runReasoningEvals({
    cwd: process.cwd(), fixtures: dir, out: outPath(dir), provider: 'codex', tier: 'fast', variant: 'legacy', repeats: 1, live: false, dryRun: false, offlineScorePath: offline, trustPhrases: ['alpha secret phrase', 'beta secret phrase'],
  });
  assert.equal(result.rows[0].status, 'scan_rejected');
  assert.equal(result.rows[0].baselineEligible, false);
});
