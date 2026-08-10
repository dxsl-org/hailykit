import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const REPO_ROOT = path.resolve(__dirname, '..', '..');

function read(relativePath: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8');
}

function normalizedBytes(relativePath: string): number {
  return Buffer.byteLength(read(relativePath).replace(/\r\n/g, '\n'));
}

test('hailykit rule keeps installer cleanup, registry, and tier policy anchors', () => {
  const source = read('kit/rules/hailykit.md');
  for (const anchor of [
    'kit/metadata.json',
    'deletions[]',
    'kit/skills/*/SKILL.md',
    'hl-` universal/utility',
    'hc-` coding and code security',
    'hs-` security operations on running systems',
    '{skill:prefix-name}',
    'node scripts/check-skill-cross-refs.js',
    'workflow.md',
    '## Workflow Position',
    'fast | medium | thinking | ultra',
    'kit/model-map.json',
    'MODEL_MAP',
    '~/.hailykit/model-map.json',
    'model:` is the floor',
    'model_max:` is the ceiling',
    'Judgment agents',
    'Mechanical agents',
    'Apex agents',
    'haily-judge',
    'haily-advisor',
  ]) {
    assert.ok(source.includes(anchor), `missing hailykit anchor: ${anchor}`);
  }
});

test('documentation rule keeps living-doc triggers and plan schema', () => {
  const source = read('kit/rules/haily-documentation.md');
  for (const anchor of [
    'project-roadmap.md',
    'project-changelog.md',
    'system-architecture.md',
    'code-standards.md',
    'haily-project-manager',
    'phase status changes',
    'security fix',
    'breaking change',
    '.agents/<plan-name>/',
    '.claude/templates/',
    'Completed plans: archive',
    'consolidated-summary.md',
    'plan.md',
    'under 80 lines',
    'phase-NN-<slug>.md',
    'Context Links',
    'Security Considerations',
    'scope, ownership, validation, and follow-up state',
  ]) {
    assert.ok(source.includes(anchor), `missing documentation anchor: ${anchor}`);
  }
});

test('remaining always-on rules stay within compressed byte ceilings', () => {
  const budgets: Record<string, number> = {
    'kit/rules/hailykit.md': 2500,
    'kit/rules/haily-documentation.md': 2100,
  };
  let total = 0;
  for (const [file, ceiling] of Object.entries(budgets)) {
    const bytes = normalizedBytes(file);
    total += bytes;
    assert.ok(bytes <= ceiling, `${file} is ${bytes} bytes; ceiling ${ceiling}`);
  }
  assert.ok(total <= 4500, `always-on rules pair is ${total} bytes; ceiling 4500`);
});
