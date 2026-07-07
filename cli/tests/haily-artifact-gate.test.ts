import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

// Regression coverage for the fail-open wiring bug: haily-artifact.cjs used to
// call `readArtifacts(dir).files` (readArtifacts returns `{ artifacts, errors }`,
// no `files` key) then feed the resulting `undefined` into `validateShapes`,
// which threw inside `Object.entries(undefined)`. main().catch swallowed the
// throw and exited 0 — every ship gate silently passed regardless of missing
// or malformed artifacts. The fix routes through the validateArtifacts
// composite in validator.cjs. These tests spawn the real hook script (manual
// `--stage`/`--artifact-dir` mode) and assert on its actual exit code, so a
// regression of the wiring reintroduces a failing test, not a silent pass.

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const HOOK_PATH = path.join(REPO_ROOT, 'kit', 'hooks', 'haily-artifact.cjs');

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'haily-artifact-gate-'));
}

function writeJson(dir: string, name: string, value: unknown): void {
  fs.writeFileSync(path.join(dir, name), JSON.stringify(value));
}

const VALID_CONTEXT = {
  skill: 'hc:cook', mode: 'auto', task: 't', acceptanceCriteria: ['a'],
  touchpoints: ['f.ts'], publicContracts: ['c'], blastRadius: ['b'], scoutSummary: 's',
};
const VALID_RISK = { highRisk: false, reasons: [], autoStopRequired: false, humanApproved: false, largeDiff: false };
const VALID_VERIFICATION = {
  commands: [{ command: 'npm test', status: 'pass', exitCode: 0, timestamp: '2026-07-07T00:00:00.000Z', summary: 'ok' }],
};
const VALID_REVIEW = {
  decision: 'PASS', score: 9, criticalCount: 0, acceptanceCoverage: ['a'],
  regressionProof: ['p'], contractStatus: 'OK', blockingReasons: [],
};
const VALID_ADVERSARIAL = { decision: 'PASS', disprovenClaims: [], unverifiedClaims: [], missingProof: [], reachableRegressions: [] };

/** Writes all 5 REQUIRED_FILES artifacts; `contextOverrides` merges onto context-snippets.json. */
function writeValidArtifactDir(dir: string, contextOverrides: Record<string, unknown> = {}): void {
  writeJson(dir, 'context-snippets.json', { ...VALID_CONTEXT, ...contextOverrides });
  writeJson(dir, 'risk-gate.json', VALID_RISK);
  writeJson(dir, 'verification.json', VALID_VERIFICATION);
  writeJson(dir, 'review-decision.json', VALID_REVIEW);
  writeJson(dir, 'adversarial-validation.json', VALID_ADVERSARIAL);
}

