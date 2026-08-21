import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { getAgentDir } from '@earendil-works/pi-coding-agent';
import { loadHailykitSettings } from './config.js';
import { registerDiagnostics } from './diagnostics.js';
import { registerPlan } from './plan/index.js';
import { registerPresets } from './presets/index.js';
import { registerSafety } from './safety/index.js';
import { type HailykitRuntime } from './shared-types.js';
import registerTask from './task/index.js';

export default function registerHailykit(pi: ExtensionAPI): void {
  const loaded = loadHailykitSettings(process.cwd(), getAgentDir());
  const runtime: HailykitRuntime = {
    settings: loaded.settings,
    warnings: loaded.warnings,
    planState: { enabled: false },
  };
  if (runtime.settings.modules.task) registerTask(pi);
  if (runtime.settings.modules.presets) registerPresets(pi, runtime, getAgentDir());
  if (runtime.settings.modules.safety) registerSafety(pi, runtime);
  if (runtime.settings.modules.plan) registerPlan(pi, runtime);
  if (runtime.settings.modules.diagnostics) registerDiagnostics(pi, runtime);
}
