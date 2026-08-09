import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SKILL_PATH = 'kit/skills/hl-help/SKILL.md';
const BASELINE_NORMALIZED_BODY_BYTES = 29079;
const MAX_BODY_BYTES = 5000;
const MAX_LINES = 125;

const { parseFrontmatter } = require(path.join(ROOT, '.test-build', 'installer', 'converter.js')) as {
  parseFrontmatter(content: string): { body: string };
};

function read(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8').replace(/\r\n/g, '\n');
}

function body(relativePath: string): string {
  return parseFrontmatter(read(relativePath)).body;
}

function normalizedBytes(text: string): number {
  return Buffer.byteLength(text.replace(/\r\n/g, '\n'), 'utf8');
}

test('hl-help keeps its frontmatter and invocation contract byte-identical', () => {
  const expected = [
    '---',
    'name: hl-help',
    'description: "Discover skills across 3 prefixes. List, search, filter, or show workflow combos."',
    'when_to_use: "Invoke when discovering available skills or getting help with HailyKit."',
    'user-invocable: true',
    'argument-hint: "[--list] [--search <keyword>] [--domain <area>] [--prefix <hc|hl|hs>] [--all] [--combos]"',
    'metadata:',
    '  category: utilities',
    '  keywords: [help, discover, search, list, skills, catalog, prefix, domain, workflow, combo]',
    '---',
    '',
  ].join('\n');

  assert.ok(read(SKILL_PATH).startsWith(expected), 'hl-help frontmatter changed');
});

test('hl-help keeps hot-path routing markers and cold-reference links', () => {
  const skill = read(SKILL_PATH);
  const markers = [
    '## Domain Prefix System',
    '{skill:hl-help} --list',
    '{skill:hl-help} --search browser',
    '{skill:hl-help} --combos',
    'SECURITY OPS (running systems — authorized-use only)',
    '{skill:hc-security}` is code security, `hs-*` skills are for authorized running-system security work',
    'references/common-confusions.md',
    'references/catalog-and-filters.md',
    'references/workflow-combos.md',
    'references/brainstorm-flags.md',
  ];

  for (const marker of markers) {
    assert.ok(skill.includes(marker), `hl-help must retain ${marker}`);
  }
});

test('hl-help hot body stays compact after splitting cold catalogs', () => {
  const skill = read(SKILL_PATH);
  const skillBody = body(SKILL_PATH);
  const lineCount = skill.split('\n').length;
  const bodyBytes = Buffer.byteLength(skillBody, 'utf8');
  const normalizedBodyBytes = normalizedBytes(skillBody);

  assert.ok(lineCount <= MAX_LINES, `hl-help exceeded ${MAX_LINES} lines`);
  assert.ok(bodyBytes <= MAX_BODY_BYTES, `hl-help exceeded ${MAX_BODY_BYTES} body bytes`);
  assert.ok(
    normalizedBodyBytes <= Math.floor(BASELINE_NORMALIZED_BODY_BYTES * 0.65),
    `hl-help normalized body bytes did not shrink by at least 35%`,
  );
});

test('hl-help reference files preserve the moved cold-path catalogs', () => {
  const references = [
    'kit/skills/hl-help/references/common-confusions.md',
    'kit/skills/hl-help/references/catalog-and-filters.md',
    'kit/skills/hl-help/references/workflow-combos.md',
    'kit/skills/hl-help/references/brainstorm-flags.md',
  ];

  for (const reference of references) {
    const content = read(reference);
    assert.ok(content.length > 0, `${reference} must exist`);
  }

  assert.ok(read(references[0]).includes('/review'), 'common-confusions reference lost built-in routing notes');
  assert.ok(read(references[1]).includes('Category Grouping Map'), 'catalog reference lost list grouping map');
  assert.ok(read(references[2]).includes('{skill:hc-goal} "feature description" --auto'), 'workflow combos reference lost autonomous chain');
  assert.ok(read(references[3]).includes('--creative-director'), 'brainstorm flags reference lost persona coverage');
});
