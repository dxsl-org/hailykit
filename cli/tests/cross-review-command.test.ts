import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runCrossReview } from '../lib/cross-review';
import { cmdCrossReview } from '../commands/cross-review';
import { findCommand } from '../commands/registry';
import type { DetectDeps } from '../lib/cross-review/detect';
import type { ResolveDeps } from '../lib/cross-review/resolve';

const MAP: Record<string, Record<string, string>> = {
  gemini: { thinking: 'gemini-3.1-pro-preview', medium: 'm', fast: 'f', ultra: 'u' },
};
const detectAll = (legs: string[]): DetectDeps => ({
  hasExecutable: (b) => legs.includes(b),
  env: { GEMINI_API_KEY: 'x', OPENAI_API_KEY: 'x' },
  homeDir: '/h', exists: () => false, ollamaReachable: () => false,
});
const resolveDeps: ResolveDeps = { getMap: (p) => MAP[p] ?? {}, ollamaModels: () => [] };

test('disable config short-circuits to a skip', () => {
  const r = runCrossReview({
    stage: 'plan', artifact: 'x', sessionProvider: 'claude', cwd: '.',
    config: { disable: true },
    detectDeps: detectAll(['gemini']), resolveDeps,
  });
  assert.match(r.skipped?.reason ?? '', /disabled/);
});

test('no eligible CLI yields a skip, not an error', () => {
  const r = runCrossReview({
    stage: 'plan', artifact: 'x', sessionProvider: 'claude', cwd: '.',
    config: {},
    detectDeps: detectAll([]), resolveDeps,
  });
  assert.equal(r.reviewer, undefined);
  assert.match(r.skipped?.reason ?? '', /no eligible reviewer/);
});

test('successful review returns reviewer + normalized findings', () => {
  const r = runCrossReview({
    stage: 'plan', artifact: 'my plan', sessionProvider: 'claude', cwd: '.',
    config: {},
    detectDeps: detectAll(['gemini']), resolveDeps,
    runner: (leg, prompt) => {
      assert.equal(leg.cli, 'gemini');
      assert.match(prompt, /my plan/); // artifact reached the reviewer
      return { ok: true, stdout: '{"findings":[{"severity":"critical","summary":"risk"}]}' };
    },
  });
  assert.equal(r.reviewer?.cli, 'gemini');
  assert.equal(r.findings.length, 1);
  assert.equal(r.findings[0].severity, 'critical');
});

test('falls through to the next leg when the first invocation fails', () => {
  let calls = 0;
  const r = runCrossReview({
    stage: 'code', artifact: 'diff', sessionProvider: 'claude', cwd: '.',
    config: {},
    detectDeps: detectAll(['codex', 'gemini']), resolveDeps: { getMap: (p) => (p === 'codex' ? { thinking: 'gpt-5.5' } : MAP[p] ?? {}), ollamaModels: () => [] },
    runner: (leg) => {
      calls++;
      if (leg.cli === 'codex') return { ok: false, stdout: '' };
      return { ok: true, stdout: '{"findings":[]}' };
    },
  });
  assert.equal(calls, 2);
  assert.equal(r.reviewer?.cli, 'gemini');
  assert.equal(r.skipped, undefined);
});

test('command exits 1 on unreadable input', () => {
  const code = cmdCrossReview({ stage: 'plan', input: '/nonexistent/plan.md', sessionProvider: 'claude', json: true });
  assert.equal(code, 1);
});

test('command exits 0 on a graceful skip (no reviewer)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hl-cmd-'));
  const file = path.join(dir, 'plan.md');
  fs.writeFileSync(file, '# plan');
  // Force disable via .hl.json so no real CLI is spawned in the test.
  fs.writeFileSync(path.join(dir, '.hl.json'), JSON.stringify({ crossReview: { disable: true } }));
  const code = cmdCrossReview({ stage: 'plan', input: file, sessionProvider: 'claude', json: true, cwd: dir });
  assert.equal(code, 0);
});

test('registry exposes cross-review with its value-flags', () => {
  const spec = findCommand('cross-review');
  assert.ok(spec);
  for (const f of ['stage', 'input', 'session-provider', 'tier', 'reviewer']) {
    assert.ok(spec!.valueFlags.includes(f), `missing value-flag ${f}`);
  }
});
