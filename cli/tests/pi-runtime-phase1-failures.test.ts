import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ensurePiRuntime, type ProcessRunner } from '../installer/pi-runtime';
import { manifest, tmp } from './pi-runtime-phase1-helpers';

test('ensurePiRuntime reports timeout from npm bootstrap', async () => {
  const root = tmp();
  const runner: ProcessRunner = { exec: async (file) => {
    if (file === process.execPath) { const error = new Error('timeout') as NodeJS.ErrnoException; error.code = 'ETIMEDOUT'; throw error; }
    const error = new Error('missing') as NodeJS.ErrnoException; error.code = 'ENOENT'; throw error;
  } };
  await assert.rejects(ensurePiRuntime({ manifest, runner, paths: { env: { PATH: root, npm_execpath: path.join(root, 'npm-cli.js') }, cwd: root, homeDir: root } }), /timed out/);
});

test('ensurePiRuntime reports offline bootstrap failures', async () => {
  const root = tmp();
  const runner: ProcessRunner = { exec: async (file) => {
    if (file === process.execPath) { const error = new Error('offline') as NodeJS.ErrnoException & { stderr?: string }; error.stderr = 'npm ERR! request to registry failed: ENOTFOUND'; throw error; }
    const error = new Error('missing') as NodeJS.ErrnoException; error.code = 'ENOENT'; throw error;
  } };
  await assert.rejects(ensurePiRuntime({ manifest, runner, paths: { env: { PATH: root, npm_execpath: path.join(root, 'npm-cli.js') }, cwd: root, homeDir: root } }), /network access failed/);
});

test('ensurePiRuntime reports non-zero bootstrap failures', async () => {
  const root = tmp();
  const runner: ProcessRunner = { exec: async (file) => {
    if (file === process.execPath) { const error = new Error('boom') as NodeJS.ErrnoException & { stderr?: string }; error.stderr = 'npm ERR! boom'; throw error; }
    const error = new Error('missing') as NodeJS.ErrnoException; error.code = 'ENOENT'; throw error;
  } };
  await assert.rejects(ensurePiRuntime({ manifest, runner, paths: { env: { PATH: root, npm_execpath: path.join(root, 'npm-cli.js') }, cwd: root, homeDir: root } }), /npm ERR! boom/);
});

test('ensurePiRuntime fails closed when bootstrap succeeds but PATH refresh still misses Pi', async () => {
  const root = tmp();
  const calls: string[] = [];
  const runner: ProcessRunner = { exec: async (file) => {
    calls.push(file);
    if (file === process.execPath) return { stdout: '', stderr: '' };
    const error = new Error('missing') as NodeJS.ErrnoException; error.code = 'ENOENT'; throw error;
  } };
  await assert.rejects(ensurePiRuntime({ manifest, runner, paths: { env: { PATH: root, npm_execpath: path.join(root, 'npm-cli.js') }, cwd: root, homeDir: root } }), /still not resolvable/);
  assert.equal(calls.filter((file) => file === process.execPath).length, 1);
});

test('ensurePiRuntime rejects unsupported versions after detection', async () => {
  const root = tmp();
  const bin = path.join(root, process.platform === 'win32' ? 'pi.cmd' : 'pi');
  fs.writeFileSync(bin, '');
  if (process.platform !== 'win32') fs.chmodSync(bin, 0o755);
  const runner: ProcessRunner = { exec: async () => ({ stdout: '0.83.0\n', stderr: '' }) };
  await assert.rejects(ensurePiRuntime({ manifest, runner, paths: { env: { PATH: root }, cwd: root, homeDir: root } }), /outside supported range/);
});
