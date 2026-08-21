import * as fs from 'node:fs';
import * as path from 'node:path';
import { CONFIG_DIR_NAME } from '@earendil-works/pi-coding-agent';
import { type HailykitSettings } from './shared-types.js';

const DEFAULTS: HailykitSettings = {
  modules: { task: true, plan: true, presets: true, safety: true, diagnostics: true },
  plan: { command: 'plan', readOnlyTools: ['read', 'grep', 'find', 'ls'] },
  safety: { requireProjectTrust: true, guardDirtyRepo: true, confirmDestructive: true, protectedPaths: ['.env', '.git/', 'secrets/', 'id_rsa'] },
  presets: {
    command: 'preset',
    defaultName: undefined,
    definitions: {
      plan: { tier: 'thinking', thinkingLevel: 'medium', tools: ['read', 'grep', 'find', 'ls'] },
      build: { tier: 'medium', thinkingLevel: 'medium', tools: ['read', 'grep', 'find', 'ls', 'edit', 'write', 'bash', 'task'] },
      review: { tier: 'thinking', thinkingLevel: 'medium', tools: ['read', 'grep', 'find', 'ls', 'bash'] },
    },
  },
};

function readJson(filePath: string): Record<string, unknown> | null {
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')) as Record<string, unknown>; } catch { return null; }
}

function pickBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function pickStrings(value: unknown, fallback: string[]): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0) : fallback;
}

export function loadHailykitSettings(cwd: string, agentDir: string): { settings: HailykitSettings; warnings: string[] } {
  const warnings: string[] = [];
  const globalPath = path.join(agentDir, 'settings.json');
  const projectPath = path.join(cwd, CONFIG_DIR_NAME, 'settings.json');
  const globalSettings = readJson(globalPath);
  const projectSettings = readJson(projectPath);
  if (fs.existsSync(globalPath) && !globalSettings) warnings.push('Malformed global settings; using defaults.');
  if (fs.existsSync(projectPath) && !projectSettings) warnings.push('Malformed project settings; using defaults.');
  if ((globalSettings && !('hailykit' in globalSettings)) || (projectSettings && !('hailykit' in projectSettings))) warnings.push('Missing hailykit settings block; using defaults.');
  const globalRaw = (globalSettings?.['hailykit'] as Record<string, unknown> | undefined) ?? {};
  const projectRaw = (projectSettings?.['hailykit'] as Record<string, unknown> | undefined) ?? {};
  const modules = globalRaw['modules'] as Record<string, unknown> | undefined;
  const plan = globalRaw['plan'] as Record<string, unknown> | undefined;
  const safety = globalRaw['safety'] as Record<string, unknown> | undefined;
  const presets = globalRaw['presets'] as Record<string, unknown> | undefined;
  const definitions = presets?.['definitions'] as Record<string, Record<string, unknown>> | undefined;
  const projectSafety = projectRaw['safety'] as Record<string, unknown> | undefined;
  const normalizedDefinitions = definitions ? Object.fromEntries(Object.entries(definitions).map(([name, value]) => [name, {
    tier: typeof value?.['tier'] === 'string' ? value['tier'] : undefined,
    thinkingLevel: typeof value?.['thinkingLevel'] === 'string' ? value['thinkingLevel'] : undefined,
    tools: pickStrings(value?.['tools'], []),
  }])) : DEFAULTS.presets.definitions;
  return {
    settings: {
      modules: {
        task: pickBoolean(modules?.['task'], DEFAULTS.modules.task),
        plan: pickBoolean(modules?.['plan'], DEFAULTS.modules.plan),
        presets: pickBoolean(modules?.['presets'], DEFAULTS.modules.presets),
        safety: pickBoolean(modules?.['safety'], DEFAULTS.modules.safety),
        diagnostics: pickBoolean(modules?.['diagnostics'], DEFAULTS.modules.diagnostics),
      },
      plan: {
        command: typeof plan?.['command'] === 'string' ? String(plan['command']) : DEFAULTS.plan.command,
        readOnlyTools: pickStrings(plan?.['readOnlyTools'], DEFAULTS.plan.readOnlyTools),
      },
      safety: {
        requireProjectTrust: pickBoolean(safety?.['requireProjectTrust'], DEFAULTS.safety.requireProjectTrust),
        guardDirtyRepo: pickBoolean(safety?.['guardDirtyRepo'], DEFAULTS.safety.guardDirtyRepo),
        confirmDestructive: pickBoolean(safety?.['confirmDestructive'], DEFAULTS.safety.confirmDestructive),
        protectedPaths: [...new Set([
          ...pickStrings(safety?.['protectedPaths'], DEFAULTS.safety.protectedPaths),
          ...pickStrings(projectSafety?.['protectedPaths'], []),
        ])],
      },
      presets: {
        command: typeof presets?.['command'] === 'string' ? String(presets['command']) : DEFAULTS.presets.command,
        defaultName: typeof presets?.['defaultName'] === 'string' ? String(presets['defaultName']) : DEFAULTS.presets.defaultName,
        definitions: Object.keys(normalizedDefinitions).length > 0 ? normalizedDefinitions : DEFAULTS.presets.definitions,
      },
    },
    warnings,
  };
}
