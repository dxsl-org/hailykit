import fs from 'node:fs';
import path from 'node:path';
import type { EvalProvider, EvalTier } from './types';

type ModelMap = Record<string, Record<string, string>>;

/**
 * Resolve the exact model a baseline cell must run. `override` exists because a
 * provider's mapped tier model may not be installed locally (ollama), and a cell whose
 * requested model is not the model that answered is failed as `model_mismatch`.
 * @throws when no override is given and the tier has no `kit/model-map.json` entry
 */
export function resolveRequestedModel(provider: EvalProvider, tier: EvalTier, override?: string): string {
  if (override?.trim()) return override.trim();
  const map = loadModelMap();
  const providerMap = map[provider];
  const model = providerMap?.[tier];
  if (!model) throw new Error(`missing model-map entry for ${provider}:${tier}`);
  return model;
}

function loadModelMap(): ModelMap {
  const file = findModelMap();
  return JSON.parse(fs.readFileSync(file, 'utf8')) as ModelMap;
}

function findModelMap(): string {
  const candidates = [
    path.resolve(__dirname, '..', '..', '..', 'kit', 'model-map.json'),
    path.resolve(process.cwd(), 'kit', 'model-map.json'),
  ];
  for (const file of candidates) if (fs.existsSync(file)) return file;
  throw new Error('kit/model-map.json not found');
}
