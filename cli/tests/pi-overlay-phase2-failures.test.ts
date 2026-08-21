import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PiProvider } from '../installer/providers/pi';

const repoRoot = path.resolve(__dirname, '..', '..');
const tmp = (): string => fs.mkdtempSync(path.join(os.tmpdir(), 'haily-pi-overlay-'));
function overlayKit(): string {
  const root = tmp();
  fs.cpSync(path.join(repoRoot, 'kit', 'pi'), path.join(root, 'pi'), { recursive: true });
  return root;
}
function readJson(filePath: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as Record<string, unknown>;
}
function overlayArtifacts(root: string): string[] {
  const found: string[] = [];
  const walk = (current: string): void => {
    if (!fs.existsSync(current)) return;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const next = path.join(current, entry.name);
      if (entry.name.includes('.hailykit-tmp') || entry.name.includes('.hailykit-old')) found.push(next);
      if (entry.isDirectory() && !entry.isSymbolicLink()) walk(next);
    }
  };
  walk(root);
  return found;
}

test('Pi overlay restores previous resource when marker write fails after backup', () => {
  const provider = new PiProvider();
  const target = path.join(tmp(), '.pi');
  provider.installOverlay(overlayKit(), target);
  const original = fs.readFileSync(path.join(target, 'prompts', 'hailykit-baseline.md'), 'utf8');
  const kit = overlayKit();
  fs.writeFileSync(path.join(kit, 'pi', 'prompts', 'hailykit-baseline.md'), 'next prompt', 'utf8');
  const originalWrite = fs.writeFileSync;
  fs.writeFileSync = ((filePath: fs.PathOrFileDescriptor, data: string | NodeJS.ArrayBufferView, options?: fs.WriteFileOptions) => {
    if (typeof filePath === 'string' && filePath.endsWith('hailykit-baseline.hailykit-pi-overlay.json')) throw new Error('simulated marker failure');
    return originalWrite(filePath, data, options);
  }) as typeof fs.writeFileSync;
  try { assert.throws(() => provider.installOverlay(kit, target), /simulated marker failure/); } finally { fs.writeFileSync = originalWrite; }
  assert.equal(fs.readFileSync(path.join(target, 'prompts', 'hailykit-baseline.md'), 'utf8'), original);
  assert.deepEqual(overlayArtifacts(target), []);
});

test('Pi overlay keeps committed overlay when backup cleanup fails', () => {
  const provider = new PiProvider();
  const target = path.join(tmp(), '.pi');
  provider.installOverlay(overlayKit(), target);
  const kit = overlayKit();
  fs.writeFileSync(path.join(kit, 'pi', 'prompts', 'hailykit-baseline.md'), 'committed prompt', 'utf8');
  const originalRm = fs.rmSync;
  fs.rmSync = ((filePath: fs.PathLike, options?: fs.RmOptions) => {
    if (typeof filePath === 'string' && filePath.endsWith(path.join('prompts', 'hailykit-baseline.md.hailykit-old'))) {
      throw new Error('simulated cleanup failure');
    }
    return originalRm(filePath, options);
  }) as typeof fs.rmSync;
  try { provider.installOverlay(kit, target); } finally { fs.rmSync = originalRm; }
  assert.equal(fs.readFileSync(path.join(target, 'prompts', 'hailykit-baseline.md'), 'utf8'), 'committed prompt');
  assert.ok(fs.existsSync(path.join(target, 'hailykit-installed-pi-overlay.json')));
});

test('Pi overlay recovers on the next install after a leftover backup artifact', () => {
  const provider = new PiProvider();
  const target = path.join(tmp(), '.pi');
  provider.installOverlay(overlayKit(), target);
  const firstKit = overlayKit();
  fs.writeFileSync(path.join(firstKit, 'pi', 'prompts', 'hailykit-baseline.md'), 'faulted prompt', 'utf8');
  const originalRm = fs.rmSync;
  fs.rmSync = ((filePath: fs.PathLike, options?: fs.RmOptions) => {
    if (typeof filePath === 'string' && filePath.endsWith(path.join('prompts', 'hailykit-baseline.md.hailykit-old'))) {
      throw new Error('simulated cleanup failure');
    }
    return originalRm(filePath, options);
  }) as typeof fs.rmSync;
  try { provider.installOverlay(firstKit, target); } finally { fs.rmSync = originalRm; }
  assert.ok(overlayArtifacts(target).some((entry) => entry.endsWith(path.join('prompts', 'hailykit-baseline.md.hailykit-old'))));
  const secondKit = overlayKit();
  fs.writeFileSync(path.join(secondKit, 'pi', 'prompts', 'hailykit-baseline.md'), 'recovered prompt', 'utf8');
  provider.installOverlay(secondKit, target);
  assert.equal(fs.readFileSync(path.join(target, 'prompts', 'hailykit-baseline.md'), 'utf8'), 'recovered prompt');
  assert.deepEqual(overlayArtifacts(target), []);
});

test('Pi overlay uninstall leaves resources untouched when settings write fails', () => {
  const provider = new PiProvider();
  const target = path.join(tmp(), '.pi');
  provider.installOverlay(overlayKit(), target);
  const originalWrite = fs.writeFileSync;
  fs.writeFileSync = ((filePath: fs.PathOrFileDescriptor, data: string | NodeJS.ArrayBufferView, options?: fs.WriteFileOptions) => {
    if (typeof filePath === 'string' && filePath.endsWith('settings.json.hailykit-tmp')) throw new Error('simulated settings failure');
    return originalWrite(filePath, data, options);
  }) as typeof fs.writeFileSync;
  try { assert.throws(() => provider.uninstallOverlay(target), /simulated settings failure/); } finally { fs.writeFileSync = originalWrite; }
  assert.ok(fs.existsSync(path.join(target, 'extensions', 'hailykit', 'README.md')));
  assert.ok(fs.existsSync(path.join(target, 'prompts', 'hailykit-baseline.md')));
  assert.equal((readJson(path.join(target, 'settings.json')).hailykit as Record<string, unknown>).provider, 'pi');
});
