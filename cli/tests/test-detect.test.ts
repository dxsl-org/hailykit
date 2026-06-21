import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { cmdTestDetect } from '../commands/test/detect';

function capture(dir: string): any {
  const lines: string[] = [];
  const orig = console.log;
  console.log = (...a: unknown[]) => { lines.push(a.map(String).join(' ')); };
  try { cmdTestDetect({ path: dir, json: true }); } finally { console.log = orig; }
  return JSON.parse(lines.join('\n')).data;
}

function mk(prefix: string): string { return fs.mkdtempSync(path.join(os.tmpdir(), prefix)); }

test('test-detect: jest from package.json + coverage threshold', () => {
  const dir = mk('hl-td-jest-');
  try {
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({
      devDependencies: { jest: '^29' },
      jest: { coverageThreshold: { global: { lines: 85 } } },
    }));
    const d = capture(dir);
    assert.equal(d.framework, 'jest');
    assert.equal(d.coverageThreshold, 85);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('test-detect: pytest from pyproject section', () => {
  const dir = mk('hl-td-py-');
  try {
    fs.writeFileSync(path.join(dir, 'pyproject.toml'), '[tool.pytest.ini_options]\naddopts = "--cov-fail-under=90"\n');
    const d = capture(dir);
    assert.equal(d.framework, 'pytest');
    assert.equal(d.language, 'Python');
    assert.equal(d.coverageThreshold, 90);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('test-detect: go from go.mod', () => {
  const dir = mk('hl-td-go-');
  try {
    fs.writeFileSync(path.join(dir, 'go.mod'), 'module example.com/x\n\ngo 1.21\n');
    const d = capture(dir);
    assert.equal(d.framework, 'go-test');
    assert.deepEqual(d.testGlobs, ['*_test.go']);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('test-detect: unknown is not an error', () => {
  const dir = mk('hl-td-none-');
  try {
    const d = capture(dir);
    assert.equal(d.framework, 'unknown');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
