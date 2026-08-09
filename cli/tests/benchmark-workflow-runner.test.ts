import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildBenchmarkReport } from '../lib/benchmark/report';
import { evaluateBenchmarkOutcome } from '../lib/benchmark/identity';
import { buildWorkflowManifestHash, loadWorkflowFixtures, resolveWorkflowManifest, type WorkflowTreatmentManifest } from '../lib/benchmark/treatment-manifest';
import { scheduleWorkflowPairs } from '../lib/benchmark/scheduler';
import { assertCanStartWorkflowCall, createWorkflowBudgetState, consumeWorkflowBudget, validateWorkflowLiveBudget } from '../lib/benchmark/live-budget';
import { runWorkflowBenchmark } from '../lib/benchmark/workflow-runner';
import type { BenchmarkProviderResponse } from '../lib/benchmark/provider-contract';

function tmp(prefix: string): string { return fs.mkdtempSync(path.join(os.tmpdir(), prefix)); }

function manifest(repoRoot: string, fixtureRoot = path.join(repoRoot, 'fixtures'), overrides: Partial<WorkflowTreatmentManifest> = {}): WorkflowTreatmentManifest {
  return {
    provider: 'codex',
    tier: 'fast',
    requestedModel: 'gpt-5.4-mini',
    policy: 'read_only',
    provenance: 'live',
    liveEquivalent: true,
    budgetAcknowledged: true,
    budget: { projectedCalls: 8, projectedSpendUsd: 1, maxCalls: 8, maxSpendUsd: 10, maxWallMs: 1000, maxOutputBytes: 1000 },
    baseRef: 'HEAD',
    candidateRef: 'HEAD',
    fixtureRoot: path.relative(repoRoot, fixtureRoot),
    fixturePaths: ['sample-fixture-a.json', 'sample-fixture-b.json'],
    repeats: 2,
    randomSeed: 7,
    cliVersion: '1.0.0',
    configSnapshotHash: 'config-hash',
    evaluatorEvidenceHash: 'evidence-hash',
    treatmentFiles: { base: ['treatment.md'], candidate: ['treatment.md'] },
    componentClass: 'workflow',
    ablations: ['none'],
    marginRegistry: { metric: 'outcomeScore', threshold: 0.9, exploratoryBatches: 2, firstDecisionBatch: 3, frozen: false, frozenAt: null, identityHash: 'exploratory' },
    calibration: { completedLiveBatches: 0, firstDecisionBatch: 3 },
    ...overrides,
  };
}

function initWorkflowRepo(): { repoRoot: string; fixtureRoot: string } {
  const repoRoot = tmp('workflow-repo-');
  const fixtureRoot = path.join(repoRoot, 'fixtures');
  fs.mkdirSync(fixtureRoot, { recursive: true });
  for (const fileName of ['sample-fixture-a.json', 'sample-fixture-b.json']) {
    fs.copyFileSync(
      path.join(process.cwd(), 'cli', 'tests', 'fixtures', 'benchmark', 'workflows', fileName),
      path.join(fixtureRoot, fileName),
    );
  }
  fs.writeFileSync(path.join(repoRoot, '.gitignore'), 'fixtures-link/\n', 'utf8');
  fs.writeFileSync(path.join(repoRoot, 'treatment.md'), '# Treatment\n\nUse evidence and preserve scope.\n', 'utf8');
  execFileSync('git', ['init'], { cwd: repoRoot, stdio: 'ignore' });
  execFileSync('git', ['config', 'user.email', 'benchmark@example.com'], { cwd: repoRoot, stdio: 'ignore' });
  execFileSync('git', ['config', 'user.name', 'Benchmark Runner'], { cwd: repoRoot, stdio: 'ignore' });
  execFileSync('git', ['add', '.'], { cwd: repoRoot, stdio: 'ignore' });
  execFileSync('git', ['commit', '-m', 'init workflow fixtures'], { cwd: repoRoot, stdio: 'ignore' });
  return { repoRoot, fixtureRoot };
}

