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
  // Layer 1: a findings object sitting directly in the text (ollama's raw JSON,
  // or a fenced answer the CLI printed verbatim).
  let obj = findLastFindingsObject(text);
  // Layer 2: CLIs wrap the model's answer in an envelope — gemini nests it as an
  // escaped string in `.response`, cline/codex stream it across NDJSON `.text`
  // events. Parse those structures out and scan their string leaves too.
  if (!obj) {
    for (const s of envelopeStrings(text)) {
      obj = findLastFindingsObject(s);
      if (obj) break;
    }
  }
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

/**
 * Candidate answer strings pulled from a CLI's JSON envelope, newest-first. The
 * model's real reply lives in a string field (gemini `.response`) or is streamed
 * across NDJSON events (cline/codex `.text`); we collect every string leaf plus
 * the in-order concatenation of them (for chunked streams), so findLastFindingsObject
 * can be re-run against the actual answer. Bounded so adversarial output can't blow up.
 */
function envelopeStrings(text: string): string[] {
  const leaves: string[] = [];
  const whole = tryParse(text);
  if (whole !== undefined) collectStrings(whole, leaves, 0);
  const perLine: string[] = [];
  for (const line of text.split('\n')) {
    const v = tryParse(line.trim());
    if (v !== undefined) collectStrings(v, perLine, 0);
    if (leaves.length + perLine.length > 5000) break;
  }
  const all = [...leaves, ...perLine];
  if (perLine.length) all.push(perLine.join('')); // reassemble a chunked stream
  return all.reverse();
}

function tryParse(s: string): unknown {
  if (!s || (s[0] !== '{' && s[0] !== '[')) return undefined;
  try { return JSON.parse(s); } catch { return undefined; }
}

function collectStrings(value: unknown, out: string[], depth: number): void {
  if (depth > 8 || out.length > 5000) return;
  if (typeof value === 'string') { if (value.includes('findings')) out.push(value); return; }
  if (Array.isArray(value)) { for (const v of value) collectStrings(v, out, depth + 1); return; }
  if (typeof value === 'object' && value !== null) {
    for (const v of Object.values(value)) collectStrings(v, out, depth + 1);
  }
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
