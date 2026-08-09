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
    '{skill:hc-lookup}',
    '{skill:hc-git} retro',
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
    '## Planning & Architecture',
    '## Writing',
    '## Shipping & Release',
    '## Security Operations (Systems)',
    '`{skill:hc-review}`',
    '`{skill:hc-review} --quick`',
    '`{skill:hc-review} --comment`',
    '`{skill:hc-ship}`',
    '`{skill:hl-reasoning}`',
    '`{skill:hl-brainstorm}`',
    '`{skill:hc-worktree}`',
    '`{skill:hc-security}` / `{skill:hc-fix}`',
    '/hl-advisor',
  ]) {
    assert.ok(source.includes(anchor), `missing workflow anchor: ${anchor}`);
  }
});

test('rules referenced by routing contract still exist', () => {
  assert.ok(fs.existsSync(DOMAIN_RULE), 'missing kit/rules/haily-domain.md');
  assert.ok(fs.existsSync(WORKFLOW_RULE), 'missing kit/rules/haily-workflow.md');
});
