import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { WorkflowArm } from './scheduler';

export interface WorkflowWorkspaces { rootDir: string; armCwd: Record<WorkflowArm, string>; cleanup(): void; }

export function createWorkflowWorkspaces(repoRoot: string, commits: Record<WorkflowArm, string>, requestedBase?: string): WorkflowWorkspaces {
  const base = validateTempBase(repoRoot, requestedBase);
  const rootDir = fs.mkdtempSync(path.join(base, 'workflow-benchmark-'));
  const armCwd = { base: path.join(rootDir, 'base'), candidate: path.join(rootDir, 'candidate') };
  const added: string[] = [];
  try {
    for (const arm of ['base', 'candidate'] as const) {
      execFileSync('git', ['worktree', 'add', '--detach', armCwd[arm], commits[arm]], { cwd: repoRoot, stdio: 'ignore' });
      added.push(armCwd[arm]);
    }
  } catch (error) {
    cleanupWorktrees(repoRoot, rootDir, added);
    throw error;
  }
  return { rootDir, armCwd, cleanup: () => cleanupWorktrees(repoRoot, rootDir, added) };
}

function validateTempBase(repoRoot: string, requestedBase: string | undefined): string {
  if (!requestedBase) return fs.realpathSync.native(os.tmpdir());
  const resolved = path.resolve(requestedBase);
  fs.mkdirSync(resolved, { recursive: true });
  if (fs.lstatSync(resolved).isSymbolicLink()) throw new Error('workflow temp base cannot be a symlink or junction');
  const real = fs.realpathSync.native(resolved);
  const repo = fs.realpathSync.native(repoRoot);
  const rel = path.relative(repo, real);
  if (rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))) throw new Error('workflow temp base must be outside the source repo');
  return real;
}

function cleanupWorktrees(repoRoot: string, rootDir: string, worktrees: string[]): void {
  for (const worktree of [...worktrees].reverse()) {
    const rel = path.relative(rootDir, worktree);
    if (rel.startsWith('..') || path.isAbsolute(rel)) continue;
    try { execFileSync('git', ['worktree', 'remove', '--force', worktree], { cwd: repoRoot, stdio: 'ignore' }); } catch { /* temp-root removal is the fallback */ }
  }
  fs.rmSync(rootDir, { recursive: true, force: true });
  try { execFileSync('git', ['worktree', 'prune'], { cwd: repoRoot, stdio: 'ignore' }); } catch { /* cleanup must not mask the run */ }
}
