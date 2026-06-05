import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fetchRelease, downloadZip } from '../github.js';
import { extract, makeTempDir, resolveRoot } from '../extractor.js';
import { mergeClaudeDir, readMetadata } from '../merger.js';
import { setupVenv } from '../venv.js';
import { resolveProviders } from '../providers/index.js';
import type { Provider } from '../providers/index.js';

export interface UpgradeOptions {
  provider?: string;
  project?: boolean;
  version?: string;
  noVenv?: boolean;
}

export interface PortableManifest {
  providerPathMigrations?: Array<{ provider: string; from: string; to: string }>;
}

/**
 * Read portable-manifest.json from the extracted release root.
 * Returns an empty manifest on missing file or parse error — callers
 * treat this as "no migrations declared" rather than a hard failure.
 *
 * @param extractedRoot - Path to the extracted release root dir.
 */
export function readPortableManifest(extractedRoot: string): PortableManifest {
  const p = path.join(extractedRoot, 'portable-manifest.json');
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8')) as PortableManifest;
  } catch {
    return {};
  }
}

/**
 * Apply declared provider path migrations to an installed provider directory.
 * Moves files/dirs from their old location to the new one when the old path
 * still exists but the new path does not yet — i.e. a one-time migration.
 *
 * Migration entry fields:
 *   provider  — must match provider.name
 *   from      — old path relative to home dir (e.g. ".codex/AGENTS.md")
 *   to        — new path relative to the user home dir (e.g. ".codex/agents/")
 *               trailing slash means destination is a directory; filename is preserved
 *
 * @param manifest     - Parsed portable-manifest.json.
 * @param provider     - The provider being upgraded.
 * @param providerDir  - Absolute path to provider's install dir.
 */
export function applyProviderPathMigrations(
  manifest: PortableManifest,
  provider: Provider,
  providerDir: string,
): void {
  const migrations = manifest.providerPathMigrations || [];
  const safeBase = path.resolve(os.homedir());

  for (const m of migrations) {
    if (m.provider !== provider.name) continue;

    // "from" paths are home-dir-relative (same convention as "to").
    const oldPath = path.resolve(os.homedir(), m.from);
    if (!fs.existsSync(oldPath)) continue;

    // "to" paths are relative to home dir (e.g. ".codex/agents/").
    const newDir = path.resolve(os.homedir(), m.to);
    // Trailing slash means directory target — keep original filename.
    const newPath = m.to.endsWith('/') || m.to.endsWith(path.sep)
      ? path.join(newDir, path.basename(m.from))
      : path.resolve(os.homedir(), m.to);

    // Reject paths that escape the home directory — defense against tampered manifests.
    const isSafe = (p: string): boolean =>
      p !== safeBase && p.startsWith(safeBase + path.sep);
    if (!isSafe(oldPath) || !isSafe(newPath)) {
      console.warn(`  Skipped unsafe migration: ${m.from} → ${m.to}`);
      continue;
    }

    if (fs.existsSync(newPath)) continue; // already migrated

    fs.mkdirSync(newDir, { recursive: true });
    fs.renameSync(oldPath, newPath);
    console.log(`  Migrated: ${m.from} → ${m.to}`);
  }
}

/**
 * Upgrade HailyKit for one or all providers.
 * Checks each provider's current version first; skips providers already
 * up to date or not yet installed.
 *
 * @param options - CLI options forwarded from the upgrade command.
 * @throws When the release fetch, download, or extraction fails.
 */
export async function cmdUpgrade(options: UpgradeOptions): Promise<void> {
  const providers = resolveProviders(options.provider || 'claude');
  const isProject = !!options.project;
  const tag = options.version || 'latest';

  const release = await fetchRelease(tag);
  const latestVer = release.tag_name.replace(/^v/, '');

  let needsDownload = false;
  for (const provider of providers) {
    const targetDir = isProject ? provider.projectDir() : provider.globalDir();
    const currentVer = provider.name === 'claude'
      ? (readMetadata(targetDir).version ?? null)
      : provider.readVersion(targetDir);

    if (!currentVer) {
      console.log(`[${provider.label}] Not installed — run: hailykit install --provider ${provider.name}`);
      continue;
    }
    if (currentVer === latestVer) {
      console.log(`[${provider.label}] Already up to date (${release.tag_name})`);
      continue;
    }
    console.log(`[${provider.label}] ${currentVer} → ${latestVer}`);
    needsDownload = true;
  }

  if (!needsDownload) {
    console.log('\n✓ All providers up to date.');
    return;
  }

  const tmpDir = makeTempDir();
  const zipPath = await downloadZip(release, tmpDir);

  try {
    console.log('  Extracting...');
    extract(zipPath, tmpDir);
    const root = resolveRoot(tmpDir);

    const extractedKitDir = path.join(root, 'kit');

    const manifest = readPortableManifest(root);

    for (const provider of providers) {
      const targetDir = isProject ? provider.projectDir() : provider.globalDir();

      if (provider.name === 'claude') {
        mergeClaudeDir(root, targetDir, { isUpgrade: true });
        if (!options.noVenv) setupVenv(targetDir);
      } else {
        if (!fs.existsSync(targetDir)) continue;
        applyProviderPathMigrations(manifest, provider, targetDir);
        provider.installSkills(extractedKitDir, targetDir);
        provider.installRules(extractedKitDir, targetDir);
        if (provider.hooksSupported()) provider.installHooks(extractedKitDir, targetDir);
        provider.writeVersion(targetDir, latestVer);
      }

      console.log(`  ✓ [${provider.label}] upgraded to ${release.tag_name}`);
    }

    console.log(`\n✓ Upgrade complete → ${release.tag_name}`);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}
