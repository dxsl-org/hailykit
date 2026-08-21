import * as fs from 'node:fs';
import * as path from 'node:path';

function canonical(filePath: string): string {
  const resolved = path.resolve(filePath);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

function within(parent: string, child: string): boolean {
  const root = canonical(parent);
  const target = canonical(child);
  return target === root || target.startsWith(`${root}${path.sep}`);
}

export function resolveTaskCwd(parentCwd: string, requested?: string): string {
  const base = fs.realpathSync.native?.(parentCwd) ?? fs.realpathSync(parentCwd);
  if (!requested) return base;
  if (path.isAbsolute(requested)) throw new Error('Task cwd must be a relative path inside the trusted parent workspace.');
  const resolved = path.resolve(base, requested);
  if (!within(base, resolved)) throw new Error('Task cwd resolves outside the trusted parent workspace.');
  if (!fs.existsSync(resolved)) throw new Error(`Task cwd does not exist: ${requested}`);
  const real = fs.realpathSync.native?.(resolved) ?? fs.realpathSync(resolved);
  if (!within(base, real)) throw new Error('Task cwd resolves outside the trusted parent workspace.');
  if (!fs.statSync(real).isDirectory()) throw new Error(`Task cwd is not a directory: ${requested}`);
  return real;
}
