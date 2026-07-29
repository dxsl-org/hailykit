import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

// Regression coverage for the loop-guard tripwire (reward-hacking
// guards): while HL_LOOP_GUARD_ACTIVE=1 (set by hc-optimize/hc-goal around
// their loop), haily-access.cjs must block Edit/Write/MultiEdit/NotebookEdit
// targeting test/spec files or the regression-gate script, and must NOT
// affect behavior when the marker is unset. The marker is agent-writable —
// this is a SECONDARY tripwire + audit layer, not the load-bearing guard
// (that is the regression-gate test-name-set shrinkage check). These tests
// spawn the real hook script so a wiring regression fails a test, not a
// silent pass.

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const HOOK_PATH = path.join(REPO_ROOT, 'kit', 'hooks', 'haily-access.cjs');

interface HookResult { status: number; stdout: string; stderr: string }

function runHook(input: string, env: NodeJS.ProcessEnv = {}): HookResult {
  const mergedEnv = { ...process.env };
  delete mergedEnv.HL_LOOP_GUARD_ACTIVE;
  Object.assign(mergedEnv, env);
  try {
    const stdout = execFileSync(process.execPath, [HOOK_PATH], {
      input,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: REPO_ROOT,
      env: mergedEnv,
    });
    return { status: 0, stdout, stderr: '' };
  } catch (e) {
    const err = e as { status: number; stdout: string; stderr: string };
    return { status: err.status, stdout: err.stdout, stderr: err.stderr };
  }
}

function payload(toolName: string, toolInput: Record<string, unknown>): string {
  return JSON.stringify({ tool_name: toolName, tool_input: toolInput, cwd: REPO_ROOT });
}

test('loop-guard tripwire: blocks Edit to a test path when marker is active', () => {
  const result = runHook(payload('Edit', { file_path: 'foo.test.ts' }), { HL_LOOP_GUARD_ACTIVE: '1' });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /LOOP-GUARD TRIPWIRE/);
});

test('loop-guard tripwire: blocks MultiEdit to a test path when marker is active', () => {
  const result = runHook(
    payload('MultiEdit', { file_path: 'foo.test.ts', edits: [{ old_string: 'a', new_string: 'b' }] }),
    { HL_LOOP_GUARD_ACTIVE: '1' },
  );
  assert.equal(result.status, 2);
  assert.match(result.stderr, /LOOP-GUARD TRIPWIRE/);
});

test('loop-guard tripwire: blocks NotebookEdit to a test path when marker is active', () => {
  const result = runHook(
    payload('NotebookEdit', { notebook_path: 'notebooks/foo.test.ipynb', new_source: 'x' }),
    { HL_LOOP_GUARD_ACTIVE: '1' },
  );
  assert.equal(result.status, 2);
  assert.match(result.stderr, /LOOP-GUARD TRIPWIRE/);
});

test('loop-guard tripwire: blocks Edit to the regression-gate script when marker is active', () => {
  const result = runHook(
    payload('Edit', { file_path: 'kit/skills/hc-goal/scripts/diff-tests.sh' }),
    { HL_LOOP_GUARD_ACTIVE: '1' },
  );
  assert.equal(result.status, 2);
  assert.match(result.stderr, /LOOP-GUARD TRIPWIRE/);
});

test('loop-guard tripwire: allows Edit to a test path when marker is unset (default behavior unchanged)', () => {
  const result = runHook(payload('Edit', { file_path: 'foo.test.ts' }));
  assert.equal(result.status, 0);
});

test('loop-guard tripwire: allows Edit to a non-test path even when marker is active', () => {
  const result = runHook(payload('Edit', { file_path: 'foo.ts' }), { HL_LOOP_GUARD_ACTIVE: '1' });
  assert.equal(result.status, 0);
});

test('loop-guard tripwire: fails open on malformed stdin even when marker is active', () => {
  const result = runHook('not-json', { HL_LOOP_GUARD_ACTIVE: '1' });
  assert.equal(result.status, 0);
});

test('loop-guard tripwire: blocks a win32 absolute drive-prefixed test path when marker is active', () => {
  // Regression test: matchPath() stripped a leading '/' but not a Windows drive
  // prefix (e.g. "D:"), so an absolute win32 path reached the vendored 'ignore'
  // lib's path assertion and threw RangeError — silently fail-opening this
  // tripwire (and the pre-existing checkScoutBlock) on every Windows machine,
  // since Claude Code always sends absolute file_path values there.
  const result = runHook(
    payload('Edit', { file_path: 'D:\\proj\\foo.test.ts' }),
    { HL_LOOP_GUARD_ACTIVE: '1' },
  );
  assert.equal(result.status, 2);
  assert.match(result.stderr, /LOOP-GUARD TRIPWIRE/);
});
