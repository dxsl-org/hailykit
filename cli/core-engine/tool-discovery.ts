import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import type { NativeToolHandler, Tool, ToolManifest } from './types';
import { InvalidManifestError } from '../utils/errors';

const MANIFEST_FILENAME = 'tool.json';
const requireModule = createRequire(__filename);

/**
 * Discover tools under `rootDir`. Each immediate subdirectory containing a
 * `tool.json` is treated as one tool. Manifests are parsed eagerly; native
 * handler modules are wired as lazy loaders (required on first execution).
 *
 * @param rootDir - Directory whose subdirectories hold tool manifests.
 * @returns Discovered tools, ordered by directory name.
 * @throws {InvalidManifestError} when a manifest is malformed or incomplete.
 */
export function discoverTools(rootDir: string): Tool[] {
  if (!fs.existsSync(rootDir)) return [];
  const tools: Tool[] = [];
  for (const entry of fs.readdirSync(rootDir, { withFileTypes: true }).sort(byName)) {
    if (!entry.isDirectory()) continue;
    const dir = path.join(rootDir, entry.name);
    const manifestPath = path.join(dir, MANIFEST_FILENAME);
    if (!fs.existsSync(manifestPath)) continue;
    tools.push(toTool(parseManifest(manifestPath), dir));
  }
  return tools;
}

/**
 * Parse and validate a single manifest file.
 * @throws {InvalidManifestError} on parse error or schema violation.
 */
export function parseManifest(manifestPath: string): ToolManifest {
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (cause) {
    throw new InvalidManifestError(`Cannot parse ${manifestPath}`, { cause });
  }
  return validateManifest(raw, manifestPath);
}

function byName(a: fs.Dirent, b: fs.Dirent): number {
  return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
}

function validateManifest(raw: unknown, source: string): ToolManifest {
  if (typeof raw !== 'object' || raw === null) {
    throw new InvalidManifestError(`Manifest is not an object: ${source}`);
  }
  const m = raw as Record<string, unknown>;
  for (const field of ['id', 'name', 'description', 'version', 'kind'] as const) {
    if (typeof m[field] !== 'string') {
      throw new InvalidManifestError(`Manifest "${source}" missing string field "${field}"`);
    }
  }
  if (m.kind !== 'native' && m.kind !== 'external') {
    throw new InvalidManifestError(`Manifest "${source}" has invalid kind "${String(m.kind)}"`);
  }
  if (m.kind === 'native' && typeof m.entry !== 'string') {
    throw new InvalidManifestError(`Native tool "${source}" requires an "entry" field`);
  }
  if (m.kind === 'external' && typeof m.command !== 'string') {
    throw new InvalidManifestError(`External tool "${source}" requires a "command" field`);
  }
  return m as unknown as ToolManifest;
}

function toTool(manifest: ToolManifest, dir: string): Tool {
  if (manifest.kind === 'external') {
    // Resolve bundled script paths (command/args that exist on disk) against the
    // tool dir so `node uppercase.js` works regardless of the run cwd. Bare
    // commands on PATH (e.g. "node", "python3") and flags are left untouched.
    return { manifest: resolveExternalPaths(manifest, dir), baseDir: dir };
  }
  // SAFETY: validateManifest guarantees `entry` is a string for native tools.
  const entryPath = path.resolve(dir, manifest.entry as string);
  return {
    manifest,
    baseDir: dir,
    loadHandler: async () => {
      // Native handler modules export `handler` (preferred) or `default`.
      const mod = requireModule(entryPath) as Record<string, unknown>;
      const handler = (mod.handler ?? mod.default) as NativeToolHandler | undefined;
      if (typeof handler !== 'function') {
        throw new InvalidManifestError(
          `Native tool "${manifest.id}" entry "${manifest.entry}" exports no handler`,
        );
      }
      return handler;
    },
  };
}

/**
 * Rewrite relative command/args that point at files in `dir` to absolute paths.
 *
 * Resolution order:
 * 1. Absolute path → returned as-is.
 * 2. Relative value that resolves to an existing file under `dir` → absolutized.
 * 3. Relative value with path separators that does NOT exist → throws, because a
 *    slash-containing relative path is unambiguously meant to be a local file; silently
 *    passing it as a bare PATH lookup would execute the wrong binary.
 * 4. Bare name (no separators) that does NOT exist under `dir` → returned as-is
 *    (treated as a command on PATH, e.g. "node", "python3").
 *
 * @throws {InvalidManifestError} when a relative file path cannot be resolved.
 */
function resolveExternalPaths(manifest: ToolManifest, dir: string): ToolManifest {
  const absolutize = (value: string): string => {
    if (path.isAbsolute(value)) return value;
    const candidate = path.join(dir, value);
    if (fs.existsSync(candidate)) return candidate;
    // A value with separators was clearly intended as a relative file path; don't
    // silently fall back to a PATH lookup — that would execute an unexpected binary.
    if (value.includes('/') || value.includes('\\')) {
      throw new InvalidManifestError(
        `External tool "${manifest.id}" command/arg "${value}" not found relative to ${dir}`,
      );
    }
    return value;
  };
  return {
    ...manifest,
    // SAFETY: validateManifest guarantees `command` is a string for external tools.
    command: absolutize(manifest.command as string),
    args: manifest.args?.map(absolutize),
  };
}
