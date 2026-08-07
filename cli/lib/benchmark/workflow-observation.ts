import type { BenchmarkProviderResponse } from './provider-contract';
import { validateMeasuredProviderMetrics } from './schema-metrics';
import type { ScheduledWorkflowArm } from './scheduler';
import type { ResolvedWorkflowManifest, WorkflowFixtureRecord } from './treatment-manifest';
import type { BenchmarkMetrics, BenchmarkObservation, BenchmarkStatus } from './types';

export function validateWorkflowProviderResponse(response: BenchmarkProviderResponse, manifest: ResolvedWorkflowManifest): BenchmarkProviderResponse {
  if (!response || typeof response !== 'object') throw new Error('workflow provider returned no response');
  if (response.provider !== manifest.provider) throw new Error(`workflow provider mismatch: expected ${manifest.provider}, got ${response.provider}`);
  if ((response.backend ?? 'provider') !== manifest.backend) throw new Error(`workflow backend mismatch: expected ${manifest.backend}, got ${response.backend ?? 'provider'}`);
  if (manifest.backend === 'codex_app_server' && response.surface !== 'app_server') throw new Error('workflow app-server backend returned a non-app-server surface');
  if (manifest.backend === 'provider' && response.surface !== 'provider') throw new Error('workflow provider backend returned a non-provider surface');
  if (response.policy !== manifest.policy || !response.policySatisfied) throw new Error('workflow provider did not enforce the declared read_only policy');
  const metrics = validateMeasuredProviderMetrics(response.metrics as unknown as Record<string, unknown>);
  return { ...response, metrics };
}

export function makeWorkflowObservation(manifest: ResolvedWorkflowManifest, fixture: WorkflowFixtureRecord, arm: ScheduledWorkflowArm, manifestHash: string, response: BenchmarkProviderResponse, createdAt: string, treatment: { bytes: number; digest: string; files: string[] }): BenchmarkObservation {
  if (response.actualModel !== null && !response.modelSatisfied) throw new Error(`workflow model mismatch: expected ${manifest.requestedModel}, got ${response.actualModel}`);
  return baseObservation(manifest, fixture, arm, manifestHash, {
    actualModel: response.actualModel, modelSatisfied: response.modelSatisfied, modelVerified: response.modelVerified,
    modelVerificationSource: response.modelVerificationSource, status: 'success', statusClass: 'measured',
    metrics: { outcomeLabel: 'not_measured', outcomeScore: null, ...response.metrics },
    reason: 'raw workflow observation awaits deterministic evaluation', response,
    extensions: {
      createdAt,
      componentClass: manifest.componentClass,
      cliVersion: manifest.cliVersion,
      configSnapshotHash: manifest.configSnapshotHash,
      ablations: manifest.ablations,
      backend: manifest.backend,
      treatmentBytes: treatment.bytes,
      treatmentDigest: treatment.digest,
      treatmentFiles: treatment.files,
      projectedSpendReserveUsd: manifest.backend === 'codex_app_server' && manifest.budget.projectedSpendUsd !== null
        ? manifest.budget.projectedSpendUsd / manifest.budget.projectedCalls
        : null,
    },
  });
}

export function makeWorkflowFailureObservation(manifest: ResolvedWorkflowManifest, fixture: WorkflowFixtureRecord, arm: ScheduledWorkflowArm, manifestHash: string, reason: string): BenchmarkObservation {
  return baseObservation(manifest, fixture, arm, manifestHash, {
    actualModel: null, modelSatisfied: false, modelVerified: false, modelVerificationSource: 'unknown',
    status: failureStatus(reason), statusClass: 'unmeasured', metrics: emptyMetrics(), reason,
    response: null, extensions: { failureClass: failureClass(reason) },
  });
}

export function finalizeWorkflowPairs(rows: BenchmarkObservation[]): BenchmarkObservation[] {
  const byPair = new Map<string, BenchmarkObservation[]>();
  for (const row of rows) { if (!row.pairId) continue; if (!byPair.has(row.pairId)) byPair.set(row.pairId, []); byPair.get(row.pairId)!.push(row); }
  return [...byPair.values()].flatMap((pair) => {
    const arms = new Set(pair.map((row) => row.arm));
    const complete = pair.length === 2 && arms.has('base') && arms.has('candidate') && pair.every((row) => row.statusClass === 'measured');
    return pair.map((row) => ({ ...row, pairStatus: complete ? 'paired' as const : 'missing_pair' as const, decisionEligible: false, decisionIneligibleReason: complete ? 'raw workflow observation awaits deterministic evaluation' : 'paired arm failed or was not measured' }));
  });
}

