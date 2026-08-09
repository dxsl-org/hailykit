import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { execFileSync } from 'node:child_process';

// Regression coverage for the injection-path repair: haily-rules.cjs used
// to call buildReminderContext(sessionId, prompt, transcriptPath) — three
// positional args — against context.cjs's options-object signature
// ({ sessionId, config, staticEnv, configDirName, baseDir, prompt }). Every
// destructured field landed undefined and the returned {content, lines,
// sections} object was written via `content + '\n'`, emitting the literal
// string "[object Object]" on every prompt since v1.0.0 (93017b8). The dedup
// TTL helpers were also never wired up. This suite spawns the real hook so a
// regression on the call-site or the TTL wiring fails a test, not a silent
// no-op.

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const HOOK_PATH = path.join(REPO_ROOT, 'kit', 'hooks', 'haily-rules.cjs');
const REVIEW_CONTENT = '# Review Audit\nSENTINEL_REVIEW_AUDIT_CONTEXTUAL_MARKER\n';
const ORCHESTRATION_CONTENT = '# Orchestration\nSENTINEL_ORCHESTRATION_CONTEXTUAL_MARKER\n';
const TEAM_CONTENT = '# Team Coordination\nSENTINEL_TEAM_CONTEXTUAL_MARKER\n';

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
    return { status: err.status, stdout: err.stdout, stderr: err.stderr };
  }
}

function payload(sessionId: string, prompt: string): string {
  return JSON.stringify({ session_id: sessionId, prompt });
}

// haily-lib/session.cjs persists TTL/dedup state at this fixed path — clean it
// up around each test so runs don't leak cooldown state into each other.
function sessionStatePath(sessionId: string): string {
  return path.join(os.tmpdir(), `hl-session-${sessionId}.json`);
}

function cleanupSession(sessionId: string): void {
  try { fs.unlinkSync(sessionStatePath(sessionId)); } catch { /* not present */ }
}

