import { assertCanStartWorkflowCall, assertProjectedWorkflowCalls, assertWorkflowBudgetAcknowledged, consumeWorkflowBudget, createWorkflowBudgetState, type WorkflowBudgetState } from './live-budget';
import type { BenchmarkProviderResponse } from './provider-contract';
import { scheduleWorkflowPairs, type ScheduledWorkflowArm, type WorkflowArm } from './scheduler';
import { buildWorkflowManifestHash, loadWorkflowFixtures, resolveWorkflowManifest, type ResolvedWorkflowManifest, type WorkflowFixtureRecord, type WorkflowTreatmentManifest } from './treatment-manifest';
import type { BenchmarkObservation, BenchmarkWorkflowBackend } from './types';
import type { BenchmarkManifest } from './types';
import { sha256, stableStringify } from '../reasoning-harness/hash';
import { hashMarginIdentity } from './identity';
import { createWorkflowWorkspaces } from './workflow-workspaces';
import { finalizeWorkflowPairs, makeWorkflowFailureObservation, makeWorkflowObservation, validateWorkflowProviderResponse } from './workflow-observation';
import { buildWorkflowTreatmentPrompt, combineTreatmentAndFixture, type WorkflowTreatmentPrompt } from './workflow-treatment';

export interface WorkflowTrialRequest {
  backend?: BenchmarkWorkflowBackend;
  manifest: ResolvedWorkflowManifest;
  fixture: WorkflowFixtureRecord;
  arm: WorkflowArm;
  pairId: string;
  blockId: string;
  cwd: string;
  prompt: string | null;
  treatment: { bytes: number; digest: string; files: string[] };
  remainingBudget: { calls: number; spendUsd: number | null; wallMs: number; outputBytes: number };
}

export interface WorkflowRunnerDeps {
  now?: () => string;
  tempRoot?: string;
  runTrial?: (request: WorkflowTrialRequest) => Promise<BenchmarkProviderResponse> | BenchmarkProviderResponse;
}

export async function runWorkflowBenchmark(repoRoot: string, input: WorkflowTreatmentManifest, deps: WorkflowRunnerDeps = {}): Promise<{ manifest: BenchmarkManifest; manifestHash: string; observations: BenchmarkObservation[] }> {
  const manifest = resolveWorkflowManifest(repoRoot, input);
  const fixtures = loadWorkflowFixtures(manifest);
  const blocks = fixtures.flatMap((fixture) => Array.from({ length: manifest.repeats }, (_, index) => ({ fixtureId: fixture.fixtureId, repeat: index + 1 })));
  if (blocks.length > 512) throw new Error('workflow schedule would exceed 512 pair blocks');
  const scheduled = scheduleWorkflowPairs(blocks, manifest.randomSeed);
  assertWorkflowBudgetAcknowledged(manifest.liveEquivalent, manifest.budgetAcknowledged, manifest.budget);
  assertProjectedWorkflowCalls(manifest.budget, scheduled.length);
  const manifestHash = buildWorkflowManifestHash(manifest, fixtures);
  const benchmarkManifest = buildWorkflowBenchmarkManifest(manifest, fixtures, manifestHash, deps.now?.() ?? new Date().toISOString());
  if (manifest.marginRegistry.frozen && manifest.marginRegistry.identityHash !== hashMarginIdentity(benchmarkManifest)) throw new Error('frozen workflow margin identity does not match the resolved treatment');
  const workspaces = createWorkflowWorkspaces(repoRoot, { base: manifest.baseCommitSha, candidate: manifest.candidateCommitSha }, deps.tempRoot);
  try {
    const treatments = { base: buildWorkflowTreatmentPrompt(workspaces.armCwd.base, manifest, 'base'), candidate: buildWorkflowTreatmentPrompt(workspaces.armCwd.candidate, manifest, 'candidate') };
    return { manifest: benchmarkManifest, manifestHash, observations: await executeSchedule(manifest, fixtures, scheduled, manifestHash, workspaces.armCwd, treatments, deps) };
  } finally {
    workspaces.cleanup();
  }
}

