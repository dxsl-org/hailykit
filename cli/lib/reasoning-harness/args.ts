import path from 'node:path';
import { getVariant } from './variants';
import type { RunnerOptions } from './types';

export function parseRunnerArgs(argv: string[]): RunnerOptions {
  const map = readArgs(argv);
  const variant = reqEnum(strArg(map.variant) ?? 'legacy', ['none', 'legacy', 'ultra-baseline', 'proposed', 'proposed-compressed']);
  return {
    cwd: process.cwd(),
    fixtures: path.resolve(strArg(map.fixtures) ?? path.join('cli', 'tests', 'fixtures', 'reasoning-harness')),
    out: path.resolve(req(strArg(map.out), '--out is required')),
    provider: reqEnum(strArg(map.provider) ?? 'codex', ['codex', 'gemini', 'ollama']),
    tier: reqEnum(strArg(map.tier) ?? getVariant(variant).tier, ['fast', 'medium', 'thinking', 'ultra']),
    variant,
    repeats: toInt(strArg(map.repeats) ?? '5', '--repeats'),
    model: strArg(map.model),
    timeoutMs: map.timeoutMs ? toInt(req(strArg(map.timeoutMs), '--timeout-ms'), '--timeout-ms') : 120000,
    live: Boolean(map.live),
    dryRun: Boolean(map['dry-run']),
    offlineScorePath: map['offline-score'] ? path.resolve(req(strArg(map['offline-score']), '--offline-score')) : undefined,
    approvedOfflineSource: map['approved-offline-source'] ? req(strArg(map['approved-offline-source']), '--approved-offline-source') : undefined,
    trustPhrases: listArg(map['trust-phrase']),
  };
}

function strArg(value: string | boolean | string[] | undefined): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function listArg(value: string | boolean | string[] | undefined): string[] {
  if (typeof value === 'string') return [value];
  return Array.isArray(value) ? value.filter((entry) => entry.trim()) : [];
}

function req(value: string | undefined, message: string): string { if (!value) throw new Error(message); return value; }
function toInt(value: string, flag: string): number { const n = Number(value); if (!Number.isInteger(n) || n <= 0) throw new Error(`${flag} must be a positive integer`); return n; }
function reqEnum<T extends string>(value: string, allowed: readonly T[]): T { if (!allowed.includes(value as T)) throw new Error(`invalid value: ${value}`); return value as T; }
function readArgs(argv: string[]): Record<string, string | boolean | string[]> {
  const out: Record<string, string | boolean | string[]> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) out[key] = true;
    else {
      out[key] = key in out ? [...listArg(out[key]), next] : next;
      i++;
    }
  }
  return out;
}
