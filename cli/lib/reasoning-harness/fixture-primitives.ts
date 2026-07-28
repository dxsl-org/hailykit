import type { ToolPolicyName, Verdict } from './types';

/** Strict JSON-shape primitives for fixture and answer parsing. Every helper throws on the
 *  first violation so a malformed fixture can never be silently coerced into a valid one. */
export function safeParse(text: string, errorText: string): unknown { try { return JSON.parse(text); } catch { throw new Error(errorText); } }
export function asRecord(value: unknown, errorText: string): Record<string, unknown> { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(errorText); return value as Record<string, unknown>; }
export function rejectUnknown(value: Record<string, unknown>, allowed: string[], errorText: string): void { for (const key of Object.keys(value)) if (!allowed.includes(key)) throw new Error(`${errorText}: ${key}`); }
export function reqString(value: unknown, label: string): string { if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} must be a non-empty string`); return value.trim(); }
export function optString(value: unknown): string | undefined { return typeof value === 'string' && value.trim() ? value.trim() : undefined; }
export function nullableString(value: unknown, label: string): string | null { if (value === null) return null; return reqString(value, label); }
export function reqBool(value: unknown, label: string): boolean { if (typeof value !== 'boolean') throw new Error(`${label} must be boolean`); return value; }
export function reqNum(value: unknown, label: string): number { if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) throw new Error(`${label} must be a positive number`); return value; }
export function reqVerdict(value: unknown, label: string): Verdict { return reqEnum(value, new Set<Verdict>(['pass', 'fail']), label); }
export function reqStringArray(value: unknown, label: string): string[] { if (!Array.isArray(value) || value.some((x) => typeof x !== 'string' || !x.trim())) throw new Error(`${label} must be a string array`); return value.map((x) => x.trim()); }
export function reqNonEmptyStrings(value: unknown, label: string): string[] { const out = reqStringArray(value, label); if (out.length === 0) throw new Error(`${label} must not be empty`); return out; }
export function optNonEmptyStrings(value: unknown): string[] | undefined { return value === undefined ? undefined : reqNonEmptyStrings(value, 'string array'); }
export function reqEnum<T extends string>(value: unknown, allowed: ReadonlySet<T>, label: string): T { if (typeof value !== 'string' || !allowed.has(value as T)) throw new Error(`${label} is invalid`); return value as T; }
export function reqEnums<T extends string>(value: unknown, allowed: ReadonlySet<T>, label: string): T[] { if (!Array.isArray(value) || value.some((x) => typeof x !== 'string' || !allowed.has(x as T))) throw new Error(`${label} is invalid`); return value as T[]; }
export function normalize(value: string): string { return value.replace(/\s+/g, ' ').trim().toLowerCase(); }
