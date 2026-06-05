import { ClaudeProvider } from './claude.js';
import { GeminiProvider } from './gemini.js';
import { CursorProvider } from './cursor.js';
import { WindsurfProvider } from './windsurf.js';
import { OpenCodeProvider } from './opencode.js';
import { AntigravityProvider } from './antigravity.js';
import { ZedProvider } from './zed.js';
import { CodexProvider } from './codex.js';
import type { Provider } from './base.js';

const PROVIDERS: Record<string, Provider> = {
  claude:      new ClaudeProvider(),
  gemini:      new GeminiProvider(),
  cursor:      new CursorProvider(),
  windsurf:    new WindsurfProvider(),
  opencode:    new OpenCodeProvider(),
  antigravity: new AntigravityProvider(),
  zed:         new ZedProvider(),
  codex:       new CodexProvider(),
};

export const PROVIDER_NAMES: string[] = Object.keys(PROVIDERS);

/**
 * Look up a single provider by name.
 * @throws When name is not a registered provider key.
 */
export function getProvider(name: string): Provider {
  const p = PROVIDERS[name];
  if (!p) {
    throw new Error(
      `Unknown provider: "${name}". Available: ${PROVIDER_NAMES.join(', ')}, all`,
    );
  }
  return p;
}

/**
 * Resolve "all" to every provider, or a single named provider.
 * @throws When name is not "all" and not a registered provider key.
 */
export function resolveProviders(name: string): Provider[] {
  if (name === 'all') return Object.values(PROVIDERS);
  return [getProvider(name)];
}

export { PROVIDERS };
export type { Provider };
