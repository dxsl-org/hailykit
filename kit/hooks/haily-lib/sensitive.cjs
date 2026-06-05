#!/usr/bin/env node
/**
 * sensitive.cjs — Sensitive-file detection logic for HailyKit hooks.
 *
 * Three-tier system:
 *   HARD_BLOCK — SSH keys, TLS certs, system passwords: always block, no bypass.
 *   WARN_ONLY  — .env, credentials.json, shell history: warn but allow.
 *   PATH_WARN  — Docker/K8s/GitHub CLI config matched by full path suffix: warn.
 *
 * Denylist updated with each HailyKit release. Report new vectors at:
 * https://github.com/dxsl-org/hailykit/issues
 *
 * @module sensitive
 */

'use strict';

const path = require('node:path');
const os = require('node:os');

// ═══════════════════════════════════════════════════════
// APPROVAL PREFIX
// ═══════════════════════════════════════════════════════

// NOTE: When a WARN-tier block fires, the hook instructs the model to retry with
// this prefix after user approval. The hook then strips the prefix and allows.
const APPROVAL_PREFIX = 'APPROVED:';

/** @param {string} filePath @returns {boolean} */
function hasApprovalPrefix(filePath) {
  return typeof filePath === 'string' && filePath.startsWith(APPROVAL_PREFIX);
}

/** @param {string} filePath @returns {string} */
function stripApprovalPrefix(filePath) {
  return hasApprovalPrefix(filePath) ? filePath.slice(APPROVAL_PREFIX.length) : filePath;
}

// ═══════════════════════════════════════════════════════
// PATTERN TIERS
// ═══════════════════════════════════════════════════════

// Files matching these patterns are safe even if the name looks sensitive.
const SAFE_PATTERNS = [
  /\.example$/i,   // .env.example, config.example
  /\.sample$/i,    // .env.sample
  /\.template$/i,  // .env.template
];

// NOTE: Hard block — no bypass mechanism. These should never be read by AI agents.
// NOTE: Patterns use (\.|$) instead of $ to catch double-extension renaming (e.g. private.key.json).
const HARD_BLOCK_PATTERNS = [
  /\.pem(\.|$)/i,                                         // TLS certificates
  /\.key(\.|$)/i,                                         // Private keys
  /\.p12(\.|$)/i, /\.pfx(\.|$)/i,                        // PKCS12 key bundles
  /^id_rsa/, /^id_dsa/, /^id_ecdsa/, /^id_ed25519/,     // SSH private keys
  /^authorized_keys$/,                                    // SSH authorized keys — allows SSH login
  /\.netrc(\.|$)/,                                        // curl/git credentials
  /wallet\.dat(\.|$)/i,                                   // crypto wallets
  /keystore\.json(\.|$)/i,                                // Ethereum keystores
  /htpasswd/i,                                            // Apache password files
  /^vault-token$/,                                        // HashiCorp Vault token
];

// NOTE: Warn only — agent may have legitimate need (debug, .env.example generation).
const WARN_PATTERNS = [
  /^\.env$/,               // .env exactly
  /^\.env\./,              // .env.local, .env.production, ...
  /credentials?\.json$/i,  // GCP, AWS credential files
  /secrets?\.json$/i,      // generic secret stores
  /^\.gitconfig$/,         // git config — credential.helper stores tokens here
  /^\.npmrc$/,             // npm auth tokens
  /^\.pypirc$/,            // PyPI upload credentials
  /^\.bash_history$/,      // shell command history — may contain inline passwords
  /^\.zsh_history$/,
  /^\.fish_history$/,
  // NOTE: master.key is already hard-blocked via the /\.key(\.|$)/ pattern above.
  /^gradle\.properties$/,  // Gradle build — often contains signing/repo credentials
];

// Full-path suffix patterns matched against the normalized path (not just basename).
// Used for credential files whose name alone is too generic (e.g. "config.json").
// NOTE: patterns use (^|\/|~\/) prefix to match absolute, relative, AND tilde-prefixed paths.
// NOTE: Add new entries here when new credential path conventions are discovered.
const CREDENTIAL_PATH_PATTERNS = [
  /(^|\/|~\/)\.docker\/config\.json$/i,   // Docker registry auth tokens
  /(^|\/|~\/)\.kube\/config$/i,            // Kubernetes cluster credentials
  /(^|\/|~\/)\.config\/gh\/hosts\.yml$/i, // GitHub CLI OAuth token
  /\/etc\/shadow$/,                         // Linux shadow password database
  /\/etc\/gshadow$/,                        // Linux group shadow passwords
];

// ═══════════════════════════════════════════════════════
// PATH CLASSIFICATION
// ═══════════════════════════════════════════════════════

/** @param {string} filePath @returns {boolean} */
function isSafeFile(filePath) {
  if (!filePath) return false;
  const name = path.basename(filePath);
  return SAFE_PATTERNS.some((p) => p.test(name));
}

/**
 * @param {string} filePath
 * @returns {'hard-block' | 'warn' | null}
 */
function classifyPath(filePath) {
  if (!filePath) return null;
  let normalized;
  try { normalized = decodeURIComponent(filePath.replace(/\\/g, '/')); } catch { normalized = filePath; }
  const name = path.basename(normalized);
  if (HARD_BLOCK_PATTERNS.some((p) => p.test(name))) return 'hard-block';
  if (WARN_PATTERNS.some((p) => p.test(name))) return 'warn';
  // Full-path suffix check for files whose basename alone is too generic.
  if (CREDENTIAL_PATH_PATTERNS.some((p) => p.test(normalized))) return 'warn';
  return null;
}

/** @returns {boolean} */
function isPrivacyBlockDisabled() {
  return process.env.PRIVACY_BLOCK_DISABLED === '1';
}

