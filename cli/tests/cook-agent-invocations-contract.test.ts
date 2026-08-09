import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const FILE = 'kit/skills/hc-cook/references/agent-invocations.md';
const BASELINE_BYTES = 7845;

function read(): string {
  return fs.readFileSync(path.join(process.cwd(), FILE), 'utf8').replace(/\r\n/g, '\n');
}

test('cook agent invocation reference preserves spawn and safety contracts', () => {
  const content = read();
  const markers = [
    '{agent:haily-researcher}',
    '{agent:scout}',
    '{agent:haily-planner}',
    '{agent:haily-designer}',
    '{agent:haily-tester}',
    '{agent:haily-debugger}',
    '{agent:haily-test-architect}',
    '{agent:haily-refiner}',
    '{agents:haily-project-manager,haily-docs-writer}',
    '{agent:haily-git-manager}',
    'Any test diff is a tamper flag',
    'refuter votes for every Critical and accepted Medium finding',
    'Under `--deep`, spawn it unconditionally',
    '`simplify.threshold.locDelta`: 400',
    '`simplify.threshold.fileCount`: 8',
    '`simplify.threshold.singleFileLoc`: 200',
    'capped at 80 excerpt lines total',
    'explicit, non-overlapping file ownership',
    'Never downgrade `haily-reviewer`',
    'never hard-code vendor model IDs',
  ];

  for (const marker of markers) assert.ok(content.includes(marker), `agent invocation contract lost: ${marker}`);
  assert.equal(content.match(/^\{agent:haily-reviewer\}$/gm)?.length, 2, 'standard and domain reviewers must both spawn');
  assert.equal(content.match(/^\{agent:haily-implementor\}$/gm)?.length, 3, 'TDD, exemplar, and parallel implementors must remain distinct');
  assert.match(content, /test-writing context[\s\S]*red proof[\s\S]*\{agent:haily-implementor\}/, 'red proof must precede implementation');
});

test('cook agent invocation reference stays below its measured byte budget', () => {
  const current = Buffer.byteLength(read(), 'utf8');
  assert.ok(current <= 6200, 'cook agent invocation reference regressed above 6200 bytes');
  assert.ok(current <= Math.floor(BASELINE_BYTES * 0.85), 'cook agent invocation reference must stay at least 15% below baseline');
});