function response(): BenchmarkProviderResponse {
  return {
    provider: 'codex',
    surface: 'provider',
    actualModel: 'gpt-5.4-mini',
    modelSatisfied: true,
    modelVerified: true,
    modelVerificationSource: 'provider_echo',
    policy: 'read_only',
    policySatisfied: true,
    rawOutput: null,
    note: null,
    metrics: {
      wallMs: 10, ttftMs: 2, outputBytes: 50,
      tokens: { inputTokens: 1, outputTokens: 2, totalTokens: 3, costUsd: 0.1, cacheReadTokens: null, cacheWriteTokens: null, reasoningTokens: null, costSource: 'provider' },
      contextOccupancy: null, contextCompactionBytes: null, toolCalls: 0, toolErrors: 0, toolRetries: 0,
      approvals: 0, subagentCount: 0, subagentDepth: 0, hookCalls: 0, hookLatencyMs: null, hookContextBytes: null,
    },
  };
}

test('workflow manifest identity changes when config, budget, or fixture set changes', () => {
  const { repoRoot, fixtureRoot } = initWorkflowRepo();
  const base = resolveWorkflowManifest(repoRoot, manifest(repoRoot, fixtureRoot));
  const fixtures = loadWorkflowFixtures(base);
  const first = buildWorkflowManifestHash(base, fixtures);
  const second = buildWorkflowManifestHash(resolveWorkflowManifest(repoRoot, manifest(repoRoot, fixtureRoot, { configSnapshotHash: 'different' })), fixtures);
  const third = buildWorkflowManifestHash(resolveWorkflowManifest(repoRoot, manifest(repoRoot, fixtureRoot, { budget: { ...manifest(repoRoot, fixtureRoot).budget, maxSpendUsd: 11 } })), fixtures);
  const backend = buildWorkflowManifestHash(resolveWorkflowManifest(repoRoot, manifest(repoRoot, fixtureRoot, { backend: 'codex_app_server' })), fixtures);
  const identityOnly = buildWorkflowManifestHash(resolveWorkflowManifest(repoRoot, manifest(repoRoot, fixtureRoot, { marginRegistry: { ...manifest(repoRoot, fixtureRoot).marginRegistry, identityHash: 'replacement' } })), fixtures);
  assert.notEqual(first, second);
  assert.notEqual(first, third);
  assert.notEqual(first, backend);
  assert.equal(first, identityOnly);
});

test('workflow fixture loader validates text contract groups', () => {
  const { repoRoot, fixtureRoot } = initWorkflowRepo();
  fs.writeFileSync(path.join(fixtureRoot, 'invalid-contract.json'), JSON.stringify({
    fixtureId: 'invalid-contract', fixtureClass: 'skill-behavior-retention', promptHash: 'cf07194ee232eb531e15f690000d19846dea69cf05504782658afcfacb9228a2', prompt: 'prompt',
    localEvaluation: {
      schemaVersion: 1, mode: 'text_contracts', split: 'public-training',
      deterministicEvidence: {
        testsPassed: true, requiredArtifacts: [], observedArtifacts: [], requiredInstructions: [], satisfiedInstructions: [], forbiddenInstructions: [], violatedInstructions: [], allowedScopePaths: [], changedPaths: [], escalationRequired: false, escalationPerformed: false, rollbackRequired: false, rollbackProvided: false, necessaryToolCalls: 0,
      },
      checks: { requiredAnyOf: [[]], forbiddenSubstrings: [] },
    },
  }), 'utf8');
  execFileSync('git', ['add', '.'], { cwd: repoRoot, stdio: 'ignore' });
  execFileSync('git', ['commit', '-m', 'add invalid fixture'], { cwd: repoRoot, stdio: 'ignore' });
  assert.throws(() => loadWorkflowFixtures(resolveWorkflowManifest(repoRoot, manifest(repoRoot, fixtureRoot, { fixturePaths: ['invalid-contract.json'] }))), /array of non-empty string arrays/);
  const empty = JSON.parse(fs.readFileSync(path.join(fixtureRoot, 'invalid-contract.json'), 'utf8'));
  empty.localEvaluation.checks.requiredAnyOf = [];
  fs.writeFileSync(path.join(fixtureRoot, 'invalid-contract.json'), JSON.stringify(empty), 'utf8');
  execFileSync('git', ['add', '.'], { cwd: repoRoot, stdio: 'ignore' });
  execFileSync('git', ['commit', '-m', 'empty invalid fixture'], { cwd: repoRoot, stdio: 'ignore' });
  assert.throws(() => loadWorkflowFixtures(resolveWorkflowManifest(repoRoot, manifest(repoRoot, fixtureRoot, { fixturePaths: ['invalid-contract.json'] }))), /array of non-empty string arrays/);
});

