import * as fs from 'node:fs';
import * as path from 'node:path';

type ModelMap = Record<string, Record<string, string>>;
const PROVIDER_ALIASES: Record<string, string> = {
  anthropic: 'claude',
  'openai-codex': 'codex',
  google: 'gemini',
  'google-vertex': 'gemini',
};

function readModelMap(agentDir: string): ModelMap | null {
  try { return JSON.parse(fs.readFileSync(path.join(agentDir, 'extensions', 'hailykit', 'model-map.json'), 'utf8')) as ModelMap; } catch { return null; }
}

export function resolvePresetModel(
  agentDir: string,
  provider: string | undefined,
  tier: string | undefined,
): string | undefined {
  if (!provider || !tier) return undefined;
  const modelMap = readModelMap(agentDir);
  return modelMap?.[provider]?.[tier] ?? modelMap?.[PROVIDER_ALIASES[provider] ?? '']?.[tier];
}
