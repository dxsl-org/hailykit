import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { cmdInstall } from '../installer/commands/install';
import { cmdStatus } from '../installer/commands/status';
import { cmdUpgrade } from '../installer/commands/upgrade';
import { cmdUninstall } from '../installer/commands/uninstall';

function tmp(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'haily-phase1-'));
}

function piProvider(root: string) {
  return {
    name: 'pi',
    label: 'Pi',
    globalDir: () => path.join(root, '.pi-agent'),
    projectDir: () => path.join(root, '.pi'),
    installSkills: () => 0,
    installRules: () => {},
    installHooks: () => {},
    hooksSupported: () => false,
    writeVersion: () => {},
    readVersion: () => null,
    uninstall: () => {},
  };
}

test('cmdInstall defaults to pi and bootstraps Pi runtime before provider install', async () => {
  const root = tmp();
  fs.mkdirSync(path.join(root, 'kit'), { recursive: true });
  let requested = '';
  let bootstrapped = 0;
  const provider = piProvider(root);

  await cmdInstall({}, {
    resolveProviders: (name) => { requested = name; return [provider as never]; },
    fetchRelease: async () => ({ tag_name: 'v1.2.3', assets: [], published_at: '', html_url: '' }),
    downloadZip: async () => path.join(root, 'release.zip'),
    makeTempDir: () => root,
    extract: () => {},
    resolveRoot: () => root,
    selfUpgradeCliIfNeeded: () => false,
    syncCentralKitDir: () => {},
    loadModelMapOverrides: () => {},
    mergeClaudeDir: () => ({}),
    setupVenv: () => {},
    ensurePiRuntime: async () => {
      bootstrapped++;
      return { commandPath: '/mock/pi', version: '0.84.2', supported: true, source: 'path' };
    },
  });

  assert.equal(requested, 'pi');
  assert.equal(bootstrapped, 1);
});

test('cmdStatus, cmdUpgrade, and cmdUninstall default to pi while preserving explicit all', async () => {
  const root = tmp();
  const provider = piProvider(root);
  const requested: string[] = [];

  await cmdStatus({}, {
    resolveProviders: (name) => { requested.push(name); return []; },
    fetchRelease: async () => ({ tag_name: 'v1.2.3', assets: [], published_at: '', html_url: '' }),
    detectPiRuntime: async () => null,
  });

  await cmdUpgrade({}, {
    resolveProviders: (name) => { requested.push(name); return [provider as never]; },
    fetchRelease: async () => ({ tag_name: 'v1.2.3', assets: [], published_at: '', html_url: '' }),
    downloadZip: async () => path.join(root, 'release.zip'),
    makeTempDir: () => root,
    extract: () => {},
    resolveRoot: () => root,
    selfUpgradeCliIfNeeded: () => false,
    syncCentralKitDir: () => {},
    loadModelMapOverrides: () => {},
    mergeClaudeDir: () => ({}),
    setupVenv: () => {},
    detectPiRuntime: async () => null,
  });

  await cmdUninstall({ provider: 'all' }, {
    resolveProviders: (name) => { requested.push(name); return []; },
    detectPiRuntime: async () => null,
  });

  assert.deepEqual(requested, ['pi', 'pi', 'all']);
});

test('cmdInstall preserves explicit claude without Pi bootstrap', async () => {
  const root = tmp();
  let requested = '';
  let bootstrapped = 0;

  await cmdInstall({ provider: 'claude' }, {
    resolveProviders: (name) => {
      requested = name;
      return [{
        name: 'claude',
        label: 'Claude',
        globalDir: () => path.join(root, '.claude'),
        projectDir: () => path.join(root, '.claude'),
      } as never];
    },
    fetchRelease: async () => ({ tag_name: 'v1.2.3', assets: [], published_at: '', html_url: '' }),
    downloadZip: async () => path.join(root, 'release.zip'),
    makeTempDir: () => root,
    extract: () => {},
    resolveRoot: () => root,
    selfUpgradeCliIfNeeded: () => false,
    syncCentralKitDir: () => {},
    loadModelMapOverrides: () => {},
    mergeClaudeDir: () => ({}),
    setupVenv: () => {},
    ensurePiRuntime: async () => {
      bootstrapped++;
      return { commandPath: '/mock/pi', version: '0.84.2', supported: true, source: 'path' };
    },
  });

  assert.equal(requested, 'claude');
  assert.equal(bootstrapped, 0);
});

test('cmdUpgrade never bootstraps Pi and stops before download when runtime is missing', async () => {
  const root = tmp();
  let detected = 0;
  let downloaded = 0;

  await cmdUpgrade({}, {
    resolveProviders: () => [piProvider(root) as never],
    fetchRelease: async () => ({ tag_name: 'v1.2.3', assets: [], published_at: '', html_url: '' }),
    downloadZip: async () => {
      downloaded++;
      return path.join(root, 'release.zip');
    },
    makeTempDir: () => root,
    extract: () => {},
    resolveRoot: () => root,
    selfUpgradeCliIfNeeded: () => false,
    syncCentralKitDir: () => {},
    loadModelMapOverrides: () => {},
    mergeClaudeDir: () => ({}),
    setupVenv: () => {},
    detectPiRuntime: async () => {
      detected++;
      return null;
    },
  });

  assert.equal(detected, 1);
  assert.equal(downloaded, 0);
});

test('cmdStatus and cmdUninstall only probe runtime state and never bootstrap', async () => {
  const root = tmp();
  let detected = 0;
  let uninstalled = 0;

  await cmdStatus({}, {
    resolveProviders: () => [piProvider(root) as never],
    fetchRelease: async () => ({ tag_name: 'v1.2.3', assets: [], published_at: '', html_url: '' }),
    detectPiRuntime: async () => {
      detected++;
      return null;
    },
  });

  await cmdUninstall({}, {
    resolveProviders: () => [{
      ...piProvider(root),
      uninstall: () => { uninstalled++; },
    } as never],
    detectPiRuntime: async () => {
      detected++;
      return null;
    },
  });

  assert.equal(detected, 2);
  assert.equal(uninstalled, 1);
});
