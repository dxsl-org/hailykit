import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { validateInstalledArtifactSnapshot } from './artifact-snapshot';
import { createFixtureMetadata } from './fixture-schema';
import { BYTE_CAP, BYTES_PER_TOKEN_EST, FILE_CAP, assertContainedStaticFile, validateSnapshotEntries } from './static-guards';
import { classifyInstalledArtifact, listStaticInventory, normalizeStaticContent, selectStaticContent } from './static-inventory';
import type { StaticComponentClass, StaticInventoryItem } from './static-inventory';
import type { BenchmarkManifest, BenchmarkObservation, BenchmarkOutcome, InstalledArtifactSnapshot } from './types';
import { sha256, stableStringify } from '../reasoning-harness/hash';

export interface StaticFootprintArtifact { manifest: BenchmarkManifest; observations: BenchmarkObservation[]; outcome: BenchmarkOutcome; }
type StaticMeta = { componentClass: StaticComponentClass; relativePath: string; representation: 'source' | 'installed'; provider: 'claude' | 'codex' | null; providerFootprintStatus: 'present' | 'not_applicable'; sourceDigest: string | null; normalizedDigest: string | null; installedDigest: string | null; lineCount: number | null; fileCount: number; rawBytes: number; normalizedBytes: number | null; rawByteDelta: number | null; normalizedByteDelta: number | null; bytesPerTokenEstimate: number; estimateLabel: 'static_estimate_only'; baseRef: string | null; };

export function collectStaticFootprint(input: { repoRoot: string; baseRef?: string; inventory?: StaticInventoryItem[]; claudeSnapshot?: InstalledArtifactSnapshot | null; codexSnapshot?: InstalledArtifactSnapshot | null; }): StaticFootprintArtifact {
  const repoRoot = path.resolve(input.repoRoot);
  const inventory = input.inventory ?? listStaticInventory(repoRoot);
  if (inventory.length > FILE_CAP) throw new Error(`static inventory exceeds file cap ${FILE_CAP}`);
  const sourceRows = inventory.map((item) => sourceObservation(repoRoot, item, input.baseRef ?? 'HEAD'));
  if (sourceRows.reduce((sum, row) => sum + (row.metrics.outputBytes ?? 0), 0) > BYTE_CAP) throw new Error(`static source exceeds byte cap ${BYTE_CAP}`);
  const claudeSnapshot = validateRuntimeSnapshot(input.claudeSnapshot ?? null, 'claude');
  const codexSnapshot = validateRuntimeSnapshot(input.codexSnapshot ?? null, 'codex');
  const observations = [...sourceRows, ...snapshotObservations(claudeSnapshot, 'claude'), ...snapshotObservations(codexSnapshot, 'codex')];
  const providerFootprintStatus = claudeSnapshot && codexSnapshot ? 'complete' : 'inconclusive';
  const manifestHash = sha256(stableStringify({
    schemaVersion: 2,
    baseRef: input.baseRef ?? 'HEAD',
    providerFootprintStatus,
    snapshots: { claude: snapshotIdentity(claudeSnapshot), codex: snapshotIdentity(codexSnapshot) },
    rows: observations.map((row) => ({ key: row.key, metrics: { outputBytes: row.metrics.outputBytes, totalTokens: row.metrics.tokens.totalTokens }, static: staticMeta(row) })),
  }));
  const manifest: BenchmarkManifest = {
    v: 2, kind: 'benchmark_manifest', source: 'static', provider: null, providerLabel: 'static', tier: 'fast', requestedModel: 'static-bytes-estimate',
    fixture: createFixtureMetadata({ fixtureId: 'static-footprint', fixtureClass: 'static-footprint', fixtureHash: sha256(`static-footprint:${providerFootprintStatus}`), promptHash: sha256(input.baseRef ?? 'HEAD'), treatmentHash: sha256(manifestHash) }),
    provenance: 'synthetic', createdAt: new Date().toISOString(), manifestHash, modelVerificationWaiver: true,
    marginRegistry: { metric: 'outcomeScore', threshold: 1, exploratoryBatches: 0, firstDecisionBatch: 1, frozen: false, frozenAt: null, identityHash: sha256('static-footprint') },
    calibration: { completedLiveBatches: 0, firstDecisionBatch: 1 }, snapshot: null, legacy: { attemptedComplete: null, baselineEligible: null, commitSha: null, providerFootprintArtifactHash: null },
  };
  const outcome: BenchmarkOutcome = { v: 2, kind: 'benchmark_outcome', source: 'static', decision: 'inconclusive', reasons: ['static footprint is descriptive only', `provider footprint status: ${providerFootprintStatus}`], observedMeanScore: null, threshold: null, comparedRows: observations.length };
  return { manifest, observations: observations.map((entry) => ({ ...entry, manifestHash })), outcome };
}

