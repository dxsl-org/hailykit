import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { sha256, stableStringify } from '../reasoning-harness/hash';
import { validateCalibration, validateMarginRegistry } from './schema-fixture';
import { asRecord, assertKeys, optString, reqBoolean, reqEnum, reqInt, reqString } from './schema-helpers';
import { validateWorkflowLiveBudget, type WorkflowLiveBudget } from './live-budget';
import type { BenchmarkCalibrationState, BenchmarkMarginRegistry, BenchmarkProvider, BenchmarkProvenance, BenchmarkWorkflowBackend } from './types';
import type { EvalTier } from '../reasoning-harness/types';

export type WorkflowPolicy = 'read_only' | 'workspace_write';
export interface WorkflowFixtureDefinition { fixtureId: string; fixtureClass: string; promptHash: string; prompt?: string; }
export interface WorkflowFixtureRecord extends Omit<WorkflowFixtureDefinition, 'prompt'> { fixtureHash: string; relativePath: string; prompt: string | null; }
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
const FIXTURE_KEYS = ['fixtureId', 'fixtureClass', 'promptHash', 'prompt'] as const;
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
    return { fixtureId: reqString(record.fixtureId, 'workflow fixture.fixtureId'), fixtureClass: reqString(record.fixtureClass, 'workflow fixture.fixtureClass'), promptHash, prompt, fixtureHash: sha256(raw.replace(/\r\n/g, '\n')), relativePath: normalized };
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
function resolveNoLinks(root: string, relativePath: string): string { let current = root; for (const part of relativePath.split('/')) { current = path.join(current, part); if (fs.lstatSync(current).isSymbolicLink()) throw new Error(`workflow path cannot contain a symlink or junction: ${relativePath}`); } const real = fs.realpathSync.native(current); const rel = path.relative(root, real); if (rel.startsWith('..') || path.isAbsolute(rel)) throw new Error(`workflow path escapes root: ${relativePath}`); return real; }
function safeRelativePath(value: string): string { const normalized = value.replace(/\\/g, '/'); if (!normalized || path.posix.isAbsolute(normalized) || normalized.split('/').includes('..') || DENY_PATH.test(normalized)) throw new Error(`unsafe workflow path: ${value}`); return normalized; }
function stringArray(value: unknown, name: string): string[] { if (!Array.isArray(value) || !value.length) throw new Error(`${name} must be a non-empty string array`); return value.map((entry, index) => reqString(entry, `${name}[${index}]`)); }
function treatmentFileSets(value: unknown): { base: string[]; candidate: string[] } { const record = asRecord(value, 'workflow manifest.treatmentFiles'); assertKeys(record, ['base', 'candidate'], 'workflow manifest.treatmentFiles'); return { base: stringArray(record.base, 'workflow manifest.treatmentFiles.base'), candidate: stringArray(record.candidate, 'workflow manifest.treatmentFiles.candidate') }; }
function boundedRepeats(value: unknown): number { const repeats = reqInt(value, 'workflow manifest.repeats', 1); if (repeats > 256) throw new Error('workflow repeats must be between 1 and 256'); return repeats; }
function safeRequestedModel(value: string): string { if (!/^[A-Za-z0-9._:/-]+$/.test(value)) throw new Error('workflow requestedModel contains unsafe characters'); return value; }
function assertCleanRepo(root: string): void { if (execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim()) throw new Error('workflow benchmark refuses dirty source trees'); }
function resolveCommitSha(root: string, ref: string): string { const value = execFileSync('git', ['rev-parse', '--verify', `${ref}^{commit}`], { cwd: root, encoding: 'utf8' }).trim(); if (!/^[0-9a-f]{40}$/i.test(value)) throw new Error(`ref did not resolve to a commit SHA: ${ref}`); return value; }
