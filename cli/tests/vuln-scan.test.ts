import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { cmdVulnScan } from '../commands/scan/vuln-scan';

function capture(opts: Parameters<typeof cmdVulnScan>[0]): { code: number; out: string; env: any } {
  const lines: string[] = [];
  const orig = console.log;
  console.log = (...a: unknown[]) => { lines.push(a.map(String).join(' ')); };
  let code: number;
  try { code = cmdVulnScan(opts); } finally { console.log = orig; }
  const out = lines.join('\n');
  return { code, out, env: JSON.parse(out) };
}

test('vuln-scan: flags eval and innerHTML, exits 0 (informational)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hl-vuln-'));
  try {
    fs.writeFileSync(path.join(dir, 'app.ts'), 'function f(x){ eval(x); }\nel.innerHTML = userInput;\n');
    const { code, env } = capture({ path: dir, json: true });
    assert.equal(code, 0, 'vuln-scan is informational');
    const ids = env.data.findings.map((f: any) => f.ruleId);
    assert.ok(ids.includes('dangerous-eval'));
    assert.ok(ids.includes('xss-innerhtml'));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('vuln-scan: skips single-line comments', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hl-vuln-comment-'));
  try {
    fs.writeFileSync(path.join(dir, 'a.ts'), '// eval(x) is dangerous, do not use\nconst y = 1;\n');
    const { env } = capture({ path: dir, json: true });
    assert.equal(env.data.findings.length, 0, 'commented-out code must not be flagged');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('vuln-scan: masks a credential embedded INSIDE the matched span', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hl-vuln-embed-'));
  try {
    // command-injection span [^)]* consumes the token before the `+` — it must be masked.
    fs.writeFileSync(path.join(dir, 'a.ts'),
      'const r = execSync("curl -H authorization:AKIAABCDEFGHIJKLMNOP " + userArg);\n');
    const { out, env } = capture({ path: dir, json: true });
    assert.ok(env.data.findings.some((f: any) => f.ruleId === 'command-injection'));
    assert.ok(!out.includes('AKIAABCDEFGHIJKLMNOP'), 'embedded credential must be scrubbed from the span');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('vuln-scan: does not leak a secret sharing a line with a matched construct', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hl-vuln-leak-'));
  try {
    // eval pattern matches `eval(`, but the line also holds a secret — it must not be echoed.
    fs.writeFileSync(path.join(dir, 'a.ts'), 'const token = "AKIAABCDEFGHIJKLMNOP"; eval(token);\n');
    const { out, env } = capture({ path: dir, json: true });
    assert.ok(env.data.findings.some((f: any) => f.ruleId === 'dangerous-eval'));
    assert.ok(!out.includes('AKIAABCDEFGHIJKLMNOP'), 'only the matched construct is shown, not the whole line');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