test('scheduler is deterministic and balanced for a fixed seed', () => {
  const schedule = scheduleWorkflowPairs([{ fixtureId: 'a', repeat: 1 }, { fixtureId: 'a', repeat: 2 }, { fixtureId: 'b', repeat: 1 }, { fixtureId: 'b', repeat: 2 }], 11);
  assert.deepEqual(schedule, scheduleWorkflowPairs([{ fixtureId: 'a', repeat: 1 }, { fixtureId: 'a', repeat: 2 }, { fixtureId: 'b', repeat: 1 }, { fixtureId: 'b', repeat: 2 }], 11));
  assert.equal(schedule.filter((entry) => entry.arm === 'base').length, schedule.filter((entry) => entry.arm === 'candidate').length);
});

test('budget fails closed when live usage is unknown', () => {
  assert.throws(() => consumeWorkflowBudget(
    createWorkflowBudgetState(),
    { projectedCalls: 1, projectedSpendUsd: 0.5, maxCalls: 1, maxSpendUsd: 1, maxWallMs: 10, maxOutputBytes: 10 },
    { calls: 1, costUsd: null, wallMs: 1, outputBytes: 1 },
    true,
  ), /requires known costUsd/);
});

test('budget refuses a projected spend above the acknowledged maximum', () => {
  assert.throws(() => validateWorkflowLiveBudget({ projectedCalls: 1, projectedSpendUsd: 2, maxCalls: 1, maxSpendUsd: 1, maxWallMs: 10, maxOutputBytes: 10 }), /projected live spend exceeds maxSpendUsd/);
});

test('budget refuses another call when spend, wall, or output reserve is exhausted', () => {
  const budget = { projectedCalls: 2, projectedSpendUsd: 1, maxCalls: 2, maxSpendUsd: 1, maxWallMs: 10, maxOutputBytes: 10 };
  assert.throws(() => assertCanStartWorkflowCall({ spentCalls: 1, spentUsd: 0.6, spentWallMs: 1, spentOutputBytes: 1 }, budget), /spend reserve/);
  assert.throws(() => assertCanStartWorkflowCall({ spentCalls: 1, spentUsd: 0, spentWallMs: 10, spentOutputBytes: 1 }, budget), /maxWallMs is exhausted/);
  assert.throws(() => assertCanStartWorkflowCall({ spentCalls: 1, spentUsd: 0, spentWallMs: 1, spentOutputBytes: 10 }, budget), /maxOutputBytes is exhausted/);
});

