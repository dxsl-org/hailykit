import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { cmdSecrets } from '../commands/scan/secrets';

const FAKE_AWS = 'AKIA' + 'ABCDEFGHIJKLMNOP'; // matches AKIA[0-9A-Z]{16}

function capture(opts: Parameters<typeof cmdSecrets>[0]): { code: number; out: string; env: any } {
  const lines: string[] = [];
  const orig = console.log;
  console.log = (...a: unknown[]) => { lines.push(a.map(String).join(' ')); };
  let code: number;
  try { code = cmdSecrets(opts); } finally { console.log = orig; }
  const out = lines.join('\n');
  return { code, out, env: JSON.parse(out) };
}

test('secrets: detects a hardcoded key and exits non-zero', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hl-secrets-'));
  try {
    fs.writeFileSync(path.join(dir, 'config.ts'), `export const awsKey = "${FAKE_AWS}";\n`);
    const { code, env } = capture({ path: dir, staged: false, json: true });
    assert.equal(code, 1, 'non-zero exit gates the commit');
    assert.ok(env.data.findings.some((f: any) => f.ruleId === 'aws-access-key-id'));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('secrets: NEVER prints the raw secret value (redaction invariant)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hl-secrets-redact-'));
  try {
    fs.writeFileSync(path.join(dir, 'config.ts'), `const k = "${FAKE_AWS}";\n`);
    const { out } = capture({ path: dir, staged: false, json: true });
    assert.ok(!out.includes(FAKE_AWS), 'raw secret must not appear anywhere in output');
    assert.ok(out.includes('redacted'), 'finding is redacted');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('secrets: placeholder/env-indirection lines are not flagged', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hl-secrets-fp-'));
  try {
    fs.writeFileSync(path.join(dir, 'ok.ts'), 'const key = process.env.AWS_SECRET_ACCESS_KEY;\nconst x = "YOUR_API_KEY_HERE";\n');
    const { code, env } = capture({ path: dir, staged: false, json: true });
    assert.equal(code, 0);
    assert.equal(env.data.findings.length, 0);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('secrets: flags a hardcoded fallback even when env-indirection is on the line', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hl-secrets-fallback-'));
  try {
    fs.writeFileSync(path.join(dir, 'c.ts'), `const k = process.env.AWS || "${FAKE_AWS}";\n`);
    const { code, env } = capture({ path: dir, staged: false, json: true });
    assert.equal(code, 1, 'quoted real fallback must still gate');
    assert.ok(env.data.findings.some((f: any) => f.ruleId === 'aws-access-key-id'));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('secrets: a pathological long line does not hang (ReDoS guard)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hl-secrets-redos-'));
  try {
    fs.writeFileSync(path.join(dir, 'big.ts'), 'const s = "' + 'a'.repeat(200_000) + '";\n');
    const start = process.hrtime.bigint();
    const { code } = capture({ path: dir, staged: false, json: true });
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    assert.equal(code, 0);
    assert.ok(ms < 2000, `scan took ${ms.toFixed(0)}ms — over-long lines must be skipped fast`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
