import type { Pattern } from './engine';

/**
 * Hardcoded-secret patterns (ported from hc-security tech-secret-patterns.md).
 * All redact:true — matches are credentials. Every pattern is bounded
 * (no nested quantifiers) so matching is linear with the line length.
 */
export const SECRET_PATTERNS: Pattern[] = [
  { id: 'aws-access-key-id', severity: 'critical', redact: true, re: /AKIA[0-9A-Z]{16}/ },
  { id: 'aws-secret-access-key', severity: 'critical', redact: true, re: /aws[_-]?secret[_-]?access[_-]?key\s*[:=]\s*['"][A-Za-z0-9/+]{40}['"]/i },
  { id: 'github-token', severity: 'critical', redact: true, re: /gh[pousr]_[A-Za-z0-9_]{36,255}/ },
  { id: 'github-pat', severity: 'critical', redact: true, re: /github_pat_[A-Za-z0-9_]{22,}/ },
  { id: 'stripe-key', severity: 'critical', redact: true, re: /[sr]k_(live|test)_[0-9a-zA-Z]{24,}/ },
  { id: 'slack-token', severity: 'critical', redact: true, re: /xox[baprs]-[0-9a-zA-Z-]{10,}/ },
  { id: 'gcp-api-key', severity: 'high', redact: true, re: /AIza[0-9A-Za-z_-]{35}/ },
  { id: 'anthropic-key', severity: 'critical', redact: true, re: /sk-ant-[A-Za-z0-9_-]{40,}/ },
  { id: 'private-key-block', severity: 'critical', redact: true, re: /-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/ },
  { id: 'jwt-token', severity: 'high', redact: true, re: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/ },
  { id: 'generic-api-key', severity: 'medium', redact: true, re: /(api[_-]?key|apikey|api[_-]?secret)\s*[:=]\s*['"][A-Za-z0-9/+=]{16,}['"]/i },
  { id: 'db-url-credentials', severity: 'high', redact: true, re: /(postgres|mysql|mongodb|redis):\/\/[^:\s]+:[^@\s]+@/i },
  { id: 'hardcoded-password', severity: 'medium', redact: true, re: /(password|passwd|pwd)\s*[:=]\s*['"][^'"]{8,}['"]/i },
  { id: 'generic-secret', severity: 'medium', redact: true, re: /(secret|token|credential)\s*[:=]\s*['"][A-Za-z0-9/+=]{16,}['"]/i },
];

/**
 * Skip only documentation prose and test/spec CODE (which legitimately carries
 * fake keys). Deliberately does NOT skip `fixtures/`, `*.example`, or `*.env.*`
 * — real credentials hide exactly there, and this is a security gate.
 */
export function skipSecretFile(rel: string): boolean {
  return /\.(md|txt)$|\.(test|spec)\.[^/.]+$/i.test(rel);
}

/**
 * Skip a match whose VALUE is an obvious placeholder. Operates on the matched
 * text, not the whole line — so `const k = process.env.X || "sk_live_real…"`
 * is still flagged (the quoted real fallback matches; env-indirection alone,
 * being unquoted, never matches a credential pattern in the first place).
 */
export function skipSecretMatch(matchText: string): boolean {
  return /YOUR_|REPLACE_|PLACEHOLDER|<your|xxxxx|EXAMPLE|CHANGEME/i.test(matchText);
}
