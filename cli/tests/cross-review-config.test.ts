import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadCrossReviewConfig } from '../lib/cross-review/config';

function tmp(contents?: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hl-cr-'));
  if (contents !== undefined) fs.writeFileSync(path.join(dir, '.hl.json'), contents);
  return dir;
}

test('missing .hl.json yields empty config', () => {
  assert.deepEqual(loadCrossReviewConfig(tmp()), {});
});

test('malformed JSON yields empty config (never throws)', () => {
  assert.deepEqual(loadCrossReviewConfig(tmp('{ not json')), {});
});

test('reads a valid crossReview block', () => {
  const dir = tmp(JSON.stringify({ crossReview: { auto: true, reviewer: 'gemini', tier: 'medium', timeoutMs: 60000 } }));
  assert.deepEqual(loadCrossReviewConfig(dir), { auto: true, reviewer: 'gemini', tier: 'medium', timeoutMs: 60000 });
});

test('drops invalid reviewer and tier values', () => {
  const dir = tmp(JSON.stringify({ crossReview: { reviewer: 'bogus', tier: 'giant', timeoutMs: -1 } }));
  assert.deepEqual(loadCrossReviewConfig(dir), {});
});

test('ignores unrelated top-level keys', () => {
  const dir = tmp(JSON.stringify({ lean: { threshold: {} }, crossReview: { disable: true } }));
  assert.deepEqual(loadCrossReviewConfig(dir), { disable: true });
});
