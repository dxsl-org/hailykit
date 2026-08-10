import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { sha256, stableStringify } from '../reasoning-harness/hash';
import { validateCalibration, validateMarginRegistry } from './schema-fixture';
import { asRecord, assertKeys, reqBoolean, reqEnum, reqInt, reqString } from './schema-helpers';
import { validateWorkflowLiveBudget, type WorkflowLiveBudget } from './live-budget';
import type { BenchmarkCalibrationState, BenchmarkMarginRegistry, BenchmarkProvider, BenchmarkProvenance, BenchmarkWorkflowBackend } from './types';
import type { EvalTier } from '../reasoning-harness/types';

export type WorkflowPolicy = 'read_only' | 'workspace_write';
export type WorkflowFixtureSplit = 'public-training' | 'public-locked-validation' | 'private-hash-only-holdout';
export interface WorkflowFixtureLocalDeterministicEvidence {
  testsPassed: boolean | null;
  requiredArtifacts: string[];
  observedArtifacts: string[];
  requiredInstructions: string[];
  satisfiedInstructions: string[];
  forbiddenInstructions: string[];
  violatedInstructions: string[];
  allowedScopePaths: string[];
  changedPaths: string[];
  escalationRequired: boolean;
  escalationPerformed: boolean;
  rollbackRequired: boolean;
  rollbackProvided: boolean;
  necessaryToolCalls: number | null;
}
export interface WorkflowJsonContractChecks {
  requiredTopLevelKeys: string[];
  forbiddenTopLevelKeys: string[];
}
export interface WorkflowTextChecks {
  requiredSubstrings: string[];
  forbiddenSubstrings: string[];
}
export interface WorkflowTextContractChecks {
  requiredAnyOf: string[][];
  requiredNegatedAnyOf?: string[][];
  forbiddenSubstrings: string[];
}
export type WorkflowFixtureLocalEvaluation =
  | {
    schemaVersion: 1;
    mode: 'json_contract';
    split: WorkflowFixtureSplit;
    deterministicEvidence: WorkflowFixtureLocalDeterministicEvidence;
    checks: WorkflowJsonContractChecks;
  }
  | {
    schemaVersion: 1;
    mode: 'text_checks';
    split: WorkflowFixtureSplit;
    deterministicEvidence: WorkflowFixtureLocalDeterministicEvidence;
    checks: WorkflowTextChecks;
  }
  | {
    schemaVersion: 1;
    mode: 'text_contracts';
    split: WorkflowFixtureSplit;
    deterministicEvidence: WorkflowFixtureLocalDeterministicEvidence;
    checks: WorkflowTextContractChecks;
  };
export interface WorkflowFixtureDefinition {
  fixtureId: string;
  fixtureClass: string;
  promptHash: string;
  prompt?: string;
  localEvaluation?: WorkflowFixtureLocalEvaluation;
}
export interface WorkflowFixtureRecord extends Omit<WorkflowFixtureDefinition, 'prompt' | 'localEvaluation'> {
  fixtureHash: string;
  relativePath: string;
  prompt: string | null;
  localEvaluation: WorkflowFixtureLocalEvaluation | null;
}
export interface WorkflowTreatmentManifest {
  provider: BenchmarkProvider; tier: EvalTier; requestedModel: string; policy: WorkflowPolicy; provenance: BenchmarkProvenance;
  liveEquivalent: boolean; budgetAcknowledged: boolean; budget: WorkflowLiveBudget; baseRef: string; candidateRef: string;
  fixtureRoot: string; fixturePaths: string[]; repeats: number; randomSeed: number; cliVersion: string; configSnapshotHash: string;
  componentClass: string; ablations: string[]; marginRegistry: BenchmarkMarginRegistry; calibration: BenchmarkCalibrationState; evaluatorEvidenceHash: string;
  backend?: BenchmarkWorkflowBackend | null;
  providerFootprintArtifactHash?: string | null;
  treatmentFiles: { base: string[]; candidate: string[] };
}
export interface ResolvedWorkflowManifest extends Omit<WorkflowTreatmentManifest, 'providerFootprintArtifactHash' | 'backend'> { backend: BenchmarkWorkflowBackend; providerFootprintArtifactHash: string | null; baseCommitSha: string; candidateCommitSha: string; fixtureRoot: string; }

