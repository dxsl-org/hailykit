import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { execFileSync } from 'node:child_process';

// Regression coverage for phase-02 (standards-detection visibility, weak-model-lift
// wave): when stack detection misses (unmapped language, unusual monorepo) a weak
// model silently loses all standards scaffolding and nobody notices. haily-session.cjs
// now emits a `standards: <list>` / `standards: none detected` segment gated on
// resolveStandardsPath resolvability (not raw detection), and context.cjs's
// buildLangStandardsSection emits a one-line miss-note instead of a silent [] when a
// language is detected but no standards file ships for it.

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const SESSION_HOOK_PATH = path.join(REPO_ROOT, 'kit', 'hooks', 'haily-session.cjs');
const CONTEXT_LIB_PATH = path.join(REPO_ROOT, 'kit', 'hooks', 'haily-lib', 'context.cjs');

interface HookResult { status: number; stdout: string; stderr: string }

function runHook(input: string, cwd: string): HookResult {
  try {
    const stdout = execFileSync(process.execPath, [SESSION_HOOK_PATH], {
      input,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd,
      env: process.env,
    });
    return { status: 0, stdout, stderr: '' };
  } catch (e) {
    const err = e as { status: number; stdout: string; stderr: string };
    return { status: err.status, stdout: err.stdout ?? '', stderr: err.stderr ?? '' };
  }
}

function payload(sessionId: string): string {
  return JSON.stringify({ session_id: sessionId, source: 'startup' });
}

function uniqueSessionId(label: string): string {
  return `phase2-${label}-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// haily-lib/session.cjs persists dedup/env state at this fixed path — clean it up
// around each test so runs don't leak state into each other (mirrors haily-rules-
// injection.test.ts convention).
function sessionStatePath(sessionId: string): string {
  return path.join(os.tmpdir(), `hl-session-${sessionId}.json`);
}

function cleanupSession(sessionId: string): void {
  try { fs.unlinkSync(sessionStatePath(sessionId)); } catch { /* not present */ }
}

// Dir where a language IS detected (tsconfig.json → typescript) and a local
// standards file for it actually resolves.
const resolvedDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hl-standards-resolved-'));
fs.writeFileSync(path.join(resolvedDir, 'tsconfig.json'), '{}\n');
fs.mkdirSync(path.join(resolvedDir, '.claude', 'standards'), { recursive: true });
fs.writeFileSync(path.join(resolvedDir, '.claude', 'standards', 'lang-typescript.md'), '# TS standards\n');

// Dir where nothing is detectable at all (no lang/framework/extras signal).
const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hl-standards-none-'));

after(() => {
  fs.rmSync(resolvedDir, { recursive: true, force: true });
  fs.rmSync(emptyDir, { recursive: true, force: true });
});

test('SessionStart: standards line lists resolved standards when a shipped file exists', () => {
  const sessionId = uniqueSessionId('resolved');
  cleanupSession(sessionId);
  try {
    const result = runHook(payload(sessionId), resolvedDir);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /standards: lang-typescript/);
  } finally {
    cleanupSession(sessionId);
  }
});

test('SessionStart: standards segment reads "none detected" when nothing resolves', () => {
  const sessionId = uniqueSessionId('none');
  cleanupSession(sessionId);
  try {
    const result = runHook(payload(sessionId), emptyDir);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /standards: none detected/);
  } finally {
    cleanupSession(sessionId);
  }
});

test('SessionStart: fails open on malformed stdin (exit 0, no crash)', () => {
  const sessionId = uniqueSessionId('malformed');
  cleanupSession(sessionId);
  try {
    const result = runHook('not-json', emptyDir);
    assert.equal(result.status, 0);
  } finally {
    cleanupSession(sessionId);
  }
});

test('buildLangStandardsSection: emits a one-line miss-note when a language is detected but unshipped', () => {
  const { buildLangStandardsSection } = require(CONTEXT_LIB_PATH) as {
    buildLangStandardsSection: (language: string | null, configDirName?: string) => string[];
  };
  const lines = buildLangStandardsSection('made-up-lang-does-not-exist');
  assert.equal(lines.length, 3);
  assert.match(lines[0], /^## Language Standards \(made-up-lang-does-not-exist\)$/);
  assert.match(lines[1], /No standards file shipped for made-up-lang-does-not-exist/);
});

test('buildLangStandardsSection: returns [] when no language is detected', () => {
  const { buildLangStandardsSection } = require(CONTEXT_LIB_PATH) as {
    buildLangStandardsSection: (language: string | null, configDirName?: string) => string[];
  };
  assert.deepEqual(buildLangStandardsSection(null), []);
});
