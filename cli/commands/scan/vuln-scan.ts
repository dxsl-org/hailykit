import { collectTargets, scanTargets, type Finding } from './engine';
import { VULN_PATTERNS, skipVulnFile, skipVulnLine } from './patterns-vuln';
import { emit, ok, type Envelope } from '../../lib/json-output';

/**
 * `vuln-scan` — fast regex scan for common vulnerability patterns (SQLi, XSS,
 * command injection, path traversal, eval, unsafe deserialization, disabled
 * TLS). A complement to semgrep, NOT a replacement: no data-flow/AST analysis,
 * so treat findings as leads to verify. Informational — always exits 0.
 */

export interface VulnScanOptions {
  path: string;
  json: boolean;
  exclude?: string[];
}

interface VulnData { findings: Finding[]; scanned: number }

export function cmdVulnScan(opts: VulnScanOptions): number {
  const { targets, warnings } = collectTargets({ path: opts.path, exclude: opts.exclude });
  const findings = scanTargets(targets, {
    patterns: VULN_PATTERNS,
    skipFile: skipVulnFile,
    skipLine: skipVulnLine,
  });
  emit(ok('vuln-scan', { findings, scanned: targets.length }, warnings), opts.json, human);
  return 0;
}

function human(env: Envelope<VulnData>): void {
  const { findings, scanned } = env.data;
  if (findings.length === 0) {
    console.log(`✓ No vulnerability patterns matched (${scanned} files scanned).`);
  } else {
    console.log(`⚠ ${findings.length} potential issue(s) in ${scanned} files (verify — regex leads, not proof):`);
    for (const f of findings) {
      console.log(`  [${f.severity}] ${f.file}:${f.line}  ${f.ruleId}  ${f.masked}`);
    }
  }
  for (const w of env.warnings ?? []) console.log(`! ${w}`);
}