// ═══════════════════════════════════════════════════════
// PATH EXTRACTION
// ═══════════════════════════════════════════════════════

/**
 * Extract candidate file paths from a tool's input object.
 * Handles Read/Edit/Write (file_path), Glob/Grep (pattern/path), Bash (command).
 * @param {Object} input — tool_input from stdin
 * @param {string} toolName
 * @returns {string[]}
 */
function extractPaths(input, toolName) {
  if (!input) return [];
  const paths_ = [];

  if (input.file_path) paths_.push(input.file_path);
  if (input.path && input.path !== input.file_path) paths_.push(input.path);
  if (input.pattern) paths_.push(input.pattern);

  if (toolName === 'Bash' && input.command) {
    const cmd = input.command;
    const quoted = cmd.match(/["']([^"']+)["']/g);
    if (quoted) paths_.push(...quoted.map((q) => q.slice(1, -1)));
    // NOTE: Also check bare (unquoted) tokens against classifyPath so that names like
    // "id_rsa" and "server.key.bak" are caught even without path separators.
    const tokens = cmd.split(/\s+/).filter((t) => t && !t.startsWith('-') && !['&&', '||', ';', '|', '>', '<', '>>'].includes(t));
    for (const t of tokens) {
      if (t.startsWith('./') || t.startsWith('/') || classifyPath(t) !== null) {
        paths_.push(t);
      }
    }
  }

  return [...new Set(paths_)].filter(Boolean);
}

// ═══════════════════════════════════════════════════════
// MAIN ENTRY
// ═══════════════════════════════════════════════════════

/**
 * Detect writes (and optionally reads) to paths outside the project CWD.
 *
 * Write/Edit/MultiEdit outside CWD → reason: 'directory-escape' (always active).
 * Read/Glob/Grep outside CWD       → reason: 'read-scope'      (only when opts.warnReadScope).
 *
 * Allowlisted paths (never warned): ~/.claude/, os.tmpdir().
 *
 * @param {string} filePath
 * @param {string} toolName
 * @param {string} cwd
 * @param {{ warnReadScope?: boolean }} [opts]
 * @returns {{ action: 'warn', reason: 'directory-escape'|'read-scope', filePath: string } | null}
 */
function checkDirectoryEscape(filePath, toolName, cwd, opts = {}) {
  if (!filePath || !cwd) return null;

  const isWrite = ['Write', 'Edit', 'MultiEdit'].includes(toolName);
  const isRead  = opts.warnReadScope && ['Read', 'Glob', 'Grep'].includes(toolName);
  if (!isWrite && !isRead) return null;

  const resolved = path.resolve(cwd, filePath);
  const resolvedCwd = path.resolve(cwd);

  if (resolved === resolvedCwd || resolved.startsWith(resolvedCwd + path.sep)) return null;

  const home = os.homedir();
  const allowlisted = [path.join(home, '.claude'), os.tmpdir()];
  if (allowlisted.some(a => resolved === a || resolved.startsWith(a + path.sep))) return null;

  return { action: 'warn', reason: isWrite ? 'directory-escape' : 'read-scope', filePath: resolved };
}

/**
 * Check whether a tool access should be allowed, blocked, or warned.
 *
 * @param {Object} toolInput
 * @param {string} toolName
 * @param {string|null} [cwd]  - Project working directory; enables directory-escape detection.
 * @param {{ warnReadScope?: boolean }} [opts] - warnReadScope: also warn on Read/Glob/Grep outside CWD.
 * @returns {{ action: 'allow'|'block'|'warn', filePath: string|null, reason: string }}
 */
function checkPrivacy(toolInput, toolName, cwd = null, opts = {}) {
  if (isPrivacyBlockDisabled()) return { action: 'allow', filePath: null, reason: 'disabled' };

  const candidates = extractPaths(toolInput, toolName);
  for (const candidate of candidates) {
    // NOTE: APPROVED: prefix means the user explicitly granted access via AskUserQuestion.
    // Strip prefix and allow — do not re-check privacy for this path.
    if (hasApprovalPrefix(candidate)) {
      return { action: 'allow', filePath: stripApprovalPrefix(candidate), reason: 'approved' };
    }

    if (isSafeFile(candidate)) continue;

    const tier = classifyPath(candidate);

    // NOTE: Hard-block tier applies even for Bash — an agent must not exfiltrate
    // SSH keys or TLS certs regardless of tool. Warn tier remains warn-only in Bash
    // because developers legitimately run bash commands against .env files.
    if (tier === 'hard-block') {
      return { action: 'block', filePath: candidate, reason: 'critical-credential' };
    }

    if (tier === 'warn') {
      if (toolName === 'Bash') {
        return { action: 'warn', filePath: candidate, reason: 'sensitive-bash-command' };
      }
      // warn tier (.env, credentials.json)
      return { action: 'warn', filePath: candidate, reason: 'sensitive-file' };
    }

    // NOTE: directory-escape check runs only when cwd available and path tier is clean.
    if (cwd) {
      const escape = checkDirectoryEscape(candidate, toolName, cwd, opts);
      if (escape) return escape;
    }
  }

  return { action: 'allow', filePath: null, reason: 'clean' };
}

module.exports = {
  APPROVAL_PREFIX,
  SAFE_PATTERNS,
  HARD_BLOCK_PATTERNS,
  WARN_PATTERNS,
  CREDENTIAL_PATH_PATTERNS,
  checkPrivacy,
  checkDirectoryEscape,
  hasApprovalPrefix,
  stripApprovalPrefix,
  isSafeFile,
  classifyPath,
  isPrivacyBlockDisabled,
  extractPaths,
};
