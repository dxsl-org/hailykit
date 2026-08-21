import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { extract } from '../installer/extractor';

function tmp(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'hailykit-extractor-'));
}

test('extract falls back to tar when Windows PowerShell extraction fails', () => {
  const root = tmp();
  const zip = path.join(root, 'hailykit.zip');
  const dest = path.join(root, 'extracted');
  const calls: string[] = [];
  fs.writeFileSync(zip, 'fixture');

  extract(zip, dest, {
    platform: 'win32',
    execFileSync: ((executable: string) => {
      calls.push(executable);
      if (executable === 'powershell') {
        fs.writeFileSync(path.join(dest, 'partial'), 'partial');
        throw new Error('Microsoft.PowerShell.Archive could not be loaded');
      }
      fs.writeFileSync(path.join(dest, 'success'), executable);
    }) as never,
  });

  assert.deepEqual(calls, ['powershell', 'tar.exe']);
  assert.equal(fs.existsSync(path.join(dest, 'partial')), false);
  assert.equal(fs.readFileSync(path.join(dest, 'success'), 'utf8'), 'tar.exe');
});

test('extract reports a clear error after every Windows backend fails', () => {
  const root = tmp();
  const zip = path.join(root, 'hailykit.zip');
  const dest = path.join(root, 'extracted');
  const calls: string[] = [];
  fs.writeFileSync(zip, 'fixture');

  assert.throws(
    () => extract(zip, dest, {
      platform: 'win32',
      execFileSync: ((executable: string) => {
        calls.push(executable);
        throw new Error(`${executable} unavailable`);
      }) as never,
    }),
    /no win32 extraction backend succeeded/,
  );
  assert.deepEqual(calls, ['powershell', 'tar.exe', 'py.exe', 'python.exe']);
});

test('extract keeps PowerShell path arguments single-quote safe', () => {
  const root = tmp();
  const zip = path.join(root, "release's.zip");
  const dest = path.join(root, "extract's");
  let command = '';
  fs.writeFileSync(zip, 'fixture');

  extract(zip, dest, {
    platform: 'win32',
    execFileSync: ((_executable: string, args: readonly string[]) => {
      command = args[2];
    }) as never,
  });

  assert.match(command, /release''s\.zip/);
  assert.match(command, /extract''s/);
});
