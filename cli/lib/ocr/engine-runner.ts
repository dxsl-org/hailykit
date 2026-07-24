import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import type { OcrJob, ProgressEvent } from './types';

/**
 * Net-new ASYNC streaming runner for the OCR engine — NOT `cli/lib/spawn.ts`
 * `runTool` (that helper is `spawnSync` with a 32MB output cap and cannot
 * stream; it stays untouched, other commands depend on its sync semantics).
 *
 * Job config always travels via a temp FILE, never argv — Windows cmd.exe
 * truncates long command lines, and job configs carry arbitrary paths. The
 * temp file gets an unpredictable name and `0600` mode in the OS per-user
 * temp dir (mkstemp semantics: no predictable path another local user could
 * read or swap) and is removed in `finally`, run or no run.
 *
 * stderr is read line-by-line via `readline` with no buffer cap (progress can
 * run for hours over thousands of pages); stdout is accumulated only for the
 * engine's single final result line. There is no timeout — the run's
 * lifecycle is Ctrl-C (forwarded as SIGTERM via `signal`) plus `--resume`,
 * not a deadline. Leaf module.
 */

const SAFE_ENV = [
  'PATH', 'Path', 'PATHEXT', 'HOME', 'USERPROFILE', 'SystemRoot', 'windir',
  'TEMP', 'TMP', 'LANG', 'LC_ALL', 'LC_CTYPE', 'TERM', 'APPDATA', 'LOCALAPPDATA',
  'PROGRAMFILES', 'PROGRAMDATA', 'COMSPEC',
];
/** Gemini credentials forwarded to the child by default (the built-in
 *  provider). Additional provider keys are forwarded only by NAME when the
 *  resolved config references them via `providers[*].api_key_env` — a
 *  config-derived allowlist, never a blanket env passthrough. Keys are never
 *  interpolated into argv or a log line, only into the env block below. */
const KEY_ENV = ['GOOGLE_API_KEY', 'GEMINI_API_KEY'];

export interface EngineRunOptions {
  pythonPath: string;
  scriptPath: string;
  /** Present for a real run; omit + set `check: true` for `--check`. */
  job?: OcrJob;
  check?: boolean;
  cwd?: string;
  /** Fired for every stderr line: `evt` is set only when the line parsed as a
   *  whole-line JSON object with a string `ev` field; otherwise it's a plain
   *  log line and `evt` is undefined — never throw on non-JSON stderr chatter. */
  onProgress?: (rawLine: string, evt?: ProgressEvent) => void;
  /** Abort triggers a SIGTERM to the child (Ctrl-C lifecycle). */
  signal?: AbortSignal;
  /** Extra env-var NAMES to forward to the child, beyond the built-in Gemini
   *  keys — sourced from the resolved config's `providers[*].api_key_env`, so
   *  an OpenAI/OpenRouter/etc. provider's key reaches the engine. Names only;
   *  values are read from the parent env, never passed as arguments. */
  keyEnvNames?: string[];
}

export interface EngineRunResult {
  ok: boolean;
  code: number | null;
  /** Parsed final stdout JSON line, when one was produced. */
  result?: unknown;
  error?: string;
}

function scrubbedEnv(keyEnvNames: string[] = []): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const key of [...SAFE_ENV, ...KEY_ENV, ...keyEnvNames]) {
    const value = process.env[key];
    if (value !== undefined) env[key] = value;
  }
  return env;
}

/** Write `job` to an unpredictable 0600 temp path; caller (`runEngine`)
 *  removes it in `finally`. `mode` is a no-op on win32 (ACLs govern there
 *  instead) but the per-user `os.tmpdir()` location + random name still hold. */
function writeTempJob(job: OcrJob): string {
  const name = `hailykit-ocr-${crypto.randomBytes(16).toString('hex')}.json`;
  const filePath = path.join(os.tmpdir(), name);
  fs.writeFileSync(filePath, JSON.stringify(job), { encoding: 'utf8', mode: 0o600 });
  return filePath;
}

function parseProgressLine(line: string): ProgressEvent | undefined {
  if (!line.trim()) return undefined;
  try {
    const parsed: unknown = JSON.parse(line);
    if (parsed && typeof parsed === 'object' && typeof (parsed as { ev?: unknown }).ev === 'string') {
      return parsed as ProgressEvent;
    }
  } catch {
    // Not JSON — tolerated as a plain log line (e.g. phase-1's `logging.info`
    // chatter before phase 3 wires real NDJSON progress events).
  }
  return undefined;
}

function lastNonEmptyLine(text: string): string | undefined {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  return lines[lines.length - 1];
}

/** Only the FINAL non-empty stdout line is ever read (`lastNonEmptyLine`
 *  above) — a misbehaving engine that floods stdout must not grow this
 *  buffer without bound for the whole lifetime of a run. */
export const STDOUT_TAIL_CAP_BYTES = 1024 * 1024;

/** Append `chunk` to `buf`, trimming to the trailing `STDOUT_TAIL_CAP_BYTES`
 *  characters once the buffer grows past twice the cap. Trimming in a batch
 *  (rather than on every chunk) avoids a slice on every `data` event while
 *  still bounding worst-case memory to ~2x the cap. */
export function appendStdoutBounded(buf: string, chunk: string): string {
  const next = buf + chunk;
  return next.length > STDOUT_TAIL_CAP_BYTES * 2 ? next.slice(-STDOUT_TAIL_CAP_BYTES) : next;
}

export async function runEngine(opts: EngineRunOptions): Promise<EngineRunResult> {
  if (!opts.check && !opts.job) throw new Error('runEngine requires either check:true or a job');

  const tempJobPath = opts.job ? writeTempJob(opts.job) : undefined;
  const args = [opts.scriptPath, ...(opts.check ? ['--check'] : ['--job', tempJobPath as string])];

  try {
    return await spawnAndCollect(opts, args);
  } finally {
    if (tempJobPath) {
      try { fs.unlinkSync(tempJobPath); } catch { /* best-effort cleanup */ }
    }
  }
}

function spawnAndCollect(opts: EngineRunOptions, args: string[]): Promise<EngineRunResult> {
  return new Promise((resolve) => {
    const child = spawn(opts.pythonPath, args, {
      cwd: opts.cwd ?? process.cwd(),
      env: scrubbedEnv(opts.keyEnvNames),
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdoutBuf = '';
    let settled = false;

    const onAbort = () => child.kill('SIGTERM');
    opts.signal?.addEventListener('abort', onAbort, { once: true });

    child.stdout.on('data', (chunk: Buffer) => { stdoutBuf = appendStdoutBounded(stdoutBuf, chunk.toString('utf8')); });

    const rl = readline.createInterface({ input: child.stderr });
    rl.on('line', (line) => {
      opts.onProgress?.(line, parseProgressLine(line));
    });

    const finish = (r: EngineRunResult) => {
      if (settled) return;
      settled = true;
      opts.signal?.removeEventListener('abort', onAbort);
      rl.close();
      resolve(r);
    };

    child.on('error', (err) => finish({ ok: false, code: null, error: err.message }));

    child.on('close', (code) => {
      const finalLine = lastNonEmptyLine(stdoutBuf);
      if (!finalLine) {
        finish({ ok: false, code, error: 'engine produced no stdout result line' });
        return;
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(finalLine);
      } catch {
        finish({ ok: false, code, error: 'engine stdout final line was not valid JSON' });
        return;
      }
      const engineOk = typeof parsed === 'object' && parsed !== null
        ? (parsed as { ok?: unknown }).ok !== false
        : true;
      finish({ ok: code === 0 && engineOk, code, result: parsed });
    });
  });
}
