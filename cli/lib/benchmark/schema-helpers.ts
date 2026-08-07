import type { BenchmarkPairStatus, BenchmarkProvenance, BenchmarkSource, BenchmarkStatus, BenchmarkStatusClass } from './types';
import type { BenchmarkProvider, BenchmarkModelVerificationSource, BenchmarkOutcomeLabel } from './types';
import type { EvalTier, HarnessVariant } from '../reasoning-harness/types';

export const BENCHMARK_PROVIDERS: readonly BenchmarkProvider[] = ['claude', 'codex'];
export const BENCHMARK_SOURCES: readonly BenchmarkSource[] = ['benchmark_v2', 'legacy_reasoning_v1', 'static', 'hook'];
export const BENCHMARK_PROVENANCE: readonly BenchmarkProvenance[] = ['live', 'offline-score', 'dry-run', 'synthetic'];
export const BENCHMARK_STATUSES: readonly BenchmarkStatus[] = ['success', 'dry_run', 'unavailable_cli', 'auth_failure', 'timeout', 'non_zero_exit', 'empty_output', 'parse_failure', 'truncation', 'scan_rejected', 'model_mismatch', 'incomplete'];
export const BENCHMARK_STATUS_CLASSES: readonly BenchmarkStatusClass[] = ['measured', 'unmeasured'];
export const BENCHMARK_PAIR_STATUSES: readonly BenchmarkPairStatus[] = ['paired', 'missing_pair', 'identity_mismatch', 'unpaired'];
export const BENCHMARK_MODEL_SOURCES: readonly BenchmarkModelVerificationSource[] = ['provider_echo', 'manifest_waiver', 'legacy_missing', 'thread_start_exact', 'unknown'];
export const BENCHMARK_OUTCOME_LABELS: readonly BenchmarkOutcomeLabel[] = ['pass', 'fail', 'inconclusive', 'not_measured'];
export const BENCHMARK_TIERS: readonly EvalTier[] = ['fast', 'medium', 'thinking', 'ultra'];
export const BENCHMARK_VARIANTS: readonly HarnessVariant[] = ['none', 'legacy', 'keyword-only', 'ultra-baseline', 'proposed', 'proposed-compressed', 'full-injection', 'econ-only', 'full-minus-econ'];

export function asRecord(value: unknown, name: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${name} must be an object`);
  return value as Record<string, unknown>;
}

export function assertKeys(record: Record<string, unknown>, keys: readonly string[], name: string): void {
  const unknown = Object.keys(record).filter((key) => !keys.includes(key));
  if (unknown.length) throw new Error(`${name} contains unknown fields: ${unknown.join(', ')}`);
}

export function reqString(value: unknown, name: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${name} must be a non-empty string`);
  return value;
}

export function optString(value: unknown, name: string): string | null {
  return value === null ? null : reqString(value, name);
}

export function reqBoolean(value: unknown, name: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`${name} must be a boolean`);
  return value;
}

export function reqFinite(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${name} must be a finite number`);
  return value;
}

export function reqNonNegative(value: unknown, name: string): number {
  const number = reqFinite(value, name);
  if (number < 0) throw new Error(`${name} must be non-negative`);
  return number;
}

export function optNonNegative(value: unknown, name: string): number | null {
  return value === null ? null : reqNonNegative(value, name);
}

export function reqInt(value: unknown, name: string, min = 0): number {
  const number = reqFinite(value, name);
  if (!Number.isInteger(number) || number < min) throw new Error(`${name} must be an integer >= ${min}`);
  return number;
}

export function reqEnum<T extends string>(value: unknown, allowed: readonly T[], name: string): T {
  const text = reqString(value, name);
  if (!allowed.includes(text as T)) throw new Error(`${name} must be one of: ${allowed.join(', ')}`);
  return text as T;
}

export function optEnum<T extends string>(value: unknown, allowed: readonly T[], name: string): T | null {
  return value === null ? null : reqEnum(value, allowed, name);
}

export function reqIsoDate(value: unknown, name: string): string {
  const text = reqString(value, name);
  if (Number.isNaN(Date.parse(text))) throw new Error(`${name} must be an ISO date string`);
  return text;
}

export function reqLiteral<T>(value: unknown, expected: T, name: string): T {
  if (value !== expected) throw new Error(`${name} must equal ${String(expected)}`);
  return expected;
}
