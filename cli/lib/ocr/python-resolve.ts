import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Resolve the python interpreter to run the OCR engine with, walking a fixed
 * ladder: `--python` flag → `ocr.python` config → the Claude-layout skills
 * venv → a `python3` on PATH. Every step is existence-checked via `fs` before
 * being accepted, so a stale/typo'd override falls through instead of
 * spawning a path that doesn't exist. Non-Claude provider installs may place
 * the skills venv elsewhere (installer `venv.ts` derives it from the
 * provider dir) — the hardcoded venv step is a convenience fallback only;
 * `haily.json ocr.python` is the durable fix for those layouts. Leaf module.
 */

export type PythonSource = 'flag' | 'config' | 'venv' | 'path';

export interface ResolvedPython {
  path: string;
  source: PythonSource;
}

export interface ResolvePythonOptions {
  /** `--python <path>` CLI override, if given. */
  flag?: string;
  /** `ocr.python` from haily.json, if set. */
  configPython?: string;
  /** Test seams — default to the real environment when omitted. */
  homeDir?: string;
  platform?: NodeJS.Platform;
  pathEnv?: string;
  existsSync?: (p: string) => boolean;
}

export function resolvePython(opts: ResolvePythonOptions = {}): ResolvedPython | null {
  const exists = opts.existsSync ?? fs.existsSync;

  if (opts.flag && exists(opts.flag)) return { path: opts.flag, source: 'flag' };
  if (opts.configPython && exists(opts.configPython)) return { path: opts.configPython, source: 'config' };

  const venvPython = skillsVenvPython(opts);
  if (exists(venvPython)) return { path: venvPython, source: 'venv' };

  const onPath = findOnPath(opts, exists);
  if (onPath) return { path: onPath, source: 'path' };

  return null;
}

function skillsVenvPython(opts: ResolvePythonOptions): string {
  const home = opts.homeDir ?? os.homedir();
  const platform = opts.platform ?? process.platform;
  const venvDir = path.join(home, '.claude', 'skills', '.venv');
  return platform === 'win32'
    ? path.join(venvDir, 'Scripts', 'python.exe')
    : path.join(venvDir, 'bin', 'python');
}

function findOnPath(opts: ResolvePythonOptions, exists: (p: string) => boolean): string | undefined {
  const platform = opts.platform ?? process.platform;
  const pathVar = opts.pathEnv ?? process.env.PATH ?? process.env.Path ?? '';
  const dirs = pathVar.split(path.delimiter).filter(Boolean);
  const bin = platform === 'win32' ? 'python3.exe' : 'python3';
  for (const dir of dirs) {
    const candidate = path.join(dir, bin);
    if (exists(candidate)) return candidate;
  }
  return undefined;
}
