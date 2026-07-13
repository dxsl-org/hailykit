import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

// Regression coverage for the path-doubling bug flagged in phase-01's Deviation Log
// (.agents/260713-0257-weak-model-lift-fixes/phase-01-injection-path-repair.md):
// buildReminderContext's Paths/Plan Context sections unconditionally joined baseDir
// onto planCtx.reportsPath, but getReportsPath/resolvePlanPath already build
// reportsPath as an absolute path (derived from process.cwd() or the resolved
// plan.md's directory) whenever an active plan is resolved. Joining an absolute
// baseDir onto an already-absolute path produced e.g.
// "D:\hailykit\D:\hailykit\.agents\...\reports" instead of
// "D:\hailykit\.agents\...\reports". Fixed by guarding every baseDir join with
// path.isAbsolute so an already-absolute candidate passes through untouched.

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const CONTEXT_LIB_PATH = path.join(REPO_ROOT, 'kit', 'hooks', 'haily-lib', 'context.cjs');
const SESSION_LIB_PATH = path.join(REPO_ROOT, 'kit', 'hooks', 'haily-lib', 'session.cjs');

const { buildReminderContext } = require(CONTEXT_LIB_PATH) as {
  buildReminderContext: (params: { sessionId?: string; baseDir?: string; prompt?: string }) => { content: string };
};
const { writeSessionState, getSessionTempPath } = require(SESSION_LIB_PATH) as {
  writeSessionState: (sessionId: string, state: Record<string, unknown>) => boolean;
  getSessionTempPath: (sessionId: string) => string;
};

function uniqueSessionId(label: string): string {
  return `plan-paths-${label}-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function cleanupSession(sessionId: string): void {
  try { fs.unlinkSync(getSessionTempPath(sessionId)); } catch { /* not present */ }
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

test('buildReminderContext: baseDir is not double-prefixed onto an already-absolute session-resolved plan reportsPath', () => {
  const sessionId = uniqueSessionId('session-resolved');
  const tmpPlanDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hl-plan-paths-'));
  const planPath = path.join(tmpPlanDir, 'plan.md');
  fs.writeFileSync(planPath, '# Plan\n');
  cleanupSession(sessionId);
  writeSessionState(sessionId, { activePlan: planPath });

  try {
    const result = buildReminderContext({ sessionId, baseDir: REPO_ROOT, prompt: 'add a feature' });
    const expectedReports = path.join(tmpPlanDir, 'reports');

    // Direct evidence the bug is gone: the exact expected reports line appears.
    assert.match(result.content, new RegExp(`Reports: ${escapeRegExp(expectedReports)} \\|`));

    // Belt-and-suspenders: REPO_ROOT must not appear twice concatenated back-to-back
    // anywhere in the injected content (the shape the old bug produced).
    assert.doesNotMatch(
      result.content,
      new RegExp(`${escapeRegExp(REPO_ROOT)}[\\\\/]+${escapeRegExp(REPO_ROOT)}`),
    );
  } finally {
    cleanupSession(sessionId);
    fs.rmSync(tmpPlanDir, { recursive: true, force: true });
  }
});

test('buildReminderContext: baseDir is still joined onto relative plans/docs paths when no active plan is resolved', () => {
  // Control case: with no session state and no active plan, plansPath/docsPath come
  // from relative config defaults (".agents", "docs") and MUST still be joined with
  // baseDir — proves the path.isAbsolute guard only skips already-absolute candidates,
  // it does not disable baseDir joining altogether.
  const sessionId = uniqueSessionId('no-plan');
  cleanupSession(sessionId);

  try {
    const result = buildReminderContext({ sessionId, baseDir: REPO_ROOT, prompt: 'add a feature' });
    const expectedPlans = path.join(REPO_ROOT, '.agents');
    const expectedDocs = path.join(REPO_ROOT, 'docs');

    assert.match(result.content, new RegExp(`Plans: ${escapeRegExp(expectedPlans)}/ \\|`));
    assert.match(result.content, new RegExp(`Docs: ${escapeRegExp(expectedDocs)}/ \\|`));
  } finally {
    cleanupSession(sessionId);
  }
});
