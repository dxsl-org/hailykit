#!/usr/bin/env node
/**
 * haily-pii.cjs — UserPromptSubmit hook that warns when the prompt contains
 * personally identifiable information (PII) patterns.
 *
 * Never blocks — always exits 0. Emits a stderr warning listing categories found.
 * Designed for coding workspaces where developers may inadvertently paste customer
 * data, error logs, or config snippets that contain personal information.
 *
 * Detects:
 *   email     — addresses with a real TLD (excludes @scope/package, @decorator tokens)
 *   card      — Visa / Mastercard / Amex / Discover card numbers with separators
 *
 * Intentionally excluded:
 *   phone     — too many false positives in code (port numbers, version strings)
 *   API keys  — covered by sensitive-file-blocker at the file level
 *
 * Config key (isHookEnabled): 'haily-pii' — opt-in, disabled by default.
 * Enable: set `"haily-pii": true` in haily.json hooks.
 *
 * @module haily-pii
 */

'use strict';

const fs = require('node:fs');
const { isHookEnabled } = require('./haily-lib/config.cjs');
const { createHookTimer, logHookCrash } = require('./haily-lib/logger.cjs');

// ═══════════════════════════════════════════════════════
// PII DETECTORS
// ═══════════════════════════════════════════════════════

// NOTE: Conservative patterns — prefer fewer false positives over completeness.
// A coding workspace contains many numeric sequences and @-tokens that are not PII.
const DETECTORS = [
  {
    label: 'email address',
    // Requires: 2+ char local part, @, domain with letters-only TLD (2+ chars).
    // Excludes: @scope/package npm tokens (contain /), @decorator shorthands,
    //           package@version refs (numeric TLD like "28.0.0" — fails [a-zA-Z]{2,}).
    pattern: /\b[a-zA-Z0-9._%+\-]{2,}@[a-zA-Z0-9\-]{2,}\.[a-zA-Z]{2,}\b/g,
  },
  {
    label: 'credit/debit card number',
    // Visa (4xxx), Mastercard (51–55xx), Discover (6011/65xx): 4-4-4-4 with separator.
    // Amex (34/37xx): 4-6-5 format (15 digits total) — separate sub-pattern.
    // Requires separators so bare 16-digit database IDs without spacing are not flagged.
    pattern: /\b(?:(?:4[0-9]{3}|5[1-5][0-9]{2}|6(?:011|5[0-9]{2}))[- ][0-9]{4}[- ][0-9]{4}[- ][0-9]{4}|3[47][0-9]{2}[- ][0-9]{6}[- ][0-9]{5})\b/g,
  },
];

// ═══════════════════════════════════════════════════════
// DETECTION
// ═══════════════════════════════════════════════════════

/**
 * @param {string} text
 * @returns {{ label: string, count: number }[]}
 */
function detectPii(text) {
  return DETECTORS.flatMap(({ label, pattern }) => {
    const matches = text.match(pattern);
    return matches && matches.length > 0 ? [{ label, count: matches.length }] : [];
  });
}

// ═══════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════

try {
  if (!isHookEnabled('haily-pii')) process.exit(0);

  const timer = createHookTimer('haily-pii');

  let payload = {};
  try {
    const raw = fs.readFileSync(0, 'utf8').trim();
    if (raw) payload = JSON.parse(raw);
  } catch {
    timer.end({ status: 'skip', exit: 0, note: 'invalid-json' });
    process.exit(0);
  }

  const prompt = String(payload.prompt || payload.user_prompt || '').trim();
  if (!prompt) {
    timer.end({ status: 'skip', exit: 0, note: 'empty-prompt' });
    process.exit(0);
  }

  const findings = detectPii(prompt);
  if (findings.length === 0) {
    timer.end({ status: 'ok', exit: 0 });
    process.exit(0);
  }

  const list = findings
    .map(f => `  · ${f.label}: ${f.count} instance${f.count > 1 ? 's' : ''}`)
    .join('\n');

  process.stderr.write(
    `\x1b[33m[PII WARN]\x1b[0m Prompt may contain personal data:\n${list}\n` +
    `Review before sending — this message will be shared with Claude.\n` +
    `To disable: set \`"haily-pii": false\` in haily.json hooks.\n`
  );

  timer.end({ status: 'warn', exit: 0, findings: findings.map(f => f.label) });
  process.exit(0); // NOTE: never block — awareness only, developer decides

} catch (e) {
  try { require('./haily-lib/logger.cjs').logHookCrash('haily-pii', e); } catch { /* ignore */ }
  process.exit(0); // fail-open
}
