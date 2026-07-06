import { loadModelMapOverrides, getModelMap } from '../../installer/converter';
import os from 'node:os';
import path from 'node:path';
import { runTool } from '../spawn';
import type { CrossReviewConfig, LegName, ResolvedLeg } from './types';

/**
 * Turn a detected leg into a concrete reviewer whose provider differs from the
 * session's. Model comes from the model-map chain (built-in < installed kit <
 * user pin), matching how the installer resolves agent tiers — reused, not
 * duplicated. Gateway legs (opencode/cline) carry a `provider/` prefix; if that
 * provider equals the session's, the review would be theater, so we swap to a
 * built-in alternate or drop the leg. Leaf module.
 */

/** Fold provider aliases to one canonical id for the difference check. */
export function canonicalProvider(p: string): string {
  const k = p.trim().toLowerCase();
  if (k === 'claude' || k === 'anthropic') return 'anthropic';
  if (k === 'codex' || k === 'openai') return 'openai';
  if (k === 'gemini' || k === 'google' || k === 'antigravity') return 'google';
  if (k === 'ollama' || k === 'local') return 'local';
  return k;
}

/** Native (non-gateway) provider each leg speaks to. */
const LEG_PROVIDER: Partial<Record<LegName, string>> = {
  codex: 'openai', gemini: 'google', ollama: 'local',
};

const GATEWAY: ReadonlySet<LegName> = new Set(['opencode', 'cline']);

/** Provider-different fallback when a gateway's mapped model collides with the
 *  session (a Chinese-provider model is always distinct from anthropic/openai/
 *  google, and both gateways can route it). */
const GATEWAY_ALTERNATE: Record<'opencode' | 'cline', string> = {
  opencode: 'deepseek/deepseek-chat',
  cline: 'deepseek/deepseek-chat',
};

export interface ResolveDeps {
  getMap: (provider: string) => Record<string, string>;
  /** Locally-pulled ollama model names (empty when none / daemon down). */
  ollamaModels: () => string[];
}

/** Load the model-map chain and probe ollama — the real environment. */
export function realResolveDeps(): ResolveDeps {
  const userDir = process.env.HAILYKIT_HOME || path.join(os.homedir(), '.hailykit');
  loadModelMapOverrides(path.join(userDir, 'kit'));
  return {
    getMap: (provider) => getModelMap(provider) as unknown as Record<string, string>,
    ollamaModels: () => {
      const r = runTool('ollama', ['list'], { cwd: process.cwd(), timeoutMs: 5000 });
      if (r.status !== 0) return [];
      return r.stdout.split('\n').slice(1)
        .map(l => l.trim().split(/\s+/)[0])
        .filter(Boolean);
    },
  };
}

export interface ResolveOutcome {
  leg?: ResolvedLeg;
  /** Per-leg reasons a candidate was rejected (for a transparent skip log). */
  rejected: Array<{ cli: LegName; reason: string }>;
}

/**
 * Pick the first ladder-ordered leg whose provider differs from `sessionProvider`.
 * @param legs - detected, ladder-ordered candidate legs.
 * @param sessionProvider - the provider the caller is running under (e.g. "claude").
 * @param cfg - `.hl.json` overrides (forced reviewer/model/tier).
 * @param deps - injectable map + ollama probe (tests supply fakes).
 */
export function resolveLeg(
  legs: LegName[],
  sessionProvider: string,
  cfg: CrossReviewConfig,
  deps: ResolveDeps,
): ResolveOutcome {
  const session = canonicalProvider(sessionProvider);
  const tier = cfg.tier ?? 'thinking';
  const ordered = cfg.reviewer ? legs.filter(l => l === cfg.reviewer) : legs;
  const rejected: ResolveOutcome['rejected'] = [];

  for (const cli of ordered) {
    const picked = resolveOne(cli, session, tier, cfg, deps);
    if ('reason' in picked) { rejected.push({ cli, reason: picked.reason }); continue; }
    return { leg: picked, rejected };
  }
  return { rejected };
}

function resolveOne(
  cli: LegName,
  session: string,
  tier: string,
  cfg: CrossReviewConfig,
  deps: ResolveDeps,
): ResolvedLeg | { reason: string } {
  if (cli === 'ollama') {
    const installed = deps.ollamaModels();
    // Prefer an explicit config model (trust the user), else the mapped hint if
    // it is actually pulled, else the first installed model.
    const hint = cfg.model || deps.getMap('ollama')[tier];
    const model = cfg.model
      || (hint && installed.includes(hint) ? hint : undefined)
      || installed[0];
    if (!model) return { reason: 'no local ollama model pulled' };
    return { cli, model, provider: 'local' };
  }

  if (GATEWAY.has(cli)) {
    const model = cfg.model || deps.getMap(cli)[tier];
    if (!model) return { reason: 'no model mapped' };
    const prov = canonicalProvider(model.split('/')[0] || '');
    if (prov === session) {
      if (cfg.model) return { reason: `forced model ${model} shares session provider` };
      const alt = GATEWAY_ALTERNATE[cli as 'opencode' | 'cline'];
      const altProv = canonicalProvider(alt.split('/')[0] || '');
      // Guard the fallback too: if even the alternate matches the session, this
      // leg cannot give a different-provider review — drop it rather than fake one.
      if (altProv === session) return { reason: `no provider-different model for ${cli}` };
      return { cli, model: alt, provider: altProv };
    }
    return { cli, model, provider: prov };
  }

  // Native leg (codex/gemini): provider is fixed; difference is structural.
  const provider = LEG_PROVIDER[cli]!;
  if (provider === session) return { reason: `${cli} shares session provider ${session}` };
  const model = cfg.model || deps.getMap(cli)[tier];
  if (!model) return { reason: 'no model mapped' };
  return { cli, model, provider };
}
