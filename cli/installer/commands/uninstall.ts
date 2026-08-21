import { requestedInstallerProvider } from '../default-provider.js';
import { resolveProviders } from '../providers/index.js';
import { detectPiRuntime } from '../pi-runtime.js';
import { reportOverlayUninstall, type OverlayLifecycleProvider } from './overlay-lifecycle.js';

export interface UninstallOptions {
  provider?: string;
  project?: boolean;
}

interface UninstallCommandDeps {
  resolveProviders: typeof resolveProviders;
  detectPiRuntime: typeof detectPiRuntime;
}

const DEFAULT_DEPS: UninstallCommandDeps = {
  resolveProviders,
  detectPiRuntime,
};

export async function cmdUninstall(options: UninstallOptions, deps: UninstallCommandDeps = DEFAULT_DEPS): Promise<void> {
  const providers = deps.resolveProviders(requestedInstallerProvider(options.provider));
  const scope = options.project ? 'project' : 'global';
  console.log(`Uninstalling HailyKit [${scope}]`);

  for (const provider of providers) {
    const targetDir = options.project ? provider.projectDir() : provider.globalDir();
    console.log(`\n  [${provider.label}] ${targetDir}`);
    if (provider.name === 'pi' && !await deps.detectPiRuntime()) {
      console.log('    Pi runtime missing — removing HailyKit overlay only');
    }
    reportOverlayUninstall(provider.label, (provider as OverlayLifecycleProvider).uninstallOverlay?.(targetDir));
    provider.uninstall(targetDir);
  }

  console.log('\n✓ Done');
}
