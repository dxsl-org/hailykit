import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const FIXTURE_DIR = path.join(ROOT, 'cli', 'tests', 'fixtures', 'scout-dedup');
const { validateReconEnvelope } = require(path.join(ROOT, 'kit', 'hooks', 'haily-artifact', 'recon-envelope.cjs')) as {
  validateReconEnvelope(value: unknown): Array<{ path: string; message: string }>;
};
const policy = require(path.join(ROOT, 'scripts', 'check-skill-cross-refs.js')) as {
  scanScoutPolicyEntries(entries: Array<{ file: string; content: string }>): Array<{ file: string; problem: string }>;
  checkScoutFixtureFiles(): Array<{ file: string; problem: string }>;
  checkScoutPolicy(): Array<{ file: string; problem: string }>;
};

function readFixture(name: string): string {
  return fs.readFileSync(path.join(FIXTURE_DIR, name), 'utf8');
}

function readFixtureJson(name: string): unknown {
  return JSON.parse(readFixture(name));
}

test('fixture README documents root scout-report, Scout Addendum replacement, and reconEnvelope metadata', () => {
  assert.deepEqual(policy.checkScoutFixtureFiles(), []);
  const fixtureReadme = readFixture('README.md');
  assert.match(fixtureReadme, /root `scout-report\.md`/);
  assert.match(fixtureReadme, /Scout Addendum/);
  assert.match(fixtureReadme, /instead of overwriting the (?:whole report|plan-authored report)/);
  assert.match(fixtureReadme, /reconEnvelope/);
});

test('valid reconEnvelope fixture is machine-readable and complete', () => {
  const issues = validateReconEnvelope(readFixtureJson('recon-envelope-valid.json'));
  assert.deepEqual(issues, []);
});

test('invalid overlap reconEnvelope fixture fails ownedPaths validation', () => {
  const issues = validateReconEnvelope(readFixtureJson('recon-envelope-invalid-overlap.json'));
  assert.ok(issues.some((issue) => issue.path === 'ownedPaths'));
});

test('direct Explore orchestration in a caller Scout step is rejected', () => {
  const problems = policy.scanScoutPolicyEntries([{
    file: 'kit/skills/hc-cook/references/fixture-invalid-direct-explore.md',
    content: readFixture('invalid-direct-explore.md'),
  }]);
  assert.ok(problems.some((problem) => /direct Explore orchestration/.test(problem.problem)));
});

test('nested reports/scout-report persistence is rejected', () => {
  const problems = policy.scanScoutPolicyEntries([{
    file: 'kit/skills/hc-plan/references/fixture-invalid-nested-persistence.md',
    content: readFixture('invalid-nested-persistence.md'),
  }]);
  assert.ok(problems.some((problem) => /nested reports\/scout-report\.md persistence/.test(problem.problem)));
});

test('non-full scout modes cannot persist to scout-report', () => {
  const problems = policy.scanScoutPolicyEntries([{
    file: 'kit/skills/hc-scout/references/fixture-invalid-mode-persistence.md',
    content: readFixture('invalid-mode-persistence.md'),
  }]);
  assert.ok(problems.some((problem) => /non-full scout output must not persist/.test(problem.problem)));
});

test('debug hypothesis Explore remains allowed outside Scout routing policy', () => {
  const problems = policy.scanScoutPolicyEntries([{
    file: 'kit/skills/hc-debug/references/fixture-allowed-hypothesis-explore.md',
    content: readFixture('allowed-hypothesis-explore.md'),
  }]);
  assert.deepEqual(problems, []);
});

test('allowed hypothesis Explore cannot hide a later caller Scout violation', () => {
  const problems = policy.scanScoutPolicyEntries([{
    file: 'kit/skills/example/SKILL.md',
    content: [
      'For hypothesis falsification, spawn parallel Explore subagents.',
      'Scout step: spawn parallel Explore subagents directly from this caller.',
    ].join('\n\n'),
  }]);
  assert.ok(problems.some((problem) => /direct Explore orchestration/.test(problem.problem)));
});

test('repo scout policy passes on shipped sources and fixtures', () => {
  assert.deepEqual(policy.checkScoutPolicy(), []);
});
