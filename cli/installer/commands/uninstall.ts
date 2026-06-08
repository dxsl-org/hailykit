import { resolveProviders } from '../providers/index.js';

export interface UninstallOptions {
  provider?: string;
  project?: boolean;
}

export async function cmdUninstall(options: UninstallOptions): Promise<void> {
  const providers = resolveProviders(options.provider || 'claude');
  const scope = options.project ? 'project' : 'global';
  console.log(`Uninstalling HailyKit [${scope}]`);

  for (const provider of providers) {
    const targetDir = options.project ? provider.projectDir() : provider.globalDir();
    console.log(`\n  [${provider.label}] ${targetDir}`);
    provider.uninstall(targetDir);
  }

  console.log('\n✓ Done');
}
