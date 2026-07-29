import type { EvalUsage } from '../types';

const ANSWER_KEYS = ['verdict', 'summary', 'evidence', 'escalation', 'rollback'];

/** True when `value` carries exactly the five keys of a fixture answer envelope. */
export function isAnswer(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const keys = Object.keys(value as Record<string, unknown>);
  return ANSWER_KEYS.every((key) => keys.includes(key));
}

/**
 * Pull the answer envelope out of a model's free-text reply. Handles a bare JSON
 * object, a ```-fenced block, and an object embedded in surrounding prose — but never
 * merges two objects, so a schema echo followed by the real answer cannot fuse.
 */
export function extractAnswer(text: string): string | null {
  const unfenced = text.replace(/```(?:json)?/gi, '').trim();
  for (const candidate of [unfenced, ...jsonCandidates(unfenced)]) {
    try {
      const parsed = JSON.parse(candidate);
      if (isAnswer(parsed)) return JSON.stringify(parsed);
    } catch { /* try the next candidate */ }
  }
  return null;
}

/** Balanced-brace slices, longest first — a nested object never truncates mid-value. */
function jsonCandidates(text: string): string[] {
  const out: string[] = [];
  for (let start = text.indexOf('{'); start !== -1; start = text.indexOf('{', start + 1)) {
    let depth = 0;
    for (let i = start; i < text.length; i++) {
      if (text[i] === '{') depth++;
      else if (text[i] === '}' && --depth === 0) { out.push(text.slice(start, i + 1)); break; }
    }
  }
  return out.sort((a, b) => b.length - a.length);
}

export function numberField(record: Record<string, unknown> | undefined, keys: string[]): number | null {
  if (!record) return null;
  for (const key of keys) if (typeof record[key] === 'number') return record[key] as number;
  return null;
}

export function emptyUsage(): EvalUsage {
  return { inputTokens: null, outputTokens: null, totalTokens: null, costUsd: null };
}

export function safeJson(text: string): unknown {
  try { return JSON.parse(text); } catch { return null; }
}

export function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

/** Object or array flattened to a keyed bag for recursive search; scalars yield undefined. */
export function walkable(value: unknown): Record<string, unknown> | undefined {
  if (Array.isArray(value)) return Object.fromEntries(value.map((entry, i) => [String(i), entry]));
  return asRecord(value);
}
