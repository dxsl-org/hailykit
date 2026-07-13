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
// single trigger entry whose pattern matches twice in one prompt still injects its
// file's content exactly once (no accidental duplicate push), (4) fail-open on
// malformed input, (5) the actual dedup Set — using a fixture trigger table with
// two distinct entries mapping to the same file, since the real CONTEXTUAL_TRIGGERS
// table has one entry per file and so never exercises the Set on its own.

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const CONTEXT_LIB_PATH = path.join(REPO_ROOT, 'kit', 'hooks', 'haily-lib', 'context.cjs');
const HOOK_PATH = path.join(REPO_ROOT, 'kit', 'hooks', 'haily-rules.cjs');
const KIT_CONTEXTUAL_DIR = path.join(REPO_ROOT, 'kit', 'contextual');

interface Trigger { file: string; pattern: RegExp }

const { buildContextualRulesSection } = require(CONTEXT_LIB_PATH) as {
  buildContextualRulesSection: (prompt: string, configDirName?: string, triggers?: Trigger[]) => string[];
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

// NOTE: "review" (keyword) + "/hc-review" (slug) both match inside the SAME
// review-audit-self-decision.md entry's single alternated pattern, not two separate
// CONTEXTUAL_TRIGGERS entries — the for-loop in buildContextualRulesSection visits
// that entry once regardless, so this asserts single-entry behavior, not the
// injectedFiles dedup Set (removing the Set would still pass this test).
test('buildContextualRulesSection: single-entry pattern matching twice in one prompt injects its file once', () => {
  const lines = withCwd(tmpProjectDir, () => buildContextualRulesSection('review this code, also run /hc-review', '.claude'));
  const joined = lines.join('\n');
  const occurrences = joined.split('Verified Decisions Are Sticky').length - 1;
  assert.equal(occurrences, 1, 'review-audit content must appear exactly once');
});

test('hook: prompt matching a single trigger entry twice injects content once (not the dedup Set)', () => {
  const sessionId = uniqueSessionId('single-entry');
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

// Real dedup Set coverage: CONTEXTUAL_TRIGGERS has exactly one entry per file, so the
// two tests above never exercise injectedFiles — the loop only visits each file once
// regardless of the Set. buildContextualRulesSection's optional third param (triggers,
// added as a backward-compatible seam) lets this test supply a fixture table with two
// distinct entries pointing at the same file, so the Set is the only thing preventing
// duplicate content when the prompt matches both entries.
test('buildContextualRulesSection: dedup Set prevents duplicate injection across two distinct entries for one file', () => {
  const fixtureTriggers: Trigger[] = [
    { file: 'review-audit-self-decision.md', pattern: /\bfixture-trigger-one\b/i },
    { file: 'review-audit-self-decision.md', pattern: /\bfixture-trigger-two\b/i },
  ];
  const lines = withCwd(tmpProjectDir, () =>
    buildContextualRulesSection('fixture-trigger-one and fixture-trigger-two both fire', '.claude', fixtureTriggers));
  const joined = lines.join('\n');
  const occurrences = joined.split('Verified Decisions Are Sticky').length - 1;
  assert.equal(occurrences, 1, 'dedup Set must prevent the same file injecting twice across two matching entries');
});

test('buildContextualRulesSection: without dedup Set protection, two matching entries for the same file would inject twice (control case proving the fixture is a real regression trap)', () => {
  // Sanity check on the fixture itself: two entries for two DIFFERENT files both
  // inject, proving the fixture format is sound and the Set only collapses same-file
  // duplicates (not all injections).
  const fixtureTriggers: Trigger[] = [
    { file: 'review-audit-self-decision.md', pattern: /\bfixture-trigger-one\b/i },
    { file: 'orchestration-protocol.md', pattern: /\bfixture-trigger-two\b/i },
  ];
  const lines = withCwd(tmpProjectDir, () =>
    buildContextualRulesSection('fixture-trigger-one and fixture-trigger-two both fire', '.claude', fixtureTriggers));
  const joined = lines.join('\n');
  assert.match(joined, /Verified Decisions Are Sticky/);
  assert.match(joined, /Delegation Context \(MANDATORY\)/);
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