function sourceObservation(repoRoot: string, item: StaticInventoryItem, baseRef: string): BenchmarkObservation {
  const filePath = assertContainedStaticFile(repoRoot, item.relativePath);
  const fileRaw = fs.readFileSync(filePath, 'utf8');
  const raw = selectStaticContent(fileRaw, item.contentMode);
  const normalized = normalizeStaticContent(fileRaw, item.contentMode);
  const beforeRaw = readGitText(repoRoot, item.relativePath, baseRef);
  const beforeSelected = beforeRaw === null ? null : selectStaticContent(beforeRaw, item.contentMode);
  const beforeNormalized = beforeRaw === null ? null : normalizeStaticContent(beforeRaw, item.contentMode);
  return buildObservation(item.relativePath, item.componentClass, {
    representation: 'source', provider: null, providerFootprintStatus: 'not_applicable', baseRef,
    sourceDigest: sha256(raw), normalizedDigest: sha256(normalized), installedDigest: null, lineCount: normalized ? normalized.split('\n').length : 0, fileCount: 1,
    rawBytes: Buffer.byteLength(raw, 'utf8'), normalizedBytes: Buffer.byteLength(normalized, 'utf8'),
    rawByteDelta: beforeSelected === null ? null : Buffer.byteLength(raw, 'utf8') - Buffer.byteLength(beforeSelected, 'utf8'),
    normalizedByteDelta: beforeNormalized === null ? null : Buffer.byteLength(normalized, 'utf8') - Buffer.byteLength(beforeNormalized, 'utf8'),
  });
}

function snapshotObservations(snapshot: InstalledArtifactSnapshot | null, provider: 'claude' | 'codex'): BenchmarkObservation[] {
  if (!snapshot) return [];
  return snapshot.entries.map((entry) => buildObservation(entry.path, classifyInstalledArtifact(entry.path), {
    representation: 'installed', provider, providerFootprintStatus: 'present', baseRef: null,
    sourceDigest: null, normalizedDigest: null, installedDigest: entry.sha256, lineCount: null, fileCount: 1, rawBytes: entry.bytes, normalizedBytes: null, rawByteDelta: null, normalizedByteDelta: null,
  }));
}

function buildObservation(relativePath: string, componentClass: StaticComponentClass, meta: Omit<StaticMeta, 'componentClass' | 'relativePath' | 'bytesPerTokenEstimate' | 'estimateLabel'>): BenchmarkObservation {
  const fullMeta: StaticMeta = { componentClass, relativePath, bytesPerTokenEstimate: BYTES_PER_TOKEN_EST, estimateLabel: 'static_estimate_only', ...meta };
  return {
    v: 2, kind: 'benchmark_observation', source: 'static', key: `static:${meta.provider ?? 'source'}:${componentClass}:${relativePath}`,
    fixtureId: relativePath, repeat: 1, provider: null, providerLabel: 'static', requestedModel: 'static-bytes-estimate', actualModel: null, modelSatisfied: true, modelVerified: true, modelVerificationSource: 'manifest_waiver',
    provenance: 'synthetic', status: 'success', statusClass: 'measured', decisionEligible: false, decisionIneligibleReason: 'static footprint is descriptive only', pairId: null, blockId: null, arm: null, pairStatus: 'unpaired',
    fixture: createFixtureMetadata({ fixtureId: relativePath, fixtureClass: `static:${componentClass}`, fixtureHash: sha256(`${componentClass}:${relativePath}`), promptHash: sha256(`${meta.representation}:${relativePath}`), treatmentHash: sha256(`${meta.provider ?? 'source'}:${meta.installedDigest ?? meta.sourceDigest ?? 'none'}`) }),
    manifestHash: '',
    metrics: { outcomeLabel: 'not_measured', outcomeScore: null, wallMs: null, ttftMs: null, outputBytes: meta.rawBytes, tokens: { inputTokens: null, outputTokens: null, totalTokens: Math.round(meta.rawBytes / BYTES_PER_TOKEN_EST), costUsd: null, cacheReadTokens: null, cacheWriteTokens: null, reasoningTokens: null, costSource: 'derived' }, contextOccupancy: null, contextCompactionBytes: null, toolCalls: null, toolErrors: null, toolRetries: null, approvals: null, subagentCount: null, subagentDepth: null, hookCalls: null, hookLatencyMs: null, hookContextBytes: null },
    providerExtensions: { static: fullMeta },
    legacy: { baselineEligible: null, attemptedComplete: null, actualPolicy: null, policySatisfied: null, coverage: null, hardChecksPassed: null, hardChecksTotal: null, finalAnswer: null, note: null, commitSha: null, providerFootprintArtifactHash: null },
  };
}

function validateRuntimeSnapshot(snapshot: InstalledArtifactSnapshot | null, provider: 'claude' | 'codex'): InstalledArtifactSnapshot | null {
  if (!snapshot) return null;
  const validated = validateInstalledArtifactSnapshot(snapshot);
  if (!path.isAbsolute(validated.rootDir)) throw new Error(`snapshot.rootDir for ${provider} must be absolute`);
  return { ...validated, entries: validateSnapshotEntries(validated.entries, provider) };
}

function snapshotIdentity(snapshot: InstalledArtifactSnapshot | null): { createdAt: string; entries: Array<Pick<InstalledArtifactSnapshot['entries'][number], 'path' | 'sha256' | 'bytes'>>; } | null {
  return snapshot ? { createdAt: snapshot.createdAt, entries: snapshot.entries.map(({ path, sha256, bytes }) => ({ path, sha256, bytes })) } : null;
}

function staticMeta(row: BenchmarkObservation): StaticMeta {
  return row.providerExtensions.static as StaticMeta;
}

function readGitText(repoRoot: string, relativePath: string, baseRef: string): string | null {
  try { return execFileSync('git', ['show', `${baseRef}:${relativePath.replace(/\\/g, '/')}`], { cwd: repoRoot, encoding: 'utf8' }); } catch { return null; }
}
