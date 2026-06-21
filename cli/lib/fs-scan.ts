import fs from 'node:fs';
import path from 'node:path';
import { Gitignore } from './gitignore';

/**
 * Safe, general-purpose file walker + reader for the native commands
 * (secrets, vuln-scan, contracts, pack). Distinct from the stats scanner,
 * which counts code inline; this lists files and reads them defensively.
 *
 * Hardening invariants (every downstream tool inherits these):
 *  - Containment: confined to the resolved real path of the scope root;
 *    symlinks pointing outside the root are skipped (never followed out).
 *  - Encoding: files are read as Buffer, BOM-stripped, UTF-16 decoded, and
 *    binary files (NUL byte) are skipped with a warning — an ASCII-only read
 *    would silently miss secrets in UTF-16 files.
 *  - Size cap: oversized files are skipped (prevents pathological work).
 * Leaf module (depends only on gitignore).
 */

export interface FileEntry { path: string; abs: string; bytes: number; }
export interface ListResult { root: string; files: FileEntry[]; warnings: string[]; }

export interface ListOptions {
  /** Substrings that exclude a path when contained. */
  exclude?: string[];
  /** Skip files larger than this (bytes). Default 1 MiB. */
  maxFileSizeBytes?: number;
  /** Honor `.gitignore` files (opt-in; stats does NOT use this). Default false. */
  respectGitignore?: boolean;
}

const EXCLUDE_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.next', '.nuxt',
  'coverage', '.venv', 'venv', '__pycache__', 'target', '.cache',
  'vendor', '.test-build',
]);

const DEFAULT_MAX_BYTES = 1024 * 1024;

/** List files under `rootPath`, confined to its real path. */
export function listFiles(rootPath: string, opts: ListOptions = {}): ListResult {
  const root = fs.realpathSync(path.resolve(rootPath));
  const exclude = opts.exclude ?? [];
  const maxBytes = opts.maxFileSizeBytes ?? DEFAULT_MAX_BYTES;
  const ig = opts.respectGitignore ? new Gitignore() : null;
  const files: FileEntry[] = [];
  const warnings: string[] = [];
  walk(root, root, '', { exclude, maxBytes, ig }, files, warnings);
  return { root, files, warnings };
}

interface WalkCtx { exclude: string[]; maxBytes: number; ig: Gitignore | null; }

function walk(dir: string, root: string, relDir: string, ctx: WalkCtx, out: FileEntry[], warnings: string[]): void {
  if (ctx.ig) {
    const gi = path.join(dir, '.gitignore');
    try { ctx.ig.add(fs.readFileSync(gi, 'utf8'), relDir); } catch { /* none here */ }
  }

  let entries: fs.Dirent[];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
  catch { return; }

  for (const entry of entries) {
    const abs = path.join(dir, entry.name);
    const rel = relDir ? `${relDir}/${entry.name}` : entry.name;

    let isDir = entry.isDirectory();
    let isFile = entry.isFile();
    if (entry.isSymbolicLink()) {
      // Containment: never follow a link whose target escapes the root.
      let target: string;
      try { target = fs.realpathSync(abs); } catch { continue; }
      if (target !== root && !target.startsWith(root + path.sep)) {
        warnings.push(`skipped symlink outside scope: ${rel}`);
        continue;
      }
      // In-tree symlinked dirs are not traversed (cycle risk); files are read.
      let st: fs.Stats;
      try { st = fs.statSync(abs); } catch { continue; }
      if (st.isDirectory()) { warnings.push(`skipped symlinked dir: ${rel}`); continue; }
      isDir = false;
      isFile = st.isFile();
    }

    if (isDir) {
      if (EXCLUDE_DIRS.has(entry.name)) continue;
      if (ctx.exclude.some(p => abs.includes(p))) continue;
      // An excluded directory is pruned wholesale — matching git, which cannot
      // re-include a file whose parent dir is excluded by a `dir/` rule. Use the
      // `dir/*` form (+ `!dir/keep`) when contents must be selectively kept.
      if (ctx.ig?.ignores(rel, true)) continue;
      walk(abs, root, rel, ctx, out, warnings);
    } else if (isFile) {
      if (ctx.exclude.some(p => abs.includes(p))) continue;
      if (ctx.ig?.ignores(rel, false)) continue;
      let bytes: number;
      try { bytes = fs.statSync(abs).size; } catch { continue; }
      if (bytes > ctx.maxBytes) { warnings.push(`skipped oversize file: ${rel}`); continue; }
      out.push({ path: rel, abs, bytes });
    }
  }
}

/**
 * Read a text file defensively: strip BOM, decode UTF-16, skip binary.
 * Returns `{ text: null, warning }` when the file is binary or unreadable.
 */
export function readText(abs: string, maxBytes = DEFAULT_MAX_BYTES): { text: string | null; warning?: string } {
  let buf: Buffer;
  try { buf = fs.readFileSync(abs); } catch { return { text: null, warning: `unreadable: ${abs}` }; }
  if (buf.length > maxBytes) return { text: null, warning: `oversize: ${abs}` };

  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) return { text: buf.toString('utf16le').replace(/^﻿/, '') };
  if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) return { text: swap16(buf).toString('utf16le').replace(/^﻿/, '') };
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) return { text: buf.slice(3).toString('utf8') };

  // Binary sniff: a NUL byte in the first 8 KiB means not text.
  const probe = buf.subarray(0, 8192);
  if (probe.includes(0)) return { text: null, warning: `binary skipped: ${abs}` };
  return { text: buf.toString('utf8') };
}

/** Byte-swap a big-endian UTF-16 buffer to little-endian. */
function swap16(buf: Buffer): Buffer {
  const out = Buffer.from(buf);
  for (let i = 0; i + 1 < out.length; i += 2) { const t = out[i]; out[i] = out[i + 1]; out[i + 1] = t; }
  return out;
}
