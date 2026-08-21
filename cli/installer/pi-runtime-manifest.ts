import * as fs from 'node:fs';
import * as path from 'node:path';
import { parseVersion } from './providers/codex-version.js';
import type { PiRuntimeDeps, PiRuntimeManifest } from './pi-runtime-types.js';

function candidateManifestPaths(cwd: string): string[] {
  return [
    path.join(__dirname, '..', '..', 'kit', 'pi-runtime.json'),
    path.join(cwd, 'kit', 'pi-runtime.json'),
  ];
}

function validateStringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string' || entry.length === 0)) {
    throw new Error(`Invalid Pi runtime manifest: ${label} must be a non-empty string array.`);
  }
  return value;
}

export function validateManifest(raw: unknown): PiRuntimeManifest {
  const value = raw as Record<string, unknown>;
  if (typeof value !== 'object' || value === null) {
    throw new Error('Invalid Pi runtime manifest: expected an object.');
  }
  const command = value.command;
  const packageName = value.packageName;
  const packageVersion = value.packageVersion;
  const supportedVersionRange = value.supportedVersionRange;
  if (typeof command !== 'string' || !/^[A-Za-z0-9._-]+$/.test(command)) {
    throw new Error('Invalid Pi runtime manifest: command must be a safe executable name.');
  }
  if (typeof packageName !== 'string' || !/^@?[A-Za-z0-9._/-]+$/.test(packageName)) {
    throw new Error('Invalid Pi runtime manifest: packageName must be a safe npm package name.');
  }
  if (typeof packageVersion !== 'string' || parseVersion(packageVersion) === null) {
    throw new Error('Invalid Pi runtime manifest: packageVersion must be a semantic version.');
  }
  if (typeof supportedVersionRange !== 'string' || supportedVersionRange.trim().length === 0) {
    throw new Error('Invalid Pi runtime manifest: supportedVersionRange is required.');
  }
  return {
    command,
    packageName,
    packageVersion,
    supportedVersionRange,
    versionArgs: validateStringArray(value.versionArgs, 'versionArgs'),
    installArgs: validateStringArray(value.installArgs, 'installArgs'),
    timeoutMs: typeof value.timeoutMs === 'number' ? value.timeoutMs : undefined,
    maxBufferBytes: typeof value.maxBufferBytes === 'number' ? value.maxBufferBytes : undefined,
  };
}

export function readManifestFile(cwd: string): PiRuntimeManifest {
  for (const manifestPath of candidateManifestPaths(cwd)) {
    try {
      return validateManifest(JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as unknown);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue;
      throw error;
    }
  }
  throw new Error('Pi runtime manifest not found (expected kit/pi-runtime.json).');
}

export function resolveManifest(deps: PiRuntimeDeps, fallbackCwd: string): PiRuntimeManifest {
  return deps.manifest ?? readManifestFile(deps.paths?.cwd ?? fallbackCwd);
}
