import * as os from 'node:os';
import * as path from 'node:path';
import { mergeClaudeDir, readMetadata } from '../merger.js';
import type { Provider } from './base.js';

/**
 * Claude Code provider — installs into ~/.claude/ or ./.claude/.
 * Uses the full merge strategy (SKILL.md format, hooks, everything).
 * Does NOT extend BaseProvider — it has a different install contract
 * and satisfies the Provider interface directly.
 *
 * Spec: 2.1.168 (2026-06-06) — daily patch cadence, do not pin to a specific build
 * Hook events: 30 as of 2.1.168 (SessionStart, Setup, UserPromptSubmit, UserPromptExpansion,
 *   PreToolUse, PermissionRequest, PermissionDenied, PostToolUse, PostToolUseFailure,
 *   PostToolBatch, Notification, MessageDisplay, SubagentStart, SubagentStop,
 *   TaskCreated, TaskCompleted, Stop, StopFailure, TeammateIdle, InstructionsLoaded,
 *   ConfigChange, CwdChanged, FileChanged, WorktreeCreate, WorktreeRemove,
 *   PreCompact, PostCompact, Elicitation, ElicitationResult, SessionEnd)
 * Docs: https://code.claude.com/docs/en/skills
 *       https://code.claude.com/docs/en/hooks
 *       https://code.claude.com/docs/en/changelog
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
