import type { Finding, Severity } from './types';

/**
 * Turn a reviewer's stdout into structured findings. Reviewers are prompted to
 * answer with `{"findings":[{severity,file?,line?,summary,evidence?}]}`, but each
 * CLI wraps that in its own event envelope (JSONL, NDJSON, prose preamble). So
 * we scan for the LAST balanced JSON object that carries a `findings` array and
 * parse it — format-agnostic and resilient to surrounding noise. Output is
 * treated strictly as data: nothing here executes or trusts it beyond shaping.
 * Leaf module.
 */

const SEVERITIES: ReadonlySet<string> = new Set(['critical', 'medium', 'low']);

export interface Normalized {
  findings: Finding[];
  /** Set when no findings object could be parsed; holds the trimmed stdout. */
  raw?: string;
}

/** Cap on bytes scanned for the findings object — it is always near the end. */
const SCAN_WINDOW = 512 * 1024;
/** Cap on `{` candidates tried, so pathological brace-dense output can't stall. */
const MAX_ATTEMPTS = 200;

export function normalizeOutput(stdout: string): Normalized {
  const text = stdout.length > SCAN_WINDOW ? stdout.slice(-SCAN_WINDOW) : stdout;
  const obj = findLastFindingsObject(text);
  if (!obj) {
    const raw = stdout.trim();
    return raw ? { findings: [], raw: raw.slice(0, 4000) } : { findings: [] };
  }
  const findings = (obj.findings as unknown[])
    .map(toFinding)
    .filter((f): f is Finding => f !== null);
  return { findings };
}

function toFinding(x: unknown): Finding | null {
  if (typeof x !== 'object' || x === null) return null;
  const o = x as Record<string, unknown>;
  const summary = typeof o.summary === 'string' ? o.summary.trim()
    : typeof o.title === 'string' ? o.title.trim() : '';
  if (!summary) return null;
  const f: Finding = { severity: coerceSeverity(o.severity), summary };
  if (typeof o.file === 'string' && o.file.trim()) f.file = o.file.trim();
  if (typeof o.line === 'number' && Number.isFinite(o.line)) f.line = o.line;
  if (typeof o.evidence === 'string' && o.evidence.trim()) f.evidence = o.evidence.trim();
  return f;
}

function coerceSeverity(v: unknown): Severity {
  const s = typeof v === 'string' ? v.trim().toLowerCase() : '';
  if (SEVERITIES.has(s)) return s as Severity;
  if (s === 'high' || s === 'error' || s === 'blocker') return 'critical';
  if (s === 'warning' || s === 'warn') return 'medium';
  return 'low';
}

/**
 * Return the object enclosing the LAST `"findings"` key that parses to an object
 * with a `findings` array. Anchoring on the key and walking the nearest opening
 * `{` first — with a bounded attempt budget — keeps this O(bounded) instead of
 * O(n²): brace-dense reviewer output cannot stall the parent (parsing runs after
 * the child's timeout no longer applies).
 */
function findLastFindingsObject(text: string): { findings: unknown[] } | null {
  const key = text.lastIndexOf('"findings"');
  if (key < 0) return null;
  let attempts = 0;
  for (let i = key; i >= 0 && attempts < MAX_ATTEMPTS; i--) {
    if (text[i] !== '{') continue;
    attempts++;
    const end = matchBrace(text, i);
    if (end <= key) continue; // must enclose the findings key
    try {
      const parsed: unknown = JSON.parse(text.slice(i, end + 1));
      if (typeof parsed === 'object' && parsed !== null
        && Array.isArray((parsed as Record<string, unknown>).findings)) {
        return parsed as { findings: unknown[] };
      }
    } catch { /* not the enclosing object — keep walking outward */ }
  }
  return null;
}

/** Index of the `}` closing the `{` at `start`, respecting strings; -1 if none. */
function matchBrace(text: string, start: number): number {
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return i; }
  }
  return -1;
}