const MANIFEST_KEYS = ['provider', 'tier', 'requestedModel', 'policy', 'provenance', 'liveEquivalent', 'budgetAcknowledged', 'budget', 'baseRef', 'candidateRef', 'fixtureRoot', 'fixturePaths', 'repeats', 'randomSeed', 'cliVersion', 'configSnapshotHash', 'componentClass', 'ablations', 'marginRegistry', 'calibration', 'evaluatorEvidenceHash', 'backend', 'providerFootprintArtifactHash', 'treatmentFiles'] as const;
const FIXTURE_KEYS = ['fixtureId', 'fixtureClass', 'promptHash', 'prompt', 'localEvaluation'] as const;
const LOCAL_EVALUATION_KEYS = ['schemaVersion', 'mode', 'split', 'deterministicEvidence', 'checks'] as const;
const LOCAL_EVIDENCE_KEYS = ['testsPassed', 'requiredArtifacts', 'observedArtifacts', 'requiredInstructions', 'satisfiedInstructions', 'forbiddenInstructions', 'violatedInstructions', 'allowedScopePaths', 'changedPaths', 'escalationRequired', 'escalationPerformed', 'rollbackRequired', 'rollbackProvided', 'necessaryToolCalls'] as const;
const DENY_PATH = /(^|\/)\.(env|aws|ssh)(\/|$)|id_rsa|credentials/i;

export function resolveWorkflowManifest(repoRoot: string, value: WorkflowTreatmentManifest): ResolvedWorkflowManifest {
  const input = asRecord(value, 'workflow manifest');
  assertKeys(input, MANIFEST_KEYS, 'workflow manifest');
  const policy = reqEnum(input.policy, ['read_only', 'workspace_write'], 'workflow manifest.policy');
  if (policy !== 'read_only') throw new Error('workflow benchmark V1 supports read_only only');
  const provenance = reqEnum(input.provenance, ['live', 'offline-score', 'dry-run', 'synthetic'], 'workflow manifest.provenance');
  const liveEquivalent = reqBoolean(input.liveEquivalent, 'workflow manifest.liveEquivalent');
  if ((provenance === 'live') !== liveEquivalent) throw new Error('workflow provenance=live must match liveEquivalent=true');
  const root = fs.realpathSync.native(path.resolve(repoRoot));
  assertCleanRepo(root);
  const fixtureRoot = resolveFixtureRoot(root, reqString(input.fixtureRoot, 'workflow manifest.fixtureRoot'));
  const fixturePaths = stringArray(input.fixturePaths, 'workflow manifest.fixturePaths');
  const ablations = stringArray(input.ablations, 'workflow manifest.ablations');
  const marginRegistry = validateMarginRegistry(input.marginRegistry);
  const calibration = validateCalibration(input.calibration);
  const treatmentFiles = treatmentFileSets(input.treatmentFiles);
  const requestedModel = safeRequestedModel(reqString(input.requestedModel, 'workflow manifest.requestedModel'));
  if (marginRegistry.firstDecisionBatch !== calibration.firstDecisionBatch) throw new Error('workflow margin and calibration firstDecisionBatch must match');
  return {
    provider: reqEnum(input.provider, ['claude', 'codex'], 'workflow manifest.provider'),
    tier: reqEnum(input.tier, ['fast', 'medium', 'thinking', 'ultra'], 'workflow manifest.tier'),
    requestedModel, policy, provenance, liveEquivalent,
    budgetAcknowledged: reqBoolean(input.budgetAcknowledged, 'workflow manifest.budgetAcknowledged'),
    budget: validateWorkflowLiveBudget(input.budget), baseRef: reqString(input.baseRef, 'workflow manifest.baseRef'),
    candidateRef: reqString(input.candidateRef, 'workflow manifest.candidateRef'), fixtureRoot, fixturePaths,
    repeats: boundedRepeats(input.repeats), randomSeed: reqInt(input.randomSeed, 'workflow manifest.randomSeed'),
    cliVersion: reqString(input.cliVersion, 'workflow manifest.cliVersion'), configSnapshotHash: reqString(input.configSnapshotHash, 'workflow manifest.configSnapshotHash'),
    componentClass: reqString(input.componentClass, 'workflow manifest.componentClass'), ablations,
    marginRegistry, calibration,
    evaluatorEvidenceHash: reqString(input.evaluatorEvidenceHash, 'workflow manifest.evaluatorEvidenceHash'), treatmentFiles,
    backend: input.backend === undefined || input.backend === null
      ? 'provider'
      : reqEnum(input.backend, ['provider', 'codex_app_server'], 'workflow manifest.backend'),
    providerFootprintArtifactHash: input.providerFootprintArtifactHash === undefined || input.providerFootprintArtifactHash === null
      ? null
      : reqString(input.providerFootprintArtifactHash, 'workflow manifest.providerFootprintArtifactHash'),
    baseCommitSha: resolveCommitSha(root, reqString(input.baseRef, 'workflow manifest.baseRef')),
    candidateCommitSha: resolveCommitSha(root, reqString(input.candidateRef, 'workflow manifest.candidateRef')),
  };
}

