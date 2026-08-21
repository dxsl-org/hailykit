import { type ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { resolvePresetModel } from './resolve.js';
import { type HailykitRuntime } from '../shared-types.js';

function parseArgLine(argLine: string): string[] {
  return argLine.trim().split(/\s+/).filter(Boolean);
}

type ScopedModel = { provider: string; id: string } & Record<string, unknown>;
const THINKING_LEVELS = new Set(['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max']);

function scopedModels(ctx: Record<string, unknown>): ScopedModel[] {
  const scoped = Array.isArray(ctx['scopedModels']) ? ctx['scopedModels'] : [];
  return scoped
    .map((entry) => {
      const model = (entry as { model?: { provider?: string; id?: string } }).model;
      return model?.provider && model?.id ? model as ScopedModel : undefined;
    })
    .filter((value): value is ScopedModel => Boolean(value));
}

export function registerPresets(pi: ExtensionAPI, runtime: HailykitRuntime, agentDir: string): void {
  const api = pi as unknown as {
    registerCommand?(name: string, spec: Record<string, unknown>): void;
    registerFlag?(name: string, spec: Record<string, unknown>): void;
    on?(name: string, fn: Function): void;
    setActiveTools(tools: string[]): void;
    getFlag?(name: string): unknown;
    setModel?(model: ScopedModel): Promise<boolean>;
    setThinkingLevel?(level: string): void;
  };
  const applyPreset = async (name: string | undefined, ctx: Record<string, unknown>): Promise<string | undefined> => {
    const presetName = name || runtime.settings.presets.defaultName;
    if (!presetName) return 'No preset name provided.';
    const preset = runtime.settings.presets.definitions[presetName];
    if (!preset) return `Unknown preset "${presetName}".`;
    if (preset.thinkingLevel && !THINKING_LEVELS.has(preset.thinkingLevel)) return `Preset ${presetName}: invalid thinking level.`;
    const provider = (ctx['model'] as { provider?: string } | undefined)?.provider;
    const model = resolvePresetModel(agentDir, provider, preset.tier);
    const scoped = scopedModels(ctx);
    const selected = model && provider ? scoped.find((entry) => entry.provider === provider && entry.id === model) : undefined;
    if (model && provider && scoped.length > 0 && !selected) return `Preset ${presetName}: model ${model} unavailable.`;
    if (selected && api.setModel) {
      const applied = await api.setModel(selected);
      if (applied !== true) return `Preset ${presetName}: model change rejected.`;
    }
    if (preset.tools?.length) api.setActiveTools(preset.tools);
    if (preset.thinkingLevel && api.setThinkingLevel) api.setThinkingLevel(preset.thinkingLevel);
    runtime.activePreset = presetName;
    return model ? `Preset ${presetName}: model=${model}` : `Preset ${presetName} applied.`;
  };
  api.registerCommand?.(runtime.settings.presets.command, {
    description: 'Apply a HailyKit model/tool preset.',
    async handler(argLine: string, ctx: unknown) {
      const message = await applyPreset(parseArgLine(argLine)[0], ctx as Record<string, unknown>);
      if (message) (ctx as { ui?: { notify?(text: string): void } }).ui?.notify?.(message);
    },
  });
  api.registerFlag?.('hailykit-preset', {
    description: 'Apply a HailyKit preset on agent start.',
    type: 'string',
  });
  api.on?.('before_agent_start', async (_input: unknown, ctx: unknown) => {
    const flagValue = api.getFlag?.('hailykit-preset');
    await applyPreset(typeof flagValue === 'string' ? flagValue : undefined, ctx as Record<string, unknown>);
  });
}
