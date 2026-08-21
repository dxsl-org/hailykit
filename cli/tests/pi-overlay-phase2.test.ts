import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { PiProvider } from '../installer/providers/pi';
import { overlayArtifacts, overlayKit, readJson, tmp } from './pi-overlay-phase2-helpers';

test('Pi overlay installs extensions, prompts, settings, and state manifest', () => {
  const kit = overlayKit();
  const target = path.join(tmp(), '.pi');
  const result = new PiProvider().installOverlay(kit, target);

  assert.equal(result.installed, 2);
  assert.equal(result.settingsChanged, true);
  assert.ok(fs.existsSync(path.join(target, 'extensions', 'hailykit', 'README.md')));
  assert.ok(fs.existsSync(path.join(target, 'prompts', 'hailykit-baseline.md')));
  assert.deepEqual(readJson(path.join(target, 'settings.json')).hailykit, {
    provider: 'pi',
    overlay: 'baseline',
    prompt: 'hailykit-baseline',
  });
  assert.equal((readJson(path.join(target, 'hailykit-installed-pi-overlay.json')).resources as unknown[]).length, 2);
});

test('Pi overlay preserves user prompt collisions and unrelated settings', () => {
  const kit = overlayKit();
  const target = path.join(tmp(), '.pi');
  fs.mkdirSync(path.join(target, 'prompts'), { recursive: true });
  fs.writeFileSync(path.join(target, 'prompts', 'hailykit-baseline.md'), 'user prompt', 'utf8');
  fs.writeFileSync(path.join(target, 'settings.json'), JSON.stringify({ user: { keep: true } }, null, 2));

  const result = new PiProvider().installOverlay(kit, target);

  assert.equal(result.skippedUser, 1);
  assert.equal(fs.readFileSync(path.join(target, 'prompts', 'hailykit-baseline.md'), 'utf8'), 'user prompt');
  assert.deepEqual(readJson(path.join(target, 'settings.json')), {
    user: { keep: true },
    hailykit: { provider: 'pi', overlay: 'baseline', prompt: 'hailykit-baseline' },
  });
});

test('Pi overlay reinstall removes stale managed resources when manifest shrinks', () => {
  const target = path.join(tmp(), '.pi');
  new PiProvider().installOverlay(overlayKit(), target);
  const kit = overlayKit();
  const manifestPath = path.join(kit, 'pi', 'overlay.json');
  const manifest = readJson(manifestPath);
  manifest.resources = (manifest.resources as unknown[]).filter((entry) => (entry as Record<string, unknown>).kind !== 'prompt');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

  const result = new PiProvider().installOverlay(kit, target);

  assert.equal(result.removed, 1);
  assert.ok(!fs.existsSync(path.join(target, 'prompts', 'hailykit-baseline.md')));
  assert.ok(fs.existsSync(path.join(target, 'extensions', 'hailykit', 'README.md')));
});

test('Pi overlay failed reinstall leaves the previous overlay intact', () => {
  const target = path.join(tmp(), '.pi');
  new PiProvider().installOverlay(overlayKit(), target);
  const beforePrompt = fs.readFileSync(path.join(target, 'prompts', 'hailykit-baseline.md'), 'utf8');
  const kit = overlayKit();
  fs.rmSync(path.join(kit, 'pi', 'prompts', 'hailykit-baseline.md'));

  assert.throws(() => new PiProvider().installOverlay(kit, target), /missing/);
  assert.equal(fs.readFileSync(path.join(target, 'prompts', 'hailykit-baseline.md'), 'utf8'), beforePrompt);
  assert.ok(fs.existsSync(path.join(target, 'extensions', 'hailykit', 'README.md')));
});

test('Pi overlay skips symlink collisions without traversing them', () => {
  const kit = overlayKit();
  const target = path.join(tmp(), '.pi');
  const outside = tmp();
  fs.mkdirSync(path.join(target, 'extensions'), { recursive: true });
  fs.mkdirSync(path.join(outside, 'hailykit'), { recursive: true });
  fs.symlinkSync(path.join(outside, 'hailykit'), path.join(target, 'extensions', 'hailykit'), 'junction');
  const result = new PiProvider().installOverlay(kit, target);

  assert.equal(result.skippedUser, 1);
  assert.equal(fs.lstatSync(path.join(target, 'extensions', 'hailykit')).isSymbolicLink(), true);
  assert.ok(fs.existsSync(path.join(target, 'prompts', 'hailykit-baseline.md')));
  assert.deepEqual(overlayArtifacts(target), []);
});

test('Pi overlay uninstall removes only owned resources and hailykit settings keys', () => {
  const target = path.join(tmp(), '.pi');
  new PiProvider().installOverlay(overlayKit(), target);
  fs.writeFileSync(path.join(target, 'settings.json'), JSON.stringify({
    user: { keep: true },
    hailykit: { provider: 'pi', overlay: 'baseline', prompt: 'hailykit-baseline' },
  }, null, 2));
  fs.writeFileSync(path.join(target, 'prompts', 'custom.md'), 'user', 'utf8');

  const result = new PiProvider().uninstallOverlay(target);

  assert.equal(result.removed, 2);
  assert.deepEqual(readJson(path.join(target, 'settings.json')), { user: { keep: true } });
  assert.ok(!fs.existsSync(path.join(target, 'extensions', 'hailykit')));
  assert.ok(fs.existsSync(path.join(target, 'prompts', 'custom.md')));
});

test('Pi overlay respects shared global roots and project roots', () => {
  const root = tmp();
  const previous = process.env['PI_CODING_AGENT_DIR'];
  const cwdBefore = process.cwd();
  process.env['PI_CODING_AGENT_DIR'] = path.join(root, 'shared-agent-dir');
  try {
    const provider = new PiProvider();
    fs.mkdirSync(provider.globalDir(), { recursive: true });
    fs.writeFileSync(path.join(provider.globalDir(), 'omp-owned.txt'), 'keep', 'utf8');
    const globalResult = provider.installOverlay(overlayKit(), provider.globalDir());
    assert.equal(globalResult.installed, 2);
    assert.ok(fs.existsSync(path.join(provider.globalDir(), 'omp-owned.txt')));
    const projectRoot = path.join(root, 'project');
    fs.mkdirSync(projectRoot, { recursive: true });
    process.chdir(projectRoot);
    const projectProvider = new PiProvider();
    const projectResult = projectProvider.installOverlay(overlayKit(), projectProvider.projectDir());
    assert.equal(projectResult.installed, 2);
    assert.ok(fs.existsSync(path.join(projectRoot, '.pi', 'extensions', 'hailykit', 'README.md')));
  } finally {
    process.chdir(cwdBefore);
    if (previous === undefined) delete process.env['PI_CODING_AGENT_DIR'];
    else process.env['PI_CODING_AGENT_DIR'] = previous;
  }
});

test('Pi overlay manifest rejects invalid owned keys and key mismatches', () => {
  const target = path.join(tmp(), '.pi');
  const kit = overlayKit();
  const manifestPath = path.join(kit, 'pi', 'overlay.json');
  const manifest = readJson(manifestPath);
  (manifest.settings as Record<string, unknown>).ownedKeys = ['hailykit', 'bad/key', 'hailykit'];

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  assert.throws(() => new PiProvider().installOverlay(kit, target), /ownedKeys|safe key|unique/i);

  (manifest.settings as Record<string, unknown>).ownedKeys = ['hailykit'];
  (manifest.settings as Record<string, unknown>).values = { other: true };
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  assert.throws(() => new PiProvider().installOverlay(kit, target), /exactly match/i);
});
