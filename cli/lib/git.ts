import { execFileSync } from 'node:child_process';

/**
 * Git-history insights from a single `git log` pass: churn (commit frequency),
 * code age (last touch), and contributor ownership / bus factor — plus a
 * `git diff` numstat parser for change-impact.
 *
 * All functions fail soft (null / empty) — git metrics are additive, never
 * blocking. Paths are normalized to the scanned root so they join with the
 * scanned-file keys. Leaf module: imports nothing from the rest of the CLI.
 */

/** Minimal shape `deriveGitInsights` needs from a scanned file (FileStats is assignable). */
export interface GitFileInput { file: string; complexity: number; ncloc: number; }

export interface GitFileData {
  /** Commits touching the file within the churn window. */
  churn: number;
  /** ISO date (YYYY-MM-DD) of the most recent commit touching the file. */
  last: string;
  /** Commit count per author name (mailmap-resolved), full collected history. */
  authors: Map<string, number>;
}

export interface GitCollect {
  perFile: Map<string, GitFileData>;
  /** Author → most recent commit date (ISO). Feeds contributor activity. */
  authorLast: Map<string, string>;
  /** ISO date → commit count, recent window only. Feeds the velocity sparkline. */
  recentDaily: Map<string, number>;
}

export interface RiskHotspot { file: string; risk: number; churn: number; complexity: number; }
export interface OwnerShare { author: string; share: number; }
export interface StaleFile { file: string; last: string; }
/** One row of `git diff --numstat`. `adds`/`dels` are null for binary files. */
export interface NumstatEntry { file: string; adds: number | null; dels: number | null; }

export interface GitInsights {
  windowDays: number;
  /** Min contributors whose owned files cover ≥50% of scanned nLOC. */
  busFactor: number;
  owners: OwnerShare[];
  riskHotspots: RiskHotspot[];
  stale: StaleFile[];
  staleTotal: number;
  staleDays: number;
}

const MAX_BUFFER = 64 * 1024 * 1024;
const COMMIT_MARK = '\x01';