function baseObservation(manifest: ResolvedWorkflowManifest, fixture: WorkflowFixtureRecord, arm: ScheduledWorkflowArm, manifestHash: string, state: {
  actualModel: string | null; modelSatisfied: boolean; modelVerified: boolean; modelVerificationSource: BenchmarkObservation['modelVerificationSource'];
  status: BenchmarkStatus; statusClass: BenchmarkObservation['statusClass']; metrics: BenchmarkMetrics; reason: string; response: BenchmarkProviderResponse | null; extensions: Record<string, unknown>;
}): BenchmarkObservation {
  return {
    v: 2, kind: 'benchmark_observation', source: 'benchmark_v2', backend: manifest.backend, key: `${fixture.fixtureId}#${arm.repeat}#${arm.arm}`, fixtureId: fixture.fixtureId, repeat: arm.repeat,
    provider: manifest.provider, providerLabel: manifest.provider, requestedModel: manifest.requestedModel, actualModel: state.actualModel,
    modelSatisfied: state.modelSatisfied, modelVerified: state.modelVerified, modelVerificationSource: state.modelVerificationSource,
    provenance: manifest.provenance, status: state.status, statusClass: state.statusClass, decisionEligible: false, decisionIneligibleReason: state.reason,
    pairId: arm.pairId, blockId: arm.blockId, arm: arm.arm, pairStatus: 'missing_pair',
    fixture: { fixtureId: fixture.fixtureId, fixtureClass: fixture.fixtureClass, fixtureHash: fixture.fixtureHash, promptHash: fixture.promptHash, treatmentHash: manifestHash, variant: null }, manifestHash,
    metrics: state.metrics,
    providerExtensions: { ...(state.response?.providerExtensions ?? {}), workflow: { baseCommitSha: manifest.baseCommitSha, candidateCommitSha: manifest.candidateCommitSha, budget: manifest.budget, evaluatorEvidenceHash: manifest.evaluatorEvidenceHash, ...state.extensions } },
    legacy: { baselineEligible: null, attemptedComplete: state.statusClass === 'measured', actualPolicy: state.response?.policy ?? 'read_only', policySatisfied: state.response?.policySatisfied ?? false, coverage: null, hardChecksPassed: null, hardChecksTotal: null, finalAnswer: state.response?.rawOutput ?? null, note: state.response?.note ?? state.reason, commitSha: arm.arm === 'base' ? manifest.baseCommitSha : manifest.candidateCommitSha, providerFootprintArtifactHash: null },
  };
}

function emptyMetrics(): BenchmarkMetrics { return { outcomeLabel: 'not_measured', outcomeScore: null, wallMs: null, ttftMs: null, outputBytes: null, tokens: { inputTokens: null, outputTokens: null, totalTokens: null, costUsd: null, cacheReadTokens: null, cacheWriteTokens: null, reasoningTokens: null, costSource: 'unknown' }, contextOccupancy: null, contextCompactionBytes: null, toolCalls: null, toolErrors: null, toolRetries: null, approvals: null, subagentCount: null, subagentDepth: null, hookCalls: null, hookLatencyMs: null, hookContextBytes: null }; }
function failureStatus(reason: string): BenchmarkStatus { if (/auth|quota|rate limit/i.test(reason)) return 'auth_failure'; if (/timeout|timed out/i.test(reason)) return 'timeout'; if (/model mismatch/i.test(reason)) return 'model_mismatch'; return 'incomplete'; }
function failureClass(reason: string): string { if (/budget|maxCalls|maxSpendUsd|maxWallMs|maxOutputBytes|requires known/i.test(reason)) return 'budget_stop'; if (/auth|quota|rate limit/i.test(reason)) return 'provider_auth'; if (/timeout/i.test(reason)) return 'provider_timeout'; return 'provider_failure'; }
