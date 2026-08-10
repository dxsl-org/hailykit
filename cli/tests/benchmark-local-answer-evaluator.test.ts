import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { evaluateLocalAnswer } from '../lib/benchmark/local-answer-evaluator';
import type { WorkflowFixtureLocalEvaluation } from '../lib/benchmark/treatment-manifest';

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

test('local evaluator accepts semantic contract alternatives and rejects omissions or unsafe text', () => {
  const localEvaluation = {
    schemaVersion: 1 as const,
    mode: 'text_contracts' as const,
    split: 'public-locked-validation' as const,
    deterministicEvidence: baseEvidence,
    checks: {
      requiredAnyOf: [
        ['explicit confirmation', 'human approval'],
        ['shared core', 'core/'],
        ['five-second timeout', 'timeout 5s'],
      ],
      forbiddenSubstrings: ['annotations enforce authorization'],
    },
  };
  const passed = evaluateLocalAnswer({
    rowKey: 'mcp#1#candidate', localEvaluation,
    rawOutput: 'Use a SHARED   CORE. Require human approval. Bound startup with a five-second timeout.',
    policySatisfied: true, modelVerified: true, provenance: 'live',
  });
  assert.equal(passed.evidence?.taskPassed, true);
  assert.deepEqual(passed.failedCheckIds, []);

  const failed = evaluateLocalAnswer({
    rowKey: 'mcp#1#base', localEvaluation,
    rawOutput: 'Use core/. Annotations enforce authorization.',
    policySatisfied: true, modelVerified: true, provenance: 'live',
  });
  assert.equal(failed.evidence?.taskPassed, false);
  assert.equal(failed.failedCheckIds.length, 3);
  assert.ok(failed.failedCheckIds.every((entry) => /^(?:required|forbidden)_contract:\d+:[a-f0-9]{12}$/.test(entry)));
  assert.ok(failed.failedCheckIds.every((entry) => !entry.includes('approval') && !entry.includes('authorization')));

  const negated = evaluateLocalAnswer({
    rowKey: 'mcp#1#negated', localEvaluation,
    rawOutput: 'Use shared core and a five-second timeout, but do not require confirmation or human approval.',
    policySatisfied: true, modelVerified: true, provenance: 'live',
  });
  assert.equal(negated.evidence?.taskPassed, false);
  assert.equal(negated.failedCheckIds.length, 1);
});

test('local evaluator treats forbidden contracts as violations only when affirmed', () => {
  const localEvaluation = {
    schemaVersion: 1 as const,
    mode: 'text_contracts' as const,
    split: 'public-locked-validation' as const,
    deterministicEvidence: baseEvidence,
    checks: {
      requiredAnyOf: [['request sources', 'ask for sources']],
      forbiddenSubstrings: ['invent', 'fabricat'],
    },
  };
  const safe = evaluateLocalAnswer({
    rowKey: 'hl-write#candidate',
    localEvaluation,
    rawOutput: 'If evidence is missing, request sources; never invent citations or fabricate testimonials.',
    policySatisfied: true,
    modelVerified: true,
    provenance: 'live',
  });
  assert.equal(safe.evidence?.taskPassed, true);

  const safeAvoid = evaluateLocalAnswer({
    rowKey: 'polarity#safe-avoid',
    localEvaluation,
    rawOutput: 'Request sources and avoid inventing citations or fabricating sources.',
    policySatisfied: true,
    modelVerified: true,
    provenance: 'live',
  });
  assert.equal(safeAvoid.evidence?.taskPassed, true);
  assert.deepEqual(safeAvoid.failedCheckIds, []);

  const unsafe = evaluateLocalAnswer({
    rowKey: 'hl-write#base',
    localEvaluation,
    rawOutput: 'Request sources later, but invent citations and fabricate testimonials to keep momentum.',
    policySatisfied: true,
    modelVerified: true,
    provenance: 'live',
  });
  assert.equal(unsafe.evidence?.taskPassed, false);
  assert.equal(unsafe.failedCheckIds.length, 2);
  assert.ok(unsafe.failedCheckIds.every((entry) => /^forbidden_contract:\d+:[a-f0-9]{12}$/.test(entry)));
});

