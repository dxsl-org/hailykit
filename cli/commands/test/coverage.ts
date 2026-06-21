import fs from 'node:fs';
import path from 'node:path';
import { emit, ok, fail, type Envelope } from '../../lib/json-output';

/**
 * `coverage-parse` — normalize a coverage report (LCOV, Istanbul JSON, pytest
 * coverage.json, or `go test -coverprofile`) into one shape: total % + per-file
 * %. Removes brittle hand-parsing from hc-test.
 *
 * Contract per format: line-oriented formats (LCOV, gocover) parse partially on
 * a truncated file; JSON formats are all-or-nothing — a parse error yields
 * `{ total: null, files: [] }` plus a warning (never throws).
 */

export type CoverageFormat = 'lcov' | 'istanbul' | 'pytest' | 'gocover';

export interface CoverageOptions { file: string; format?: CoverageFormat; json: boolean; }
interface FileCov { path: string; pct: number }
interface CoverageData { format: CoverageFormat | null; total: number | null; files: FileCov[] }

export function cmdCoverageParse(opts: CoverageOptions): number {
  const abs = path.resolve(opts.file);
  if (!fs.existsSync(abs)) { console.error(`✗ Not found: ${opts.file}`); return 1; }
  const raw = fs.readFileSync(abs, 'utf8');

  const format = opts.format ?? sniff(raw);
  if (!format) {
    emit(fail('coverage-parse', 'ambiguous format — pass --format lcov|istanbul|pytest|gocover'), opts.json,
      e => console.error(`✗ ${e.data.error}`));
    return 1;
  }

  const warnings: string[] = [];
  const data = parse(format, raw, warnings);
  emit(ok('coverage-parse', data, warnings), opts.json, human);
  return 0;
}

/** First-line signature sniff; returns null when ambiguous. */
function sniff(raw: string): CoverageFormat | null {
  const head = raw.trimStart();
  if (/^mode:\s/.test(head)) return 'gocover';
  if (/^(TN:|SF:)/m.test(head)) return 'lcov';
  if (head.startsWith('{')) {
    try {
      const j = JSON.parse(raw);
      if (j?.totals?.percent_covered !== undefined || j?.meta) return 'pytest';
      if (j?.total?.lines?.pct !== undefined) return 'istanbul';
      return 'istanbul'; // coverage-final.json (no summary) — handled in parser
    } catch { return null; }
  }
  return null;
}

function parse(format: CoverageFormat, raw: string, warnings: string[]): CoverageData {
  switch (format) {
    case 'lcov': return { format, ...parseLcov(raw) };
    case 'gocover': return { format, ...parseGoCover(raw) };
    case 'istanbul': return { format, ...parseJson(raw, warnings, parseIstanbul) };
    case 'pytest': return { format, ...parseJson(raw, warnings, parsePytest) };
  }
}

/** JSON formats are all-or-nothing: a parse error is a warning + empty result. */
function parseJson(raw: string, warnings: string[], fn: (j: any) => { total: number | null; files: FileCov[] }): { total: number | null; files: FileCov[] } {
  try { return fn(JSON.parse(raw)); }
  catch { warnings.push('unparseable JSON coverage report'); return { total: null, files: [] }; }
}

function parseLcov(raw: string): { total: number | null; files: FileCov[] } {
  const files: FileCov[] = [];
  let cur = '', lf = 0, lh = 0, totLf = 0, totLh = 0;
  for (const rawLine of raw.split('\n')) {
    const line = rawLine.replace(/\r$/, '');
    if (line.startsWith('SF:')) { cur = line.slice(3); lf = 0; lh = 0; }
    else if (line.startsWith('LF:')) lf = Number.parseInt(line.slice(3), 10) || 0;
    else if (line.startsWith('LH:')) lh = Number.parseInt(line.slice(3), 10) || 0;
    else if (line === 'end_of_record' && cur) {
      files.push({ path: cur.replace(/\\/g, '/'), pct: lf ? round(lh / lf * 100) : 0 });
      totLf += lf; totLh += lh; cur = '';
    }
  }
  return { total: totLf ? round(totLh / totLf * 100) : null, files };
}

function parseGoCover(raw: string): { total: number | null; files: FileCov[] } {
  const per = new Map<string, { covered: number; total: number }>();
  for (const rawLine of raw.split('\n')) {
    const line = rawLine.replace(/\r$/, '');
    if (!line || line.startsWith('mode:')) continue;
    // file:startLine.col,endLine.col numStmt count
    const m = /^(.+):\d+\.\d+,\d+\.\d+\s+(\d+)\s+(\d+)$/.exec(line);
    if (!m) continue;
    const file = m[1].replace(/\\/g, '/');
    const stmts = Number.parseInt(m[2], 10);
    const hit = Number.parseInt(m[3], 10) > 0 ? stmts : 0;
    const e = per.get(file) ?? { covered: 0, total: 0 };
    e.covered += hit; e.total += stmts; per.set(file, e);
  }
  let tc = 0, tt = 0;
  const files = [...per.entries()].map(([p, e]) => { tc += e.covered; tt += e.total; return { path: p, pct: e.total ? round(e.covered / e.total * 100) : 0 }; });
  return { total: tt ? round(tc / tt * 100) : null, files };
}

function parseIstanbul(j: any): { total: number | null; files: FileCov[] } {
  // coverage-summary.json: { total: {lines:{pct}}, [file]: {lines:{pct}} }
  if (j.total?.lines?.pct !== undefined) {
    const files: FileCov[] = [];
    for (const [k, v] of Object.entries<any>(j)) {
      if (k === 'total') continue;
      if (v?.lines?.pct !== undefined) files.push({ path: k.replace(/\\/g, '/'), pct: round(v.lines.pct) });
    }
    return { total: round(j.total.lines.pct), files };
  }
  // coverage-final.json: { [file]: { s: {id: hitCount} } } — derive line %.
  const files: FileCov[] = [];
  let tc = 0, tt = 0;
  for (const [k, v] of Object.entries<any>(j)) {
    const s = v?.s ?? {};
    const counts = Object.values<number>(s);
    const total = counts.length;
    const covered = counts.filter(c => c > 0).length;
    tc += covered; tt += total;
    files.push({ path: k.replace(/\\/g, '/'), pct: total ? round(covered / total * 100) : 0 });
  }
  return { total: tt ? round(tc / tt * 100) : null, files };
}

function parsePytest(j: any): { total: number | null; files: FileCov[] } {
  const files: FileCov[] = [];
  for (const [k, v] of Object.entries<any>(j.files ?? {})) {
    const pct = v?.summary?.percent_covered;
    if (pct !== undefined) files.push({ path: k.replace(/\\/g, '/'), pct: round(pct) });
  }
  const total = j.totals?.percent_covered;
  return { total: total !== undefined ? round(total) : null, files };
}

function round(n: number): number { return Math.round(n * 100) / 100; }

function human(env: Envelope<CoverageData>): void {
  const { format, total, files } = env.data;
  console.log(`coverage (${format}): ${total === null ? 'n/a' : total + '%'} total, ${files.length} files`);
  for (const w of env.warnings ?? []) console.log(`! ${w}`);
}