test('workflow benchmark rejects workspace_write, dirty trees, symlinked roots, and oversized schedules', async () => {
  const { repoRoot, fixtureRoot } = initWorkflowRepo();
  assert.throws(() => resolveWorkflowManifest(repoRoot, manifest(repoRoot, fixtureRoot, { policy: 'workspace_write' })), /read_only only/);
  assert.throws(() => resolveWorkflowManifest(repoRoot, manifest(repoRoot, fixtureRoot, { requestedModel: 'safe&echo injected' })), /unsafe characters/);
  assert.throws(() => resolveWorkflowManifest(repoRoot, manifest(repoRoot, fixtureRoot, { repeats: 300 })), /between 1 and 256/);
  const linkPath = path.join(repoRoot, 'fixtures-link');
  fs.symlinkSync(fixtureRoot, linkPath, 'junction');
  execFileSync('git', ['add', '-f', 'fixtures-link'], { cwd: repoRoot, stdio: 'ignore' });
  execFileSync('git', ['commit', '-m', 'track symlink fixture root'], { cwd: repoRoot, stdio: 'ignore' });
  assert.throws(() => resolveWorkflowManifest(repoRoot, manifest(repoRoot, linkPath)), /symlink/);
  fs.writeFileSync(path.join(repoRoot, 'dirty.txt'), 'dirty\n', 'utf8');
  assert.throws(() => resolveWorkflowManifest(repoRoot, manifest(repoRoot, fixtureRoot)), /dirty source trees/);
  execFileSync('git', ['clean', '-fd'], { cwd: repoRoot, stdio: 'ignore' });
  const stopped = await runWorkflowBenchmark(repoRoot, manifest(repoRoot, fixtureRoot), { runTrial: () => ({ ...response(), metrics: { ...response().metrics, tokens: { ...response().metrics.tokens, costUsd: null } } }) });
  assert.equal(stopped.observations.length, 8);
  assert.ok(stopped.observations.every((entry) => entry.pairStatus === 'missing_pair' && !entry.decisionEligible));
});

test('workflow benchmark emits paired observations for both arms', async () => {
  const { repoRoot, fixtureRoot } = initWorkflowRepo();
  const seenCwds = new Set<string>();
  const result = await runWorkflowBenchmark(repoRoot, manifest(repoRoot, fixtureRoot), { runTrial: (request) => {
    seenCwds.add(request.cwd);
    assert.ok(request.prompt);
    assert.match(request.prompt!, /hailykit-treatment/);
    assert.ok(fs.existsSync(path.join(request.cwd, '.git')));
    return response();
  } });
  assert.equal(result.observations.length, 8);
  assert.ok(result.observations.every((entry) => entry.pairStatus === 'paired'));
  assert.ok(result.observations.every((entry) => !entry.decisionEligible));
  assert.equal(seenCwds.size, 2);
  assert.ok(result.observations.every((entry) => entry.legacy.commitSha));
  assert.ok(result.observations.every((entry) => entry.legacy.finalAnswer === null));
});

test('codex app-server backend consumes projected reserve without fabricating observed cost', async () => {
  const { repoRoot, fixtureRoot } = initWorkflowRepo();
  const result = await runWorkflowBenchmark(repoRoot, manifest(repoRoot, fixtureRoot, {
    backend: 'codex_app_server',
    budget: { projectedCalls: 8, projectedSpendUsd: 4, maxCalls: 8, maxSpendUsd: 10, maxWallMs: 1000, maxOutputBytes: 1000 },
  }), {
    runTrial: () => ({
      ...response(),
      backend: 'codex_app_server',
      surface: 'app_server',
      modelVerificationSource: 'thread_start_exact',
      rawOutput: 'final answer',
      metrics: {
        ...response().metrics,
        outputBytes: 0,
        tokens: { ...response().metrics.tokens, costUsd: null, costSource: 'unknown' },
      },
    }),
  });
  assert.equal(result.observations.length, 8);
  assert.ok(result.observations.every((entry) => entry.backend === 'codex_app_server'));
  assert.ok(result.observations.every((entry) => entry.modelVerificationSource === 'thread_start_exact'));
  assert.ok(result.observations.every((entry) => entry.metrics.tokens.costUsd === null));
  assert.ok(result.observations.every((entry) => entry.legacy.finalAnswer === null));
  assert.ok(result.observations.every((entry) => entry.providerExtensions.outputDigest === 'sha256:89cc8a2763c6c9b7cbc8058d68c260aedc026dba2b3a47b4e2cb44fcb8747efe'));
  assert.ok(result.observations.every((entry) => {
    const workflow = entry.providerExtensions.workflow as Record<string, unknown>;
    return workflow.projectedSpendReserveUsd === 0.5;
  }));
});

