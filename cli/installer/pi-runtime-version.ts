import { compareVersions, parseVersion } from './providers/codex-version.js';
import type { ProcessRunResult } from './pi-runtime-types.js';

export function readVersionText(output: ProcessRunResult): string {
  const combined = `${output.stdout}\n${output.stderr}`.trim();
  const parsed = parseVersion(combined);
  if (!parsed) throw new Error(`Pi reported an unreadable version string: ${JSON.stringify(combined || '(empty)')}`);
  return `${parsed.major}.${parsed.minor}.${parsed.patch}${parsed.prerelease ? `-${parsed.prerelease}` : ''}`;
}

export function versionSatisfies(version: string, range: string): boolean {
  return range.split(/\s+/).filter(Boolean).every((token) => {
    const match = token.match(/^(<=|>=|<|>|=)?(.+)$/);
    if (!match || parseVersion(match[2]) === null) {
      throw new Error(`Invalid Pi supportedVersionRange token: ${JSON.stringify(token)}`);
    }
    const operator = match[1] || '=';
    const comparison = compareVersions(version, match[2]);
    switch (operator) {
      case '<': return comparison < 0;
      case '<=': return comparison <= 0;
      case '>': return comparison > 0;
      case '>=': return comparison >= 0;
      case '=': return comparison === 0;
      default: return false;
    }
  });
}
