import fs from 'node:fs';
import path from 'node:path';
import { checkReportLines, missingPythonMessage, runSummaryLines } from '../lib/ocr/check-report';
import { emit, fail, ok } from '../lib/json-output';
import { loadOcrConfig } from '../lib/ocr/config';
import { runEngine as realRunEngine } from '../lib/ocr/engine-runner';
import { resolvePython, type ResolvedPython } from '../lib/ocr/python-resolve';
import { formatProgressLine } from '../lib/ocr/render';
import type { ManifestSummary, OcrCheckResult, OcrJob } from '../lib/ocr/types';

/**
 * `hailykit ocr <input> --out <dir>` — convert a PDF/image to Markdown via
 * the docling → Gemini Flash → Gemini Pro tier ladder. Resolves the venv
 * python, warns (never installs) on missing deps, spawns the engine with a
 * temp job file, streams progress, and emits the shared JSON envelope.
 */

export interface OcrCmdOptions {
  input?: string;
  out?: string;
  maxTier?: 'local' | 'flash' | 'pro';
  resume: boolean;
  check: boolean;
  json: boolean;
  python?: string;
  lang?: string;
  cwd?: string;
  /** Submit flagged pages as async Gemini Batch jobs (50% cost) instead of
   *  calling flash/pro synchronously; wins over sync escalation per run. */
  batchApi?: boolean;
  /** Poll/collect outstanding batch jobs for this input/output instead of
   *  running the local+escalation pipeline. */
  collect?: boolean;
  /** Test seam: real engine script path + runner are the defaults. */
  scriptPath?: string;
  runEngineFn?: typeof realRunEngine;
}

interface OcrRunData {
  summary: unknown;
  manifests: ManifestSummary[];
}

function defaultScriptPath(): string {
  // Compiled to dist/commands/ocr.js — postbuild copies cli/tools/** (minus
  // .ts) to dist/tools/, so this resolves regardless of install location.
  return path.join(__dirname, '..', 'tools', 'ocr', 'ocr_engine.py');
}

export async function cmdOcr(opts: OcrCmdOptions): Promise<number> {
  const cwd = opts.cwd ?? process.cwd();
  const config = loadOcrConfig(cwd);
  const scriptPath = opts.scriptPath ?? defaultScriptPath();
  const runEngine = opts.runEngineFn ?? realRunEngine;
  const resolved = resolvePython({ flag: opts.python, configPython: config.python });

  if (opts.check) return runCheck(resolved, scriptPath, runEngine, opts.json);

  if (!opts.input) { console.error('Usage: hailykit ocr <input> --out <dir>'); return 1; }
  if (!opts.out) { console.error('ocr: --out <dir> is required'); return 1; }

  // Validate the user's own input before the (heavier) python-ladder walk
  // and before anything gets spawned — fail fast on an obviously bad path.
  const io = resolveInputOutput(opts.input, opts.out, cwd);
  if ('error' in io) {
    emit(fail('ocr', io.error), opts.json, (env) => console.error(env.data.error));
    return 1;
  }

  if (!resolved) {
    printMissingPython(opts.json);
    return 1;
  }
  if (!fs.existsSync(scriptPath)) {
    emit(fail('ocr', `engine script not found at ${scriptPath} (reinstall hailykit)`), opts.json, (env) => console.error(env.data.error));
    return 1;
  }

  const job: OcrJob = { input: io.input, output: io.output, config: buildJobConfig(opts, config) };
  const isTty = Boolean(process.stdout.isTTY) && !opts.json;
  const abortController = new AbortController();
  const onSigint = () => abortController.abort();
  process.once('SIGINT', onSigint);

  let result;
  try {
    result = await runEngine({
      pythonPath: resolved.path,
      scriptPath,
      job,
      cwd,
      signal: abortController.signal,
      onProgress: (rawLine, evt) => {
        if (isTty) console.log(formatProgressLine(rawLine, evt));
        else if (opts.json) process.stderr.write(`${rawLine}\n`);
      },
    });
  } finally {
    process.removeListener('SIGINT', onSigint);
  }

  if (!result.ok) {
    const message = result.error ?? 'ocr engine run failed';
    emit(fail('ocr', message), opts.json, (env) => console.error(`ocr: ${env.data.error}`));
    return 1;
  }

  const data = buildRunData(result.result);
  emit(ok('ocr', data), opts.json, () => printHumanSummary(data));
  return 0;
}

