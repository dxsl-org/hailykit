import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { listFiles, readText } from '../lib/fs-scan';

function mkScratch(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

test('listFiles: opt-in gitignore excludes ignored paths', () => {
  const dir = mkScratch('hl-fsscan-gi-');
  try {
    fs.writeFileSync(path.join(dir, '.gitignore'), 'ignored/\nsecret.txt\n');
    fs.writeFileSync(path.join(dir, 'keep.ts'), 'ok\n');
    fs.writeFileSync(path.join(dir, 'secret.txt'), 'nope\n');
    fs.mkdirSync(path.join(dir, 'ignored'));
    fs.writeFileSync(path.join(dir, 'ignored', 'x.ts'), 'nope\n');

    const withGi = listFiles(dir, { respectGitignore: true }).files.map(f => f.path).sort();
    assert.ok(withGi.includes('keep.ts'));
    assert.ok(!withGi.includes('secret.txt'), 'secret.txt should be ignored');
    assert.ok(!withGi.some(p => p.startsWith('ignored/')), 'ignored/ should be pruned');

    const withoutGi = listFiles(dir, { respectGitignore: false }).files.map(f => f.path);
    assert.ok(withoutGi.includes('secret.txt'), 'without gitignore, all files listed');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('listFiles: oversize files are skipped with a warning', () => {
  const dir = mkScratch('hl-fsscan-size-');
  try {
    fs.writeFileSync(path.join(dir, 'big.txt'), 'x'.repeat(2048));
    fs.writeFileSync(path.join(dir, 'small.txt'), 'x');
    const res = listFiles(dir, { maxFileSizeBytes: 1024 });
    const paths = res.files.map(f => f.path);
    assert.ok(paths.includes('small.txt'));
    assert.ok(!paths.includes('big.txt'));
    assert.ok(res.warnings.some(w => w.includes('big.txt')));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('readText: strips UTF-8 BOM', () => {
  const dir = mkScratch('hl-fsscan-bom-');
  try {
    const p = path.join(dir, 'bom.ts');
    fs.writeFileSync(p, Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('const key = "x";', 'utf8')]));
    const { text } = readText(p);
    assert.equal(text, 'const key = "x";');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('readText: decodes UTF-16LE with BOM (secret not silently missed)', () => {
  const dir = mkScratch('hl-fsscan-u16-');
  try {
    // PowerShell `>` redirection emits UTF-16LE WITH a BOM — the common Windows case.
    const p = path.join(dir, 'u16.txt');
    fs.writeFileSync(p, Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from('AKIA_SECRET', 'utf16le')]));
    const { text } = readText(p);
    assert.ok(text && text.includes('AKIA_SECRET'), 'UTF-16 content must decode');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('readText: BOM-less UTF-16 is surfaced as a warning, never silently passed', () => {
  const dir = mkScratch('hl-fsscan-u16nb-');
  try {
    const p = path.join(dir, 'u16nb.txt');
    fs.writeFileSync(p, Buffer.from('AKIA_SECRET', 'utf16le')); // no BOM → NUL bytes
    const { text, warning } = readText(p);
    // Indistinguishable from binary by a NUL sniff; we skip but WARN (not silent).
    assert.equal(text, null);
    assert.ok(warning, 'a skipped UTF-16/binary file must produce a warning');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('readText: skips binary files', () => {
  const dir = mkScratch('hl-fsscan-bin-');
  try {
    const p = path.join(dir, 'blob.bin');
    fs.writeFileSync(p, Buffer.from([0x41, 0x00, 0x42, 0x00]));
    const { text, warning } = readText(p);
    assert.equal(text, null);
    assert.ok(warning && warning.includes('binary'));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('listFiles: `dir/*` + negation re-includes a kept file (git-correct form)', () => {
  const dir = mkScratch('hl-fsscan-neg-');
  try {
    fs.writeFileSync(path.join(dir, '.gitignore'), 'logs/*\n!logs/keep.txt\n');
    fs.mkdirSync(path.join(dir, 'logs'));
    fs.writeFileSync(path.join(dir, 'logs', 'drop.txt'), 'x\n');
    fs.writeFileSync(path.join(dir, 'logs', 'keep.txt'), 'x\n');
    const paths = listFiles(dir, { respectGitignore: true }).files.map(f => f.path);
    assert.ok(paths.includes('logs/keep.txt'), 'negated file must be re-included');
    assert.ok(!paths.includes('logs/drop.txt'), 'other ignored files stay excluded');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('listFiles: reads an in-tree symlinked FILE', () => {
  const dir = mkScratch('hl-fsscan-linkfile-');
  try {
    fs.writeFileSync(path.join(dir, 'real.ts'), 'export const a = 1;\n');
    try {
      fs.symlinkSync(path.join(dir, 'real.ts'), path.join(dir, 'alias.ts'), 'file');
    } catch {
      return; // symlink not permitted — skip
    }
    const paths = listFiles(dir).files.map(f => f.path);
    assert.ok(paths.includes('alias.ts'), 'in-tree symlinked file should be listed');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('listFiles: does not follow symlink out of the scope root', () => {
  const root = mkScratch('hl-fsscan-link-');
  const outside = mkScratch('hl-fsscan-out-');
  try {
    fs.writeFileSync(path.join(outside, 'secret.env'), 'TOKEN=leak\n');
    fs.writeFileSync(path.join(root, 'keep.ts'), 'ok\n');
    try {
      fs.symlinkSync(outside, path.join(root, 'link'), 'dir');
    } catch {
      return; // symlink creation not permitted (e.g. Windows without privilege) — skip
    }
    const res = listFiles(root);
    assert.ok(!res.files.some(f => f.path.includes('secret.env')), 'must not read through out-of-tree symlink');
    assert.ok(res.warnings.some(w => w.includes('symlink')));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(outside, { recursive: true, force: true });
  }
});
