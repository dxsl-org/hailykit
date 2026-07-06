import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resolveExecutable, runTool } from '../spawn';
import type { LegName } from './types';
import { LADDER } from './types';

/**
 * Detection ladder: which reviewer CLIs are both installed and plausibly
 * authenticated. Auth checks are best-effort pre-filters — the real proof is the
 * invocation, so the orchestrator still falls through on a runtime failure. Auth
 * signals stay generous (env var OR a credential file) to avoid hiding a leg the
 * user has configured in a way we didn't anticipate. Leaf module.
 */

export interface DetectDeps {
  /** Returns true when `bin` resolves on PATH to a runnable file. */
  hasExecutable: (bin: string) => boolean;
  env: NodeJS.ProcessEnv;
  homeDir: string;
  exists: (p: string) => boolean;
  /** Probe the ollama daemon (its `list` exits 0 only when reachable). */
  ollamaReachable: () => boolean;
}

/**
 * Per-leg auth-readiness predicate. Deliberately permissive — an env key OR the
 * CLI's config directory existing counts as ready. A strict credential-file
 * check wrongly hides an OAuth-logged-in CLI (observed with gemini), and the
 * invocation is the real gate anyway (the orchestrator falls through on a
 * runtime failure), so the cost of a false positive is one wasted, time-bounded
 * spawn — cheaper than never trying a working reviewer.
 */
function authReady(leg: LegName, d: DetectDeps): boolean {
  const home = d.homeDir;
  switch (leg) {
    case 'codex':
      return !!d.env.OPENAI_API_KEY || d.exists(path.join(home, '.codex'));
    case 'gemini':
      return !!(d.env.GEMINI_API_KEY || d.env.GOOGLE_API_KEY)
        || d.exists(path.join(home, '.gemini'));
    case 'opencode':
      return d.exists(path.join(home, '.local', 'share', 'opencode'))
        || d.exists(path.join(home, '.config', 'opencode'))
        || hasAnyProviderKey(d.env);
    case 'cline':
      return d.exists(path.join(home, '.cline')) || hasAnyProviderKey(d.env);
    case 'ollama':
      return d.ollamaReachable();
  }
}

function hasAnyProviderKey(env: NodeJS.ProcessEnv): boolean {
  return !!(env.ANTHROPIC_API_KEY || env.OPENAI_API_KEY || env.OPENROUTER_API_KEY
    || env.GEMINI_API_KEY || env.GOOGLE_API_KEY || env.DEEPSEEK_API_KEY
    || env.DASHSCOPE_API_KEY || env.ZHIPUAI_API_KEY || env.MOONSHOT_API_KEY);
}

const LEG_BINARY: Record<LegName, string> = {
  codex: 'codex', gemini: 'gemini', opencode: 'opencode', cline: 'cline', ollama: 'ollama',
};

/** Default deps wired to the real environment. */
export function realDeps(): DetectDeps {
  return {
    hasExecutable: (bin) => {
      const r = resolveExecutable(bin);
      return typeof r === 'string';
    },
    env: process.env,
    homeDir: os.homedir(),
    exists: (p) => { try { return fs.existsSync(p); } catch { return false; } },
    ollamaReachable: () => runTool('ollama', ['list'], { cwd: process.cwd(), timeoutMs: 5000 }).status === 0,
  };
}

/**
 * Ladder-ordered legs that are installed AND pass their auth pre-filter.
 * @param deps - injectable environment (tests supply a fake).
 */
export function detectLegs(deps: DetectDeps = realDeps()): LegName[] {
  return LADDER.filter(leg => deps.hasExecutable(LEG_BINARY[leg]) && authReady(leg, deps));
}
