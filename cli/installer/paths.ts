import * as os from 'node:os';
import * as path from 'node:path';

export const GLOBAL_CLAUDE_DIR = path.join(os.homedir(), '.claude');
export const PROJECT_CLAUDE_DIR = path.join(process.cwd(), '.claude');

/** Relative paths within a .claude/ dir never overwritten on upgrade. */
export const PROTECTED_PATHS: readonly string[] = [
  'settings.json',
  'settings.local.json',
  '.mcp.json',
  'session-state',
  'hooks/.logs',
];

/**
 * Returns true when a relative path inside a .claude/ dir is protected from
 * overwrite during upgrade.
 *
 * @param relPath - Path relative to the .claude/ root, using any separator.
 */
export function isProtected(relPath: string): boolean {
  const norm = relPath.replace(/\\/g, '/');
  return PROTECTED_PATHS.some(p => norm === p || norm.startsWith(p + '/'));
}

export interface ResolveTargetResult {
  dir: string;
  label: string;
}

/**
 * Resolve the target .claude/ directory from CLI options.
 *
 * @param options - Object with optional `project` flag.
 */
export function resolveTarget(options: { project?: boolean }): ResolveTargetResult {
  if (options.project) {
    return { dir: PROJECT_CLAUDE_DIR, label: 'project (.claude/)' };
  }
  return { dir: GLOBAL_CLAUDE_DIR, label: 'global (~/.claude/)' };
}