export function loadWorkflowFixtures(manifest: ResolvedWorkflowManifest): WorkflowFixtureRecord[] {
  return manifest.fixturePaths.map((relativePath) => {
    const normalized = safeRelativePath(relativePath);
    const filePath = resolveNoLinks(manifest.fixtureRoot, normalized);
    const raw = fs.readFileSync(filePath, 'utf8');
    const record = asRecord(JSON.parse(raw), `workflow fixture ${relativePath}`);
    assertKeys(record, FIXTURE_KEYS, `workflow fixture ${relativePath}`);
    const prompt = record.prompt === undefined ? null : reqString(record.prompt, `workflow fixture ${relativePath}.prompt`);
    const promptHash = reqString(record.promptHash, `workflow fixture ${relativePath}.promptHash`);
    if (prompt && sha256(prompt) !== promptHash) throw new Error(`workflow fixture ${relativePath} promptHash mismatch`);
    if (manifest.provenance === 'live' && !prompt) throw new Error(`live workflow fixture ${relativePath} requires prompt text`);
    return {
      fixtureId: reqString(record.fixtureId, 'workflow fixture.fixtureId'),
      fixtureClass: reqString(record.fixtureClass, 'workflow fixture.fixtureClass'),
      promptHash,
      prompt,
      localEvaluation: record.localEvaluation === undefined ? null : validateWorkflowFixtureLocalEvaluation(record.localEvaluation, relativePath),
      fixtureHash: sha256(raw.replace(/\r\n/g, '\n')),
      relativePath: normalized,
    };
  });
}

export function buildWorkflowManifestHash(manifest: ResolvedWorkflowManifest, fixtures: WorkflowFixtureRecord[]): string {
  const { identityHash: _identityHash, ...marginDefinition } = manifest.marginRegistry;
  return sha256(stableStringify({ provider: manifest.provider, backend: manifest.backend, tier: manifest.tier, requestedModel: manifest.requestedModel, policy: manifest.policy, provenance: manifest.provenance, baseCommitSha: manifest.baseCommitSha, candidateCommitSha: manifest.candidateCommitSha, repeats: manifest.repeats, randomSeed: manifest.randomSeed, cliVersion: manifest.cliVersion, configSnapshotHash: manifest.configSnapshotHash, componentClass: manifest.componentClass, ablations: manifest.ablations, treatmentFiles: manifest.treatmentFiles, marginRegistry: marginDefinition, calibration: manifest.calibration, evaluatorEvidenceHash: manifest.evaluatorEvidenceHash, providerFootprintArtifactHash: manifest.providerFootprintArtifactHash, budget: manifest.budget, fixtures: fixtures.map(({ prompt, ...fixture }) => fixture) }));
}

