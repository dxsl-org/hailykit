import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const RULES_DIR = path.join(REPO_ROOT, 'kit', 'rules');
const DOMAIN_RULE = path.join(RULES_DIR, 'haily-domain.md');
const WORKFLOW_RULE = path.join(RULES_DIR, 'haily-workflow.md');

function read(relativePath: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8');
}

test('kit/rules keeps the expected six markdown rule files', () => {
  const ruleFiles = fs
    .readdirSync(RULES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => entry.name)
    .sort();

  assert.deepEqual(ruleFiles, [
    'haily-coding.md',
    'haily-documentation.md',
    'haily-domain.md',
    'haily-quality.md',
    'haily-workflow.md',
    'hailykit.md',
  ]);
});

test('domain routing keeps required sections and security distinctions', () => {
  const source = read('kit/rules/haily-domain.md');

  for (const anchor of [
    '## Frontend / UI',
    '## Backend / Database',
    '## Infrastructure / Deployment',
    '## Security (Code)',
    '## Security Operations (Systems)',
    '## Documentation',
    '## Senior Developer Workflows',
    'Implement shadcn/Tailwind components',
    '{skill:hl-design}',
    '{skill:hc-cook} --spec',
    '{skill:hc-plan} --quick',
    '{skill:hc-plan} --deep',
    '{skill:hc-lookup}',
    '{skill:hc-git} retro',
    '{skill:hl-reasoning}',
    '{skill:hl-brainstorm}',
    '{skill:hc-worktree}',
    '/hl-advisor',
    'All `hs-*` routing is authorized-use only.',
  ]) {
    assert.ok(source.includes(anchor), `missing domain anchor: ${anchor}`);
  }
});

test('workflow routing keeps the primary delivery routes', () => {
  const source = read('kit/rules/haily-workflow.md');

  for (const anchor of [
    '## Core Development',
    'Flow: `plan → cook → test → review → ship → log`',
    '## Bugfix',
    '## Investigation',
    '## Content Pipeline',
    '## Shipping & Release',
    '## Security Operations (Systems)',
    '`{skill:hc-review}`',
    '`{skill:hc-review} --quick`',
    '`{skill:hc-review} --comment`',
    '`{skill:hc-ship}`',
    '`{skill:hc-cook} --quick`',
    '`{skill:hc-cook} migrate',
    '| Commit or push only | `{skill:hc-git}` |',
    '`{skill:hl-brainstorm}`',
    '`{skill:hc-security}` / `{skill:hc-fix}`',
  ]) {
    assert.ok(source.includes(anchor), `missing workflow anchor: ${anchor}`);
  }
  for (const duplicatedSection of ['## Planning & Architecture', '## Writing', '## Setup', '## Thinking']) {
    assert.ok(!source.includes(duplicatedSection), `single-domain route duplicated in workflow: ${duplicatedSection}`);
  }
});

test('coding and quality rules separate implementation constraints from delegation order', () => {
  const coding = read('kit/rules/haily-coding.md');
  const quality = read('kit/rules/haily-quality.md');
  for (const anchor of ['YAGNI', 'Real code only', 'Pre-commit / Push', 'Comment the **contract, not code**', 'Output Economy']) {
    assert.ok(coding.includes(anchor), `missing coding anchor: ${anchor}`);
  }
  for (const anchor of ['haily-planner', 'haily-tester', 'haily-debugger', 'haily-reviewer', 'haily-project-manager', 'haily-docs-writer']) {
    assert.ok(quality.includes(anchor), `missing quality workflow role: ${anchor}`);
  }
  assert.ok(!quality.includes('Clean, readable, maintainable'), 'quality rule repeats coding prose');
  assert.ok(!quality.includes('Update existing files directly'), 'quality rule repeats direct-edit contract');
});

test('always-on coding, quality, domain, and workflow rules stay within the compressed budget', () => {
  const budgets: Record<string, number> = {
    'kit/rules/haily-coding.md': 3100,
    'kit/rules/haily-quality.md': 1100,
    'kit/rules/haily-domain.md': 6700,
    'kit/rules/haily-workflow.md': 2400,
  };
  let total = 0;
  for (const [file, ceiling] of Object.entries(budgets)) {
    const bytes = Buffer.byteLength(read(file).replace(/\r\n/g, '\n'));
    total += bytes;
    assert.ok(bytes <= ceiling, `${file} is ${bytes} bytes; ceiling ${ceiling}`);
  }
  assert.ok(total <= 13_000, `rule batch is ${total} bytes; ceiling 13000`);
});

test('rules referenced by routing contract still exist', () => {
  assert.ok(fs.existsSync(DOMAIN_RULE), 'missing kit/rules/haily-domain.md');
  assert.ok(fs.existsSync(WORKFLOW_RULE), 'missing kit/rules/haily-workflow.md');
});
