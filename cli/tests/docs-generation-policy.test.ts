import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

function read(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

test('hc-new delegates docs and rule generation to hc-docs init', () => {
  const skill = read('kit/skills/hc-new/SKILL.md');

  assert.match(skill, /\{skill:hc-docs\} init` as the canonical docs\/rules generator/);
  assert.match(skill, /detected commands/);
  assert.doesNotMatch(skill, /\.\/docs\/README\.md/);
  assert.doesNotMatch(skill, /\.\/docs\/codebase-summary\.md/);
  assert.doesNotMatch(skill, /\*\*`AGENTS\.md`\*\* — canonical content/);
});

test('hc-docs init keeps narrative in root README and generates operational docs', () => {
  const workflow = read('kit/skills/hc-docs/references/init-workflow.md');

  assert.match(workflow, /README\.md.*one brief purpose, strengths, and differentiation paragraph/);
  assert.match(workflow, /docs\/quick-start\.md.*first-run commands/);
  assert.match(workflow, /docs\/product-requirements\.md.*acceptance criteria/);
  assert.match(workflow, /docs\/tech-stack\.md.*why they exist/);
  assert.match(workflow, /Do not add a `## Project` narrative section/);
  assert.match(workflow, /generic duplicated safety rules/);
  assert.match(workflow, /thin importers.*@AGENTS\.md/s);
  assert.doesNotMatch(workflow, /^- `docs\/(?:README|codebase-summary|project-overview-pdr)\.md`:/m);
});

test('hc-docs update and summarize do not recreate codebase tours', () => {
  const update = read('kit/skills/hc-docs/references/update-workflow.md');
  const summarize = read('kit/skills/hc-docs/references/summarize-workflow.md');
  const writer = read('kit/agents/haily-docs-writer.md');

  assert.match(update, /Do not recreate `docs\/README\.md`, `docs\/codebase-summary\.md`/);
  assert.match(summarize, /Do not maintain `docs\/codebase-summary\.md`/);
  assert.match(writer, /Only root `README\.md`.*strengths.*differentiation/);
  assert.match(writer, /Never create a standalone codebase summary or narrative PDR/);
});
