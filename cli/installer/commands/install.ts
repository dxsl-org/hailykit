import * as fs from 'node:fs';
import * as path from 'node:path';
import { readFileSync } from 'node:fs';
import { fetchRelease, downloadZip } from '../github.js';
import { extract, makeTempDir, resolveRoot } from '../extractor.js';
import { mergeClaudeDir } from '../merger.js';
import { loadModelMapOverrides } from '../converter.js';
import { requestedInstallerProvider } from '../default-provider.js';
import { setupVenv } from '../venv.js';
import { resolveProviders } from '../providers/index.js';
import { ensurePiRuntime } from '../pi-runtime.js';
import { reportOverlayInstall, type OverlayLifecycleProvider } from './overlay-lifecycle.js';
import { selfUpgradeCliIfNeeded, syncCentralKitDir } from './self-upgrade.js';

function readCurrentVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(path.join(__dirname, '..', '..', '..', 'package.json'), 'utf8')) as { version?: string };
    return pkg.version ?? '0.0.0';
  } catch { return '0.0.0'; }
}

export interface InstallOptions {
  provider?: string;
  project?: boolean;
  version?: string;
  noVenv?: boolean;
}

interface InstallCommandDeps {
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
  ensurePiRuntime: typeof ensurePiRuntime;
}

const DEFAULT_DEPS: InstallCommandDeps = {
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
  ensurePiRuntime,
};

/**
 * Install HailyKit for one or all providers.
 * For the claude provider: full merge strategy + optional venv setup.
 * For all other providers: convert skills, install rules, optionally install hooks.
 *
 * @param options - CLI options forwarded from the install command.
 * @throws When the release fetch, download, or extraction fails.
 */
export async function cmdInstall(options: InstallOptions, deps: InstallCommandDeps = DEFAULT_DEPS): Promise<void> {
  const providers = deps.resolveProviders(requestedInstallerProvider(options.provider));
  const isProject = !!options.project;
  const tag = options.version || 'latest';

  const providerLabels = providers.map(p => p.label).join(', ');
  console.log(`Installing HailyKit (${tag}) → ${isProject ? 'project' : 'global'} [${providerLabels}]`);

  const release = await deps.fetchRelease(tag);
  console.log(`  Release: ${release.tag_name}`);

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

    if (providers.some((provider) => provider.name === 'pi')) {
      const runtime = await deps.ensurePiRuntime();
      console.log(`  Pi runtime: ${runtime.version} (${runtime.commandPath})`);
    }

    deps.syncCentralKitDir(extractedKitDir);

    // Must run before any agent conversion — resolveModel reads the merged map.
    deps.loadModelMapOverrides(extractedKitDir);

    for (const provider of providers) {
      const targetDir = isProject ? provider.projectDir() : provider.globalDir();
      console.log(`\n  [${provider.label}] → ${targetDir}`);

      if (provider.name === 'claude') {
        deps.mergeClaudeDir(root, targetDir, { isUpgrade: false });

        // Project install: scaffold CLAUDE.md if missing.
        if (isProject) {
          const srcMd = path.join(root, 'CLAUDE.md');
          const destMd = path.join(process.cwd(), 'CLAUDE.md');
          if (fs.existsSync(srcMd) && !fs.existsSync(destMd)) {
            fs.copyFileSync(srcMd, destMd);
            console.log('    Created CLAUDE.md');
          }
        }

        if (!options.noVenv) deps.setupVenv(targetDir);
      } else {
        if (!fs.existsSync(extractedKitDir)) {
          console.log('    Skipped — kit/ catalog dir not found in release');
          continue;
        }

        fs.mkdirSync(targetDir, { recursive: true });
        const count = provider.installSkills(extractedKitDir, targetDir);
        const skillFmt = provider.name === 'gemini' ? 'hl-*.toml commands'
          : provider.name === 'codex' ? 'SKILL.md files (invoke via $skill-name in chat)'
          : provider.name === 'pi' || provider.name === 'omp' ? 'native SKILL.md directories'
          : 'hl-*.md commands';
        console.log(`    Installed ${count} skills as ${skillFmt}`);

        provider.installRules(extractedKitDir, targetDir);
        console.log(`    Installed rules`);

        if (provider.installAgents) {
          const result = provider.installAgents(extractedKitDir, targetDir);
          if (result) {
            const parts: string[] = [];
            if (result.installed > 0) parts.push(`installed ${result.installed}`);
            if (result.updated > 0) parts.push(`updated ${result.updated}`);
            if (result.migrated > 0) parts.push(`migrated ${result.migrated}`);
            if (result.skippedUser > 0) parts.push(`skipped user-owned ${result.skippedUser}`);
            if (result.skippedDuplicate > 0) parts.push(`skipped duplicate ${result.skippedDuplicate}`);
            console.log(`    Agents: ${parts.join(', ') || 'no changes'}`);
          } else {
            console.log(`    Installed agents`);
          }
        }

        reportOverlayInstall(provider.label, (provider as OverlayLifecycleProvider).installOverlay?.(extractedKitDir, targetDir));

        if (provider.hooksSupported()) {
          provider.installHooks(extractedKitDir, targetDir);
          console.log(`    Installed hooks`);
        }

        provider.writeVersion(targetDir, release.tag_name.replace(/^v/, ''));
      }

      console.log(`    ✓ ${provider.label} ready`);
    }

    console.log(`\n✓ HailyKit ${release.tag_name} installed`);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}
