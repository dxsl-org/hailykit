import type { BenchmarkEvent, BenchmarkManifest, BenchmarkObservation } from './types';
import { BENCHMARK_STATUSES, assertKeys, asRecord, optString, reqBoolean, reqEnum, reqInt, reqIsoDate, reqLiteral, reqString } from './schema-helpers';
import { validateBackend, validateCalibration, validateLegacyManifestFields, validateManifestFixture, validateMarginRegistry, validateProvider, validateSnapshot, validateSourceDescriptor, validateTier } from './schema-fixture';
import { validateBenchmarkOutcome, validateMetrics, validateObservationEnums, validateObservationLegacy } from './schema-metrics';

const MANIFEST_KEYS = ['v', 'kind', 'source', 'backend', 'provider', 'providerLabel', 'tier', 'requestedModel', 'fixture', 'provenance', 'createdAt', 'manifestHash', 'modelVerificationWaiver', 'marginRegistry', 'calibration', 'snapshot', 'legacy'] as const;
const OBS_KEYS = ['v', 'kind', 'source', 'backend', 'key', 'fixtureId', 'repeat', 'provider', 'providerLabel', 'requestedModel', 'actualModel', 'modelSatisfied', 'modelVerified', 'modelVerificationSource', 'provenance', 'status', 'statusClass', 'decisionEligible', 'decisionIneligibleReason', 'pairId', 'blockId', 'arm', 'pairStatus', 'fixture', 'manifestHash', 'metrics', 'providerExtensions', 'legacy'] as const;

export function validateBenchmarkEvent(value: unknown): BenchmarkEvent {
  const record = asRecord(value, 'benchmark event');
  if (record.kind === 'benchmark_manifest') return validateBenchmarkManifest(record);
  if (record.kind === 'benchmark_observation') return validateBenchmarkObservation(record);
  if (record.kind === 'benchmark_outcome') return validateBenchmarkOutcome(record);
  throw new Error('unknown benchmark event kind');
}

export function validateBenchmarkManifest(value: unknown): BenchmarkManifest {
  const record = asRecord(value, 'benchmark manifest');
  assertKeys(record, MANIFEST_KEYS, 'benchmark manifest');
  const provider = validateProvider(record.provider, 'benchmark manifest.provider');
  const { source, providerLabel } = validateSourceDescriptor(record.source, provider, record.providerLabel, 'benchmark manifest.source');
  const marginRegistry = validateMarginRegistry(record.marginRegistry);
  const calibration = validateCalibration(record.calibration);
  if (marginRegistry.firstDecisionBatch !== calibration.firstDecisionBatch) throw new Error('benchmark manifest firstDecisionBatch mismatch between marginRegistry and calibration');
  return {
    v: reqLiteral(record.v, 2, 'benchmark manifest.v'),
    kind: reqLiteral(record.kind, 'benchmark_manifest', 'benchmark manifest.kind'),
    source,
    backend: validateBackend(record.backend, 'benchmark manifest.backend'),
    provider,
    providerLabel,
    tier: validateTier(record.tier, 'benchmark manifest.tier'),
    requestedModel: reqString(record.requestedModel, 'benchmark manifest.requestedModel'),
    fixture: validateManifestFixture(record.fixture),
    provenance: reqEnum(record.provenance, ['live', 'offline-score', 'dry-run', 'synthetic'], 'benchmark manifest.provenance'),
    createdAt: reqIsoDate(record.createdAt, 'benchmark manifest.createdAt'),
    manifestHash: reqString(record.manifestHash, 'benchmark manifest.manifestHash'),
    modelVerificationWaiver: reqBoolean(record.modelVerificationWaiver, 'benchmark manifest.modelVerificationWaiver'),
    marginRegistry,
    calibration,
    snapshot: validateSnapshot(record.snapshot),
    legacy: validateLegacyManifestFields(record.legacy),
  };
}

export function validateBenchmarkObservation(value: unknown): BenchmarkObservation {
  const record = asRecord(value, 'benchmark observation');
  assertKeys(record, OBS_KEYS, 'benchmark observation');
  const provider = validateProvider(record.provider, 'benchmark observation.provider');
  const { source, providerLabel } = validateSourceDescriptor(record.source, provider, record.providerLabel, 'benchmark observation.source');
  const enums = validateObservationEnums(record);
  const decisionEligible = reqBoolean(record.decisionEligible, 'benchmark observation.decisionEligible');
  const fixture = validateManifestFixture(record.fixture);
  const fixtureId = reqString(record.fixtureId, 'benchmark observation.fixtureId');
  if (enums.statusClass !== measuredClass(enums.status)) throw new Error('benchmark observation status/statusClass mismatch');
  if (decisionEligible && (source !== 'benchmark_v2' || enums.provenance !== 'live')) throw new Error('only benchmark_v2 live observations can be decision-eligible');
  if (decisionEligible && enums.pairStatus !== 'paired') throw new Error('decision-eligible observations must be paired');
  if (fixture.fixtureId !== fixtureId) throw new Error('benchmark observation fixtureId must match fixture.fixtureId');
  return {
    v: reqLiteral(record.v, 2, 'benchmark observation.v'),
    kind: reqLiteral(record.kind, 'benchmark_observation', 'benchmark observation.kind'),
    source,
    backend: validateBackend(record.backend, 'benchmark observation.backend'),
    key: reqString(record.key, 'benchmark observation.key'),
    fixtureId,
    repeat: reqInt(record.repeat, 'benchmark observation.repeat', 1),
    provider,
    providerLabel,
    requestedModel: reqString(record.requestedModel, 'benchmark observation.requestedModel'),
    actualModel: optString(record.actualModel, 'benchmark observation.actualModel'),
    modelSatisfied: reqBoolean(record.modelSatisfied, 'benchmark observation.modelSatisfied'),
    modelVerified: reqBoolean(record.modelVerified, 'benchmark observation.modelVerified'),
    modelVerificationSource: enums.modelVerificationSource,
    provenance: enums.provenance,
    status: enums.status,
    statusClass: enums.statusClass,
    decisionEligible,
    decisionIneligibleReason: optString(record.decisionIneligibleReason, 'benchmark observation.decisionIneligibleReason'),
    pairId: optString(record.pairId, 'benchmark observation.pairId'),
    blockId: optString(record.blockId, 'benchmark observation.blockId'),
    arm: optString(record.arm, 'benchmark observation.arm'),
    pairStatus: enums.pairStatus,
    fixture,
    manifestHash: reqString(record.manifestHash, 'benchmark observation.manifestHash'),
    metrics: validateMetrics(record.metrics),
    providerExtensions: asRecord(record.providerExtensions, 'benchmark observation.providerExtensions'),
    legacy: validateObservationLegacy(record.legacy),
  };
}

function measuredClass(status: BenchmarkObservation['status']): BenchmarkObservation['statusClass'] {
  return ['success', 'parse_failure', 'truncation'].includes(status) ? 'measured' : 'unmeasured';
}