test('workflow runner promotes locally evaluated rows and never serializes raw answers', async () => {
  const { repoRoot, fixtureRoot } = initWorkflowRepo();
  const sentinel = 'secret sentinel final answer';
  const localFixture = {
    fixtureId: 'workflow-a',
    fixtureClass: 'evidence_trap',
    promptHash: '4efc8d44133e525ba7f9bfe51690671dd39d6c8a69b2276ff40a99c35fe99295',
    prompt: 'Return the evidence-trap fixture result.',
    localEvaluation: {
      schemaVersion: 1,
      mode: 'text_checks',
      split: 'public-training',
      deterministicEvidence: {
        testsPassed: true,
        requiredArtifacts: [],
        observedArtifacts: [],
        requiredInstructions: [],
        satisfiedInstructions: [],
        forbiddenInstructions: [],
        violatedInstructions: [],
        allowedScopePaths: ['cli/lib'],
        changedPaths: ['cli/lib/benchmark/workflow-runner.ts'],
        escalationRequired: false,
        escalationPerformed: false,
        rollbackRequired: false,
        rollbackProvided: false,
        necessaryToolCalls: 0,
      },
      checks: {
        requiredSubstrings: ['sentinel final answer'],
        forbiddenSubstrings: ['do not include'],
      },
    },
  };
  fs.writeFileSync(path.join(fixtureRoot, 'sample-fixture-a.json'), `${JSON.stringify(localFixture, null, 2)}\n`, 'utf8');
  execFileSync('git', ['add', '.'], { cwd: repoRoot, stdio: 'ignore' });
  execFileSync('git', ['commit', '-m', 'add local evaluator fixture'], { cwd: repoRoot, stdio: 'ignore' });
  const result = await runWorkflowBenchmark(repoRoot, manifest(repoRoot, fixtureRoot, {
    repeats: 1,
    budget: { projectedCalls: 4, projectedSpendUsd: 1, maxCalls: 4, maxSpendUsd: 10, maxWallMs: 1000, maxOutputBytes: 1000 },
  }), {
    runTrial: ({ fixture }) => ({
      ...response(),
      rawOutput: fixture.fixtureId === 'workflow-a' ? sentinel : null,
      metrics: { ...response().metrics, outputBytes: fixture.fixtureId === 'workflow-a' ? sentinel.length : 0 },
    }),
  });
  const eligible = result.observations.filter((entry) => entry.fixtureId === 'workflow-a');
  const legacy = result.observations.filter((entry) => entry.fixtureId === 'workflow-b');
  assert.equal(eligible.length, 2);
  assert.ok(eligible.every((entry) => entry.decisionEligible));
  assert.ok(eligible.every((entry) => entry.metrics.outcomeScore === 1));
  assert.ok(eligible.every((entry) => entry.legacy.finalAnswer === null));
  assert.ok(eligible.every((entry) => typeof entry.providerExtensions.outputDigest === 'string'));
  assert.ok(legacy.every((entry) => !entry.decisionEligible));
  const lines = [
    JSON.stringify(result.manifest),
    ...result.observations.map((entry) => JSON.stringify(entry)),
    JSON.stringify(evaluateBenchmarkOutcome(result.manifest, result.observations)),
  ];
  const artifactText = `${lines.join('\n')}\n`;
  assert.doesNotMatch(artifactText, /secret sentinel final answer/);
  assert.match(artifactText, /sha256:/);
  const report = buildBenchmarkReport(artifactText);
  assert.doesNotMatch(JSON.stringify(report), /secret sentinel final answer/);
});

test('workflow treatment is loaded from each pinned commit and bound to each arm', async () => {
  const { repoRoot, fixtureRoot } = initWorkflowRepo();
  const baseRef = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).trim();
  fs.writeFileSync(path.join(repoRoot, 'treatment.md'), '# Candidate treatment\n\nUse the candidate rule.\n', 'utf8');
  execFileSync('git', ['add', 'treatment.md'], { cwd: repoRoot, stdio: 'ignore' });
  execFileSync('git', ['commit', '-m', 'candidate treatment'], { cwd: repoRoot, stdio: 'ignore' });
  const prompts = new Map<string, string>();
  const result = await runWorkflowBenchmark(repoRoot, manifest(repoRoot, fixtureRoot, { baseRef, candidateRef: 'HEAD' }), { runTrial: (request) => {
    prompts.set(request.arm, request.prompt ?? '');
    return response();
  } });
  assert.match(prompts.get('base') ?? '', /Use evidence and preserve scope/);
  assert.match(prompts.get('candidate') ?? '', /Use the candidate rule/);
  const digests = new Set(result.observations.map((row) => (row.providerExtensions.workflow as Record<string, unknown>).treatmentDigest));
  assert.equal(digests.size, 2);
});

