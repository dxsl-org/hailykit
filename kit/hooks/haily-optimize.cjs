#!/usr/bin/env node
/**
 * haily-optimize.cjs — UserPromptSubmit hook that warns/blocks when ship/commit verbs
 * appear while the working tree carries a large un-optimized diff.
 *
 * Hard-blocks (exit 2): ship, push, merge, pr, deploy, publish
 * Soft-warns (exit 0):  commit, finalize, release
 *
 * Negated phrasings ("don't ship", "never deploy") and "ship on" idioms are ignored.
 *
 * Config key (isHookEnabled): 'haily-optimize' — opt-in, disabled by default.
 * Enable: set `"haily-optimize": true` in haily.json hooks.
 * Bypass: set HL_OPTIMIZE_DISABLED=1 or disable the hook.
 *
 * @module haily-optimize
 */

'use strict';

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { isHookEnabled } = require('./haily-lib/config.cjs');
const { createHookTimer, logHookCrash } = require('./haily-lib/logger.cjs');

// ═══════════════════════════════════════════════════════
// THRESHOLDS
// ═══════════════════════════════════════════════════════

// Tier-keyed breach thresholds: a deep-tier (ultra) session already reasons at
// max budget so it earns the looser fail-safe default; unknown/empty tier
// (non-Claude or undetected sessions) gets the SAME fail-safe default rather
// than the tighter one — never tighten a gate against a session we can't
// confirm. Tiers below ultra get the tighter gate since normal-mode passes
// benefit most from an earlier nudge to simplify.
const THRESHOLDS_BY_TIER = {
  ultra:    { locDelta: 400, fileCount: 8, singleFileLoc: 200 },
  thinking: { locDelta: 250, fileCount: 5, singleFileLoc: 150 },
  medium:   { locDelta: 250, fileCount: 5, singleFileLoc: 150 },
  fast:     { locDelta: 250, fileCount: 5, singleFileLoc: 150 },
};
const DEFAULT_THRESHOLDS = THRESHOLDS_BY_TIER.ultra;

/** @returns {{locDelta:number, fileCount:number, singleFileLoc:number}} */
function resolveThresholds() {
  return THRESHOLDS_BY_TIER[process.env.HL_MODEL_TIER] || DEFAULT_THRESHOLDS;
}

const HARD_VERBS = ['ship', 'push', 'merge', 'pr', 'deploy', 'publish'];
const SOFT_VERBS = ['commit', 'finalize', 'release'];

// ═══════════════════════════════════════════════════════
// VERB DETECTION
// ═══════════════════════════════════════════════════════

function escapeRegex(v) {
  return v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** @returns {'hard'|'soft'|null} */
function matchedSeverity(prompt) {
  const allVerbs = [...HARD_VERBS, ...SOFT_VERBS];
  const negated = new RegExp(
    `\\b(?:don'?t|do not|never|not)\\s+(?:\\w+\\s+){0,2}(${allVerbs.map(escapeRegex).join('|')})\\b`,
    'i',
  );
  if (negated.test(prompt) || /\bship on\b/i.test(prompt)) return null;
  if (new RegExp(`\\b(${HARD_VERBS.map(escapeRegex).join('|')})\\b`, 'i').test(prompt)) return 'hard';
  if (new RegExp(`\\b(${SOFT_VERBS.map(escapeRegex).join('|')})\\b`, 'i').test(prompt)) return 'soft';
  return null;
}

// ═══════════════════════════════════════════════════════
// GIT DIFF SIGNALS
// ═══════════════════════════════════════════════════════

function gitLines(args, cwd) {
  try {
    return execFileSync('git', args, {
      cwd, encoding: 'utf8', timeout: 1500,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch { return ''; }
}

function computeSignals(cwd) {
  const tracked   = gitLines(['diff', '--numstat', 'HEAD', '--ignore-all-space'], cwd);
  const untracked = gitLines(['ls-files', '--others', '--exclude-standard'], cwd);

  let totalLoc = 0, maxFileLoc = 0;
  const files = new Set();

  for (const line of tracked.split('\n')) {
    if (!line.trim()) continue;
    const [addedStr, , file] = line.split('\t');
    const added = Number(addedStr) || 0;
    totalLoc += added + (Number(line.split('\t')[1]) || 0);
    if (added > maxFileLoc) maxFileLoc = added;
    if (file) files.add(path.normalize(file));
  }

  for (const file of untracked.split('\n')) {
    if (!file.trim()) continue;
    try {
      const content = fs.readFileSync(path.join(cwd, file.trim()), 'utf8');
      const lines = content.split('\n').length;
      totalLoc += lines;
      if (lines > maxFileLoc) maxFileLoc = lines;
      files.add(path.normalize(file.trim()));
    } catch { /* skip unreadable */ }
  }

  return { totalLoc, fileCount: files.size, maxFileLoc };
}

function evaluateBreaches(signals, thresholds) {
  return [
    signals.totalLoc      > thresholds.locDelta      && `${signals.totalLoc} LOC delta`,
    signals.fileCount     > thresholds.fileCount      && `${signals.fileCount} files changed`,
    signals.maxFileLoc    > thresholds.singleFileLoc  && `single file +${signals.maxFileLoc} LOC`,
  ].filter(Boolean);
}

// ═══════════════════════════════════════════════════════
// OUTPUT
// ═══════════════════════════════════════════════════════

function buildMessage(breaches, severity) {
  const noun = severity === 'hard' ? 'shipping' : 'committing';
  return [
    `[OPTIMIZE GATE] Un-optimized diff detected: ${breaches.join(', ')}.`,
    `Run /simplify on modified files before ${noun}:`,
    `  Task(subagent_type="haily-optimizer", prompt="Optimize: simplify, remove dead code, keep behavior identical: <files>")`,
    `Bypass: set HL_OPTIMIZE_DISABLED=1 or \`"haily-optimize": false\` in haily.json hooks.`,
  ].join('\n');
}

// ═══════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════

// Guarded so `require()` (unit tests) only loads the pure functions above
// without running the hook — it reads stdin and calls process.exit, which
// would hang/kill a test runner.
if (require.main === module) {
try {
  if (process.env.HL_OPTIMIZE_DISABLED === '1') process.exit(0);
  if (!isHookEnabled('haily-optimize')) process.exit(0);

  const timer = createHookTimer('haily-optimize');

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

  const severity = matchedSeverity(prompt);
  if (!severity) {
    timer.end({ status: 'skip', exit: 0 });
    process.exit(0);
  }

  const cwd = payload.cwd || process.cwd();
  const signals = computeSignals(cwd);
  const breaches = evaluateBreaches(signals, resolveThresholds());

  if (breaches.length === 0) {
    timer.end({ status: 'ok', exit: 0 });
    process.exit(0);
  }

  const message = buildMessage(breaches, severity);

  if (severity === 'hard') {
    process.stderr.write(`\x1b[31m${message}\x1b[0m\n`);
    timer.end({ status: 'block', exit: 2, breaches });
    process.exit(2);
  }

  // Soft warn: output to stdout so it appears as context in the conversation.
  process.stdout.write(message + '\n');
  timer.end({ status: 'warn', exit: 0, breaches });
  process.exit(0);

} catch (e) {
  try { require('./haily-lib/logger.cjs').logHookCrash('haily-optimize', e); } catch { /* ignore */ }
  process.exit(0); // fail-open
}
}

module.exports = { resolveThresholds, evaluateBreaches, matchedSeverity, computeSignals, THRESHOLDS_BY_TIER };