async function executeSchedule(
  manifest: ResolvedWorkflowManifest,
  fixtures: WorkflowFixtureRecord[],
  scheduled: ScheduledWorkflowArm[],
  manifestHash: string,
  armCwd: Record<WorkflowArm, string>,
  treatments: Record<WorkflowArm, WorkflowTreatmentPrompt>,
  deps: WorkflowRunnerDeps,
): Promise<BenchmarkObservation[]> {
  const rows: BenchmarkObservation[] = [];
  let state = createWorkflowBudgetState();
  let stopReason: string | null = null;
  for (const scheduledArm of scheduled) {
    const fixture = fixtures.find((entry) => entry.fixtureId === scheduledArm.fixtureId);
    if (!fixture) throw new Error(`missing scheduled fixture: ${scheduledArm.fixtureId}`);
    if (stopReason) {
      rows.push(makeWorkflowFailureObservation(manifest, fixture, scheduledArm, manifestHash, stopReason));
      continue;
    }
    try {
      if (!deps.runTrial) throw new Error('workflow benchmark runTrial dependency is required');
      assertCanStartWorkflowCall(state, manifest.budget);
      const treatment = treatments[scheduledArm.arm];
      const response = await deps.runTrial({ backend: manifest.backend, manifest, fixture, arm: scheduledArm.arm, pairId: scheduledArm.pairId, blockId: scheduledArm.blockId, cwd: armCwd[scheduledArm.arm], prompt: combineTreatmentAndFixture(treatment, fixture.prompt), treatment: { bytes: treatment.bytes, digest: treatment.digest, files: treatment.files }, remainingBudget: remainingBudget(state, manifest) });
      const validated = validateWorkflowProviderResponse(response, manifest);
      state = consumeWorkflowBudget(state, manifest.budget, usageFromResponse(manifest, validated), manifest.liveEquivalent);
      rows.push(makeWorkflowObservation(manifest, fixture, scheduledArm, manifestHash, validated, deps.now?.() ?? new Date().toISOString(), { bytes: treatment.bytes, digest: treatment.digest, files: treatment.files }));
    } catch (error) {
      const reason = errorMessage(error);
      rows.push(makeWorkflowFailureObservation(manifest, fixture, scheduledArm, manifestHash, reason));
      if (isBudgetFailure(reason)) stopReason = reason;
    }
  }
  return finalizeWorkflowPairs(rows);
}

function remainingBudget(state: WorkflowBudgetState, manifest: ResolvedWorkflowManifest): WorkflowTrialRequest['remainingBudget'] {
  return {
    calls: manifest.budget.maxCalls - state.spentCalls,
    spendUsd: manifest.budget.maxSpendUsd === null ? null : manifest.budget.maxSpendUsd - state.spentUsd,
    wallMs: manifest.budget.maxWallMs - state.spentWallMs,
    outputBytes: manifest.budget.maxOutputBytes - state.spentOutputBytes,
  };
}

function usageFromResponse(manifest: ResolvedWorkflowManifest, response: BenchmarkProviderResponse) {
  const reservedCostUsd = manifest.backend === 'codex_app_server' && manifest.budget.projectedSpendUsd !== null
    ? manifest.budget.projectedSpendUsd / manifest.budget.projectedCalls
    : response.metrics.tokens.costUsd;
  return { calls: 1, costUsd: reservedCostUsd, wallMs: response.metrics.wallMs, outputBytes: response.metrics.outputBytes };
}
function errorMessage(error: unknown): string { return error instanceof Error ? error.message.slice(0, 240) : String(error).slice(0, 240); }
function isBudgetFailure(reason: string): boolean { return /budget|maxCalls|maxSpendUsd|maxWallMs|maxOutputBytes|requires known/i.test(reason); }

export function buildWorkflowBenchmarkManifest(manifest: ResolvedWorkflowManifest, fixtures: WorkflowFixtureRecord[], manifestHash: string, createdAt: string): BenchmarkManifest {
  return {
    v: 2, kind: 'benchmark_manifest', source: 'benchmark_v2', backend: manifest.backend, provider: manifest.provider, providerLabel: manifest.provider, tier: manifest.tier,
    requestedModel: manifest.requestedModel,
    fixture: { fixtureId: 'workflow-suite', fixtureClass: manifest.componentClass, fixtureHash: sha256(stableStringify(fixtures.map((fixture) => fixture.fixtureHash))), promptHash: sha256(stableStringify(fixtures.map((fixture) => fixture.promptHash))), treatmentHash: manifestHash, variant: null },
    provenance: manifest.provenance, createdAt, manifestHash, modelVerificationWaiver: false, marginRegistry: manifest.marginRegistry,
    calibration: manifest.calibration, snapshot: null, legacy: { attemptedComplete: null, baselineEligible: null, commitSha: manifest.candidateCommitSha, providerFootprintArtifactHash: manifest.providerFootprintArtifactHash },
  };
}
