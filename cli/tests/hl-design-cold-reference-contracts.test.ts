import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SKILL_PATH = 'kit/skills/hl-design/SKILL.md';
const BASELINE_REFERENCE_BYTES = 24086;
const MAX_TOTAL_BYTES = Math.floor(BASELINE_REFERENCE_BYTES * 0.75);
const CEILINGS = new Map<string, number>([
  ['kit/skills/hl-design/references/flow-social.md', 5200],
  ['kit/skills/hl-design/references/tech-banner-formats.md', 4200],
  ['kit/skills/hl-design/references/tech-canvas-design.md', 3600],
]);

function read(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8').replace(/\r\n/g, '\n');
}

function bytes(relativePath: string): number {
  return Buffer.byteLength(read(relativePath), 'utf8');
}

test('hl-design references table keeps only one tech-image-generation row', () => {
  const skill = read(SKILL_PATH);
  const referencesTable = skill.split('## References')[1] ?? '';
  const matches = referencesTable.match(/\| `references\/tech-image-generation\.md` \|/g) ?? [];
  assert.equal(matches.length, 1, 'hl-design References table must contain exactly one tech-image-generation row');
});

test('hl-design cold references keep the required semantic contracts', () => {
  const social = read('kit/skills/hl-design/references/flow-social.md');
  const banners = read('kit/skills/hl-design/references/tech-banner-formats.md');
  const canvas = read('kit/skills/hl-design/references/tech-canvas-design.md');

  for (const marker of [
    'Default outputs when the user does not specify sizes: Instagram Post `1080x1080` and Instagram Story `1080x1920`.',
    'Load brand guidance from `docs/brand-guidelines.md` when it exists.',
    'Present those ideas for user approval before producing final HTML variants.',
    '**Viewport**: set exact pixel dimensions for the target platform.',
    '**Self-contained**: inline CSS; if fonts are remote, load only what the page needs.',
    '**No scroll**: `html` and `body` must fit one viewport with `overflow: hidden`.',
    'Wait `3-5s` after load so fonts and images finish rendering before capture.',
    'Contrast stays at or above WCAG AA `4.5:1`.',
    'Write the delivery report to `.agents/reports/`',
    'This reference does not cover:',
  ]) {
    assert.ok(social.includes(marker), `flow-social lost: ${marker}`);
  }

  for (const marker of [
    '| YouTube | Safe area | 1546 x 423 px | 3.65:1 |',
    '| Motion-Ready / Kinetic | layered parts built for later animation |',
    'Use one CTA per banner; keep it visually dominant and mobile-tappable.',
    'Start CTA copy with an action verb such as `Get`, `Start`, `Download`, or `Claim`.',
    'Meta-style paid ads should stay under roughly `20%` text coverage.',
    'Add `3-5 mm` bleed on all sides.',
    'roughly `1 pt per foot` of viewing distance',
  ]) {
    assert.ok(banners.includes(marker), `tech-banner-formats lost: ${marker}`);
  }

  for (const marker of [
    'Every canvas delivery includes `philosophy.md`',
    'roughly `90%` visual communication and no more than `10%` text',
    'Limit the palette to `2-5` colors.',
    'Default to a single page unless the brief asks for a series.',
    'Required output files: `philosophy.md` plus the visual export as `.pdf` or `.png`.',
    'For multi-page work, verify consistency across the full set after each refinement pass.',
    '- brand identity explorations',
  ]) {
    assert.ok(canvas.includes(marker), `tech-canvas-design lost: ${marker}`);
  }
});

test('hl-design cold references remove verbose or wrong-scope relationships', () => {
  const social = read('kit/skills/hl-design/references/flow-social.md');
  const banners = read('kit/skills/hl-design/references/tech-banner-formats.md');
  const canvas = read('kit/skills/hl-design/references/tech-canvas-design.md');

  for (const forbidden of [
    'Activate Project Management',
    'Spawn parallel subagents',
    'Option B: chrome-devtools skill',
    'Option C: Playwright script',
    'Option D: Puppeteer script',
    'assets-organizing',
    'AI image generation (use `ai-artist` skill for that)',
  ]) {
    assert.ok(!social.includes(forbidden), `flow-social still contains removed relation: ${forbidden}`);
  }

  for (const forbidden of [
    'Pinterest Research Queries',
    'Highest CTR',
  ]) {
    assert.ok(!banners.includes(forbidden), `tech-banner-formats still contains removed boilerplate: ${forbidden}`);
  }

  for (const forbidden of [
    'museum',
    'master-level',
    'countless hours',
    'top-of-field',
    'art object status',
  ]) {
    assert.ok(!canvas.includes(forbidden), `tech-canvas-design still contains removed superlative: ${forbidden}`);
  }
});

test('hl-design cold references stay under byte ceilings and hit the batch reduction target', () => {
  const files = [...CEILINGS.keys()];
  const totals = files.map((file) => ({ file, size: bytes(file) }));
  const totalBytes = totals.reduce((sum, entry) => sum + entry.size, 0);

  for (const entry of totals) {
    assert.ok(entry.size <= CEILINGS.get(entry.file)!, `${entry.file} exceeded byte ceiling`);
  }
  assert.ok(totalBytes <= MAX_TOTAL_BYTES, `hl-design cold references total ${totalBytes} exceeds ${MAX_TOTAL_BYTES}`);
});
