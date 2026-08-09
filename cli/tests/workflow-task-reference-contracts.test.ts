import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const BASELINE_BYTES = {
  'kit/skills/hc-plan/references/task-management.md': 5904,
  'kit/skills/hc-review/references/process-task-pipeline.md': 5629,
  'kit/skills/hc-fix/references/task-orchestration.md': 5400,
} as const;

function read(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8').replace(/\r\n/g, '\n');
}

function bytes(relativePath: string): number {
  return Buffer.byteLength(read(relativePath), 'utf8');
}

test('task workflow references retain coordination and fallback contracts', () => {
  const plan = read('kit/skills/hc-plan/references/task-management.md');
  const review = read('kit/skills/hc-review/references/process-task-pipeline.md');
  const fix = read('kit/skills/hc-fix/references/task-orchestration.md');

  for (const marker of [
    'Plan files are persistent and remain the source of truth',
    '`TaskCreate` / `TaskUpdate` / `TaskGet` / `TaskList` are CLI-only',
    'use `TodoWrite`',
    'Sync completed Tasks back to phase checkboxes and plan status',
    'Report unresolved mappings before claiming completion',
  ]) assert.ok(plan.includes(marker), `plan task contract lost: ${marker}`);

  for (const marker of [
    'fewer than 3 meaningful steps',
    'scout -> (review || adversarial) -> fix -> verify',
    '`review` and `adversarial` start together',
    'Stop after 3 cycles',
    'continue sequentially',
  ]) assert.ok(review.includes(marker), `review task contract lost: ${marker}`);

  for (const marker of [
    'Quick fixes skip Tasks',
    'Standard Workflow — 6 Phases',
    'Deep Workflow — 9 Phases',
    'Steps 1, 2, and 3 run in parallel',
    'non-overlapping file or responsibility boundary',
    'Keep at most one Task `in_progress` per agent',
  ]) assert.ok(fix.includes(marker), `fix task contract lost: ${marker}`);

  assert.match(
    review,
    /`fix` blocks on both review branches[\s\S]*`verify` blocks on the applied fix/,
    'review and adversarial must both precede fix, then verification',
  );
  assert.match(
    fix,
    /If a Task fails, keep it `in_progress`[\s\S]*A blocked or incomplete Task prevents finalization/,
    'failed or incomplete fix tasks must not permit finalization',
  );
  assert.ok(!fix.includes('{skill:hl-log}` owns advanced hydration'), 'hydration must not route to hl-log');
});

test('task workflow reference batch stays below its measured byte budget', () => {
  const entries = Object.entries(BASELINE_BYTES) as Array<[keyof typeof BASELINE_BYTES, number]>;
  const baseline = entries.reduce((sum, [, value]) => sum + value, 0);
  const current = entries.reduce((sum, [file]) => sum + bytes(file), 0);

  assert.ok(bytes(entries[0][0]) <= 4100, 'hc-plan task reference regressed');
  assert.ok(bytes(entries[1][0]) <= 3700, 'hc-review task reference regressed');
  assert.ok(bytes(entries[2][0]) <= 3500, 'hc-fix task reference regressed');
  assert.ok(current <= Math.floor(baseline * 0.85), 'task reference batch must stay at least 15% below baseline');
});
