import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { cmdGitInsights } from '../commands/git-insights';

function hasGit(): boolean {
  try { execFileSync('git', ['--version'], { stdio: 'ignore' }); return true; } catch { return false; }
}
function git(cwd: string, args: string[], dateIso?: string): void {
  const env = dateIso
    ? { ...process.env, GIT_AUTHOR_DATE: `${dateIso}T12:00:00`, GIT_COMMITTER_DATE: `${dateIso}T12:00:00` }
    : process.env;
  execFileSync('git', args, { cwd, stdio: 'ignore', env });
}
function commitAs(cwd: string, author: string, msg: string, dateIso: string): void {
  git(cwd, ['-c', `user.name=${author}`, '-c', `user.email=${author}@test.local`, 'commit', '-m', msg], dateIso);
}

/** Run cmdGitInsights with --json and parse the captured envelope. */
function runJson(opts: Parameters<typeof cmdGitInsights>[0]): { code: number; env: any } {
  const lines: string[] = [];
  const orig = console.log;
  console.log = (...a: unknown[]) => { lines.push(a.map(String).join(' ')); };
  let code: number;
  try { code = cmdGitInsights(opts); } finally { console.log = orig; }
  return { code, env: JSON.parse(lines.join('\n')) };
}

test('git-insights: emits churn/bus-factor/velocity + change-impact on a fixture', { skip: !hasGit() }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hl-gi-'));
  function recentIso(daysAgo: number): string {
    return new Date(Date.now() - daysAgo * 86_400_000).toISOString().slice(0, 10);
  }
  try {
    git(dir, ['init', '-q']);
    fs.writeFileSync(path.join(dir, 'hot.ts'), 'export const a = 0;\nif (a) { }\n');
    git(dir, ['add', '.']);
    commitAs(dir, 'Alice', 'base', recentIso(10));

    // Two more commits to hot.ts → churn, and a new file in the last commit.
    fs.writeFileSync(path.join(dir, 'hot.ts'), 'export const a = 1;\nif (a) { for (;;) break; }\n');
    git(dir, ['add', '.']);
    commitAs(dir, 'Alice', 'change 1', recentIso(5));
    fs.writeFileSync(path.join(dir, 'hot.ts'), 'export const a = 2;\nif (a) { while (a) break; }\n');
    fs.writeFileSync(path.join(dir, 'new.ts'), 'export const b = 1;\n');
    git(dir, ['add', '.']);
    commitAs(dir, 'Bob', 'change 2', recentIso(1));

    const { code, env } = runJson({ path: dir, json: true, since: 180, top: 10, ref: 'HEAD~1' });
    assert.equal(code, 0);
    assert.equal(env.ok, true);
    assert.equal(env.tool, 'git-insights');
    assert.ok(env.data.git, 'git insights present');
    assert.ok(env.data.git.busFactor >= 1);
    assert.ok(Array.isArray(env.data.git.riskHotspots));
    assert.ok(env.data.activity, 'activity present');

    // Change impact for HEAD~1..HEAD: new.ts added, hot.ts modified.
    const ci = env.data.changeImpact;
    assert.ok(ci, 'change impact present');
    assert.equal(ci.base, 'HEAD~1');
    const touched = ci.files.map((f: any) => f.file).sort();
    assert.deepEqual(touched, ['hot.ts', 'new.ts']);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('git-insights: outside a repo exits 0 with git: null', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hl-gi-plain-'));
  try {
    const { code, env } = runJson({ path: dir, json: true, since: 180, top: 10 });
    assert.equal(code, 0);
    assert.equal(env.ok, true);
    assert.equal(env.data.git, null);
    assert.equal(env.data.reason, 'not a git repository');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
