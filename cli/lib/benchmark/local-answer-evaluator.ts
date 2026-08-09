import { sha256 } from '../reasoning-harness/hash';
import type { DeterministicEvidence } from './evaluators';
import type { BenchmarkProvenance } from './types';
import type { WorkflowFixtureLocalEvaluation, WorkflowFixtureSplit } from './treatment-manifest';

const MAX_STORED_CHECK_NAME_LENGTH = 80;

export interface LocalAnswerEvaluationRequest {
  rowKey: string;
  localEvaluation: WorkflowFixtureLocalEvaluation | null;
  rawOutput: string | null;
  policySatisfied: boolean;
  modelVerified: boolean;
  provenance: BenchmarkProvenance;
}

export interface LocalAnswerEvaluationResult {
  outputDigest: string | null;
  evidence: DeterministicEvidence | null;
  failedCheckIds: string[];
  fixtureSplit: WorkflowFixtureSplit | null;
}

export function evaluateLocalAnswer(request: LocalAnswerEvaluationRequest): LocalAnswerEvaluationResult {
  const outputDigest = request.rawOutput === null ? null : `sha256:${sha256(request.rawOutput)}`;
  if (!request.localEvaluation) {
    return { outputDigest, evidence: null, failedCheckIds: [], fixtureSplit: null };
  }
  const modeResult = request.rawOutput === null
    ? { taskPassed: null, outputContractPassed: null, failedCheckIds: [] as string[] }
    : request.localEvaluation.mode === 'json_contract'
      ? evaluateJsonContract(request.rowKey, request.rawOutput, request.localEvaluation.checks)
      : evaluateTextChecks(request.rawOutput, request.localEvaluation.checks);
  return {
    outputDigest,
    evidence: {
      taskPassed: modeResult.taskPassed,
      testsPassed: request.localEvaluation.deterministicEvidence.testsPassed,
      requiredArtifacts: request.localEvaluation.deterministicEvidence.requiredArtifacts,
      observedArtifacts: request.localEvaluation.deterministicEvidence.observedArtifacts,
      requiredInstructions: request.localEvaluation.deterministicEvidence.requiredInstructions,
      satisfiedInstructions: request.localEvaluation.deterministicEvidence.satisfiedInstructions,
      forbiddenInstructions: request.localEvaluation.deterministicEvidence.forbiddenInstructions,
      violatedInstructions: request.localEvaluation.deterministicEvidence.violatedInstructions,
      outputContractPassed: modeResult.outputContractPassed,
      allowedScopePaths: request.localEvaluation.deterministicEvidence.allowedScopePaths,
      changedPaths: request.localEvaluation.deterministicEvidence.changedPaths,
      escalationRequired: request.localEvaluation.deterministicEvidence.escalationRequired,
      escalationPerformed: request.localEvaluation.deterministicEvidence.escalationPerformed,
      rollbackRequired: request.localEvaluation.deterministicEvidence.rollbackRequired,
      rollbackProvided: request.localEvaluation.deterministicEvidence.rollbackProvided,
      necessaryToolCalls: request.localEvaluation.deterministicEvidence.necessaryToolCalls,
    },
    failedCheckIds: modeResult.failedCheckIds,
    fixtureSplit: request.localEvaluation.split,
  };
}

function evaluateJsonContract(
  rowKey: string,
  rawOutput: string,
  checks: Extract<WorkflowFixtureLocalEvaluation, { mode: 'json_contract' }>['checks'],
): { taskPassed: boolean; outputContractPassed: boolean; failedCheckIds: string[] } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawOutput);
  } catch {
    return {
      taskPassed: false,
      outputContractPassed: false,
      failedCheckIds: ['invalid_json_contract'],
    };
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {
      taskPassed: false,
      outputContractPassed: false,
      failedCheckIds: ['invalid_json_contract'],
    };
  }
  const record = parsed as Record<string, unknown>;
  const failedCheckIds = [
    ...checks.requiredTopLevelKeys
      .filter((key) => !Object.prototype.hasOwnProperty.call(record, key))
      .map((key, index) => hashedCheckId('required_key', index, key)),
    ...checks.forbiddenTopLevelKeys
      .filter((key) => Object.prototype.hasOwnProperty.call(record, key))
      .map((key, index) => hashedCheckId('forbidden_key', index, key)),
  ];
  return {
    taskPassed: failedCheckIds.length === 0,
    outputContractPassed: failedCheckIds.length === 0,
    failedCheckIds,
  };
}

function evaluateTextChecks(
  rawOutput: string,
  checks: Extract<WorkflowFixtureLocalEvaluation, { mode: 'text_checks' }>['checks'],
): { taskPassed: boolean; outputContractPassed: boolean; failedCheckIds: string[] } {
  const failedCheckIds = [
    ...checks.requiredSubstrings.flatMap((value, index) => rawOutput.includes(value)
      ? []
      : [boundedCheckId(`required_substring:${index + 1}:${sha256(value).slice(0, 12)}`)]),
    ...checks.forbiddenSubstrings.flatMap((value, index) => rawOutput.includes(value)
      ? [boundedCheckId(`forbidden_substring:${index + 1}:${sha256(value).slice(0, 12)}`)]
      : []),
  ];
  return {
    taskPassed: failedCheckIds.length === 0,
    outputContractPassed: failedCheckIds.length === 0,
    failedCheckIds,
  };
}

function boundedCheckId(value: string): string {
  return value.slice(0, MAX_STORED_CHECK_NAME_LENGTH);
}

function hashedCheckId(kind: string, index: number, value: string): string {
  return boundedCheckId(`${kind}:${index + 1}:${sha256(value).slice(0, 12)}`);
}