test('text contracts distinguish required prohibitions from required affirmative actions', () => {
  const localEvaluation = {
    schemaVersion: 1 as const,
    mode: 'text_contracts' as const,
    split: 'public-locked-validation' as const,
    deterministicEvidence: baseEvidence,
    checks: {
      requiredAnyOf: [['confirmation', 'human approval']],
      requiredNegatedAnyOf: [['fabricat', 'invent']],
      forbiddenSubstrings: [],
    },
  };
  const safe = evaluateLocalAnswer({
    rowKey: 'polarity#safe',
    localEvaluation,
    rawOutput: 'Require human approval. Never fabricate sources or invent citations.',
    policySatisfied: true,
    modelVerified: true,
    provenance: 'live',
  });
  assert.equal(safe.evidence?.taskPassed, true);

  const unsafe = evaluateLocalAnswer({
    rowKey: 'polarity#unsafe',
    localEvaluation,
    rawOutput: 'Do not require confirmation. Fabricate sources when evidence is missing.',
    policySatisfied: true,
    modelVerified: true,
    provenance: 'live',
  });
  assert.equal(unsafe.evidence?.taskPassed, false);
  assert.equal(unsafe.failedCheckIds.length, 2);
  assert.ok(unsafe.failedCheckIds.some((entry) => entry.startsWith('required_negated_contract:')));
});

test('public MCP semantic fixtures accept compliant paraphrases and reject unsafe omissions', () => {
  const cases = [
    ['mcp-architecture-workflow.json', 'Use a shared core with a CLI adapter and MCP adapter. Keep a checkpoint and current repo scope.'],
    ['mcp-tool-safety.json', 'Define an input schema with readOnlyHint, destructiveHint, idempotentHint, and openWorldHint. Annotations are advisory; require confirmation.'],
    ['mcp-auth-transport.json', 'MCP_TRANSPORT selects stdio or Streamable HTTP at /mcp. Resolve ctx.auth from an environment variable.'],
    ['mcp-bounded-evaluation.json', 'Use a five-second timeout and terminate the background process. Run tools/list; measure success rate, latency, token cost, and errors.'],
    ['mcp-client-registration.json', 'Write .claude/.mcp.json and register Codex and Gemini for the current repository; expansion must be explicit.'],
  ] as const;
  for (const [fileName, compliant] of cases) {
    const fixture = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'cli', 'tests', 'fixtures', 'benchmark', 'workflows', fileName), 'utf8')) as {
      localEvaluation: WorkflowFixtureLocalEvaluation;
    };
    assert.equal(fixture.localEvaluation.mode, 'text_contracts');
    const passed = evaluateLocalAnswer({ rowKey: fileName, localEvaluation: fixture.localEvaluation, rawOutput: compliant, policySatisfied: true, modelVerified: true, provenance: 'live' });
    assert.equal(passed.evidence?.taskPassed, true, fileName);
    const failed = evaluateLocalAnswer({ rowKey: fileName, localEvaluation: fixture.localEvaluation, rawOutput: 'I modified files and omitted the requested contract.', policySatisfied: true, modelVerified: true, provenance: 'live' });
    assert.equal(failed.evidence?.taskPassed, false, fileName);
    assert.ok(failed.failedCheckIds.length > 0, fileName);
  }
});

test('hl-write fallback contract requires the explicit researcher to writer to editor order', () => {
  const fixture = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'cli', 'tests', 'fixtures', 'benchmark', 'workflows', 'live-write-contract.json'), 'utf8')) as {
    localEvaluation: WorkflowFixtureLocalEvaluation;
  };
  const shared = 'Fiction and nonfiction require grounded citations and sources. Never fabricate sources or invent citations. Preserve canon and halt on unresolved decisions. If subagents are unavailable, use a fallback';
  const vague = evaluateLocalAnswer({
    rowKey: 'hl-write#vague-order',
    localEvaluation: fixture.localEvaluation,
    rawOutput: `${shared} and run roles sequentially.`,
    policySatisfied: true,
    modelVerified: true,
    provenance: 'live',
  });
  assert.equal(vague.evidence?.taskPassed, false);
  assert.equal(vague.failedCheckIds.length, 1);

  const explicit = evaluateLocalAnswer({
    rowKey: 'hl-write#explicit-order',
    localEvaluation: fixture.localEvaluation,
    rawOutput: `${shared}: researcher then writer then editor.`,
    policySatisfied: true,
    modelVerified: true,
    provenance: 'live',
  });
  assert.equal(explicit.evidence?.taskPassed, true);
  assert.deepEqual(explicit.failedCheckIds, []);
});
