import * as fs from 'node:fs';
import * as path from 'node:path';
import { fetchRelease } from '../github.js';
import { readMetadata } from '../merger.js';
import { resolveProviders } from '../providers/index.js';

export interface StatusOptions {
  provider?: string;
}

/**
 * Print installation status for one or all providers, then fetch and show
 * the latest available release from Gitea.
 *
 * @param options - CLI options forwarded from the status command.
 */
export async function cmdStatus(options: StatusOptions): Promise<void> {
  const providers = resolveProviders(options.provider || 'all');

  console.log('HailyKit Installation Status\n');

  for (const provider of providers) {
    const dirs = [
      { scope: 'Global ', dir: provider.globalDir() },
      {
        scope: 'Project',
        dir: provider.name === 'claude'
          ? path.join(process.cwd(), '.claude')
          : provider.projectDir(),
      },
    ];

    for (const { scope, dir } of dirs) {
      if (!fs.existsSync(dir)) {
        console.log(`  [${provider.label}] ${scope}: not installed`);
        continue;
      }

      let ver: string;
      let date: string;

      if (provider.name === 'claude') {
        const meta = readMetadata(dir);
        ver = meta.version ? `v${meta.version}` : '(unknown)';
        date = meta.buildDate ? meta.buildDate.slice(0, 10) : '?';
      } else {
        const v = provider.readVersion(dir);
        ver = v ? `v${v}` : '(unknown)';
        date = '?';
        const metaPath = path.join(dir, '.hailykit-meta.json');
        if (fs.existsSync(metaPath)) {
          try {
            const m = JSON.parse(fs.readFileSync(metaPath, 'utf8')) as Record<string, unknown>;
            date = typeof m.installedAt === 'string' ? m.installedAt.slice(0, 10) : '?';
          } catch { /* leave date as '?' */ }
        }
      }

      console.log(`  [${provider.label}] ${scope}: ${ver}  (installed ${date})`);
    }
  }

  console.log('');

  try {
    const release = await fetchRelease('latest');
    const ver = release.tag_name;
    const date = release.published_at?.slice(0, 10) ?? '?';
    console.log(`  Latest release: ${ver}  (published ${date})`);
    console.log(`  ${release.html_url}`);
  } catch {
    console.log('  Latest release: (could not fetch — offline?)');
  }
}
