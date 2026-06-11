import fs from 'node:fs';
import path from 'node:path';
import { scan } from './stats/scanner';
import type { FileStats } from './stats/scanner';

export interface StatsOptions {
  path: string;
  json: boolean;
  langs: string[];
  top: number;
  exclude: string[];
}

interface LangSummary {
  files: number; ncloc: number; comments: number; blanks: number; complexity: number;
}

const COMPLEXITY_WARN = 15;
const COMPLEXITY_ERROR = 25;
const FILE_LOC_WARN = 200;
const TOKEN_RATIO = 18;

export async function cmdStats(opts: StatsOptions): Promise<number> {
  const root = path.resolve(opts.path);
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    console.error(`✗ Not a directory: ${opts.path}`);
    return 1;
  }

  const result = scan(root, { langs: opts.langs, exclude: opts.exclude });
  if (result.files.length === 0) {
    console.log('No files found.');
    return 0;
  }

  const langMap = aggregate(result.files);
  const totals = sumTotals(langMap);
  const hotspots = buildHotspots(result.files, opts.top);

  if (opts.json) {
    const langObj: Record<string, { files: number; ncloc: number }> = {};
    for (const [name, s] of [...langMap.entries()].sort((a, b) => b[1].ncloc - a[1].ncloc)) {
      langObj[name] = { files: s.files, ncloc: s.ncloc };
    }
    console.log(JSON.stringify({
      v: 1,
      root: opts.path,
      summary: {
        files: result.files.length,
        ncloc: totals.ncloc, comments: totals.comments, blanks: totals.blanks,
        complexity: totals.complexity,
        languages: langObj,
        token_est: totals.ncloc * TOKEN_RATIO,
      },
      hotspots,
      thresholds: { complexity_warn: COMPLEXITY_WARN, complexity_error: COMPLEXITY_ERROR, file_loc_warn: FILE_LOC_WARN },
    }, null, 2));
    return 0;
  }

  printReport(opts.path, result.files.length, langMap, totals, hotspots);
  return 0;
}

function aggregate(files: FileStats[]): Map<string, LangSummary> {
  const m = new Map<string, LangSummary>();
  for (const f of files) {
    let s = m.get(f.language);
    if (!s) { s = { files: 0, ncloc: 0, comments: 0, blanks: 0, complexity: 0 }; m.set(f.language, s); }
    s.files++; s.ncloc += f.ncloc; s.comments += f.comments;
    s.blanks += f.blanks; s.complexity += f.complexity;
  }
  return m;
}

function sumTotals(m: Map<string, LangSummary>): LangSummary & { files: number } {
  let files = 0, ncloc = 0, comments = 0, blanks = 0, complexity = 0;
  for (const s of m.values()) {
    files += s.files; ncloc += s.ncloc; comments += s.comments;
    blanks += s.blanks; complexity += s.complexity;
  }
  return { files, ncloc, comments, blanks, complexity };
}

function buildHotspots(files: FileStats[], top: number) {
  return [...files]
    .sort((a, b) => b.complexity - a.complexity)
    .slice(0, top)
    .map(f => ({ file: f.file, ncloc: f.ncloc, complexity: f.complexity, token_est: f.ncloc * TOKEN_RATIO }));
}

function printReport(
  rootLabel: string,
  fileCount: number,
  langMap: Map<string, LangSummary>,
  totals: LangSummary & { files: number },
  hotspots: Array<{ file: string; ncloc: number; complexity: number; token_est: number }>,
): void {
  const SEP = '━'.repeat(60);
  console.log(`\nhailykit stats — ${rootLabel}  (${fileCount} files)`);
  console.log(SEP);
  console.log(col('Language', 16) + col('Files', 7) + col('nLOC', 8) + col('Comments', 10) + col('Complexity', 12));

  for (const [name, s] of [...langMap.entries()].sort((a, b) => b[1].ncloc - a[1].ncloc)) {
    console.log(
      col(name, 16) +
      col(String(s.files), 7) +
      col(String(s.ncloc), 8) +
      col(s.comments > 0 ? String(s.comments) : '----', 10) +
      col(s.complexity > 0 ? String(s.complexity) : '-', 12),
    );
  }

  console.log(SEP);
  console.log(
    col('Total', 16) + col(String(fileCount), 7) + col(String(totals.ncloc), 8) +
    col(String(totals.comments), 10) + col(String(totals.complexity), 12),
  );

  const significant = hotspots.filter(h => h.complexity >= COMPLEXITY_WARN);
  if (significant.length > 0) {
    console.log(`\nTop hotspots (complexity ≥${COMPLEXITY_WARN}):`);
    for (const h of significant) {
      const icon = h.complexity >= COMPLEXITY_ERROR ? '✗' : '⚠';
      const fname = h.file.length > 60 ? '…' + h.file.slice(-59) : h.file;
      console.log(`  ${icon}  ${String(h.complexity).padStart(3)}  ${fname.padEnd(62)}  (${h.ncloc} loc)`);
    }
  }
  console.log('');
}

function col(s: string, width: number): string {
  return s.length > width ? s.slice(0, width - 1) + '…' : s.padEnd(width);
}
