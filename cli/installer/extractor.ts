import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

/**
 * Extract a zip file into destDir.
 * On Windows uses PowerShell Expand-Archive; on Unix tries unzip then falls back to python3.
 * Uses execFileSync (not shell) to prevent injection via path arguments.
 *
 * @param zipPath - Absolute path to the zip file.
 * @param destDir - Destination directory (created fresh; deleted first if it exists).
 */
export function extract(zipPath: string, destDir: string): void {
  if (fs.existsSync(destDir)) fs.rmSync(destDir, { recursive: true, force: true });
  fs.mkdirSync(destDir, { recursive: true });

  if (process.platform === 'win32') {
    // Escape single quotes for the PowerShell single-quoted string literals so a
    // path containing a quote cannot break out of the -Command expression.
    const ps = (s: string): string => s.replace(/'/g, "''");
    execFileSync('powershell', [
      '-NonInteractive', '-Command',
      `Expand-Archive -Force -LiteralPath '${ps(zipPath)}' -DestinationPath '${ps(destDir)}'`,
    ], { stdio: 'pipe' });
    return;
  }

  // Unix: try unzip first, fall back to python3 — args array prevents shell injection.
  try {
    execFileSync('unzip', ['-q', '-o', zipPath, '-d', destDir], { stdio: 'pipe' });
  } catch {
    execFileSync('python3', ['-m', 'zipfile', '-e', zipPath, destDir], { stdio: 'pipe' });
  }
}

/**
 * Create a uniquely-named temp directory under os.tmpdir().
 */
export function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'hailykit-'));
}

/**
 * Gitea source archives nest everything inside one subdirectory (e.g. hailykit/).
 * If that's the case, return the inner dir so callers always get the repo root.
 *
 * @param dir - Directory to inspect.
 * @returns The repo root (may be dir itself or its single subdirectory).
 */
export function resolveRoot(dir: string): string {
  if (fs.existsSync(path.join(dir, 'cli'))) return dir;
  const entries = fs.readdirSync(dir);
  if (entries.length === 1) {
    const sub = path.join(dir, entries[0]);
    if (fs.statSync(sub).isDirectory()) return sub;
  }
  return dir;
}
