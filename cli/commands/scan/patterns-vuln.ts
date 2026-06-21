import type { Pattern } from './engine';

/**
 * Vulnerability code patterns (ported from hc-security tech-vulnerability-patterns.md).
 * A fast regex complement to semgrep — NOT a full AST replacement. redact:false
 * (matches are code constructs); only the matched substring is shown, never the
 * surrounding line, so an inline secret elsewhere on the line is not leaked.
 * `.*` patterns are single-quantifier and bounded by the engine's per-line cap.
 */
export const VULN_PATTERNS: Pattern[] = [
  { id: 'sql-injection-concat', severity: 'high', redact: false, re: /(query|sql|execute)\s*\([^)]*\+/i },
  { id: 'sql-injection-template', severity: 'high', redact: false, re: /(query|sql|execute)\s*\(`[^`]*\$\{/i },
  { id: 'xss-innerhtml', severity: 'medium', redact: false, re: /\.innerHTML\s*=/ },
  { id: 'xss-dangerously-set', severity: 'medium', redact: false, re: /dangerouslySetInnerHTML/ },
  { id: 'xss-document-write', severity: 'medium', redact: false, re: /document\.write\(/ },
  { id: 'command-injection', severity: 'high', redact: false, re: /(exec|execSync|spawn|spawnSync)\s*\([^)]*(\+|`[^`]*\$\{)/i },
  { id: 'py-os-system-concat', severity: 'high', redact: false, re: /os\.system\([^)]*\+/ },
  { id: 'py-subprocess-concat', severity: 'high', redact: false, re: /subprocess\.(call|run|Popen)\([^)]*\+/ },
  { id: 'path-traversal-userinput', severity: 'high', redact: false, re: /(readFile|writeFile|createReadStream|open)\s*\([^)]*req\.(params|query|body)/i },
  { id: 'insecure-randomness', severity: 'medium', redact: false, re: /Math\.random\(\)[^;\n]{0,80}(token|key|secret|password|session|nonce|salt)/i },
  { id: 'dangerous-eval', severity: 'high', redact: false, re: /\beval\s*\(/ },
  { id: 'dangerous-new-function', severity: 'medium', redact: false, re: /new\s+Function\s*\(/ },
  { id: 'unsafe-deserialization', severity: 'high', redact: false, re: /(pickle\.loads|yaml\.load\(|unserialize\()/i },
  { id: 'tls-verification-disabled', severity: 'high', redact: false, re: /rejectUnauthorized\s*:\s*false/i },
];

/** Docs/text files have no executable vulns. */
export function skipVulnFile(rel: string): boolean {
  return /\.(md|txt|json|lock)$/i.test(rel) || /\.(test|spec)\.[^/.]+$/i.test(rel);
}

/** Skip single-line comments (common false positives). */
export function skipVulnLine(line: string): boolean {
  const t = line.trim();
  return t.startsWith('//') || t.startsWith('#') || t.startsWith('*');
}
