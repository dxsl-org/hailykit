import { iqr, median } from './hash';
import type { RunnerArtifacts, RunnerRow } from './types';

export function buildSummaryMarkdown(artifacts: RunnerArtifacts): string {
  const statusCounts = countBy(artifacts.rows, (row) => row.status);
  const scoreLines = summarizeByFixture(artifacts.rows, 'weightedScore');
  const latencyLines = summarizeByFixture(artifacts.rows, 'latencyMs');
  const banner = artifacts.manifest.executionMode === 'dry-run'
    ? 'DRY RUN ONLY — baselineEligible=false'
    : artifacts.baselineEligible ? 'BASELINE ELIGIBLE' : 'BASELINE INELIGIBLE';
  return [
    '# Reasoning Harness Eval Summary',
    '',
    banner,
    `Manifest: \`${artifacts.manifest.manifestHash}\``,
    `Provider: \`${artifacts.manifest.provider}\` | Tier: \`${artifacts.manifest.tier}\` | Model: \`${artifacts.manifest.requestedModel}\` | Variant: \`${artifacts.manifest.variant}\``,
    `Rows: ${artifacts.rows.length}/${artifacts.manifest.expectedKeys.length} | Attempted Complete: ${artifacts.attemptedComplete ? 'yes' : 'no'} | Baseline Eligible: ${artifacts.baselineEligible ? 'yes' : 'no'}`,
    '',
    '## Status Counts',
    ...Object.entries(statusCounts).sort(([a], [b]) => a.localeCompare(b)).map(([status, count]) => `- ${status}: ${count}`),
    '',
    '## Weighted Score',
    ...scoreLines,
    '',
    '## Latency (ms)',
    ...latencyLines,
  ].join('\n');
}

function summarizeByFixture(rows: RunnerRow[], field: 'weightedScore' | 'latencyMs'): string[] {
  const grouped = new Map<string, number[]>();
  for (const row of rows) {
    const value = row[field];
    if (value === null) continue;
    grouped.set(row.fixtureId, [...(grouped.get(row.fixtureId) ?? []), value]);
  }
  return [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([fixtureId, values]) => {
    const med = median(values);
    const spread = iqr(values);
    return `- ${fixtureId}: median=${fmt(med)} iqr=${fmt(spread)}`;
  });
}

function countBy<T>(items: T[], key: (item: T) => string): Record<string, number> {
  return items.reduce<Record<string, number>>((acc, item) => {
    const k = key(item);
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});
}

function fmt(value: number | null): string {
  return value === null ? 'n/a' : Number(value.toFixed(4)).toString();
}
