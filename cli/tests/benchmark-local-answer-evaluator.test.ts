import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateLocalAnswer } from '../lib/benchmark/local-answer-evaluator';

const baseEvidence = {
  testsPassed: true,
  requiredArtifacts: [] as string[],
  observedArtifacts: [] as string[],
  requiredInstructions: [] as string[],
  satisfiedInstructions: [] as string[],
  forbiddenInstructions: [] as string[],
  violatedInstructions: [] as string[],
  allowedScopePaths: ['cli/lib'] as string[],
  changedPaths: ['cli/lib/benchmark/workflow-runner.ts'] as string[],
  escalationRequired: false,
  escalationPerformed: false,
  rollbackRequired: false,
  rollbackProvided: false,
  necessaryToolCalls: 1,
};

test('local evaluator hashes output and validates json contracts without storing raw text', () => {
  const passed = evaluateLocalAnswer({
    rowKey: 'fixture#1#base',
    localEvaluation: {
      schemaVersion: 1,
      mode: 'json_contract',
      split: 'public-locked-validation',
      deterministicEvidence: baseEvidence,
      checks: {
        requiredTopLevelKeys: ['answer'],
        forbiddenTopLevelKeys: ['secret'],
      },
    },
    rawOutput: '{"answer":"ok"}',
    policySatisfied: true,
    modelVerified: true,
    provenance: 'live',
  });
  assert.match(passed.outputDigest ?? '', /^sha256:/);
  assert.equal(passed.evidence?.taskPassed, true);
  assert.equal(passed.evidence?.outputContractPassed, true);
  const failed = evaluateLocalAnswer({
    rowKey: 'fixture#1#candidate',
    localEvaluation: {
      schemaVersion: 1,
      mode: 'json_contract',
      split: 'public-locked-validation',
      deterministicEvidence: baseEvidence,
      checks: {
        requiredTopLevelKeys: ['answer'],
        forbiddenTopLevelKeys: ['secret'],
      },
    },
    rawOutput: '{"secret":"x"}',
    policySatisfied: true,
    modelVerified: true,
    provenance: 'live',
  });
  assert.equal(failed.evidence?.taskPassed, false);
  assert.equal(failed.failedCheckIds.length, 2);
  assert.ok(failed.failedCheckIds.every((entry) => /^(?:required|forbidden)_key:\d+:[a-f0-9]{12}$/.test(entry)));
  assert.ok(failed.failedCheckIds.every((entry) => !entry.includes('answer') && !entry.includes('secret')));
});

test('local evaluator uses hashed check ids for text checks and stays inconclusive on null output', () => {
  const failed = evaluateLocalAnswer({
    rowKey: 'fixture#2#base',
    localEvaluation: {
      schemaVersion: 1,
      mode: 'text_checks',
      split: 'public-training',
      deterministicEvidence: { ...baseEvidence, testsPassed: null },
      checks: {
        requiredSubstrings: ['must include'],
        forbiddenSubstrings: ['do not show'],
      },
    },
    rawOutput: 'plain output',
    policySatisfied: true,
    modelVerified: true,
    provenance: 'live',
  });
  assert.equal(failed.evidence?.taskPassed, false);
  assert.equal(failed.evidence?.outputContractPassed, false);
  assert.ok(failed.failedCheckIds.every((entry) => entry.length <= 80));
  assert.ok(failed.failedCheckIds.every((entry) => !entry.includes('must include') && !entry.includes('do not show')));
  const missing = evaluateLocalAnswer({
    rowKey: 'fixture#2#candidate',
    localEvaluation: {
      schemaVersion: 1,
      mode: 'text_checks',
      split: 'public-training',
      deterministicEvidence: baseEvidence,
      checks: {
        requiredSubstrings: ['must include'],
        forbiddenSubstrings: [],
      },
    },
    rawOutput: null,
    policySatisfied: true,
    modelVerified: true,
    provenance: 'live',
  });
  assert.equal(missing.outputDigest, null);
  assert.equal(missing.evidence?.taskPassed, null);
  assert.equal(missing.evidence?.outputContractPassed, null);
});
