import fs from 'node:fs';
import path from 'node:path';
import { EXT_MAP, type Language } from './languages';

export interface FileStats {
  file: string;
  language: string;
  lines: number;
  ncloc: number;
  comments: number;
  blanks: number;
  complexity: number;
  bytes: number;
}

export interface ScanOptions {
  langs?: string[];
  exclude?: string[];
  maxFileSizeBytes?: number;
}

export interface ScanResult {
  root: string;
  files: FileStats[];
}

const EXCLUDE_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.next', '.nuxt',
  'coverage', '.venv', 'venv', '__pycache__', 'target', '.cache',
  'vendor', '.test-build',
]);

const DEFAULT_MAX_BYTES = 1024 * 1024;

export function scan(rootPath: string, opts: ScanOptions = {}): ScanResult {
  const root = path.resolve(rootPath);
  const langFilter = opts.langs?.length ? opts.langs.map(l => l.toLowerCase()) : undefined;
  const excludeExtra = opts.exclude ?? [];
  const maxBytes = opts.maxFileSizeBytes ?? DEFAULT_MAX_BYTES;
  const files: FileStats[] = [];
  walkDir(root, root, langFilter, excludeExtra, maxBytes, files);
  return { root, files };
}

function walkDir(
  dir: string,
  root: string,
  langFilter: string[] | undefined,
  excludeExtra: string[],
  maxBytes: number,
  results: FileStats[],
): void {
  let entries: fs.Dirent[];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
  catch { return; }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (EXCLUDE_DIRS.has(entry.name)) continue;
      if (excludeExtra.some(p => fullPath.includes(p))) continue;
      walkDir(fullPath, root, langFilter, excludeExtra, maxBytes, results);
    } else if (entry.isFile()) {
      const lang = detectLanguage(entry.name);
      if (!lang) continue;
      if (langFilter && !matchesLangFilter(lang, langFilter)) continue;
      if (excludeExtra.some(p => fullPath.includes(p))) continue;
      const stats = countFile(fullPath, path.relative(root, fullPath), lang, maxBytes);
      if (stats) results.push(stats);
    }
  }
}

function matchesLangFilter(lang: Language, filter: string[]): boolean {
  return filter.some(f =>
    lang.name.toLowerCase() === f ||
    lang.extensions.some(ext => ext.replace(/^\./, '') === f),
  );
}

function detectLanguage(filename: string): Language | null {
  const ext = path.extname(filename).toLowerCase();
  return EXT_MAP.get(ext) ?? null;
}

function countFile(
  filePath: string,
  relPath: string,
  lang: Language,
  maxBytes: number,
): FileStats | null {
  let stat: fs.Stats;
  try { stat = fs.statSync(filePath); }
  catch { return null; }
  if (stat.size > maxBytes) return null;

  let content: string;
  try { content = fs.readFileSync(filePath, 'utf8'); }
  catch { return null; }

  const rawLines = content.split('\n');
  let ncloc = 0, comments = 0, blanks = 0;
  // Base complexity = 1 per file (one always-reachable execution path)
  let complexity = 1;
  let inBlock = false;
  let blockClose = '';

  for (const rawLine of rawLines) {
    const line = rawLine.replace(/\r$/, '');
    const trimmed = line.trim();

    if (trimmed === '') { blanks++; continue; }

    if (inBlock) {
      comments++;
      if (trimmed.includes(blockClose)) inBlock = false;
      continue;
    }

    // Single-line comment prefixes
    if (lang.lineComment.some(p => trimmed.startsWith(p))) { comments++; continue; }

    // Block comment open
    let openedBlock = false;
    for (const [open, close] of lang.blockComment) {
      if (trimmed.includes(open)) {
        comments++;
        const afterOpen = trimmed.indexOf(open) + open.length;
        if (trimmed.indexOf(close, afterOpen) === -1) { inBlock = true; blockClose = close; }
        openedBlock = true;
        break;
      }
    }
    if (openedBlock) continue;

    // Code line — count keywords for complexity
    ncloc++;
    for (const kw of lang.complexity) {
      let idx = 0;
      while ((idx = line.indexOf(kw, idx)) !== -1) { complexity++; idx += kw.length; }
    }
  }

  return {
    file: relPath.replace(/\\/g, '/'),
    language: lang.name,
    lines: rawLines.length,
    ncloc,
    comments,
    blanks,
    complexity,
    bytes: stat.size,
  };
}