test('workflow runner preserves caller temp root and atomically excludes failed pairs', async () => {
  const { repoRoot, fixtureRoot } = initWorkflowRepo();
  const tempBase = tmp('workflow-temp-base-');
  const sentinel = path.join(tempBase, 'keep.txt');
  fs.writeFileSync(sentinel, 'keep', 'utf8');
  let calls = 0;
  const result = await runWorkflowBenchmark(repoRoot, manifest(repoRoot, fixtureRoot), {
    tempRoot: tempBase,
    runTrial: () => { calls += 1; if (calls === 2) throw new Error('provider timeout'); return response(); },
  });
  assert.ok(fs.existsSync(sentinel));
  const failedPair = result.observations.filter((entry) => entry.pairId === result.observations[0].pairId);
  assert.equal(failedPair.length, 2);
  assert.ok(failedPair.every((entry) => entry.pairStatus === 'missing_pair' && !entry.decisionEligible));
});

test('workflow runner rejects live/budget drift, path escape, unknown fields, and provider mismatch', async () => {
  const { repoRoot, fixtureRoot } = initWorkflowRepo();
  await assert.rejects(() => runWorkflowBenchmark(repoRoot, manifest(repoRoot, fixtureRoot, { liveEquivalent: false })), /must match/);
  await assert.rejects(() => runWorkflowBenchmark(repoRoot, manifest(repoRoot, fixtureRoot, { budgetAcknowledged: false })), /acknowledgement/);
  await assert.rejects(() => runWorkflowBenchmark(repoRoot, manifest(repoRoot, fixtureRoot, { budget: { ...manifest(repoRoot, fixtureRoot).budget, projectedCalls: 7 } })), /exact schedule size/);
  assert.throws(() => resolveWorkflowManifest(repoRoot, manifest(repoRoot, fixtureRoot, { fixtureRoot: '../outside' })), /unsafe workflow path/);
  const fixturePath = path.join(fixtureRoot, 'sample-fixture-a.json');
  const original = fs.readFileSync(fixturePath, 'utf8');
  fs.writeFileSync(fixturePath, JSON.stringify({ ...JSON.parse(original), unexpected: true }), 'utf8');
  execFileSync('git', ['add', '.'], { cwd: repoRoot, stdio: 'ignore' });
  execFileSync('git', ['commit', '-m', 'invalid fixture'], { cwd: repoRoot, stdio: 'ignore' });
  await assert.rejects(() => runWorkflowBenchmark(repoRoot, manifest(repoRoot, fixtureRoot)), /unknown fields/);
  fs.writeFileSync(fixturePath, original, 'utf8');
  execFileSync('git', ['add', '.'], { cwd: repoRoot, stdio: 'ignore' });
  execFileSync('git', ['commit', '-m', 'restore fixture'], { cwd: repoRoot, stdio: 'ignore' });
  const mismatch = await runWorkflowBenchmark(repoRoot, manifest(repoRoot, fixtureRoot), { runTrial: () => ({ ...response(), provider: 'claude' }) });
  assert.ok(mismatch.observations.every((entry) => entry.pairStatus === 'missing_pair'));
  const backendMismatch = await runWorkflowBenchmark(repoRoot, manifest(repoRoot, fixtureRoot, { backend: 'codex_app_server' }), {
    runTrial: () => ({ ...response(), backend: 'provider', surface: 'provider' }),
  });
  assert.ok(backendMismatch.observations.every((entry) => entry.pairStatus === 'missing_pair'));
});
