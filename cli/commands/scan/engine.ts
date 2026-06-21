import path from 'node:path';
import { listFiles, readText } from '../../lib/fs-scan';
import { runGit, isGitRepo } from '../../lib/git';

/**
 * Shared regex-scan engine for the `secrets` and `vuln-scan` commands. One scope
 * resolver + one line scanner; the two commands differ only by their pattern
 * pack and filters (DRY).
 *
 * ReDoS guard: lines over MAX_LINE are skipped (a crafted long line cannot hang
 * the pre-commit gate). Redaction is an ENGINE invariant — a finding never
 * carries a raw secret value; `masked` is fixed-length and leaks no characters.
 */

export type Severity = 'critical' | 'high' | 'medium' | 'low';

export interface Pattern {
  id: string;
  severity: Severity;
  re: RegExp;
  /** Mask the matched text in output (true for credential patterns). */
  redact: boolean;
}

export interface Finding {
  file: string;
  line: number;
  ruleId: string;
  severity: Severity;
  /** Redacted match — safe to print. Never the raw secret. */
  masked: string;
}

export interface ScanConfig {
  patterns: Pattern[];
  /** Skip a whole file by relative path (e.g. tests, docs). */
  skipFile?: (relPath: string) => boolean;
  /** Skip a single line (e.g. comments). */
  skipLine?: (line: string) => boolean;
  /** Skip a specific match by its matched text (e.g. placeholder values). */
  skipMatch?: (matchText: string) => boolean;
}

export interface ScopeOptions {
  path: string;
  staged?: boolean;
  exclude?: string[];
}

const MAX_LINE = 4096;
const MAX_FINDINGS = 1000;
const SEVERITY_RANK: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 };

interface Target { path: string; text: string; }

/** Resolve the files to scan: staged set (pre-commit) or the working tree. */
export function collectTargets(opts: ScopeOptions): { targets: Target[]; warnings: string[] } {
  const root = path.resolve(opts.path);
  const warnings: string[] = [];
  const targets: Target[] = [];

  if (opts.staged) {
    if (!isGitRepo(root)) return { targets, warnings: ['not a git repository — nothing staged'] };
    const out = runGit(['diff', '--cached', '--name-only', '--diff-filter=ACM', '-z'], root) ?? '';
    for (const rel of out.split('\0').filter(Boolean)) {
      const { text, warning } = readText(path.join(root, rel));
      if (warning) warnings.push(warning);
      if (text !== null) targets.push({ path: rel.replace(/\\/g, '/'), text });
    }
    return { targets, warnings };
  }

  const { files, warnings: w } = listFiles(root, { exclude: opts.exclude, respectGitignore: true });
  warnings.push(...w);
  for (const f of files) {
    const { text, warning } = readText(f.abs, f.bytes + 1);
    if (warning) warnings.push(warning);
    if (text !== null) targets.push({ path: f.path, text });
  }
  return { targets, warnings };
}

/** Scan targets against a pattern pack. Returns severity-sorted, capped findings. */
export function scanTargets(targets: Target[], cfg: ScanConfig): Finding[] {
  const findings: Finding[] = [];
  for (const t of targets) {
    if (cfg.skipFile?.(t.path)) continue;
    const lines = t.text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].replace(/\r$/, '');
      if (line.length > MAX_LINE) continue; // ReDoS guard
      if (cfg.skipLine?.(line)) continue;
      for (const p of cfg.patterns) {
        const m = p.re.exec(line);
        if (!m) continue;
        if (cfg.skipMatch?.(m[0])) continue;
        findings.push({
          file: t.path,
          line: i + 1,
          ruleId: p.id,
          severity: p.severity,
          // redact:true → full mask. redact:false → show the construct but still
          // scrub any credential-length token embedded in the matched span, so a
          // secret sitting inside e.g. execSync("…token…" + x) is never printed.
          masked: p.redact ? maskValue(m[0]) : sanitizeSnippet(m[0]),
        });
        if (findings.length >= MAX_FINDINGS) {
          findings.sort(bySeverity);
          return findings;
        }
      }
    }
  }
  findings.sort(bySeverity);
  return findings;
}

function bySeverity(a: Finding, b: Finding): number {
  return SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || a.file.localeCompare(b.file) || a.line - b.line;
}

/** Fixed-length redaction — never echoes any character of the secret. */
function maskValue(s: string): string {
  return `***redacted(len=${s.length})***`;
}

/** Show a code construct but mask any embedded credential-length token (≥20 chars). */
function sanitizeSnippet(s: string): string {
  return s.trim().slice(0, 120).replace(/[A-Za-z0-9_\-/+=]{20,}/g, '***');
}
