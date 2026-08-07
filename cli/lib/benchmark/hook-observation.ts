import { sha256, stableStringify } from '../reasoning-harness/hash';
import { validateBenchmarkObservation } from './schema';
import type { BenchmarkObservation } from './types';
import type { HookFixture, HookReplayOutcome } from './hook-fixtures';
import type { HookReplayResult } from './hook-replay';

export function toHookBenchmarkObservation(result: HookReplayResult, fixture: HookFixture): BenchmarkObservation {
  return validateBenchmarkObservation({
    v: 2,
    kind: 'benchmark_observation',
    source: 'hook',
    key: `${fixture.id}#1`,
    fixtureId: fixture.id,
    repeat: 1,
    provider: null,
    providerLabel: 'hook',
    requestedModel: fixture.mode,
    actualModel: null,
    modelSatisfied: true,
    modelVerified: false,
    modelVerificationSource: 'unknown',
    provenance: 'synthetic',
    status: statusForOutcome(result.outcome),
    statusClass: statusClassForOutcome(result.outcome),
    decisionEligible: false,
    decisionIneligibleReason: 'hook replay observations are offline and synthetic',
    pairId: null,
    blockId: fixture.eventName,
    arm: fixture.mode,
    pairStatus: 'unpaired',
    fixture: {
      fixtureId: fixture.id,
      fixtureClass: fixture.eventName,
      fixtureHash: sha256(fixture.stdin),
      promptHash: sha256(fixture.scriptRelativePath),
      treatmentHash: sha256(`${fixture.mode}:${fixture.eventName}`),
      variant: 'none',
    },
    manifestHash: sha256(`${fixture.id}:${fixture.mode}:hook`),
    metrics: {
      outcomeLabel: labelForOutcome(result.outcome),
      outcomeScore: scoreForOutcome(result.outcome),
      wallMs: Math.round(result.wallMs * 1000) / 1000,
      ttftMs: null,
      outputBytes: result.stdoutBytes,
      tokens: { inputTokens: null, outputTokens: null, totalTokens: null, costUsd: null, cacheReadTokens: null, cacheWriteTokens: null, reasoningTokens: null, costSource: 'unknown' },
      contextOccupancy: null,
      contextCompactionBytes: null,
      toolCalls: null,
      toolErrors: result.outcome === 'emitted' || result.outcome === 'intentional_skip' ? 0 : 1,
      toolRetries: null,
      approvals: null,
      subagentCount: null,
      subagentDepth: null,
      hookCalls: 1,
      hookLatencyMs: Math.round(result.wallMs * 1000) / 1000,
      hookContextBytes: result.additionalContextBytes,
    },
    providerExtensions: {
      hookReplay: {
        mode: result.mode,
        eventName: result.eventName,
        outcome: result.outcome,
        exitCode: result.exitCode,
        stdoutBytes: result.stdoutBytes,
        stderrBytes: result.stderrBytes,
        additionalContextBytes: result.additionalContextBytes,
        scriptLabel: result.scriptLabel,
        outputDigest: result.parsedOutput ? `sha256:${sha256(stableStringify(result.parsedOutput))}` : null,
      },
    },
    legacy: {
      baselineEligible: false,
      attemptedComplete: false,
      actualPolicy: null,
      policySatisfied: null,
      coverage: null,
      hardChecksPassed: null,
      hardChecksTotal: null,
      finalAnswer: null,
      note: fixture.note ?? null,
      commitSha: null,
    },
  });
}

function statusForOutcome(outcome: HookReplayOutcome): BenchmarkObservation['status'] {
  if (outcome === 'emitted') return 'success';
  if (outcome === 'intentional_skip') return 'dry_run';
  if (outcome === 'malformed_input_fail_open') return 'incomplete';
  if (outcome === 'timeout_fail_open') return 'timeout';
  if (outcome === 'unexpected_no_output') return 'empty_output';
  return 'non_zero_exit';
}

function statusClassForOutcome(outcome: HookReplayOutcome): BenchmarkObservation['statusClass'] {
  return outcome === 'emitted' ? 'measured' : 'unmeasured';
}

function labelForOutcome(outcome: HookReplayOutcome): BenchmarkObservation['metrics']['outcomeLabel'] {
  return outcome === 'emitted' || outcome === 'intentional_skip' ? 'pass' : 'fail';
}

function scoreForOutcome(outcome: HookReplayOutcome): number {
  return outcome === 'emitted' || outcome === 'intentional_skip' ? 1 : 0;
}
