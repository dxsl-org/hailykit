import { createHash } from 'node:crypto';

export function sha256(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

export function stableStringify(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function iqr(values: number[]): number | null {
  if (values.length < 2) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return percentile(sorted, 0.75) - percentile(sorted, 0.25);
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 1) return sorted[0];
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value as Record<string, unknown>).sort()
    .reduce<Record<string, unknown>>((acc, key) => {
      acc[key] = sortValue((value as Record<string, unknown>)[key]);
      return acc;
    }, {});
}