function buildJobConfig(opts: OcrCmdOptions, config: ReturnType<typeof loadOcrConfig>): OcrJob['config'] {
  const langs = (opts.lang ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const maxTier = opts.maxTier ?? config.max_tier;
  return {
    ...(maxTier ? { max_tier: maxTier } : {}),
    ...(langs.length ? { ocr_lang: langs } : config.ocr_lang ? { ocr_lang: config.ocr_lang } : {}),
    ...(opts.resume ? { resume: true } : {}),
    ...(config.models ? { models: config.models } : {}),
    ...(config.blur_min !== undefined ? { blur_min: config.blur_min } : {}),
    ...(config.escalate_below_grade ? { escalate_below_grade: config.escalate_below_grade } : {}),
    ...(config.route_tables_to_vlm !== undefined ? { route_tables_to_vlm: config.route_tables_to_vlm } : {}),
    ...(config.long_edge_min !== undefined ? { long_edge_min: config.long_edge_min } : {}),
    ...(config.rpm !== undefined ? { rpm: config.rpm } : {}),
    // --batch-api wins over sync escalation per run (see batch.py's mode
    // switch) — both flags are still forwarded independently rather than
    // one silently overriding the other, so the engine's own precedence is
    // the single source of truth.
    ...(opts.batchApi ? { batch_api: true } : {}),
    ...(opts.collect ? { collect: true } : {}),
  };
}

/** Resolve `input`/`out` to absolute paths, realpath-resolving `input` (an
 *  existing file) so downstream hashing/slugging operate on its real
 *  location rather than a symlink that could be swapped after this check.
 *  `output` is left as an absolute path — it need not exist yet, the engine
 *  creates it (`assemble.ensure_doc_layout`), and there is no fixed root for
 *  a CLI-chosen `--out` to "escape" from. */
function resolveInputOutput(input: string, out: string, cwd: string): { input: string; output: string } | { error: string } {
  const inputAbs = path.resolve(cwd, input);
  if (!fs.existsSync(inputAbs)) return { error: `input not found: ${input}` };
  let inputReal = inputAbs;
  try { inputReal = fs.realpathSync(inputAbs); } catch { /* keep resolved-but-unreal path */ }
  return { input: inputReal, output: path.resolve(cwd, out) };
}

function buildRunData(engineResult: unknown): OcrRunData {
  const manifests: ManifestSummary[] = [];
  const manifestPath = extractManifestPath(engineResult);
  if (manifestPath) {
    try {
      manifests.push(JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as ManifestSummary);
    } catch {
      // Summary still returned even if the manifest file can't be re-read.
    }
  }
  return { summary: engineResult, manifests };
}

function extractManifestPath(r: unknown): string | undefined {
  if (r && typeof r === 'object' && typeof (r as Record<string, unknown>).manifest === 'string') {
    return (r as Record<string, unknown>).manifest as string;
  }
  return undefined;
}

async function runCheck(
  resolved: ResolvedPython | null,
  scriptPath: string,
  runEngine: typeof realRunEngine,
  json: boolean,
): Promise<number> {
  if (!resolved) { printMissingPython(json); return 0; }
  if (!fs.existsSync(scriptPath)) {
    if (json) console.log(JSON.stringify(fail('ocr', `engine script not found at ${scriptPath}`), null, 2));
    else console.error(`ocr: engine script not found at ${scriptPath} (reinstall hailykit)`);
    return 0;
  }

  const result = await runEngine({ pythonPath: resolved.path, scriptPath, check: true });
  const data = (result.result ?? { ok: false }) as Partial<OcrCheckResult>;

  if (json) { console.log(JSON.stringify(ok('ocr', data), null, 2)); return 0; }
  printCheckHuman(data, resolved.path, scriptPath);
  return 0;
}

function printMissingPython(json: boolean): void {
  const msg = missingPythonMessage();
  if (json) console.log(JSON.stringify(fail('ocr', msg), null, 2));
  else console.error(`ocr: ${msg}`);
}

function printCheckHuman(data: Partial<OcrCheckResult>, pythonPath: string, scriptPath: string): void {
  for (const line of checkReportLines(data, pythonPath, scriptPath)) console.log(line);
}

function printHumanSummary(data: OcrRunData): void {
  for (const line of runSummaryLines(data)) console.log(line);
}
