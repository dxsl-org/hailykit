import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { cmdCoverageParse, type CoverageFormat } from '../commands/test/coverage';

function capture(file: string, format?: CoverageFormat): { code: number; env: any } {
  const lines: string[] = [];
  const orig = console.log;
  console.log = (...a: unknown[]) => { lines.push(a.map(String).join(' ')); };
  let code: number;
  try { code = cmdCoverageParse({ file, format, json: true }); } finally { console.log = orig; }
  return { code, env: JSON.parse(lines.join('\n')) };
}

function write(prefix: string, name: string, content: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const p = path.join(dir, name);
  fs.writeFileSync(p, content);
  return p;
}

test('coverage-parse: LCOV total and per-file (auto-detect)', () => {
  const p = write('hl-cov-lcov-', 'lcov.info', 'TN:\nSF:src/a.ts\nLF:10\nLH:8\nend_of_record\nSF:src/b.ts\nLF:10\nLH:10\nend_of_record\n');
  const { env } = capture(p);
  assert.equal(env.data.format, 'lcov');
  assert.equal(env.data.total, 90); // 18/20
  assert.equal(env.data.files.find((f: any) => f.path === 'src/a.ts').pct, 80);
});

test('coverage-parse: Istanbul coverage-summary.json', () => {
  const p = write('hl-cov-ist-', 'coverage-summary.json', JSON.stringify({
    total: { lines: { pct: 77.5 } },
    'src/x.ts': { lines: { pct: 50 } },
  }));
  const { env } = capture(p);
  assert.equal(env.data.format, 'istanbul');
  assert.equal(env.data.total, 77.5);
});

test('coverage-parse: pytest coverage.json', () => {
  const p = write('hl-cov-py-', 'cov.json', JSON.stringify({
    files: { 'm.py': { summary: { percent_covered: 66.7 } } },
    totals: { percent_covered: 66.7 },
  }));
  const { env } = capture(p);
  assert.equal(env.data.format, 'pytest');
  assert.equal(env.data.total, 66.7);
});

test('coverage-parse: go coverprofile', () => {
  const p = write('hl-cov-go-', 'c.out', 'mode: set\nexample.com/x/a.go:1.1,3.2 2 1\nexample.com/x/a.go:5.1,6.2 1 0\n');
  const { env } = capture(p);
  assert.equal(env.data.format, 'gocover');
  // 2 covered stmts of 3 total → 66.67
  assert.equal(env.data.total, 66.67);
});

test('coverage-parse: malformed JSON returns null total + warning, not a throw', () => {
  const p = write('hl-cov-bad-', 'cov.json', '{ "files": { "a.py": { trunc');
  const { code, env } = capture(p, 'pytest');
  assert.equal(code, 0);
  assert.equal(env.data.total, null);
  assert.ok((env.warnings ?? []).some((w: string) => w.includes('unparseable')));
});
