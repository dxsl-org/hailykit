import * as os from 'node:os';
import * as path from 'node:path';
import { mergeClaudeDir, readMetadata } from '../merger.js';
import type { Provider } from './base.js';

/**
 * Claude Code provider — installs into ~/.claude/ or ./.claude/.
 * Uses the full merge strategy (SKILL.md format, hooks, everything).
 * Does NOT extend BaseProvider — it has a different install contract
 * and satisfies the Provider interface directly.
 */
export class ClaudeProvider implements Provider {
  get name(): string { return 'claude'; }
  get label(): string { return 'Claude Code'; }

  globalDir(): string { return path.join(os.homedir(), '.claude'); }
  projectDir(): string { return path.join(process.cwd(), '.claude'); }
  hooksSupported(): boolean { return true; }

  /** Full merge — not skill-by-skill like other providers. */
  install(extractedDir: string, targetDir: string, opts: { isUpgrade?: boolean } = {}): void {
    mergeClaudeDir(extractedDir, targetDir, opts);
  }

  readVersion(dir: string): string | null {
    const meta = readMetadata(dir);
    return meta.version ?? null;
  }

  // The install/upgrade commands bypass these methods for the claude provider,
  // but they must exist to satisfy the Provider interface.
  // SAFETY: unreachable in normal flow — commands branch on provider.name === 'claude'.
  installSkills(_e: string, _t: string): number { return 0; }
  installRules(_e: string, _t: string): void { /* no-op */ }
  installHooks(_e: string, _t: string): void { /* no-op */ }
  writeVersion(_dir: string, _version: string): void { /* no-op */ }
}
