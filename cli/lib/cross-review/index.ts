import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runTool } from '../spawn';
import { detectLegs, realDeps, type DetectDeps } from './detect';
import { resolveLeg, realResolveDeps, type ResolveDeps } from './resolve';
import { buildInvocation, legBinary, legDelivery } from './adapters';
import { buildPrompt } from './prompt';
import { normalizeOutput } from './normalize';
import type { CrossReviewConfig, CrossReviewResult, LegName, ResolvedLeg, Stage } from './types';

/**
 * Orchestrate a cross-model review: detect eligible CLIs, resolve the first
 * provider-different reviewer, run it, and normalize its output. Falls through to
 * the next eligible leg on a runtime failure — auth pre-filters can be wrong, so
 * the invocation is the real gate. Returns a `skipped` result (never throws) when
 * nothing eligible runs; skip is a normal outcome, not an error.
 */

const DEFAULT_TIMEOUT_MS = 120_000;

export interface RunCrossReviewOptions {
  stage: Stage;
  artifact: string;
  sessionProvider: string;
  cwd: string;
  config: CrossReviewConfig;
  /** Test seams; omit for the real environment. */
  detectDeps?: DetectDeps;
  resolveDeps?: ResolveDeps;
  runner?: (leg: ResolvedLeg, prompt: string, timeoutMs: number, cwd: string) => { ok: boolean; stdout: string };
}

export function runCrossReview(opts: RunCrossReviewOptions): CrossReviewResult {
  if (opts.config.disable) return { findings: [], skipped: { reason: 'disabled in .hl.json' } };

  const legs = detectLegs(opts.detectDeps ?? realDeps());
  if (!legs.length) return { findings: [], skipped: { reason: 'no eligible reviewer CLI found on PATH' } };

  const resolveDeps = opts.resolveDeps ?? realResolveDeps();
  const timeoutMs = opts.config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const prompt = buildPrompt(opts.stage, opts.artifact);
  const run = opts.runner ?? defaultRunner;

  // Try each provider-different leg in ladder order; fall through on failure.
  const rejections: string[] = [];
  let remaining = legs;
  while (remaining.length) {
    const outcome = resolveLeg(remaining, opts.sessionProvider, opts.config, resolveDeps);
    outcome.rejected.forEach(r => rejections.push(`${r.cli}: ${r.reason}`));
    if (!outcome.leg) break;

    const leg = outcome.leg;
    const res = run(leg, prompt, timeoutMs, opts.cwd);
    if (res.ok) {
      const norm = normalizeOutput(res.stdout);
      return { reviewer: leg, findings: norm.findings, ...(norm.raw ? { raw: norm.raw } : {}) };
    }
    rejections.push(`${leg.cli}: invocation failed`);
    remaining = remaining.filter(l => l !== leg.cli);
  }

  const unique = [...new Set(rejections)];
  const reason = unique.length
    ? `no reviewer with a provider different from "${opts.sessionProvider}" — ${unique.join('; ')}`
    : `no reviewer with a provider different from "${opts.sessionProvider}"`;
  return { findings: [], skipped: { reason } };
}

function defaultRunner(leg: ResolvedLeg, prompt: string, timeoutMs: number, cwd: string): { ok: boolean; stdout: string } {
  let promptFile: string | undefined;
  let tmpDir: string | undefined;
  try {
    if (legDelivery(leg.cli) === 'file') {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hl-xr-'));
      promptFile = path.join(tmpDir, 'prompt.txt');
      fs.writeFileSync(promptFile, prompt, 'utf8');
    }
    const inv = buildInvocation(leg, prompt, promptFile);
    const r = runTool(legBinary(leg.cli), inv.args, {
      cwd,
      allowEnv: inv.allowEnv,
      input: inv.input,
      timeoutMs,
    });
    // A spawn/timeout error, or empty stdout (crashed wrapper / wrong flags),
    // falls through to the next leg — a genuine review always emits output.
    if (r.error || !r.stdout.trim()) return { ok: false, stdout: '' };
    return { ok: true, stdout: r.stdout };
  } finally {
    if (tmpDir) { try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* best-effort */ } }
  }
}

export type { CrossReviewResult, CrossReviewConfig, Stage, LegName } from './types';
