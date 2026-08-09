import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const BASELINE = {
  'kit/skills/hl-write/references/playbook-business-report.md': 4981,
  'kit/skills/hl-write/references/playbook-article.md': 7241,
  'kit/skills/hl-write/references/playbook-academic-writing.md': 7321,
} as const;

function read(file: string): string {
  return fs.readFileSync(path.join(ROOT, file), 'utf8').replace(/\r\n/g, '\n');
}

test('hl-write cold playbooks preserve routing, evidence, and structure contracts', () => {
  const business = read('kit/skills/hl-write/references/playbook-business-report.md');
  const article = read('kit/skills/hl-write/references/playbook-article.md');
  const academic = read('kit/skills/hl-write/references/playbook-academic-writing.md');

  for (const marker of [
    'NĐ30 route to `playbook-vn-administrative.md`',
    'top-down TAM plus bottom-up SOM cross-check',
    'require 5–10 interviews or a ≥30-response survey',
    'Never invent interviews or survey responses',
    'Choose consulting Situation–Complication–Resolution or engineering IMRaD-style conventions',
    '**Required — cite-before-claim:**',
  ]) assert.ok(business.includes(marker), `business playbook lost: ${marker}`);

  for (const marker of [
    'Press releases route to `playbook-marketing-copy.md`',
    'Delivered persuasive arguments route to `playbook-speech.md`',
    'lede (5W1H, at most 30 words)',
    'visible correction note',
    'keeps the URL/slug',
    'strongest opposing argument/concession',
    '**Required — attribution-before-print:**',
    '**Required — op-ed-advocacy-bounded:**',
  ]) assert.ok(article.includes(marker), `article playbook lost: ${marker}`);

  for (const marker of [
    'Vietnamese request defaults to Tiểu Luận',
    '`citation_style` during Recon',
    'routes to `playbook-literary-criticism.md`',
    'theses/dissertations route to `playbook-academic-thesis.md`',
    '**Required — references-mandatory:**',
    'cơ sở lý luận → thực trạng',
    '**Required — abstract-draft-last:**',
    'Results reports findings without interpretation; Discussion interprets',
    '**Required — verify-before-cite:**',
  ]) assert.ok(academic.includes(marker), `academic playbook lost: ${marker}`);

  assert.match(academic, /\*\*Build order:\*\*[\s\S]*Abstract \+ Keywords[\s\S]*draft the Abstract last/, 'IMRaD abstract build relation changed');
});

test('hl-write flat-inline contract remains unchanged', () => {
  const skill = read('kit/skills/hl-write/SKILL.md');
  assert.ok(skill.includes('flat_inline: [references/craft-prose-antipatterns.md]'));
  for (const file of Object.keys(BASELINE)) assert.ok(!skill.includes(`flat_inline: [${file.replace('kit/skills/hl-write/', '')}]`));
});

test('hl-write cold playbook batch stays below measured byte budget', () => {
  const entries = Object.entries(BASELINE);
  const baseline = entries.reduce((sum, [, size]) => sum + size, 0);
  const current = entries.reduce((sum, [file]) => sum + Buffer.byteLength(read(file), 'utf8'), 0);
  assert.ok(current <= Math.floor(baseline * 0.75), 'hl-write cold batch must stay at least 25% below baseline');
});
