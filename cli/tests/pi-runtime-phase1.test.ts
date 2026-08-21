import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { detectPiRuntime, ensurePiRuntime, type ProcessRunner } from '../installer/pi-runtime';
import { manifest, tmp } from './pi-runtime-phase1-helpers';

test('detectPiRuntime reads a supported Pi binary from PATH', async () => {
  const root = tmp();
  const bin = path.join(root, process.platform === 'win32' ? 'pi.cmd' : 'pi');
  fs.writeFileSync(bin, '');
  if (process.platform !== 'win32') fs.chmodSync(bin, 0o755);
  const seen: Array<{ file: string; args: string[] }> = [];
  const runner: ProcessRunner = {
    exec: async (file, args) => {
      seen.push({ file, args });
      return { stdout: 'pi 0.84.2\n', stderr: '' };
    },
  };

  const runtime = await detectPiRuntime({
    manifest,
    runner,
    paths: { env: { PATH: root }, cwd: root, homeDir: root },
  });

  assert.equal(runtime?.version, '0.84.2');
  assert.equal(runtime?.supported, true);
  assert.equal(seen[0]?.file, bin);
  assert.equal(runtime?.source, 'path');
});

test('detectPiRuntime classifies binaries outside injected PATH as known-bin', async () => {
  const root = tmp();
  const pathDir = path.join(root, 'path-bin');
  const knownDir = path.join(root, '.npm-global', 'bin');
  fs.mkdirSync(pathDir, { recursive: true });
  fs.mkdirSync(knownDir, { recursive: true });
  const bin = path.join(knownDir, process.platform === 'win32' ? 'pi.cmd' : 'pi');
  fs.writeFileSync(bin, '');
  if (process.platform !== 'win32') fs.chmodSync(bin, 0o755);

  const runtime = await detectPiRuntime({
    manifest,
    runner: { exec: async () => ({ stdout: '0.84.2\n', stderr: '' }) },
    paths: { env: { PATH: pathDir }, cwd: root, homeDir: root },
  });

  assert.equal(runtime?.commandPath, bin);
  assert.equal(runtime?.source, 'known-bin');
});

test('detectPiRuntime ignores a non-executable POSIX file', async () => {
  if (process.platform === 'win32') return;
  const root = tmp();
  const bin = path.join(root, 'pi');
  fs.writeFileSync(bin, '');
  fs.chmodSync(bin, 0o644);

  const runtime = await detectPiRuntime({
    manifest,
    runner: { exec: async () => ({ stdout: '0.84.2\n', stderr: '' }) },
    paths: { env: { PATH: root }, cwd: root, homeDir: root },
  });

  assert.equal(runtime, null);
});

test('ensurePiRuntime installs Pi through npm_execpath and re-detects the binary', async () => {
  const root = tmp();
  const npmCli = path.join(root, 'npm-cli.js');
  const bin = path.join(root, process.platform === 'win32' ? 'pi.cmd' : 'pi');
  let installed = false;
  const calls: Array<{ file: string; args: string[] }> = [];
  const runner: ProcessRunner = {
    exec: async (file, args) => {
      calls.push({ file, args });
      if (file === process.execPath) {
        installed = true;
        fs.writeFileSync(bin, '');
        return { stdout: '', stderr: '' };
      }
      if (file === bin && installed) return { stdout: '0.84.2\n', stderr: '' };
      const error = new Error('missing') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      throw error;
    },
  };

  const runtime = await ensurePiRuntime({
    manifest,
    runner,
    paths: { env: { PATH: root, npm_execpath: npmCli }, cwd: root, homeDir: root },
  });

  assert.equal(runtime.version, '0.84.2');
  assert.match(calls[0]!.args.join(' '), /npm-cli\.js install -g --ignore-scripts @earendil-works\/pi-coding-agent@0\.84\.2/);
});
