import { sha256 } from '../reasoning-harness/hash';
import type { BenchmarkObservation } from './types';
import { pairedPermutationPValue, seededBlockBootstrapCi } from './statistics-resampling';

export type PairedMetric = 'outcomeScore' | 'totalTokens' | 'wallMs' | 'hookLatencyMs';
export interface PairedStatistics {
  metric: PairedMetric;
  completePairs: number;
  effectivePairs: number;
  fixtureBlocks: number;
  meanDelta: number | null;
  ci95: [number, number] | null;
  permutationPValue: number | null;
  incompletePairs: number;
  identityMismatchPairs: number;
  uniqueOutputPairs: number | null;
  degenerateRepeats: boolean;
  flakeRate: number;
  flakeBudgetExceeded: boolean;
  descriptiveOnly: boolean;
  reasons: string[];
}

export function computePairedStatistics(rows: BenchmarkObservation[], metric: PairedMetric, options: { seed?: number; iterations?: number; flakeBudget?: number } = {}): PairedStatistics {
  const groups = groupPairs(rows);
  const deltas: number[] = [];
  const blocks = new Map<string, number[]>();
  const outputPairs = new Set<string>();
  let outputKnown = true;
  let incompletePairs = 0;
  let identityMismatchPairs = 0;
  let descriptiveOnly = false;
  const flakeGroups = new Map<string, Set<string>>();
  for (const pair of groups.values()) {
    const validation = validatePair(pair, metric);
    if (!validation.ok) {
      incompletePairs += 1;
      if (validation.identityMismatch) identityMismatchPairs += 1;
      if (validation.descriptiveOnly) descriptiveOnly = true;
      continue;
    }
    if (validation.descriptiveOnly) descriptiveOnly = true;
    const delta = validation.candidate - validation.base;
    deltas.push(delta);
    const fixtureId = pair[0].fixtureId;
    if (!blocks.has(fixtureId)) blocks.set(fixtureId, []);
    blocks.get(fixtureId)!.push(delta);
    recordFlake(flakeGroups, pair, metric);
    const signature = pairOutputSignature(pair);
    if (signature) outputPairs.add(signature); else outputKnown = false;
  }
  const blockMeans = [...blocks.values()].map(average);
  const uniqueOutputPairs = outputKnown ? outputPairs.size : null;
  const effectivePairs = Math.min(deltas.length, blockMeans.length, uniqueOutputPairs ?? deltas.length);
  const flakeRate = flakeGroups.size ? [...flakeGroups.values()].filter((values) => values.size > 1).length / flakeGroups.size : 0;
  const flakeBudget = options.flakeBudget ?? 0.1;
  const reasons: string[] = [];
  if (incompletePairs) reasons.push(`${incompletePairs} incomplete or ineligible pair(s)`);
  if (identityMismatchPairs) reasons.push(`${identityMismatchPairs} identity mismatch pair(s)`);
  if (descriptiveOnly) reasons.push('provider/model/tokenizer mismatch makes efficiency descriptive only');
  if (effectivePairs < deltas.length) reasons.push('effective sample size reduced by fixture blocks or repeated outputs');
  if (flakeRate > flakeBudget) reasons.push('flake budget exceeded');
  return {
    metric, completePairs: deltas.length, effectivePairs, fixtureBlocks: blockMeans.length,
    meanDelta: deltas.length ? average(deltas) : null,
    ci95: blockMeans.length ? seededBlockBootstrapCi(blockMeans, options.seed ?? 7, options.iterations ?? 2000) : null,
    permutationPValue: deltas.length ? pairedPermutationPValue(deltas, options.seed ?? 7) : null,
    incompletePairs, identityMismatchPairs, uniqueOutputPairs,
    degenerateRepeats: deltas.length > 1 && effectivePairs <= 1,
    flakeRate, flakeBudgetExceeded: flakeRate > flakeBudget, descriptiveOnly, reasons,
  };
}

function groupPairs(rows: BenchmarkObservation[]): Map<string, BenchmarkObservation[]> {
  const groups = new Map<string, BenchmarkObservation[]>();
  for (const row of rows) { const key = row.pairId ?? `unpaired:${row.key}`; if (!groups.has(key)) groups.set(key, []); groups.get(key)!.push(row); }
  return groups;
}

function validatePair(pair: BenchmarkObservation[], metric: PairedMetric): { ok: true; base: number; candidate: number; descriptiveOnly: boolean } | { ok: false; identityMismatch: boolean; descriptiveOnly: boolean } {
  const base = pair.filter((row) => row.arm === 'base');
  const candidate = pair.filter((row) => row.arm === 'candidate');
  const identityMismatch = pair.length === 2 && (pair[0].manifestHash !== pair[1].manifestHash || pair[0].fixture.fixtureHash !== pair[1].fixture.fixtureHash || pair[0].fixture.promptHash !== pair[1].fixture.promptHash || pair[0].fixture.treatmentHash !== pair[1].fixture.treatmentHash);
  const tokenMismatch = metric === 'totalTokens' && pair.length === 2 && tokenBlock(pair[0]) !== tokenBlock(pair[1]);
  const eligible = pair.length === 2 && base.length === 1 && candidate.length === 1 && pair.every((row) => row.pairStatus === 'paired' && row.decisionEligible);
  const baseValue = base[0] ? metricValue(base[0], metric) : null;
  const candidateValue = candidate[0] ? metricValue(candidate[0], metric) : null;
  if (!eligible || identityMismatch || baseValue === null || candidateValue === null) return { ok: false, identityMismatch, descriptiveOnly: tokenMismatch };
  return { ok: true, base: baseValue, candidate: candidateValue, descriptiveOnly: tokenMismatch };
}

function metricValue(row: BenchmarkObservation, metric: PairedMetric): number | null {
  if (metric === 'outcomeScore') return row.metrics.outcomeScore;
  if (metric === 'totalTokens') return row.metrics.tokens.totalTokens;
  return row.metrics[metric];
}
function tokenBlock(row: BenchmarkObservation): string { const extension = row.providerExtensions.tokenizerId; return `${row.providerLabel}:${row.actualModel ?? row.requestedModel}:${typeof extension === 'string' ? extension : row.requestedModel}`; }
function recordFlake(groups: Map<string, Set<string>>, pair: BenchmarkObservation[], metric: PairedMetric): void { for (const row of pair) { const key = `${row.fixtureId}:${row.arm}`; if (!groups.has(key)) groups.set(key, new Set()); groups.get(key)!.add(String(metricValue(row, metric))); } }
function pairOutputSignature(pair: BenchmarkObservation[]): string | null { const values = pair.map((row) => { const digest = row.providerExtensions.outputDigest; if (typeof digest === 'string') return digest; if (row.legacy.finalAnswer) return sha256(row.legacy.finalAnswer); return null; }); return values.every((value): value is string => value !== null) ? sha256(values.join(':')) : null; }
function average(values: number[]): number { return values.reduce((sum, value) => sum + value, 0) / values.length; }
