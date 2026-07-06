import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Hardened cross-platform subprocess helper for commands that shell out to
 * external tools (deps-audit auditors, etc.). Closes the four traps the plan's
 * red-team flagged:
 *  1. win32 `.cmd`/`.exe` resolution (execFile throws ENOENT for `.cmd`).
 *  2. stdout is preserved on non-zero exit (npm audit exits 1 when vulns exist).
 *  3. env is allowlisted — never `process.env` passthrough, so a malicious repo
 *     config cannot make a child exfiltrate NPM_TOKEN / GITHUB_TOKEN.
 *  4. the executable is resolved to an absolute path and REFUSED if it resolves
 *     inside the scanned/target tree (planted-binary attack).
 * Args are always an array (no shell string) — no argument injection.
 * Leaf module.
 */

export interface ToolResult {
  ok: boolean;
  status: number | null;
  stdout: string;
  stderr: string;
  /** Set when the tool could not be run at all (not found / blocked / spawn error). */
  error?: 'tool_not_found' | 'blocked_in_tree' | 'spawn_failed';
}

const MAX_BUFFER = 32 * 1024 * 1024;

/** Env keys safe to forward — excludes registry tokens, cloud creds, etc. */
const SAFE_ENV = [
  'PATH', 'Path', 'PATHEXT', 'HOME', 'USERPROFILE', 'SystemRoot', 'windir',
  'TEMP', 'TMP', 'LANG', 'LC_ALL', 'LC_CTYPE', 'TERM', 'APPDATA', 'LOCALAPPDATA',
  'PROGRAMFILES', 'PROGRAMDATA', 'COMSPEC',
];

/**
 * Build the child env: the SAFE_ENV allowlist plus any caller-named extras.
 * `allowEnv` exists for tools that legitimately need a credential (cross-review
 * shells out to AI CLIs that read e.g. OPENAI_API_KEY); only the explicitly
 * named keys are copied, never a blanket `process.env` passthrough.
 */
function scrubbedEnv(allowEnv?: string[]): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  const keys = allowEnv && allowEnv.length ? [...SAFE_ENV, ...allowEnv] : SAFE_ENV;
  for (const k of keys) {
    const v = process.env[k];
    if (v !== undefined) env[k] = v;
  }
  return env;
}

/**
 * Resolve `cmd` to an absolute executable path via PATH (+ PATHEXT on win32).
 * Returns null when not found, or 'blocked' when the resolved binary lives
 * inside `denyRoot` (the scanned tree) — a planted-binary guard.
 */
export function resolveExecutable(cmd: string, denyRoot?: string): string | 'blocked' | null {
  const pathVar = process.env.PATH ?? process.env.Path ?? '';
  const dirs = pathVar.split(path.delimiter).filter(Boolean);
  const exts = process.platform === 'win32'
    ? (process.env.PATHEXT ?? '.COM;.EXE;.BAT;.CMD').split(';').filter(Boolean)
    : [''];
  const deny = denyRoot ? safeReal(path.resolve(denyRoot)) : null;

  for (const dir of dirs) {
    for (const ext of exts) {
      const candidate = path.join(dir, cmd + ext);
      if (!isExecutableFile(candidate)) continue;
      const real = safeReal(candidate);
      if (deny && (real === deny || real.startsWith(deny + path.sep))) return 'blocked';
      return real;
    }
  }
  return null;
}

function isExecutableFile(p: string): boolean {
  try { return fs.statSync(p).isFile(); } catch { return false; }
}

function safeReal(p: string): string {
  try { return fs.realpathSync(p); } catch { return p; }
}

export interface RunOptions {
  cwd: string;
  /** Reject an executable that resolves inside this tree (defaults to cwd). */
  denyRoot?: string;
  maxBuffer?: number;
  /** Extra env keys to forward on top of SAFE_ENV (e.g. an AI CLI's API key). */
  allowEnv?: string[];
  /** Text piped to the child's stdin. */
  input?: string;
  /** Kill the child after this many ms; surfaces as a `spawn_failed` result. */
  timeoutMs?: number;
}

/**
 * Run an external tool. `spawnSync` returns stdout even on non-zero exit, so a
 * tool that signals findings via exit code (npm audit) is not treated as failed
 * — callers inspect `status` and parse `stdout`.
 */
export function runTool(cmd: string, args: string[], opts: RunOptions): ToolResult {
  const denyRoot = opts.denyRoot ?? opts.cwd;
  const resolved = resolveExecutable(cmd, denyRoot);
  if (resolved === null) return { ok: false, status: null, stdout: '', stderr: '', error: 'tool_not_found' };
  if (resolved === 'blocked') return { ok: false, status: null, stdout: '', stderr: '', error: 'blocked_in_tree' };

  const base = {
    cwd: opts.cwd,
    encoding: 'utf8' as const,
    env: scrubbedEnv(opts.allowEnv),
    maxBuffer: opts.maxBuffer ?? MAX_BUFFER,
    windowsHide: true,
    ...(opts.input !== undefined ? { input: opts.input } : {}),
    ...(opts.timeoutMs ? { timeout: opts.timeoutMs } : {}),
  };

  // Node + `shell:false` cannot execute Windows batch shims (`.cmd`/`.bat`)
  // since CVE-2024-27980 — and npm/pnpm/yarn ARE `.cmd` shims, the exact
  // deps-audit case. Run those through the comspec with a quoted command line;
  // args here are caller-controlled flags, not untrusted input.
  const isBatch = process.platform === 'win32' && /\.(cmd|bat)$/i.test(resolved);
  const r = isBatch
    ? spawnSync([quoteWin(resolved), ...args.map(quoteWin)].join(' '), { ...base, shell: true })
    : spawnSync(resolved, args, { ...base, shell: false });

  if (r.error) return { ok: false, status: null, stdout: r.stdout ?? '', stderr: r.stderr ?? '', error: 'spawn_failed' };
  return { ok: true, status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

/** Quote a Windows command-line token that contains whitespace or quotes. */
function quoteWin(s: string): string {
  return /[\s"]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
