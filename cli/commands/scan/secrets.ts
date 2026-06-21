import { collectTargets, scanTargets, type Finding } from './engine';
import { SECRET_PATTERNS, skipSecretFile, skipSecretMatch } from './patterns-secrets';
import { emit, ok, type Envelope } from '../../lib/json-output';

/**
 * `secrets` — scan the working tree (or `--staged`, pre-commit) for hardcoded
 * credentials. Exits non-zero when any secret is found so it can gate a commit.
 * Output is always redacted; the raw value never appears anywhere.
 *
 * Scope vs gitleaks: this is the fast local gate, not a full history scan —
 * keep `gitleaks` for deep/historical audits (see hc-security).
 */

export interface SecretsOptions {
  path: string;
  staged: boolean;
  json: boolean;
  exclude?: string[];
}

interface SecretsData { findings: Finding[]; scanned: number; }

export function cmdSecrets(opts: SecretsOptions): number {
  const { targets, warnings } = collectTargets({ path: opts.path, staged: opts.staged, exclude: opts.exclude });
  const findings = scanTargets(targets, {
    patterns: SECRET_PATTERNS,
    skipFile: skipSecretFile,
    skipMatch: skipSecretMatch,
  });
  emit(ok('secrets', { findings, scanned: targets.length }, warnings), opts.json, human);
  return findings.length > 0 ? 1 : 0;
}

function human(env: Envelope<SecretsData>): void {
  const { findings, scanned } = env.data;
  if (findings.length === 0) {
    console.log(`✓ No secrets found (${scanned} files scanned).`);
  } else {
    console.log(`✗ ${findings.length} potential secret(s) in ${scanned} files:`);
    for (const f of findings) {
      console.log(`  [${f.severity}] ${f.file}:${f.line}  ${f.ruleId}  ${f.masked}`);
    }
  }
  for (const w of env.warnings ?? []) console.log(`! ${w}`);
}
