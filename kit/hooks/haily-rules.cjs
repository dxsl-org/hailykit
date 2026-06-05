#!/usr/bin/env node
/**
 * haily-rules.cjs — UserPromptSubmit hook that injects dev rules and session context.
 *
 * Fires on every user prompt. Delegates context building (TTL cooldown, contextual
 * rules injection, rules path resolution) entirely to context.cjs. Outputs
 * a plain-text rules block to stdout; Claude Code prepends it to the next turn context.
 *
 * TTL: 5-minute cooldown per scope (session+CWD) — context manages this.
 * Contextual rules (keyword-matched) always inject even during cooldown.
 *
 * Config key (isHookEnabled): 'dev-rules-reminder'  ← preserved as user config contract
 * Exit codes: 0 always (fail-open)
 *
 * @module haily-rules
 */

'use strict';

try {
  const fs = require('node:fs');
  const { isHookEnabled } = require('./haily-lib/config.cjs');
  const { createHookTimer, logHookCrash } = require('./haily-lib/logger.cjs');
  const { buildReminderContext } = require('./haily-lib/context.cjs');

  // NOTE: config key 'dev-rules-reminder' preserved — user-facing contract
  if (!isHookEnabled('dev-rules-reminder')) process.exit(0);

  async function main() {
    const timer = createHookTimer('haily-rules');
    let data;
    try { data = JSON.parse(fs.readFileSync(0, 'utf8')); } catch { process.exit(0); }

    const sessionId = data.session_id || process.env.HL_SESSION_ID || '';
    const prompt = data.prompt || '';
    const transcriptPath = data.transcript_path || null;

    // Delegate all context building + TTL logic to context
    let content = null;
    try {
      content = await buildReminderContext(sessionId, prompt, transcriptPath);
    } catch { /* fail-open — if context errors, skip injection */ }

    if (content) {
      process.stdout.write(content + '\n');
      timer.end({ status: 'injected', exit: 0 });
    } else {
      timer.end({ status: 'skip', exit: 0, note: 'cooldown-or-empty' });
    }

    process.exit(0);
  }

  main().catch((e) => { logHookCrash('haily-rules', e); process.exit(0); });

} catch (e) {
  try { require('./haily-lib/logger.cjs').logHookCrash('haily-rules', e); } catch { /* ignore */ }
  process.exit(0);
}
