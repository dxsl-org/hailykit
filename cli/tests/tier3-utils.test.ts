import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { cmdAdrNext } from '../commands/adr-next';
import { cmdLicenseDetect } from '../commands/license-detect';
import { cmdPack } from '../commands/pack';

function cap(fn: () => number): { code: number; env: any } {
  const lines: string[] = [];
  const orig = console.log;
  console.log = (...a: unknown[]) => { lines.push(a.map(String).join(' ')); };
  let code: number;
  try { code = fn(); } finally { console.log = orig; }
  return { code, env: JSON.parse(lines.join('\n')) };
}
function mk(p: string): string { return fs.mkdtempSync(path.join(os.tmpdir(), p)); }

// ── adr-next ─────────────────────────────────────────────────────────────────

test('adr-next: empty dir starts at 0001', () => {
  const dir = mk('hl-adr-empty-');
  try {
    const { env } = cap(() => cmdAdrNext({ dir, slug: 'Use Postgres', json: true }));
    assert.equal(env.data.padded, '0001');
    assert.equal(env.data.filename, '0001-use-postgres.md');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('adr-next: follows ADR- scheme and sanitizes slug', () => {
  const dir = mk('hl-adr-existing-');
  try {
    fs.writeFileSync(path.join(dir, 'ADR-007-init.md'), '');
    const { env } = cap(() => cmdAdrNext({ dir, slug: 'Switch: DB? to Mongo*', json: true }));
    assert.equal(env.data.scheme, 'ADR-');
    assert.equal(env.data.filename, 'ADR-0008-switch-db-to-mongo.md');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// ── license-detect ───────────────────────────────────────────────────────────

test('license-detect: MIT → adapt', () => {
  const dir = mk('hl-lic-mit-');
  try {
    fs.writeFileSync(path.join(dir, 'LICENSE'), 'MIT License\n\nPermission is hereby granted, free of charge, to any person...');
    const { env } = cap(() => cmdLicenseDetect({ path: dir, json: true }));
    assert.equal(env.data.spdx, 'MIT');
    assert.equal(env.data.mode, 'adapt');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('license-detect: GPL → rewrite', () => {
  const dir = mk('hl-lic-gpl-');
  try {
    fs.writeFileSync(path.join(dir, 'LICENSE'), 'GNU GENERAL PUBLIC LICENSE\nVersion 3, 29 June 2007');
    const { env } = cap(() => cmdLicenseDetect({ path: dir, json: true }));
    assert.equal(env.data.mode, 'rewrite');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('license-detect: declared MIT but GPL text → conflict → rewrite', () => {
  const dir = mk('hl-lic-conflict-');
  try {
    fs.writeFileSync(path.join(dir, 'LICENSE'), 'GNU GENERAL PUBLIC LICENSE\nVersion 3');
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ license: 'MIT' }));
    const { env } = cap(() => cmdLicenseDetect({ path: dir, json: true }));
    assert.equal(env.data.mode, 'rewrite');
    assert.match(env.data.reason, /conflict/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('license-detect: no license → rewrite', () => {
  const dir = mk('hl-lic-none-');
  try {
    const { env } = cap(() => cmdLicenseDetect({ path: dir, json: true }));
    assert.equal(env.data.mode, 'rewrite');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// ── pack ─────────────────────────────────────────────────────────────────────

test('pack: includes source, excludes .env and secret-bearing files', () => {
  const dir = mk('hl-pack-');
  try {
    fs.writeFileSync(path.join(dir, 'index.ts'), 'export const x = 1;\n');
    fs.writeFileSync(path.join(dir, '.env'), 'TOKEN=abc123\n');
    fs.writeFileSync(path.join(dir, 'leak.ts'), 'const k = "AKIA' + 'ABCDEFGHIJKLMNOP";\n');
    const { env } = cap(() => cmdPack({ path: dir, json: true }));
    assert.ok(env.data.files.includes('index.ts'));
    assert.ok(!env.data.files.includes('.env'), '.env must be denied');
    assert.ok(!env.data.files.includes('leak.ts'), 'secret-bearing file must be denied');
    assert.ok(!env.data.content.includes('AKIAABCDEFGHIJKLMNOP'), 'no secret in packed output');
    assert.ok(env.data.tokenEst > 0);
    assert.equal(env.data.excluded.length, 2);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
