import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { readFileSync } from 'node:fs';
import { loadModelMapOverrides } from '../converter.js';
import { extract, makeTempDir, resolveRoot } from '../extractor.js';
import { downloadZip, fetchRelease } from '../github.js';
import { mergeClaudeDir } from '../merger.js';
import { resolveProviders } from '../providers/index.js';
import type { Provider } from '../providers/index.js';
import { detectPiRuntime } from '../pi-runtime.js';
import { setupVenv } from '../venv.js';
import { selfUpgradeCliIfNeeded, syncCentralKitDir } from './self-upgrade.js';

export interface UpgradeOptions {
  provider?: string;
  project?: boolean;
  version?: string;
  noVenv?: boolean;
}

export interface UpgradeCommandDeps {
  resolveProviders: typeof resolveProviders;
  fetchRelease: typeof fetchRelease;
  downloadZip: typeof downloadZip;
  makeTempDir: typeof makeTempDir;
  extract: typeof extract;
  resolveRoot: typeof resolveRoot;
  selfUpgradeCliIfNeeded: typeof selfUpgradeCliIfNeeded;
  syncCentralKitDir: typeof syncCentralKitDir;
  loadModelMapOverrides: typeof loadModelMapOverrides;
  mergeClaudeDir: typeof mergeClaudeDir;
  setupVenv: typeof setupVenv;
  detectPiRuntime: typeof detectPiRuntime;
}

export const DEFAULT_UPGRADE_DEPS: UpgradeCommandDeps = {
  resolveProviders,
  fetchRelease,
  downloadZip,
  makeTempDir,
  extract,
  resolveRoot,
  selfUpgradeCliIfNeeded,
  syncCentralKitDir,
  loadModelMapOverrides,
  mergeClaudeDir,
  setupVenv,
  detectPiRuntime,
};

export interface PortableManifest {
  providerPathMigrations?: Array<{ provider: string; from: string; to: string }>;
}

export function readCurrentVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(path.join(__dirname, '..', '..', '..', 'package.json'), 'utf8')) as { version?: string };
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

export function readPortableManifest(extractedRoot: string): PortableManifest {
  const manifestPath = path.join(extractedRoot, 'portable-manifest.json');
  try {
    return JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as PortableManifest;
  } catch {
    return {};
  }
}

export function applyProviderPathMigrations(
  manifest: PortableManifest,
  provider: Provider,
  providerDir: string,
): void {
  const migrations = manifest.providerPathMigrations || [];
  const safeBase = path.resolve(os.homedir());
  for (const migration of migrations) {
    if (migration.provider !== provider.name) continue;
    const oldPath = path.resolve(os.homedir(), migration.from);
    if (!fs.existsSync(oldPath)) continue;
    const newDir = path.resolve(os.homedir(), migration.to);
    const newPath = migration.to.endsWith('/') || migration.to.endsWith(path.sep)
      ? path.join(newDir, path.basename(migration.from))
      : path.resolve(os.homedir(), migration.to);
    const isSafe = (targetPath: string): boolean => targetPath !== safeBase && targetPath.startsWith(safeBase + path.sep);
    if (!isSafe(oldPath) || !isSafe(newPath)) {
      console.warn(`  Skipped unsafe migration: ${migration.from} → ${migration.to}`);
      continue;
    }
    if (fs.existsSync(newPath)) continue;
    fs.mkdirSync(newDir, { recursive: true });
    fs.renameSync(oldPath, newPath);
    console.log(`  Migrated: ${migration.from} → ${migration.to}`);
  }
}

export async function filterUpgradeableProviders(
  providers: Provider[],
  detectRuntime: typeof detectPiRuntime,
): Promise<Provider[]> {
  const upgradeable: Provider[] = [];
  for (const provider of providers) {
    if (provider.name !== 'pi') {
      upgradeable.push(provider);
      continue;
    }
    const runtime = await detectRuntime();
    if (!runtime) {
      console.log('[Pi] Runtime missing — install official Pi first or rerun hailykit install.');
      continue;
    }
    if (!runtime.supported) {
      console.log(`[Pi] Runtime ${runtime.version} unsupported — upgrade official Pi before upgrading HailyKit.`);
      continue;
    }
    upgradeable.push(provider);
  }
  return upgradeable;
}
