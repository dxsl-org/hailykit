import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

/**
 * Resolve the hailykit home directory.
 *
 * Resolution order (mirrors install.ps1 / install.sh):
 *   1. HAILYKIT_HOME env var
 *   2. ~/.hailykit
 */
export function resolveHailyHome(): string {
  return process.env['HAILYKIT_HOME'] || path.join(os.homedir(), '.hailykit');
}

/**
 * Read the version field from a package.json file.
 * Returns null when the file is missing or unparseable.
 */
function readPackageVersion(pkgPath: string): string | null {
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as { version?: string };
    return typeof pkg.version === 'string' ? pkg.version : null;
  } catch {
    return null;
  }
}

/**
 * Compare two semver-like version strings (major.minor.patch).
 * Returns  1 when a > b, -1 when a < b, 0 when equal.
 * Non-numeric segments are treated as 0.
 */
function compareVersions(a: string, b: string): number {
  const parse = (v: string): number[] =>
    v.replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
  const [aMaj, aMin, aPatch] = parse(a);
  const [bMaj, bMin, bPatch] = parse(b);
  if (aMaj !== bMaj) return aMaj > bMaj ? 1 : -1;
  if (aMin !== bMin) return aMin > bMin ? 1 : -1;
  if (aPatch !== bPatch) return aPatch > bPatch ? 1 : -1;
  return 0;
}

/**
 * Attempt to self-upgrade the hailykit CLI binary from the extracted release.
 *
 * When the release ships a `dist/` directory whose version is strictly newer
 * than the currently running binary, it is copied into `HAILYKIT_HOME/dist/`
 * and this function returns `true` — the caller MUST exit and instruct the
 * user to re-run the command so the fresh binary takes effect.
 *
 * Returns `false` when:
 *   - no `dist/` directory is found in the release (catalog-only release)
 *   - the installed binary is already up to date
 *   - HAILYKIT_HOME cannot be determined or is the workspace itself
 *     (dev/test mode — skip to avoid clobbering the work tree)
 *
 * @param extractedRoot - Absolute path to the extracted release root (contains dist/, kit/, …)
 * @param currentVersion - Version string of the currently running binary.
 */
export function selfUpgradeCliIfNeeded(
  extractedRoot: string,
  currentVersion: string,
): boolean {
  const releaseDist = path.join(extractedRoot, 'dist');
  if (!fs.existsSync(releaseDist)) return false;

  const releasePkg = path.join(extractedRoot, 'package.json');
  const releaseVersion = readPackageVersion(releasePkg);
  if (!releaseVersion) return false;

  if (compareVersions(releaseVersion, currentVersion) <= 0) return false;

  const hailyHome = resolveHailyHome();

  // Safety guard: never overwrite the workspace dist/ (dev/test scenario).
  // When running from a workspace build, __dirname is <workspace>/dist/ — skip.
  const workspaceDist = path.resolve(__dirname);
  if (path.resolve(hailyHome, 'dist') === workspaceDist) return false;

  // Verify hailyHome looks like a real install (contains dist/bin.js).
  const homeBinJs = path.join(hailyHome, 'dist', 'bin.js');
  if (!fs.existsSync(homeBinJs)) return false;

  console.log(`\n  ↑ Updating hailykit CLI: ${currentVersion} → ${releaseVersion}`);
  const destDist = path.join(hailyHome, 'dist');
  fs.rmSync(destDist, { recursive: true, force: true });
  fs.cpSync(releaseDist, destDist, { recursive: true });

  // Also update package.json so the new binary reports the right version.
  const homePkg = path.join(hailyHome, 'package.json');
  if (fs.existsSync(releasePkg)) {
    fs.copyFileSync(releasePkg, homePkg);
  }

  console.log(`  ✓ CLI updated to ${releaseVersion} — re-run the command to continue.\n`);
  return true;
}