function uniqueSessionId(label: string): string {
  return `rulesinj-${label}-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function extractContextualBlock(output: string, content: string): string {
  const expected = content.trim();
  const start = output.indexOf(expected);
  assert.notEqual(start, -1);
  const after = output.slice(start + expected.length);
  const nextSection = after.indexOf('\n\n## ');
  return (nextSection === -1 ? output.slice(start) : output.slice(start, start + expected.length + nextSection)).trim();
}

// Isolated project dir so config/contextual-rule lookups don't depend on this
// machine's real ~/.claude install or hailykit's own repo-local .claude/ (which
// has no contextual/ dir since this repo IS the kit source, not an install target).
const tmpProjectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hl-rules-test-'));
fs.mkdirSync(path.join(tmpProjectDir, '.claude', 'contextual'), { recursive: true });
fs.writeFileSync(path.join(tmpProjectDir, '.claude', 'contextual', 'review-audit-self-decision.md'), REVIEW_CONTENT);
fs.writeFileSync(path.join(tmpProjectDir, '.claude', 'contextual', 'orchestration-protocol.md'), ORCHESTRATION_CONTENT);
fs.writeFileSync(path.join(tmpProjectDir, '.claude', 'contextual', 'team-coordination-rules.md'), TEAM_CONTENT);

after(() => {
  fs.rmSync(tmpProjectDir, { recursive: true, force: true });
});

test('injection: emits real markdown sections, never the stringified-object bug', () => {
  const sessionId = uniqueSessionId('fresh');
  cleanupSession(sessionId);
  try {
    const result = runHook(payload(sessionId, 'please review this code'), tmpProjectDir);
    assert.equal(result.status, 0);
    assert.doesNotMatch(result.stdout, /\[object Object\]/);
    assert.match(result.stdout, /^## Rules$/m);
    assert.match(result.stdout, /^## Paths$/m);
    assert.match(result.stdout, /SENTINEL_REVIEW_AUDIT_CONTEXTUAL_MARKER/);
  } finally {
    cleanupSession(sessionId);
  }
});

test('injection: cooldown suppresses the heavy block on an immediate second call', () => {
  const sessionId = uniqueSessionId('cooldown');
  cleanupSession(sessionId);
  try {
    const first = runHook(payload(sessionId, 'add a new feature'), tmpProjectDir);
    assert.equal(first.status, 0);
    assert.match(first.stdout, /^## Rules$/m);

    const second = runHook(payload(sessionId, 'add a new feature'), tmpProjectDir);
    assert.equal(second.status, 0);
    assert.equal(second.stdout.trim(), '');
  } finally {
    cleanupSession(sessionId);
  }
});

test('injection: contextual (keyword-matched) rules still fire during cooldown', () => {
  const sessionId = uniqueSessionId('contextual-cooldown');
  cleanupSession(sessionId);
  try {
    const first = runHook(payload(sessionId, 'add a new feature'), tmpProjectDir);
    assert.equal(first.status, 0);
    assert.match(first.stdout, /^## Rules$/m);

    const second = runHook(payload(sessionId, 'please review this code'), tmpProjectDir);
    assert.equal(second.status, 0);
    assert.doesNotMatch(second.stdout, /^## Rules$/m);
    assert.match(second.stdout, /SENTINEL_REVIEW_AUDIT_CONTEXTUAL_MARKER/);
  } finally {
    cleanupSession(sessionId);
  }
});

test('injection: same matching prompt keeps identical contextual bytes across full build and cooldown path', () => {
  const sessionId = uniqueSessionId('review-equivalence');
  cleanupSession(sessionId);
  try {
    const expected = REVIEW_CONTENT.trim();
    const first = runHook(payload(sessionId, 'please review this code'), tmpProjectDir);
    assert.equal(first.status, 0);

    const second = runHook(payload(sessionId, 'please review this code'), tmpProjectDir);
    assert.equal(second.status, 0);
    assert.equal(second.stdout.trim(), expected);
    assert.equal(extractContextualBlock(first.stdout, REVIEW_CONTENT), expected);
  } finally {
    cleanupSession(sessionId);
  }
});

test('injection: orchestration and team prompts hit their own contextual files', () => {
  const orchestrationSession = uniqueSessionId('orchestration');
  const teamSession = uniqueSessionId('team');
  cleanupSession(orchestrationSession);
  cleanupSession(teamSession);
  try {
    const orchestration = runHook(payload(orchestrationSession, 'please spawn a subagent for this task'), tmpProjectDir);
    assert.equal(orchestration.status, 0);
    assert.match(orchestration.stdout, /SENTINEL_ORCHESTRATION_CONTEXTUAL_MARKER/);

    const team = runHook(payload(teamSession, 'message the teammate in the agent team'), tmpProjectDir);
    assert.equal(team.status, 0);
    assert.match(team.stdout, /SENTINEL_TEAM_CONTEXTUAL_MARKER/);
  } finally {
    cleanupSession(orchestrationSession);
    cleanupSession(teamSession);
  }
});

test('injection: fails open on malformed stdin (no crash, no output)', () => {
  const result = runHook('not-json', tmpProjectDir);
  assert.equal(result.status, 0);
  assert.equal(result.stdout.trim(), '');
});

test('contextual source files keep required safety and status phrases after compaction', () => {
  const review = fs.readFileSync(path.join(REPO_ROOT, 'kit', 'contextual', 'review-audit-self-decision.md'), 'utf8');
  assert.match(review, /verified/i);
  assert.match(review, /threat model/i);
  assert.match(review, /NEVER silently reverse decisions the user has already confirmed/i);
  assert.match(review, /confidence/i);

  const orchestration = fs.readFileSync(path.join(REPO_ROOT, 'kit', 'contextual', 'orchestration-protocol.md'), 'utf8');
  assert.match(orchestration, /Work context/i);
  assert.match(orchestration, /Reports/i);
  assert.match(orchestration, /Plans/i);
  assert.match(orchestration, /DONE_WITH_CONCERNS/i);
  assert.match(orchestration, /Verification/i);

  const team = fs.readFileSync(path.join(REPO_ROOT, 'kit', 'contextual', 'team-coordination-rules.md'), 'utf8');
  assert.match(team, /File Ownership/i);
  assert.match(team, /STOP and report to lead immediately/i);
  assert.match(team, /SendMessage/i);
  assert.match(team, /Do not treat idle notifications as completion signals/i);
});
