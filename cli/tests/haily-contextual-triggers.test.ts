import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { execFileSync } from 'node:child_process';

// Regression coverage for phase-03 (skill-triggered contextual rules, weak-model-lift
// wave): CONTEXTUAL_TRIGGERS in context.cjs used to match prompt keywords only, and
// referenced three rule files (orchestration-protocol.md, team-coordination-rules.md,
// review-audit-self-decision.md) that were never ported into kit/ — nothing installed,
// so the feature injected nothing even after the injection-path repair in phase-01.
// This suite verifies: (1) the ported files exist and are real content, (2) typing a
// skill slug (e.g. "/hc-review") triggers the same injection as a keyword, (3) a
// prompt matching two triggers for one file injects it once, (4) fail-open on
// malformed input.

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const CONTEXT_LIB_PATH = path.join(REPO_ROOT, 'kit', 'hooks', 'haily-lib', 'context.cjs');
const HOOK_PATH = path.join(REPO_ROOT, 'kit', 'hooks', 'haily-rules.cjs');
const KIT_CONTEXTUAL_DIR = path.join(REPO_ROOT, 'kit', 'contextual');

const { buildContextualRulesSection } = require(CONTEXT_LIB_PATH) as {
  buildContextualRulesSection: (prompt: string, configDirName?: string) => string[];
};

interface HookResult { status: number; stdout: string; stderr: string }

