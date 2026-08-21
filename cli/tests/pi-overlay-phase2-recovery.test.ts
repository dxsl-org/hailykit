import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { PiProvider } from '../installer/providers/pi';
import { overlayArtifacts, overlayKit, readJson, tmp } from './pi-overlay-phase2-helpers';

test('Pi overlay cleans staged temp artifacts after a mid-stage failure', () => {
  const target = path.join(tmp(), '.pi');
  const kit = overlayKit();
  fs.rmSync(path.join(kit, 'pi', 'prompts', 'hailykit-baseline.md'));
  assert.throws(() => new PiProvider().installOverlay(kit, target), /missing/);
  assert.deepEqual(overlayArtifacts(target), []);
});

test('Pi overlay restores stale resources, settings, and state after late failure', () => {
  const provider = new PiProvider();
  const target = path.join(tmp(), '.pi');
  provider.installOverlay(overlayKit(), target);
  const kit = overlayKit();
  const manifestPath = path.join(kit, 'pi', 'overlay.json');
  const manifest = readJson(manifestPath);
  manifest.resources = (manifest.resources as unknown[]).filter((entry) => (entry as Record<string, unknown>).kind !== 'prompt');
  (manifest.settings as Record<string, unknown>).values = { hailykit: { provider: 'pi', overlay: 'baseline', prompt: 'changed' } };
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  const originalSettings = fs.readFileSync(path.join(target, 'settings.json'), 'utf8');
  const originalState = fs.readFileSync(path.join(target, 'hailykit-installed-pi-overlay.json'), 'utf8');
  const originalWrite = fs.writeFileSync;
  fs.writeFileSync = ((filePath: fs.PathOrFileDescriptor, data: string | NodeJS.ArrayBufferView, options?: fs.WriteFileOptions) => {
    if (typeof filePath === 'string' && filePath.endsWith('hailykit-installed-pi-overlay.json.hailykit-tmp')) throw new Error('simulated late failure');
    return originalWrite(filePath, data, options);
  }) as typeof fs.writeFileSync;
  try {
    assert.throws(() => provider.installOverlay(kit, target), /simulated late failure/);
  } finally {
    fs.writeFileSync = originalWrite;
  }
  assert.equal(fs.readFileSync(path.join(target, 'settings.json'), 'utf8'), originalSettings);
  assert.equal(fs.readFileSync(path.join(target, 'hailykit-installed-pi-overlay.json'), 'utf8'), originalState);
  assert.ok(fs.existsSync(path.join(target, 'prompts', 'hailykit-baseline.md')));
  assert.deepEqual(overlayArtifacts(target), []);
});