function runHook(args: string[]): { status: number; stdout: string; stderr: string } {
  try {
    const stdout = execFileSync(process.execPath, [HOOK_PATH, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { status: 0, stdout, stderr: '' };
  } catch (e) {
    const err = e as { status: number; stdout: string; stderr: string };
    return { status: err.status, stdout: err.stdout, stderr: err.stderr };
  }
}

// ---------------------------------------------------------------------------
// Prerequisite bug fix: hard-stage block actually fires on a missing artifact
// ---------------------------------------------------------------------------

test('haily-artifact gate: hard stage BLOCKS (exit 2) when required artifacts are missing', () => {
  const dir = tmpDir();
  const result = runHook(['--stage', 'ship', '--artifact-dir', dir]);
  assert.equal(result.status, 2, `expected exit 2, got ${result.status}. stdout=${result.stdout} stderr=${result.stderr}`);
  assert.match(result.stdout, /"decision":"block"/);
  assert.match(result.stdout, /required artifact is missing/);
});

test('haily-artifact gate: hard stage PASSES (exit 0) when all required artifacts are valid', () => {
  const dir = tmpDir();
  writeValidArtifactDir(dir);
  const result = runHook(['--stage', 'ship', '--artifact-dir', dir]);
  assert.equal(result.status, 0, `expected exit 0, got ${result.status}. stdout=${result.stdout} stderr=${result.stderr}`);
});

// ---------------------------------------------------------------------------
// Evidence gate — CONDITIONAL_FILES marker mechanism
// ---------------------------------------------------------------------------

test('evidence gate: marker present + execution-evidence.json missing -> hard block', () => {
  const dir = tmpDir();
  writeValidArtifactDir(dir, { evidence: 'expected' });
  const result = runHook(['--stage', 'ship', '--artifact-dir', dir]);
  assert.equal(result.status, 2);
  assert.match(result.stdout, /execution-evidence\.json/);
});

test('evidence gate: marker present + noRuntimeSurface evidence -> passes', () => {
  const dir = tmpDir();
  writeValidArtifactDir(dir, { evidence: 'expected' });
  writeJson(dir, 'execution-evidence.json', { phase: 'p1', noRuntimeSurface: 'docs-only change' });
  const result = runHook(['--stage', 'ship', '--artifact-dir', dir]);
  assert.equal(result.status, 0, `stdout=${result.stdout} stderr=${result.stderr}`);
});

test('evidence gate: marker present + malformed execution-evidence.json -> hard block', () => {
  const dir = tmpDir();
  writeValidArtifactDir(dir, { evidence: 'expected' });
  fs.writeFileSync(path.join(dir, 'execution-evidence.json'), '{not valid json');
  const result = runHook(['--stage', 'ship', '--artifact-dir', dir]);
  assert.equal(result.status, 2);
  assert.match(result.stdout, /not valid JSON/);
});

test('evidence gate: no marker (legacy dir) -> execution-evidence.json not required, passes', () => {
  const dir = tmpDir();
  writeValidArtifactDir(dir); // no `evidence` field
  const result = runHook(['--stage', 'ship', '--artifact-dir', dir]);
  assert.equal(result.status, 0, `stdout=${result.stdout} stderr=${result.stderr}`);
});

test('evidence gate: soft stage warns (exit 0) instead of blocking on a missing marker-required artifact', () => {
  // `--stage`/`--artifact-dir` flags force manual mode, which always applies
  // hard-stage strictness (CLI invocations expect a strict signal). To reach
  // the hook's actual soft-stage path we drive it the way a real PreToolUse
  // hook is driven: stdin payload + HL_WORKFLOW_ARTIFACT_DIR env var, with the
  // gate explicitly enabled via project config (disabled by default).
  const dir = tmpDir();
  writeValidArtifactDir(dir, { evidence: 'expected' });
  fs.mkdirSync(path.join(dir, '.claude'), { recursive: true });
  writeJson(path.join(dir, '.claude'), 'haily.json', { hooks: { 'workflow-artifact-gate': true } });
  const stdout = execFileSync(process.execPath, [HOOK_PATH], {
    input: JSON.stringify({ prompt: 'commit this change' }),
    encoding: 'utf8',
    cwd: dir,
    env: { ...process.env, HL_WORKFLOW_ARTIFACT_DIR: dir },
  });
  assert.match(stdout, /Soft-stage/);
  assert.match(stdout, /execution-evidence\.json/);
});

// ---------------------------------------------------------------------------
// Fail-open contract: malformed/missing artifact dir never crashes the gate
// ---------------------------------------------------------------------------

test('malformed/missing artifact dir: manual mode reports a clean block, never an unhandled crash', () => {
  const dir = path.join(os.tmpdir(), 'haily-artifact-gate-does-not-exist-' + Date.now());
  const result = runHook(['--stage', 'ship', '--artifact-dir', dir]);
  assert.equal(result.status, 2);
  assert.match(result.stdout, /artifact directory is missing/);
});

test('non-manual invocation with the gate enabled but no artifact pointer allows through (exit 0) — "no plan -> no requirement" fail-open', () => {
  // Enable the hook via project config so the run actually reaches the
  // locator instead of short-circuiting on the (disabled-by-default) config
  // gate — this isolates the locator's own fail-open path from the separate
  // "hook disabled" early return.
  const dir = tmpDir();
  fs.mkdirSync(path.join(dir, '.claude'), { recursive: true });
  writeJson(path.join(dir, '.claude'), 'haily.json', { hooks: { 'workflow-artifact-gate': true } });
  const stdout = execFileSync(process.execPath, [HOOK_PATH], {
    input: JSON.stringify({ prompt: 'ship this' }),
    encoding: 'utf8',
    cwd: dir,
  });
  assert.equal(stdout, '');
});

test('non-manual invocation with the gate disabled by default allows through regardless of artifacts', () => {
  const dir = tmpDir();
  const stdout = execFileSync(process.execPath, [HOOK_PATH], {
    input: JSON.stringify({ prompt: 'ship this' }),
    encoding: 'utf8',
    cwd: dir,
  });
  assert.equal(stdout, '');
});
