#!/usr/bin/env node
/**
 * haily-usage.cjs — Keeps the 5h/weekly quota cache warm for the
 * statusline and session summary display.
 *
 * Fires on PostToolUse, UserPromptSubmit, and SessionStart. Throttles API
 * calls to 5 minutes for tool events and 1 minute for prompt/session events.
 * Always exits 0 (fail-open) — quota display is cosmetic, never blocking.
 *
 * Config key (isHookEnabled): 'haily-usage' — opt-in, default false.
 * Enable: set `"haily-usage": true` in haily.json hooks.
 * Requires: Claude Code with Pro / Max / Team / Enterprise subscription.
 *
 * @module haily-usage
 */

'use strict';

// Outer crash wrapper — always exit 0
try {
  const fs = require('node:fs');
  const { isHookEnabled } = require('./haily-lib/config.cjs');
  const { createHookTimer, logHookCrash } = require('./haily-lib/logger.cjs');
  const { getCacheAgeMs, readUsageCache, refreshUsageCache } = require('./haily-lib/usage.cjs');

  if (!isHookEnabled('haily-usage')) {
    process.stdout.write(JSON.stringify({ continue: true }) + '\n');
    process.exit(0);
  }

  // ── Throttle intervals ────────────────────────────────────────────────────
  // PostToolUse: refresh at most once per 5 minutes (low-noise background refresh)
  // UserPromptSubmit / SessionStart: refresh at most once per 1 minute
  const INTERVAL_TOOL_MS   = 5 * 60 * 1000;
  const INTERVAL_PROMPT_MS = 1 * 60 * 1000;

  function detectEvent(data = {}) {
    const eventName = typeof data.hook_event_name === 'string' ? data.hook_event_name : '';
    const source    = data.source === 'startup' || data.source === 'resume' ? data.source : '';
    const isSession = source !== '' || eventName === 'SessionStart';
    const isPrompt  = typeof data.prompt === 'string' || eventName === 'UserPromptSubmit' || isSession;
    const event     = isSession
      ? 'SessionStart'
      : eventName || (typeof data.prompt === 'string' ? 'UserPromptSubmit' : 'PostToolUse');
    return { event, isPromptLike: isPrompt };
  }

  function shouldFetch(isPromptLike) {
    const interval = isPromptLike ? INTERVAL_PROMPT_MS : INTERVAL_TOOL_MS;
    return getCacheAgeMs(readUsageCache()) >= interval;
  }

  async function main() {
    const timer = createHookTimer('haily-usage');

    let data = {};
    try {
      const raw = fs.readFileSync(0, 'utf8');
      if (raw.trim()) data = JSON.parse(raw);
    } catch { /* fail-open: use empty data */ }

    const { event, isPromptLike } = detectEvent(data);

    if (shouldFetch(isPromptLike)) {
      const result = await refreshUsageCache({ fetchTimeoutMs: 5000, userAgent: 'hailykit/haily-usage' });
      timer.end({ event, status: result.ok ? 'ok' : 'warn', exit: 0, note: result.note });
    } else {
      timer.end({ event, status: 'skip', exit: 0, note: 'throttled' });
    }

    process.stdout.write(JSON.stringify({ continue: true }) + '\n');
    process.exit(0);
  }

  main().catch((e) => {
    logHookCrash('haily-usage', e);
    process.stdout.write(JSON.stringify({ continue: true }) + '\n');
    process.exit(0);
  });

} catch (e) {
  try { require('./haily-lib/logger.cjs').logHookCrash('haily-usage', e); } catch { /* ignore */ }
  process.stdout.write(JSON.stringify({ continue: true }) + '\n');
  process.exit(0);
}
