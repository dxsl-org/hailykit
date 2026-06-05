import * as fs from 'node:fs';
import * as path from 'node:path';
import { fetchRelease, downloadZip } from '../github.js';
import { extract, makeTempDir, resolveRoot } from '../extractor.js';
import { mergeClaudeDir } from '../merger.js';
import { setupVenv } from '../venv.js';
import { resolveProviders } from '../providers/index.js';

export interface InstallOptions {
  provider?: string;
  project?: boolean;
  version?: string;
  noVenv?: boolean;
}

/**
 * Install HailyKit for one or all providers.
 * For the claude provider: full merge strategy + optional venv setup.
 * For all other providers: convert skills, install rules, optionally install hooks.
 *
 * @param options - CLI options forwarded from the install command.
 * @throws When the release fetch, download, or extraction fails.
 */
export async function cmdInstall(options: InstallOptions): Promise<void> {
  const providers = resolveProviders(options.provider || 'claude');
  const isProject = !!options.project;
  const tag = options.version || 'latest';

  const providerLabels = providers.map(p => p.label).join(', ');
  console.log(`Installing HailyKit (${tag}) → ${isProject ? 'project' : 'global'} [${providerLabels}]`);

  const release = await fetchRelease(tag);
  console.log(`  Release: ${release.tag_name}`);

  const tmpDir = makeTempDir();
  const zipPath = await downloadZip(release, tmpDir);

  try {
    console.log('  Extracting...');
    extract(zipPath, tmpDir);
    const root = resolveRoot(tmpDir);

    const extractedKitDir = path.join(root, 'kit');

    for (const provider of providers) {
      const targetDir = isProject ? provider.projectDir() : provider.globalDir();
      console.log(`\n  [${provider.label}] → ${targetDir}`);

      if (provider.name === 'claude') {
        mergeClaudeDir(root, targetDir, { isUpgrade: false });

        // Project install: scaffold CLAUDE.md if missing.
        if (isProject) {
          const srcMd = path.join(root, 'CLAUDE.md');
          const destMd = path.join(process.cwd(), 'CLAUDE.md');
          if (fs.existsSync(srcMd) && !fs.existsSync(destMd)) {
            fs.copyFileSync(srcMd, destMd);
            console.log('    Created CLAUDE.md');
          }
        }

        if (!options.noVenv) setupVenv(targetDir);
      } else {
        if (!fs.existsSync(extractedKitDir)) {
          console.log('    Skipped — kit/ catalog dir not found in release');
          continue;
        }

        fs.mkdirSync(targetDir, { recursive: true });
        const count = provider.installSkills(extractedKitDir, targetDir);
        const skillFmt = provider.name === 'gemini' ? 'hl-*.toml commands'
          : provider.name === 'codex' ? 'SKILL.md files (invoke via $skill-name in chat)'
          : 'hl-*.md commands';
        console.log(`    Installed ${count} skills as ${skillFmt}`);

        provider.installRules(extractedKitDir, targetDir);
        console.log(`    Installed rules`);

        if (provider.installAgents) {
          provider.installAgents(extractedKitDir, targetDir);
          console.log(`    Installed agents`);
        }

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
