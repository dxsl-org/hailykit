import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_INSTALLER_PROVIDER } from '../installer/default-provider';
import { validateManifest } from '../installer/pi-runtime';

const read = (...parts: string[]) => fs.readFileSync(path.join(process.cwd(), ...parts), 'utf8');

test('Phase 5 release contracts keep Pi as default and stage kit assets for release packing', () => {
  assert.equal(DEFAULT_INSTALLER_PROVIDER, 'pi');
  const script = read('scripts', 'package-release.mjs');
  assert.match(script, /const INCLUDE = \['package\.json', 'README\.md', 'LICENSE'\]/);
  assert.match(script, /cpSync\(join\(ROOT, 'kit'\), join\(STAGE_DIR, 'kit'\), \{ recursive: true \}\)/);
});

test('Phase 5 runtime manifest stays pinned to stock Pi and release overlay inventory is complete', () => {
  const runtime = validateManifest(JSON.parse(read('kit', 'pi-runtime.json')) as Record<string, unknown>);
  assert.equal(runtime.command, 'pi');
  assert.equal(runtime.packageName, '@earendil-works/pi-coding-agent');
  assert.equal(runtime.packageVersion, '0.84.2');
  assert.equal(runtime.supportedVersionRange, '>=0.84.2 <0.85.0');
  assert.match(runtime.installArgs.join(' '), /@earendil-works\/pi-coding-agent@0\.84\.2/);

  const overlay = JSON.parse(read('kit', 'pi', 'overlay.json')) as {
    compatibility: { runtimeRange: string };
    resources: Array<{ source: string; marker: string }>;
  };
  assert.equal(overlay.compatibility.runtimeRange, runtime.supportedVersionRange);
  for (const resource of overlay.resources) {
    assert.ok(fs.existsSync(path.join(process.cwd(), 'kit', 'pi', resource.source)), resource.source);
    assert.match(resource.marker, /\.hailykit-pi-overlay\.json$/);
  }
  for (const rel of [
    ['kit', 'pi', 'extensions', 'hailykit', 'index.ts'],
    ['kit', 'pi', 'extensions', 'hailykit', 'ATTRIBUTION.md'],
    ['kit', 'pi', 'prompts', 'hailykit-baseline.md'],
  ]) assert.ok(fs.existsSync(path.join(process.cwd(), ...rel)), rel.join('/'));
  assert.equal(
    read('kit', 'pi', 'extensions', 'hailykit', 'model-map.json'),
    read('kit', 'model-map.json'),
  );
  const attribution = read('kit', 'pi', 'extensions', 'hailykit', 'ATTRIBUTION.md');
  assert.match(attribution, /DeepSeek Harness: concepts only/i);
  assert.doesNotMatch(attribution, /source copied from DeepSeek/i);
});

test('Phase 5 user docs describe Pi default, Claude optional, trust boundaries, and deferred OMP-only extras', () => {
  const readme = read('README.md');
  assert.match(readme, /default Pi install/i);
  assert.match(readme, /hailykit install\s+# Pi \(default; bootstraps stock Pi if missing\)/);
  assert.match(readme, /--provider claude\s+# Claude Code \(optional\)/);
  assert.match(readme, /Open Pi after the default install/i);
  assert.match(readme, /\/skill:hc-plan → \/skill:hc-cook → \/skill:hc-test → \/skill:hc-review → \/skill:hc-ship/);
  assert.match(readme, /For Claude Code, use the same skill names with Claude's native/);
  assert.match(readme, /@earendil-works\/pi-coding-agent@0\.84\.2/);
  assert.match(readme, /supported range `>=0\.84\.2 <0\.85\.0`/);
  assert.match(readme, /stock Pi stays installed/i);
  assert.match(readme, /not an OS sandbox/i);
  assert.match(readme, /Untrusted projects stay fail-closed/i);
  assert.match(readme, /Deferred OMP-only extras/i);

  const matrix = read('docs', 'provider-support-matrix.md');
  assert.match(matrix, /Installer default: \*\*Pi\*\*/);
  assert.match(matrix, /Claude remains supported through `hailykit install --provider claude`/);
  assert.match(matrix, /\| \*\*Multi-agent \/ subagent spawn\*\* .* \| ✅ \| ✅ \|$/m);
  assert.match(matrix, /Runtime package: stock `@earendil-works\/pi-coding-agent@0\.84\.2`/);
  assert.match(matrix, /Included baseline overlay: native skills, prompts, runnable task\/subagent extension, plan mode, presets, diagnostics/);
  assert.match(matrix, /Pi event surface differs from Claude's hook names\./);
  assert.match(matrix, /They are fail-closed, but they are not an OS sandbox\./);
  assert.match(matrix, /Pi baseline does not claim OMP-only async hub, stronger harness-level isolation, prewalk, or advisor flows\./);
  assert.match(matrix, /\| \*\*Full\*\* \| Claude Code, Codex, Pi, OMP \|/);
});