function runHook(input: string, cwd: string): HookResult {
  try {
    const stdout = execFileSync(process.execPath, [HOOK_PATH], {
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

function payload(sessionId: string, prompt: string): string {
  return JSON.stringify({ session_id: sessionId, prompt });
}

function sessionStatePath(sessionId: string): string {
  return path.join(os.tmpdir(), `hl-session-${sessionId}.json`);
}

function cleanupSession(sessionId: string): void {
  try { fs.unlinkSync(sessionStatePath(sessionId)); } catch { /* not present */ }
}

function uniqueSessionId(label: string): string {
  return `phase3-${label}-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// Isolated project dir with real contextual files copied from kit/, mirroring what
// the installer's copyDir would place at .claude/contextual/ on a real machine.
const tmpProjectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hl-contextual-test-'));
const projectContextualDir = path.join(tmpProjectDir, '.claude', 'contextual');
fs.mkdirSync(projectContextualDir, { recursive: true });
for (const file of fs.readdirSync(KIT_CONTEXTUAL_DIR)) {
  fs.copyFileSync(path.join(KIT_CONTEXTUAL_DIR, file), path.join(projectContextualDir, file));
}

after(() => {
  fs.rmSync(tmpProjectDir, { recursive: true, force: true });
});

test('kit/contextual: all three referenced rule files exist with real content', () => {
  for (const file of ['orchestration-protocol.md', 'team-coordination-rules.md', 'review-audit-self-decision.md']) {
    const fullPath = path.join(KIT_CONTEXTUAL_DIR, file);
    assert.ok(fs.existsSync(fullPath), `${file} must exist under kit/contextual/`);
    const content = fs.readFileSync(fullPath, 'utf8');
    assert.ok(content.trim().length > 100, `${file} must have real content, not a stub`);
  }
});

// buildContextualRulesSection resolves contextual/ relative to process.cwd() (via
// resolveContextualPath), so these direct-call tests chdir into the tmp project dir
// that already has the real ported files copied in, then restore cwd in `finally`.
function withCwd<T>(dir: string, fn: () => T): T {
  const prev = process.cwd();
  process.chdir(dir);
  try {
    return fn();
  } finally {
    process.chdir(prev);
  }
}

test('buildContextualRulesSection: plain keyword still triggers review-audit content', () => {
  const lines = withCwd(tmpProjectDir, () => buildContextualRulesSection('please review this code', '.claude'));
  assert.match(lines.join('\n'), /Verified Decisions Are Sticky/);
});

test('buildContextualRulesSection: unknown prompt injects nothing', () => {
  const lines = withCwd(tmpProjectDir, () => buildContextualRulesSection('what is the weather like', '.claude'));
  assert.deepEqual(lines, []);
});

test('hook: "/hc-review" skill slug injects review-audit contextual content', () => {
  const sessionId = uniqueSessionId('slash-review');
  cleanupSession(sessionId);
  try {
    const result = runHook(payload(sessionId, '/hc-review this PR before merge'), tmpProjectDir);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /Verified Decisions Are Sticky/);
  } finally {
    cleanupSession(sessionId);
  }
});

test('hook: "/hc-security" skill slug injects review-audit contextual content', () => {
  const sessionId = uniqueSessionId('slash-security');
  cleanupSession(sessionId);
  try {
    const result = runHook(payload(sessionId, 'run /hc-security --deep on this module'), tmpProjectDir);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /Verified Decisions Are Sticky/);
  } finally {
    cleanupSession(sessionId);
  }
});

test('hook: "/hc-cook" skill slug injects orchestration contextual content', () => {
  const sessionId = uniqueSessionId('slash-cook');
  cleanupSession(sessionId);
  try {
    const result = runHook(payload(sessionId, '/hc-cook implement the auth feature'), tmpProjectDir);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /Delegation Context \(MANDATORY\)/);
  } finally {
    cleanupSession(sessionId);
  }
});

test('hook: "/hc-goal" and "/hc-plan" skill slugs also trigger orchestration content', () => {
  for (const slug of ['/hc-goal', '/hc-plan']) {
    const sessionId = uniqueSessionId(`slash-${slug.replace('/', '')}`);
    cleanupSession(sessionId);
    try {
      const result = runHook(payload(sessionId, `${slug} build the feature end to end`), tmpProjectDir);
      assert.equal(result.status, 0);
      assert.match(result.stdout, /Delegation Context \(MANDATORY\)/, `${slug} should trigger orchestration content`);
    } finally {
      cleanupSession(sessionId);
    }
  }
});

test('hook: unknown prompt injects no contextual content', () => {
  const sessionId = uniqueSessionId('no-match');
  cleanupSession(sessionId);
  try {
    const result = runHook(payload(sessionId, 'what is the weather like'), tmpProjectDir);
    assert.equal(result.status, 0);
    assert.doesNotMatch(result.stdout, /Verified Decisions Are Sticky/);
    assert.doesNotMatch(result.stdout, /Delegation Context \(MANDATORY\)/);
    assert.doesNotMatch(result.stdout, /File Ownership \(CRITICAL\)/);
  } finally {
    cleanupSession(sessionId);
  }
});

test('buildContextualRulesSection: dedup — a prompt matching two patterns for one file injects it once', () => {
  // "review" (keyword) + "/hc-review" (slug) both map to review-audit-self-decision.md.
  const lines = withCwd(tmpProjectDir, () => buildContextualRulesSection('review this code, also run /hc-review', '.claude'));
  const joined = lines.join('\n');
  const occurrences = joined.split('Verified Decisions Are Sticky').length - 1;
  assert.equal(occurrences, 1, 'review-audit content must appear exactly once');
});

test('hook: prompt matching two triggers for the same file injects content once (not duplicated)', () => {
  const sessionId = uniqueSessionId('dedup');
  cleanupSession(sessionId);
  try {
    const result = runHook(payload(sessionId, 'review this code, also run /hc-review'), tmpProjectDir);
    assert.equal(result.status, 0);
    const occurrences = result.stdout.split('Verified Decisions Are Sticky').length - 1;
    assert.equal(occurrences, 1);
  } finally {
    cleanupSession(sessionId);
  }
});

test('hook: fails open on malformed stdin (no crash, no output)', () => {
  const result = runHook('not-json', tmpProjectDir);
  assert.equal(result.status, 0);
  assert.equal(result.stdout.trim(), '');
});

// Regression coverage for the slash-slug path false-positive: `/hc-cook\b` used
// to match inside a plain path mention like `kit/skills/hc-cook/SKILL.md`
// because the `\b` after "hc-cook" is satisfied by the following "/" the same
// as it would be by whitespace. The tightened pattern requires the slug to
// stand alone as a command token (not preceded by a path-ish char, not
// followed by another "/").
test('buildContextualRulesSection: path mention of a skill dir does not inject orchestration content', () => {
  const lines = withCwd(tmpProjectDir, () => buildContextualRulesSection(
    'see kit/skills/hc-cook/SKILL.md for the reference table', '.claude',
  ));
  assert.deepEqual(lines, []);
});

test('buildContextualRulesSection: slash command at the very start of the prompt still injects', () => {
  const lines = withCwd(tmpProjectDir, () => buildContextualRulesSection('/hc-review the diff', '.claude'));
  assert.match(lines.join('\n'), /Verified Decisions Are Sticky/);
});

test('buildContextualRulesSection: slash command mid-sentence after whitespace still injects', () => {
  const lines = withCwd(tmpProjectDir, () => buildContextualRulesSection(
    'before you merge please run /hc-review on this PR', '.claude',
  ));
  assert.match(lines.join('\n'), /Verified Decisions Are Sticky/);
});
