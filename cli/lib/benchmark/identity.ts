import { sha256, stableStringify } from '../reasoning-harness/hash';
import type { BenchmarkDecision, BenchmarkManifest, BenchmarkObservation, BenchmarkOutcome, BenchmarkProvenance } from './types';

const DECISION_PROVENANCE: readonly BenchmarkProvenance[] = ['live', 'offline-score'];

export function hashBenchmarkIdentity(parts: { source?: string; providerLabel?: string; tier?: string; fixtureHash: string; promptHash: string; treatmentHash: string; requestedModel: string; provenance: BenchmarkProvenance }): string {
  return sha256(stableStringify({ schemaVersion: 2, ...parts }));
}

export function hashMarginIdentity(manifest: BenchmarkManifest): string {
  return sha256(stableStringify({
    schemaVersion: 2,
    source: manifest.source,
    providerLabel: manifest.providerLabel,
    tier: manifest.tier,
    requestedModel: manifest.requestedModel,
    fixtureHash: manifest.fixture.fixtureHash,
    promptHash: manifest.fixture.promptHash,
    treatmentHash: manifest.fixture.treatmentHash,
    metric: manifest.marginRegistry.metric,
    threshold: manifest.marginRegistry.threshold,
    exploratoryBatches: manifest.marginRegistry.exploratoryBatches,
    firstDecisionBatch: manifest.marginRegistry.firstDecisionBatch,
  }));
}

export function decisionEligibilityReason(observation: Pick<BenchmarkObservation, 'provenance' | 'statusClass' | 'modelSatisfied' | 'modelVerified'>): string | null {
  if (!DECISION_PROVENANCE.includes(observation.provenance)) return `provenance ${observation.provenance} is non-decision`;
  if (observation.statusClass !== 'measured') return `status class ${observation.statusClass} is not measured`;
  if (!observation.modelSatisfied) return 'actual model did not satisfy the requested model';
  if (!observation.modelVerified) return 'actual model is unverified';
  return null;
}

export function evaluateBenchmarkOutcome(manifest: BenchmarkManifest, observations: BenchmarkObservation[]): BenchmarkOutcome {
  const reasons: string[] = [];
  const suite = manifest.fixture.fixtureId === 'workflow-suite';
  const relevant = observations.filter((entry) => suite
    ? entry.manifestHash === manifest.manifestHash && entry.fixture.treatmentHash === manifest.fixture.treatmentHash
    : entry.fixture.fixtureHash === manifest.fixture.fixtureHash && entry.fixture.promptHash === manifest.fixture.promptHash
      && entry.fixture.treatmentHash === manifest.fixture.treatmentHash);
  if (manifest.source !== 'benchmark_v2') reasons.push(`source ${manifest.source} is not decision-grade`);
  if (manifest.provenance !== 'live') reasons.push(`manifest provenance ${manifest.provenance} is not live`);
  if (!manifest.marginRegistry.frozen || !manifest.marginRegistry.frozenAt) reasons.push('margin registry is not frozen and dated');
  if (manifest.calibration.completedLiveBatches < manifest.marginRegistry.firstDecisionBatch) reasons.push('calibration is incomplete');
  if (manifest.marginRegistry.firstDecisionBatch !== manifest.calibration.firstDecisionBatch) reasons.push('margin registry and calibration first-decision batch differ');
  if (manifest.marginRegistry.identityHash !== hashMarginIdentity(manifest)) reasons.push('margin registry identity drifted');
  if (!relevant.length) reasons.push('no relevant observations matched the manifest fixture');
  if (relevant.length !== observations.length) reasons.push('one or more observations drifted from the manifest identity');
  if (!everyRelevantRowEligible(manifest, relevant)) reasons.push('one or more observations are not decision-grade live pairs');
  const scores = relevant.map((entry) => entry.metrics.outcomeScore);
  const numericScores = scores.filter((entry): entry is number => entry !== null);
  if (numericScores.length !== scores.length) reasons.push('one or more relevant observations have null outcome scores');
  const mean = !scores.length || numericScores.length !== scores.length ? null : numericScores.reduce((sum, entry) => sum + entry, 0) / numericScores.length;
  const decision: BenchmarkDecision = reasons.length
    ? 'inconclusive'
    : (mean ?? 0) >= manifest.marginRegistry.threshold ? 'go' : 'no_go';
  return {
    v: 2,
    kind: 'benchmark_outcome',
    source: manifest.source,
    decision,
    reasons,
    observedMeanScore: mean,
    threshold: manifest.marginRegistry.threshold,
    comparedRows: relevant.length,
  };
}

function everyRelevantRowEligible(manifest: BenchmarkManifest, rows: BenchmarkObservation[]): boolean {
  if (!rows.every((entry) => entry.source === 'benchmark_v2' && entry.provenance === 'live' && entry.decisionEligible && entry.pairStatus === 'paired')) return false;
  if (!rows.every((entry) => entry.manifestHash === manifest.manifestHash)) return false;
  if (!rows.every((entry) => entry.provider === manifest.provider && entry.providerLabel === manifest.providerLabel && entry.requestedModel === manifest.requestedModel)) return false;
  if (manifest.fixture.fixtureId === 'workflow-suite') {
    if (!rows.every((entry) => entry.fixture.treatmentHash === manifest.fixture.treatmentHash)) return false;
  } else if (!rows.every((entry) => entry.fixture.fixtureHash === manifest.fixture.fixtureHash
      && entry.fixture.fixtureId === manifest.fixture.fixtureId
      && entry.fixture.promptHash === manifest.fixture.promptHash
      && entry.fixture.treatmentHash === manifest.fixture.treatmentHash)) return false;
  const groups = new Map<string, Set<string>>();
  for (const row of rows) {
    if (!row.pairId || !row.arm) return false;
    if (!groups.has(row.pairId)) groups.set(row.pairId, new Set());
    groups.get(row.pairId)!.add(row.arm);
  }
  return [...groups.values()].every((arms) => arms.size >= 2);
}
