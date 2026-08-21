import { type ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { type HailykitRuntime } from './shared-types.js';

export function registerDiagnostics(pi: ExtensionAPI, runtime: HailykitRuntime): void {
  (pi as unknown as { registerCommand?(name: string, spec: Record<string, unknown>): void }).registerCommand?.('hailykit', {
    description: 'Show compact HailyKit Pi overlay diagnostics.',
    async handler(_args: string, ctx: unknown) {
      const summary = {
        modules: runtime.settings.modules,
        planMode: runtime.planState.enabled,
        activePreset: runtime.activePreset ?? null,
        trusted: (ctx as { isProjectTrusted?(): boolean }).isProjectTrusted?.() ?? false,
        warnings: runtime.warnings,
      };
      (ctx as { ui?: { notify?(text: string): void } }).ui?.notify?.(JSON.stringify(summary));
    },
  });
}
