import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { diffNumstat } from '../lib/git';

function hasGit(): boolean {
  try { execFileSync('git', ['--version'], { stdio: 'ignore' }); return true; } catch { return false; }
}

function git(cwd: string, args: string[]): void {
  execFileSync('git', args, { cwd, stdio: 'ignore' });
}

function commit(cwd: string, msg: string): void {
  git(cwd, ['-c', 'user.name=Test', '-c', 'user.email=t@test.local', 'commit', '-m', msg]);
}

test('diffNumstat: parses added/deleted lines per file', { skip: !hasGit() }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hl-numstat-'));
  try {
    git(dir, ['init', '-q']);
    fs.writeFileSync(path.join(dir, 'a.ts'), 'line1\nline2\n');
    git(dir, ['add', '.']);
    commit(dir, 'base');

    fs.writeFileSync(path.join(dir, 'a.ts'), 'line1\nline2\nline3\nline4\n'); // +2
    fs.writeFileSync(path.join(dir, 'b.ts'), 'new\n');                         // +1 (new file)
    git(dir, ['add', '.']);
    commit(dir, 'change');

    const entries = diffNumstat('HEAD~1', dir);
    const a = entries.find(e => e.file === 'a.ts');
    const b = entries.find(e => e.file === 'b.ts');
    assert.ok(a && b, 'expected both files in numstat');
    assert.equal(a.adds, 2);
    assert.equal(a.dels, 0);
    assert.equal(b.adds, 1);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('diffNumstat: binary file yields null adds/dels', { skip: !hasGit() }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hl-numstat-bin-'));
  try {
    git(dir, ['init', '-q']);
    fs.writeFileSync(path.join(dir, 'seed.txt'), 'x\n');
    git(dir, ['add', '.']);
    commit(dir, 'base');

    fs.writeFileSync(path.join(dir, 'img.bin'), Buffer.from([0, 1, 2, 0, 255, 0]));
    git(dir, ['add', '.']);
    commit(dir, 'add binary');

    const entries = diffNumstat('HEAD~1', dir);
    const bin = entries.find(e => e.file === 'img.bin');
    assert.ok(bin, 'expected binary file entry');
    assert.equal(bin.adds, null);
    assert.equal(bin.dels, null);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('diffNumstat: returns empty array outside a repo', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hl-numstat-plain-'));
  try {
    assert.deepEqual(diffNumstat('HEAD~1', dir), []);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
