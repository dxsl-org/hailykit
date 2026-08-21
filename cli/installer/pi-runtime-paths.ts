import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { PiRuntimeManifest, PiRuntimePaths, ProcessRunOptions } from './pi-runtime-types.js';
import { DEFAULT_MAX_BUFFER_BYTES, DEFAULT_TIMEOUT_MS } from './pi-runtime-process.js';

export function defaultPaths(): PiRuntimePaths {
  return {
    env: process.env,
    cwd: process.cwd(),
    homeDir: os.homedir(),
  };
}

export function runtimeOptions(manifest: PiRuntimeManifest): ProcessRunOptions {
  return {
    timeoutMs: manifest.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    maxBufferBytes: manifest.maxBufferBytes ?? DEFAULT_MAX_BUFFER_BYTES,
  };
}

export function executableNames(command: string): string[] {
  return process.platform === 'win32' ? [`${command}.cmd`, `${command}.exe`, command] : [command];
}

export function splitPathVariable(env: NodeJS.ProcessEnv): string[] {
  const raw = env['PATH'] || env['Path'] || '';
  return raw.split(path.delimiter).filter(Boolean);
}

export function knownBinDirs(paths: PiRuntimePaths): string[] {
  const dirs = new Set<string>();
  for (const part of splitPathVariable(paths.env)) dirs.add(part);
  dirs.add(path.join(paths.homeDir, '.local', 'bin'));
  dirs.add(path.join(paths.homeDir, '.npm-global', 'bin'));
  if (process.platform === 'darwin') dirs.add('/opt/homebrew/bin');
  if (process.platform !== 'win32') dirs.add('/usr/local/bin');
  const appData = paths.env['APPDATA'];
  if (process.platform === 'win32' && appData) dirs.add(path.join(appData, 'npm'));
  return [...dirs];
}

function isExecutable(candidate: string): boolean {
  try {
    const stat = fs.statSync(candidate);
    if (!stat.isFile()) return false;
    if (process.platform === 'win32') return true;
    return (stat.mode & 0o111) !== 0;
  } catch {
    return false;
  }
}

export function existingExecutable(
  command: string,
  dirs: string[],
  env: NodeJS.ProcessEnv,
): { commandPath: string; source: 'path' | 'known-bin' } | null {
  const names = executableNames(command);
  const pathDirs = splitPathVariable(env);
  for (const dir of dirs) {
    for (const name of names) {
      const candidate = path.join(dir, name);
      if (isExecutable(candidate)) {
        return {
          commandPath: candidate,
          source: pathDirs.includes(dir) ? 'path' : 'known-bin',
        };
      }
    }
  }
  return null;
}

export function npmInvocations(paths: PiRuntimePaths): Array<{ file: string; args: string[] }> {
  const invocations: Array<{ file: string; args: string[] }> = [];
  const npmExecPath = paths.env['npm_execpath'];
  if (npmExecPath) invocations.push({ file: process.execPath, args: [npmExecPath] });
  if (process.platform === 'win32') {
    invocations.push({ file: 'npm.cmd', args: [] });
    invocations.push({ file: 'npm', args: [] });
    return invocations;
  }
  invocations.push({ file: 'npm', args: [] });
  return invocations;
}
