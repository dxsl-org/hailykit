import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const DEBUG_DIR = path.join(REPO_ROOT, 'kit', 'skills', 'hc-debug');

function read(relativePath: string): string {
  return fs.readFileSync(path.join(DEBUG_DIR, relativePath), 'utf8');
}

function collectMarkdown(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return collectMarkdown(fullPath);
    return fullPath.endsWith('.md') ? [fs.readFileSync(fullPath, 'utf8')] : [];
  });
}

const skill = read('SKILL.md');
const confidence = read(path.join('references', 'confidence-signaling.md'));
const panel = read(path.join('references', 'hypothesis-panel.md'));
const corpus = collectMarkdown(DEBUG_DIR).join('\n');

test('hc-debug docs: panel agreement is candidate convergence, not observed evidence', () => {
  assert.match(skill, /candidate convergence, not observed evidence/i);
  assert.match(confidence, /candidate convergence only, not observed evidence/i);
  assert.match(panel, /candidate convergence only, not observed evidence/i);
});

test('hc-debug docs: PROBABLE requires reproduction or two genuinely different observed signal types', () => {
  assert.match(confidence, /\| \*\*PROBABLE\*\* \| One reproducible case; OR ≥2 genuinely different observed signal types agreeing \|/i);
  assert.match(
    confidence,
    /cannot satisfy PROBABLE without .*one reproducible case.*or.*two genuinely different observed signal types/i,
  );
  assert.match(
    panel,
    /cannot promote SUSPECTED to PROBABLE on its own.*one reproducible case.*or.*two genuinely different observed signal types/i,
  );
});

test('hc-debug docs: CONFIRMED still requires reproduction plus elimination of a competitor', () => {
  assert.match(skill, /CONFIRMED still requires reproduction plus elimination of a competing hypothesis/i);
  assert.match(
    confidence,
    /CONFIRMED.*reproducible test case AND at least one competing hypothesis eliminated/i,
  );
  assert.match(
    panel,
    /same bar as without a panel.*convergence alone never reaches CONFIRMED/i,
  );
});

test('hc-debug docs: no wording lets convergence alone satisfy the confidence ladder', () => {
  for (const pattern of [
    /convergence .*satisfies the existing SUSPECTED→PROBABLE bar/i,
    /applied to streams instead of tool outputs → \*\*PROBABLE\*\*/i,
    /This \*\*is\*\* the ladder's "≥2 independent signal types agreeing" rule/i,
    /SUSPECTED escalates to PROBABLE/i,
  ]) {
    assert.doesNotMatch(corpus, pattern);
  }
});
