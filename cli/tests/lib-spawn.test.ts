import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resolveExecutable, runTool } from '../lib/spawn';

// `node` is always on PATH while the test suite runs.

test('resolveExecutable: resolves node to an absolute path', () => {
  const resolved = resolveExecutable('node');
  assert.ok(typeof resolved === 'string' && path.isAbsolute(resolved), `got ${String(resolved)}`);
});

test('resolveExecutable: blocks a binary resolving inside the deny root', () => {
  const real = resolveExecutable('node');
  assert.ok(typeof real === 'string');
  // Deny the directory that actually contains node → must be refused.
  const blocked = resolveExecutable('node', path.dirname(real as string));
  assert.equal(blocked, 'blocked');
});

test('resolveExecutable: returns null for a non-existent tool', () => {
  assert.equal(resolveExecutable('definitely-not-a-real-binary-xyz'), null);
});

test('runTool: captures stdout on a non-zero exit', () => {
  const r = runTool('node', ['-e', 'process.stdout.write("hello"); process.exit(7)'], { cwd: process.cwd() });
  assert.equal(r.ok, true);          // ran successfully (exit code is data, not failure)
  assert.equal(r.status, 7);
  assert.equal(r.stdout, 'hello');
});

test('runTool: child does not inherit non-allowlisted env (no token leak)', () => {
  process.env.HL_SECRET_TOKEN = 'leak-me';
  try {
    const r = runTool('node', ['-e', 'process.stdout.write(process.env.HL_SECRET_TOKEN ?? "absent")'], { cwd: process.cwd() });
    assert.equal(r.stdout, 'absent', 'secret env must not reach the child');
  } finally {
    delete process.env.HL_SECRET_TOKEN;
  }
});

test('runTool: reports tool_not_found instead of throwing', () => {
  const r = runTool('definitely-not-a-real-binary-xyz', [], { cwd: process.cwd() });
  assert.equal(r.ok, false);
  assert.equal(r.error, 'tool_not_found');
});

test('runTool: executes a Windows .cmd shim (the deps-audit case)', { skip: process.platform !== 'win32' }, () => {
  // Tool dir is separate from the scanned tree (cwd) — mirrors npm.cmd living
  // outside the audited repo, so the in-tree-binary guard does not fire.
  const toolDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hl-spawn-tool-'));
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hl-spawn-work-'));
  const prevPath = process.env.PATH;
  try {
    fs.writeFileSync(path.join(toolDir, 'mytool.cmd'), '@echo off\r\necho shim-ran\r\nexit /b 5\r\n');
    process.env.PATH = `${toolDir}${path.delimiter}${prevPath ?? ''}`;
    const r = runTool('mytool', [], { cwd: workDir });
    assert.equal(r.ok, true, `expected spawn to succeed, got ${r.error ?? 'ok'}`);
    assert.equal(r.status, 5, 'non-zero exit from a .cmd is captured, not a spawn failure');
    assert.ok(r.stdout.includes('shim-ran'), 'stdout from the .cmd must be captured');
  } finally {
    process.env.PATH = prevPath;
    fs.rmSync(toolDir, { recursive: true, force: true });
    fs.rmSync(workDir, { recursive: true, force: true });
  }
});
