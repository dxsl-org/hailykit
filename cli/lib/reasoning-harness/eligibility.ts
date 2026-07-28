import type { RowStatus, RunnerManifest, RunnerRow } from './types';

/**
 * A model that answers badly is data, not a broken run: unparseable or oversized output is a
 * scored zero and still counts toward the baseline. Everything else — auth, transport, dry run,
 * wrong model, runner-side scan refusal — means the cell was never measured.
 */
const SCORED_STATUSES: readonly RowStatus[] = ['success', 'parse_failure', 'truncation'];

/**
 * Whether a row represents a real measurement of the model. Resume keeps these and retries
 * everything else: a rate-limit blip or a dead CLI is an environment fault that must not be
 * baked into an artifact as though the cell had been measured and found wanting.
 */
export function isMeasuredStatus(status: RowStatus): boolean {
  return SCORED_STATUSES.includes(status);
}

export function attemptedComplete(manifest: RunnerManifest, rows: RunnerRow[]): boolean {
  if (rows.length !== manifest.expectedKeys.length) return false;
  const keys = new Set(rows.map((row) => row.key));
  return keys.size === rows.length && manifest.expectedKeys.every((key) => keys.has(key));
}

export function baselineEligible(manifest: RunnerManifest, rows: RunnerRow[]): boolean {
  const provenanceOk = manifest.executionMode === 'live' || Boolean(manifest.approvedOfflineSource);
  return attemptedComplete(manifest, rows) && provenanceOk && rows.every((row) => row.baselineEligible);
}

export function rowBaselineEligible(manifest: RunnerManifest, row: RunnerRow): boolean {
  const provenanceOk = manifest.executionMode === 'live' || Boolean(manifest.approvedOfflineSource);
  return provenanceOk && SCORED_STATUSES.includes(row.status) && row.policySatisfied && row.modelSatisfied;
}
