#!/usr/bin/env node
/**
 * haily-state.cjs — Multi-event session state persistence hook.
 *
 * Routes three Claude Code hook events to the appropriate state action:
 *  - PostToolUse (Task|TodoWrite):  refresh statusline activity snapshot
 *  - Stop / SubagentStop:           persist full markdown state + refresh snapshot
 *  - SessionStart (legacy path):    emit saved state to stdout for context recovery
 *
 * Config key (isHookEnabled): 'session-state'  ← user-facing contract, kept from old name
 * Exit codes: 0 always (fail-open)
 *
 * @module haily-state
 */

'use strict';

try {
  const fs = require('node:fs');

  const { isHookEnabled } = require('./haily-lib/config.cjs');
  const { createHookTimer, logHookCrash } = require('./haily-lib/logger.cjs');
  const { persistState, loadState, refreshStatuslineSnapshot } = require('./haily-lib/state.cjs');
  const { readActivitySnapshot } = require('./haily-lib/statusline.cjs');
  const { readUsageCache, getCacheAgeMs } = require('./haily-lib/usage.cjs');

  // NOTE: config key 'session-state' preserved — user-facing contract
  if (!isHookEnabled('session-state')) process.exit(0);

  // Tool events that trigger a statusline snapshot refresh
  const TRACKED_POST_TOOL_EVENTS = new Set([
    'Task', 'TaskCreate', 'TaskUpdate', 'TodoWrite'
  ]);

  async function main() {
    const timer = createHookTimer('haily-state');
    let data;
    try { data = JSON.parse(fs.readFileSync(0, 'utf8')); } catch { process.exit(0); }

    const hookEvent = data.hook_event_name || '';
    const toolName = data.tool_name || '';
    const transcriptPath = data.transcript_path || null;
    const sessionId = data.session_id || process.env.HL_SESSION_ID || '';

    // ── PostToolUse: refresh snapshot when task/todo tools fire ─────────────
    if (hookEvent === 'PostToolUse') {
      if (TRACKED_POST_TOOL_EVENTS.has(toolName)) {
        await refreshStatuslineSnapshot(sessionId, data, transcriptPath);
      }
      // Always output continue:true — Claude Code needs this for PostToolUse
      process.stdout.write(JSON.stringify({ continue: true }) + '\n');
      timer.end({ status: 'ok', exit: 0, event: hookEvent, tool: toolName });
      process.exit(0);
    }

    // ── Stop / SubagentStop: persist full markdown snapshot ──────────────────
    if (hookEvent === 'Stop' || hookEvent === 'SubagentStop') {
      await persistState(sessionId, data, transcriptPath, hookEvent);

      // Best-effort session summary on Stop only (SubagentStop fires per agent
      // and would spam). Emitted via the `systemMessage` JSON field — the only
      // Stop-hook output Claude Code renders to the user; raw stdout shows in
      // transcript mode only.
      if (hookEvent === 'Stop') {
        try {
          const snap = readActivitySnapshot(sessionId);
          const parts = [];

          // sessionStart is an ISO string from the transcript — parse before math
          const startMs = snap?.sessionStart ? Date.parse(snap.sessionStart) : NaN;
          if (Number.isFinite(startMs) && Date.now() > startMs) {
            const durationMs = Date.now() - startMs;
            const mins = Math.floor(durationMs / 60000);
            const secs = Math.floor((durationMs % 60000) / 1000);
            parts.push(`⏱ ${mins}m ${secs}s`);
          }

          const agents = snap?.agents || [];
          const todos  = snap?.todos  || [];
          if (agents.length > 0) parts.push(`agents ${agents.filter(a => a.completedAt).length}/${agents.length}`);
          if (todos.length  > 0) parts.push(`tasks ${todos.filter(t => t.status === 'completed').length}/${todos.length}`);

          // Quota: only when the haily-usage cache is reasonably fresh (≤30 min)
          const usage = readUsageCache();
          if (usage && getCacheAgeMs(usage) <= 30 * 60 * 1000) {
            const quota = [];
            if (usage.fiveHour != null) quota.push(`5h ${usage.fiveHour}%`);
            if (usage.week     != null) quota.push(`wk ${usage.week}%`);
            if (quota.length > 0) parts.push(`quota ${quota.join(' · ')}`);
          }

          if (parts.length > 0) {
            process.stdout.write(JSON.stringify({ systemMessage: `📊 ${parts.join(' · ')}` }) + '\n');
          }
        } catch { /* fail silently — summary is informational only */ }
      }

      timer.end({ status: 'persist', exit: 0, event: hookEvent });
      process.exit(0);
    }

    // ── Legacy SessionStart safety path ─────────────────────────────────────
    // This fires when haily-session fails or is disabled; provides fallback
    // state recovery to stdout so Claude Code can restore context.
    if (hookEvent === 'SessionStart') {
      const source = data.source || 'startup';
      // Compact recovery already handled by haily-session — only emit on startup
      if (source === 'startup' || source === 'resume') {
        const savedState = loadState(sessionId);
        if (savedState) {
          process.stdout.write(`\n--- Previous Session State ---\n${savedState}\n--- End Session State ---\n`);
          process.stdout.write('Review above state from your last session. Continue where you left off or start fresh.\n');
        }
      }
      timer.end({ status: 'legacy-session-start', exit: 0 });
      process.exit(0);
    }

    // ── Unknown event: fail-open ─────────────────────────────────────────────
    timer.end({ status: 'skip', exit: 0, event: hookEvent });
    process.exit(0);
  }

  main().catch((e) => { logHookCrash('haily-state', e); process.exit(0); });

} catch (e) {
  try { require('./haily-lib/logger.cjs').logHookCrash('haily-state', e); } catch { /* ignore */ }
  process.exit(0);
}
