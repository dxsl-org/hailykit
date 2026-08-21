import { execFileSync as defaultExecFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

type ExecFileSync = typeof defaultExecFileSync;

interface ExtractCommand {
  executable: string;
  args: string[];
}

export interface ExtractOptions {
  platform?: NodeJS.Platform;
  execFileSync?: ExecFileSync;
}

function resetDestination(destDir: string): void {
  if (fs.existsSync(destDir)) fs.rmSync(destDir, { recursive: true, force: true });
  fs.mkdirSync(destDir, { recursive: true });
}

function extractionCommands(platform: NodeJS.Platform, zipPath: string, destDir: string): ExtractCommand[] {
  if (platform === 'win32') {
    const ps = (value: string): string => value.replace(/'/g, "''");
    return [
      {
        executable: 'powershell',
        args: [
          '-NonInteractive',
          '-Command',
          `Expand-Archive -Force -LiteralPath '${ps(zipPath)}' -DestinationPath '${ps(destDir)}'`,
        ],
      },
      { executable: 'tar.exe', args: ['-xf', zipPath, '-C', destDir] },
      { executable: 'py.exe', args: ['-3', '-m', 'zipfile', '-e', zipPath, destDir] },
      { executable: 'python.exe', args: ['-m', 'zipfile', '-e', zipPath, destDir] },
    ];
  }

  return [
    { executable: 'unzip', args: ['-q', '-o', zipPath, '-d', destDir] },
    { executable: 'python3', args: ['-m', 'zipfile', '-e', zipPath, destDir] },
  ];
}

/**
 * Extract a zip file into a freshly-created destination directory.
 * Tries platform-native tools in order so one unavailable system module does
 * not block installation; each retry starts from an empty destination.
 *
 * @param zipPath - Absolute path to the zip file.
 * @param destDir - Destination directory, replaced if it already exists.
 * @param options - Test-only platform and process-runner overrides.
 * @throws When every extraction backend fails.
 */
export function extract(zipPath: string, destDir: string, options: ExtractOptions = {}): void {
  const platform = options.platform ?? process.platform;
  const execFileSync = options.execFileSync ?? defaultExecFileSync;
  let lastError: unknown;

  for (const command of extractionCommands(platform, zipPath, destDir)) {
    resetDestination(destDir);
    try {
      execFileSync(command.executable, command.args, { stdio: 'pipe' });
      return;
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(`Unable to extract archive: no ${platform} extraction backend succeeded`, {
    cause: lastError,
  });
}

/** Create a uniquely-named temp directory under the system temp directory. */
export function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'hailykit-'));
}

/**
 * Resolve the repository root when an archive nests its contents one level.
 *
 * @param dir - Directory to inspect.
 * @returns The repository root, which may be the input directory itself.
 */
export function resolveRoot(dir: string): string {
  if (fs.existsSync(path.join(dir, 'cli'))) return dir;
  const entries = fs.readdirSync(dir);
  if (entries.length === 1) {
    const sub = path.join(dir, entries[0]);
    if (fs.statSync(sub).isDirectory()) return sub;
  }
  return dir;
}
