import * as fs from 'node:fs';
import * as path from 'node:path';
import { readMetadata } from '../merger.js';
import { requestedInstallerProvider } from '../default-provider.js';
import type { Provider } from '../providers/index.js';
import { reportOverlayInstall, type OverlayLifecycleProvider } from './overlay-lifecycle.js';
import {
  applyProviderPathMigrations,
  DEFAULT_UPGRADE_DEPS,
  filterUpgradeableProviders,
  readCurrentVersion,
  readPortableManifest,
  type UpgradeCommandDeps,
  type UpgradeOptions,
} from './upgrade-support.js';

/**
 * Upgrade HailyKit for one or all providers.
 * Checks each provider's current version first; skips providers already
 * up to date or not yet installed.
 *
 * @param options - CLI options forwarded from the upgrade command.
 * @throws When the release fetch, download, or extraction fails.
 */
export async function cmdUpgrade(options: UpgradeOptions, deps: UpgradeCommandDeps = DEFAULT_UPGRADE_DEPS): Promise<void> {
  const providers = deps.resolveProviders(requestedInstallerProvider(options.provider));
  const isProject = !!options.project;
  const tag = options.version || 'latest';

  const release = await deps.fetchRelease(tag);
  const latestVer = release.tag_name.replace(/^v/, '');

  let needsDownload = false;
  const upgradeableProviders = await filterUpgradeableProviders(providers, deps.detectPiRuntime);
  for (const provider of upgradeableProviders) {
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
    console.log(upgradeableProviders.length ? '\n✓ All providers up to date.' : '\n✓ Nothing to upgrade.');
    return;
  }

  const tmpDir = deps.makeTempDir();
  const zipPath = await deps.downloadZip(release, tmpDir);

  try {
    console.log('  Extracting...');
    const extractDir = path.join(tmpDir, 'extracted');
    deps.extract(zipPath, extractDir);
    const root = deps.resolveRoot(extractDir);

    const extractedKitDir = path.join(root, 'kit');

    // Self-upgrade the CLI binary if the release ships a newer version.
    if (deps.selfUpgradeCliIfNeeded(root, readCurrentVersion())) return;

    deps.syncCentralKitDir(extractedKitDir);

    // Must run before any agent conversion — resolveModel reads the merged map.
    deps.loadModelMapOverrides(extractedKitDir);

    const manifest = readPortableManifest(root);

    for (const provider of upgradeableProviders) {
      const targetDir = isProject ? provider.projectDir() : provider.globalDir();

      if (provider.name === 'claude') {
        deps.mergeClaudeDir(root, targetDir, { isUpgrade: true });
        if (!options.noVenv) deps.setupVenv(targetDir);
      } else {
        if (!fs.existsSync(targetDir)) continue;
        applyProviderPathMigrations(manifest, provider, targetDir);
        provider.installSkills(extractedKitDir, targetDir);
        provider.installRules(extractedKitDir, targetDir);
        if (provider.installAgents) provider.installAgents(extractedKitDir, targetDir);
        reportOverlayInstall(provider.label, (provider as OverlayLifecycleProvider).installOverlay?.(extractedKitDir, targetDir));
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
