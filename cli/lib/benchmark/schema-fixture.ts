import { validateInstalledArtifactSnapshot } from './artifact-snapshot';
import type { BenchmarkCalibrationState, BenchmarkFixtureMetadata, BenchmarkManifest, BenchmarkMarginRegistry, BenchmarkProvider } from './types';
import { BENCHMARK_PROVIDERS, BENCHMARK_SOURCES, BENCHMARK_TIERS, BENCHMARK_VARIANTS, assertKeys, asRecord, optEnum, optString, reqBoolean, reqEnum, reqInt, reqIsoDate, reqNonNegative, reqString } from './schema-helpers';
import type { BenchmarkWorkflowBackend } from './types';

const LEGACY_PROVIDER_LABELS = ['claude', 'codex', 'gemini', 'ollama'] as const;

const FIXTURE_KEYS = ['fixtureId', 'fixtureClass', 'fixtureHash', 'promptHash', 'treatmentHash', 'variant'] as const;
const MARGIN_KEYS = ['metric', 'threshold', 'exploratoryBatches', 'firstDecisionBatch', 'frozen', 'frozenAt', 'identityHash'] as const;
const CALIBRATION_KEYS = ['completedLiveBatches', 'firstDecisionBatch'] as const;
const LEGACY_MANIFEST_KEYS = ['attemptedComplete', 'baselineEligible', 'commitSha', 'providerFootprintArtifactHash'] as const;

export function validateManifestFixture(value: unknown): BenchmarkFixtureMetadata {
  const record = asRecord(value, 'fixture');
  assertKeys(record, FIXTURE_KEYS, 'fixture');
  return {
    fixtureId: reqString(record.fixtureId, 'fixture.fixtureId'),
    fixtureClass: optString(record.fixtureClass, 'fixture.fixtureClass'),
    fixtureHash: reqString(record.fixtureHash, 'fixture.fixtureHash'),
    promptHash: reqString(record.promptHash, 'fixture.promptHash'),
    treatmentHash: reqString(record.treatmentHash, 'fixture.treatmentHash'),
    variant: optEnum(record.variant, BENCHMARK_VARIANTS, 'fixture.variant'),
  };
}

export function validateMarginRegistry(value: unknown): BenchmarkMarginRegistry {
  const record = asRecord(value, 'marginRegistry');
  assertKeys(record, MARGIN_KEYS, 'marginRegistry');
  const exploratoryBatches = reqInt(record.exploratoryBatches, 'marginRegistry.exploratoryBatches');
  const firstDecisionBatch = reqInt(record.firstDecisionBatch, 'marginRegistry.firstDecisionBatch', 1);
  if (firstDecisionBatch <= exploratoryBatches) throw new Error('marginRegistry.firstDecisionBatch must be greater than exploratoryBatches');
  const frozen = reqBoolean(record.frozen, 'marginRegistry.frozen');
  const frozenAt = record.frozenAt === null ? null : reqIsoDate(record.frozenAt, 'marginRegistry.frozenAt');
  if (frozen !== (frozenAt !== null)) throw new Error('marginRegistry frozen and frozenAt must be set together');
  return {
    metric: reqEnum(record.metric, ['outcomeScore'], 'marginRegistry.metric'),
    threshold: reqNonNegative(record.threshold, 'marginRegistry.threshold'),
    exploratoryBatches,
    firstDecisionBatch,
    frozen,
    frozenAt,
    identityHash: reqString(record.identityHash, 'marginRegistry.identityHash'),
  };
}

export function validateCalibration(value: unknown): BenchmarkCalibrationState {
  const record = asRecord(value, 'calibration');
  assertKeys(record, CALIBRATION_KEYS, 'calibration');
  return {
    completedLiveBatches: reqInt(record.completedLiveBatches, 'calibration.completedLiveBatches'),
    firstDecisionBatch: reqInt(record.firstDecisionBatch, 'calibration.firstDecisionBatch', 1),
  };
}

export function validateLegacyManifestFields(value: unknown): BenchmarkManifest['legacy'] {
  const record = asRecord(value, 'legacy');
  assertKeys(record, LEGACY_MANIFEST_KEYS, 'legacy');
  return {
    attemptedComplete: record.attemptedComplete === null ? null : reqBoolean(record.attemptedComplete, 'legacy.attemptedComplete'),
    baselineEligible: record.baselineEligible === null ? null : reqBoolean(record.baselineEligible, 'legacy.baselineEligible'),
    commitSha: optString(record.commitSha, 'legacy.commitSha'),
    providerFootprintArtifactHash: optString(record.providerFootprintArtifactHash, 'legacy.providerFootprintArtifactHash'),
  };
}

export function validateSourceDescriptor(value: unknown, provider: BenchmarkProvider | null, providerLabelValue: unknown, name: string): Pick<BenchmarkManifest, 'source' | 'providerLabel'> {
  const source = reqEnum(value, BENCHMARK_SOURCES, name);
  const providerLabel = reqString(providerLabelValue, name.replace('.source', '.providerLabel'));
  if (source === 'benchmark_v2') {
    if (provider === null) throw new Error(`${name} source=benchmark_v2 requires a benchmark provider`);
    if (providerLabel !== provider) throw new Error(`${name} source=benchmark_v2 requires providerLabel to match provider`);
    return { source, providerLabel };
  }
  if (source === 'legacy_reasoning_v1') {
    const label = reqEnum(providerLabel, LEGACY_PROVIDER_LABELS, name.replace('.source', '.providerLabel'));
    if (provider !== null && label !== provider) throw new Error(`${name} source=legacy_reasoning_v1 requires providerLabel to match provider when provider is known`);
    return { source, providerLabel: label };
  }
  if (provider !== null) throw new Error(`${name} cannot use a benchmark provider on ${source} source`);
  if (providerLabel !== source) throw new Error(`${name} source=${source} requires providerLabel=${source}`);
  return { source, providerLabel };
}

export function validateProvider(value: unknown, name: string): BenchmarkProvider | null {
  return value === null ? null : reqEnum(value, BENCHMARK_PROVIDERS, name);
}

export function validateTier(value: unknown, name: string): BenchmarkManifest['tier'] {
  return reqEnum(value, BENCHMARK_TIERS, name);
}

export function validateSnapshot(value: unknown): BenchmarkManifest['snapshot'] {
  return value === null ? null : validateInstalledArtifactSnapshot(value);
}

export function validateBackend(value: unknown, name: string): BenchmarkWorkflowBackend | null {
  return value === undefined || value === null
    ? null
    : reqEnum(value, ['provider', 'codex_app_server'] as const, name);
}