export function runGit(args: string[], cwd: string): string | null {
  try {
    return execFileSync('git', args, {
      cwd, encoding: 'utf8', maxBuffer: MAX_BUFFER, stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return null;
  }
}

export function isGitRepo(root: string): boolean {
  return runGit(['rev-parse', '--is-inside-work-tree'], root)?.trim() === 'true';
}

// UTC-based cutoff vs git author-date in commit-local tz: commits at the exact
// window edge may classify either way — acceptable for a directional metric.
export function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

export const VELOCITY_DAYS = 84; // 12 weeks for the activity sparkline

/**
 * One history pass: newest-first commits with author, date, and file list.
 * Full history is preferred (code age needs it); falls back to a 2-year
 * window when the output exceeds the buffer on very large repos.
 * Scanning a repo subdirectory works: history is limited to the subtree and
 * the repo-root prefix is stripped so keys match scanned-file paths.
 */
export function collectGitData(root: string, sinceDays: number): GitCollect | null {
  const fmt = `--format=${COMMIT_MARK}%aN${COMMIT_MARK}%ad`;
  const base = ['log', fmt, '--date=short', '--name-only', '--no-renames'];
  // Fallback window must never truncate the requested churn window.
  const fallbackDays = Math.max(sinceDays, 730);
  const out = runGit([...base, '--', '.'], root)
    ?? runGit([...base, `--since=${fallbackDays}.days`, '--', '.'], root);
  if (out === null) return null;

  // --show-prefix always ends in '/', so startsWith() below cannot leak
  // sibling dirs sharing a name stem (cli/ vs cli-old/).
  const prefix = (runGit(['rev-parse', '--show-prefix'], root) ?? '').trim();
  const cutoff = isoDaysAgo(sinceDays);
  const velocityCutoff = isoDaysAgo(VELOCITY_DAYS);
  const perFile = new Map<string, GitFileData>();
  const authorLast = new Map<string, string>();
  const recentDaily = new Map<string, number>();

  let author = '', date = '', inWindow = false;
  for (const line of out.split('\n')) {
    if (line.startsWith(COMMIT_MARK)) {
      // Date is always the last field — parse from the end so an author name
      // containing the mark character cannot shift the date column.
      const lastMark = line.lastIndexOf(COMMIT_MARK);
      author = line.slice(1, lastMark);
      date = line.slice(lastMark + 1);
      inWindow = date >= cutoff;
      if (!authorLast.has(author)) authorLast.set(author, date); // newest-first log
      if (date >= velocityCutoff) recentDaily.set(date, (recentDaily.get(date) ?? 0) + 1);
      continue;
    }
    const raw = line.trim();
    if (!raw || (prefix && !raw.startsWith(prefix))) continue;
    const file = prefix ? raw.slice(prefix.length) : raw;

    let d = perFile.get(file);
    if (!d) { d = { churn: 0, last: date, authors: new Map() }; perFile.set(file, d); }
    if (inWindow) d.churn++;
    d.authors.set(author, (d.authors.get(author) ?? 0) + 1);
  }
  return { perFile, authorLast, recentDaily };
}

/**
 * Parse `git diff <base>..HEAD --numstat -z` into per-file added/deleted lines.
 * `-z` makes paths NUL-delimited and verbatim (no C-style quoting), so crafted
 * filenames (newlines, quotes) cannot spoof extra rows. Paths are `/`-normalized.
 * Returns [] outside a repo or when the ref does not resolve (fails soft).
 */
export function diffNumstat(base: string, cwd: string): NumstatEntry[] {
  const out = runGit(['diff', `${base}..HEAD`, '--numstat', '-z'], cwd);
  if (!out) return [];
  const tokens = out.split('\0');
  const entries: NumstatEntry[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    if (!tok) continue;
    const tab1 = tok.indexOf('\t');
    if (tab1 === -1) continue; // not a stat record
    const tab2 = tok.indexOf('\t', tab1 + 1);
    if (tab2 === -1) continue;
    const addsRaw = tok.slice(0, tab1);
    const delsRaw = tok.slice(tab1 + 1, tab2);
    let file = tok.slice(tab2 + 1);
    // Rename: a well-formed record ends exactly at the second tab; the old/new
    // paths are the next two NUL tokens. Attribute the churn to the new path.
    // Guard the index skip so a malformed tail cannot swallow a real record.
    if (file === '' && tab2 === tok.length - 1 && i + 2 < tokens.length) {
      i += 2; file = tokens[i] ?? '';
    }
    if (!file) continue;
    entries.push({
      file: file.replace(/\\/g, '/'),
      adds: parseCount(addsRaw),
      dels: parseCount(delsRaw),
    });
  }
  return entries;
}

/** Numstat count: `-` means binary (null); anything non-numeric is null, never NaN. */
function parseCount(raw: string): number | null {
  if (raw === '-') return null;
  const n = Number.parseInt(raw, 10);
  return Number.isNaN(n) ? null : n;
}

export interface DeriveOptions { windowDays: number; staleDays: number; top: number; }

/** Join git data with scanned files and derive the report-ready insights. */
export function deriveGitInsights(
  perFile: Map<string, GitFileData>,
  files: GitFileInput[],
  opts: DeriveOptions,
): GitInsights {
  const riskHotspots: RiskHotspot[] = [];
  const ownerWeight = new Map<string, number>();
  let ownedTotal = 0;
  const staleCutoff = isoDaysAgo(opts.staleDays);
  const staleAll: StaleFile[] = [];

  for (const f of files) {
    const g = perFile.get(f.file);
    if (!g) continue; // untracked or outside collected history

    const risk = g.churn * f.complexity;
    if (risk > 0) riskHotspots.push({ file: f.file, risk, churn: g.churn, complexity: f.complexity });

    let topAuthor = '', max = -1;
    for (const [a, n] of g.authors) if (n > max) { max = n; topAuthor = a; }
    if (topAuthor) {
      ownerWeight.set(topAuthor, (ownerWeight.get(topAuthor) ?? 0) + f.ncloc);
      ownedTotal += f.ncloc;
    }

    if (g.last < staleCutoff) staleAll.push({ file: f.file, last: g.last });
  }

  riskHotspots.sort((a, b) => b.risk - a.risk).splice(opts.top);
  staleAll.sort((a, b) => a.last.localeCompare(b.last));

  const ranked = [...ownerWeight.entries()].sort((a, b) => b[1] - a[1]);
  const owners = ranked.slice(0, 3).map(([author, w]) => ({
    author, share: ownedTotal > 0 ? Math.round((w / ownedTotal) * 100) : 0,
  }));
  let cum = 0, busFactor = 0;
  for (const [, w] of ranked) {
    cum += w; busFactor++;
    if (cum >= ownedTotal / 2) break;
  }

  return {
    windowDays: opts.windowDays,
    busFactor,
    owners,
    riskHotspots,
    stale: staleAll.slice(0, 5),
    staleTotal: staleAll.length,
    staleDays: opts.staleDays,
  };
}
