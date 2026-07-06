import fs from 'node:fs';
import { ok, emit } from '../lib/json-output';
import { loadCrossReviewConfig } from '../lib/cross-review/config';
import { runCrossReview } from '../lib/cross-review';
import { LADDER, type CrossReviewResult, type LegName, type Stage } from '../lib/cross-review/types';

/**
 * `hailykit cross-review` — send a plan or diff to an external AI CLI whose
 * provider differs from the session's, and print its findings. Advisory only:
 * the caller (a skill / the developer) decides what to do with them. Exits 0 on
 * success AND on a graceful skip (no eligible reviewer is a normal outcome);
 * exits 1 only when the input artifact cannot be read.
 */

export interface CrossReviewCmdOptions {
  stage: Stage;
  input: string;
  sessionProvider: string;
  tier?: 'fast' | 'medium' | 'thinking' | 'ultra';
  reviewer?: string;
  json: boolean;
  cwd?: string;
}

export function cmdCrossReview(opts: CrossReviewCmdOptions): number {
  const cwd = opts.cwd ?? process.cwd();

  let artifact: string;
  try {
    artifact = fs.readFileSync(opts.input, 'utf8');
  } catch {
    console.error(`cross-review: cannot read input file: ${opts.input}`);
    return 1;
  }

  const config = loadCrossReviewConfig(cwd);
  if (opts.tier) config.tier = opts.tier;
  if (opts.reviewer && LADDER.includes(opts.reviewer as LegName)) {
    config.reviewer = opts.reviewer as LegName;
  }

  const result = runCrossReview({
    stage: opts.stage,
    artifact,
    sessionProvider: opts.sessionProvider,
    cwd,
    config,
  });

  emit(ok('cross-review', result), opts.json, () => printHuman(result));
  return 0;
}

function printHuman(r: CrossReviewResult): void {
  if (r.skipped) {
    console.log(`⚠ cross-review skipped — ${r.skipped.reason}`);
    return;
  }
  const rv = r.reviewer;
  console.log(`Cross-review by ${rv?.cli} · ${rv?.model} · ${rv?.provider}`);
  if (r.attempts?.length) {
    console.log(`  (fell through: ${r.attempts.join('; ')})`);
  }
  if (!r.findings.length) {
    console.log(r.raw ? `  (no structured findings — reviewer replied unparseably)` : '  no findings');
    return;
  }
  const order = { critical: 0, medium: 1, low: 2 } as const;
  const sorted = [...r.findings].sort((a, b) => order[a.severity] - order[b.severity]);
  for (const f of sorted) {
    const loc = f.file ? ` ${f.file}${f.line ? `:${f.line}` : ''}` : '';
    console.log(`  [${f.severity}]${loc} — ${f.summary}`);
    if (f.evidence) console.log(`     ${f.evidence}`);
  }
}