function resolveFixtureRoot(repoRoot: string, relativePath: string): string {
  if (path.isAbsolute(relativePath)) throw new Error('workflow fixtureRoot must be repo-relative');
  const resolved = resolveNoLinks(repoRoot, safeRelativePath(relativePath));
  if (!fs.statSync(resolved).isDirectory()) throw new Error('workflow fixtureRoot must be a directory');
  return resolved;
}
function validateWorkflowFixtureLocalEvaluation(value: unknown, relativePath: string): WorkflowFixtureLocalEvaluation {
  const record = asRecord(value, `workflow fixture ${relativePath}.localEvaluation`);
  assertKeys(record, LOCAL_EVALUATION_KEYS, `workflow fixture ${relativePath}.localEvaluation`);
  const schemaVersion = reqInt(record.schemaVersion, `workflow fixture ${relativePath}.localEvaluation.schemaVersion`);
  if (schemaVersion !== 1) throw new Error(`workflow fixture ${relativePath}.localEvaluation.schemaVersion must be 1`);
  const mode = reqEnum(record.mode, ['json_contract', 'text_checks', 'text_contracts'], `workflow fixture ${relativePath}.localEvaluation.mode`);
  const split = reqEnum(record.split, ['public-training', 'public-locked-validation', 'private-hash-only-holdout'], `workflow fixture ${relativePath}.localEvaluation.split`);
  const deterministicEvidence = validateWorkflowFixtureLocalDeterministicEvidence(record.deterministicEvidence, relativePath);
  if (mode === 'json_contract') {
    const checks = asRecord(record.checks, `workflow fixture ${relativePath}.localEvaluation.checks`);
    assertKeys(checks, ['requiredTopLevelKeys', 'forbiddenTopLevelKeys'], `workflow fixture ${relativePath}.localEvaluation.checks`);
    return {
      schemaVersion,
      mode,
      split,
      deterministicEvidence,
      checks: {
        requiredTopLevelKeys: flexibleStringArray(checks.requiredTopLevelKeys, `workflow fixture ${relativePath}.localEvaluation.checks.requiredTopLevelKeys`),
        forbiddenTopLevelKeys: flexibleStringArray(checks.forbiddenTopLevelKeys, `workflow fixture ${relativePath}.localEvaluation.checks.forbiddenTopLevelKeys`),
      },
    };
  }
  const checks = asRecord(record.checks, `workflow fixture ${relativePath}.localEvaluation.checks`);
  if (mode === 'text_contracts') {
    assertKeys(checks, ['requiredAnyOf', 'requiredNegatedAnyOf', 'forbiddenSubstrings'], `workflow fixture ${relativePath}.localEvaluation.checks`);
    return {
      schemaVersion,
      mode,
      split,
      deterministicEvidence,
      checks: {
        requiredAnyOf: flexibleStringMatrix(checks.requiredAnyOf, `workflow fixture ${relativePath}.localEvaluation.checks.requiredAnyOf`),
        requiredNegatedAnyOf: checks.requiredNegatedAnyOf === undefined
          ? []
          : flexibleStringMatrix(checks.requiredNegatedAnyOf, `workflow fixture ${relativePath}.localEvaluation.checks.requiredNegatedAnyOf`),
        forbiddenSubstrings: flexibleStringArray(checks.forbiddenSubstrings, `workflow fixture ${relativePath}.localEvaluation.checks.forbiddenSubstrings`),
      },
    };
  }
  assertKeys(checks, ['requiredSubstrings', 'forbiddenSubstrings'], `workflow fixture ${relativePath}.localEvaluation.checks`);
  return {
    schemaVersion,
    mode,
    split,
    deterministicEvidence,
    checks: {
      requiredSubstrings: flexibleStringArray(checks.requiredSubstrings, `workflow fixture ${relativePath}.localEvaluation.checks.requiredSubstrings`),
      forbiddenSubstrings: flexibleStringArray(checks.forbiddenSubstrings, `workflow fixture ${relativePath}.localEvaluation.checks.forbiddenSubstrings`),
    },
  };
}
function validateWorkflowFixtureLocalDeterministicEvidence(value: unknown, relativePath: string): WorkflowFixtureLocalDeterministicEvidence {
  const record = asRecord(value, `workflow fixture ${relativePath}.localEvaluation.deterministicEvidence`);
  assertKeys(record, LOCAL_EVIDENCE_KEYS, `workflow fixture ${relativePath}.localEvaluation.deterministicEvidence`);
  return {
    testsPassed: nullableBoolean(record.testsPassed, `workflow fixture ${relativePath}.localEvaluation.deterministicEvidence.testsPassed`),
    requiredArtifacts: flexibleStringArray(record.requiredArtifacts, `workflow fixture ${relativePath}.localEvaluation.deterministicEvidence.requiredArtifacts`),
    observedArtifacts: flexibleStringArray(record.observedArtifacts, `workflow fixture ${relativePath}.localEvaluation.deterministicEvidence.observedArtifacts`),
    requiredInstructions: flexibleStringArray(record.requiredInstructions, `workflow fixture ${relativePath}.localEvaluation.deterministicEvidence.requiredInstructions`),
    satisfiedInstructions: flexibleStringArray(record.satisfiedInstructions, `workflow fixture ${relativePath}.localEvaluation.deterministicEvidence.satisfiedInstructions`),
    forbiddenInstructions: flexibleStringArray(record.forbiddenInstructions, `workflow fixture ${relativePath}.localEvaluation.deterministicEvidence.forbiddenInstructions`),
    violatedInstructions: flexibleStringArray(record.violatedInstructions, `workflow fixture ${relativePath}.localEvaluation.deterministicEvidence.violatedInstructions`),
    allowedScopePaths: flexibleStringArray(record.allowedScopePaths, `workflow fixture ${relativePath}.localEvaluation.deterministicEvidence.allowedScopePaths`),
    changedPaths: flexibleStringArray(record.changedPaths, `workflow fixture ${relativePath}.localEvaluation.deterministicEvidence.changedPaths`),
    escalationRequired: reqBoolean(record.escalationRequired, `workflow fixture ${relativePath}.localEvaluation.deterministicEvidence.escalationRequired`),
    escalationPerformed: reqBoolean(record.escalationPerformed, `workflow fixture ${relativePath}.localEvaluation.deterministicEvidence.escalationPerformed`),
    rollbackRequired: reqBoolean(record.rollbackRequired, `workflow fixture ${relativePath}.localEvaluation.deterministicEvidence.rollbackRequired`),
    rollbackProvided: reqBoolean(record.rollbackProvided, `workflow fixture ${relativePath}.localEvaluation.deterministicEvidence.rollbackProvided`),
    necessaryToolCalls: record.necessaryToolCalls === null
      ? null
      : reqInt(record.necessaryToolCalls, `workflow fixture ${relativePath}.localEvaluation.deterministicEvidence.necessaryToolCalls`),
  };
}
function resolveNoLinks(root: string, relativePath: string): string { let current = root; for (const part of relativePath.split('/')) { current = path.join(current, part); if (fs.lstatSync(current).isSymbolicLink()) throw new Error(`workflow path cannot contain a symlink or junction: ${relativePath}`); } const real = fs.realpathSync.native(current); const rel = path.relative(root, real); if (rel.startsWith('..') || path.isAbsolute(rel)) throw new Error(`workflow path escapes root: ${relativePath}`); return real; }
function safeRelativePath(value: string): string { const normalized = value.replace(/\\/g, '/'); if (!normalized || path.posix.isAbsolute(normalized) || normalized.split('/').includes('..') || DENY_PATH.test(normalized)) throw new Error(`unsafe workflow path: ${value}`); return normalized; }
function stringArray(value: unknown, name: string): string[] { if (!Array.isArray(value) || !value.length) throw new Error(`${name} must be a non-empty string array`); return value.map((entry, index) => reqString(entry, `${name}[${index}]`)); }
function flexibleStringArray(value: unknown, name: string): string[] { if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) throw new Error(`${name} must be a string array`); return value as string[]; }
function flexibleStringMatrix(value: unknown, name: string): string[][] {
  if (!Array.isArray(value) || !value.length || value.some((group) => !Array.isArray(group) || !group.length || group.some((entry) => typeof entry !== 'string' || !entry.trim()))) {
    throw new Error(`${name} must be an array of non-empty string arrays`);
  }
  return value as string[][];
}
function treatmentFileSets(value: unknown): { base: string[]; candidate: string[] } { const record = asRecord(value, 'workflow manifest.treatmentFiles'); assertKeys(record, ['base', 'candidate'], 'workflow manifest.treatmentFiles'); return { base: stringArray(record.base, 'workflow manifest.treatmentFiles.base'), candidate: stringArray(record.candidate, 'workflow manifest.treatmentFiles.candidate') }; }
function boundedRepeats(value: unknown): number { const repeats = reqInt(value, 'workflow manifest.repeats', 1); if (repeats > 256) throw new Error('workflow repeats must be between 1 and 256'); return repeats; }
function safeRequestedModel(value: string): string { if (!/^[A-Za-z0-9._:/-]+$/.test(value)) throw new Error('workflow requestedModel contains unsafe characters'); return value; }
function assertCleanRepo(root: string): void { if (execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim()) throw new Error('workflow benchmark refuses dirty source trees'); }
function resolveCommitSha(root: string, ref: string): string { const value = execFileSync('git', ['rev-parse', '--verify', `${ref}^{commit}`], { cwd: root, encoding: 'utf8' }).trim(); if (!/^[0-9a-f]{40}$/i.test(value)) throw new Error(`ref did not resolve to a commit SHA: ${ref}`); return value; }
function nullableBoolean(value: unknown, name: string): boolean | null { return value === null ? null : reqBoolean(value, name); }
