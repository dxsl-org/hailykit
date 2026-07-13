#!/usr/bin/env node
/**
 * haily-rules.cjs — UserPromptSubmit hook that injects dev rules and session context.
 *
 * Fires on every user prompt. Delegates context building (rules, standards,
 * contextual rules, paths, plan context, naming) to context.cjs, which returns
 * an options object — NOT a positional-args string API. Outputs a plain-text
 * rules block to stdout; Claude Code prepends it to the next turn context.
 *
 * TTL: 5-minute cooldown per scope (session+CWD), enforced here via
 * reserveInjectionScope/markRecentlyInjected/clearPendingInjection — context.cjs
 * exposes the helpers but does not call them itself. During cooldown, the heavy
 * builder (buildReminderContext — git subprocess, plan-context reads, standards
 * fs detection) is skipped entirely; only buildContextualRulesSection(prompt)
 * runs, so contextual (keyword-matched) rules still inject per the docstring
 * contract without paying for the discarded heavy sections.
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
  const {
    buildReminderContext,
    buildContextualRulesSection,
    buildInjectionScopeKey,
    reserveInjectionScope,
    markRecentlyInjected,
    clearPendingInjection
  } = require('./haily-lib/context.cjs');

  // NOTE: config key 'dev-rules-reminder' preserved — user-facing contract
  if (!isHookEnabled('dev-rules-reminder')) process.exit(0);

  async function main() {
    const timer = createHookTimer('haily-rules');
    let data;
    try { data = JSON.parse(fs.readFileSync(0, 'utf8')); } catch { process.exit(0); }

    const sessionId = data.session_id || process.env.HL_SESSION_ID || '';
    const prompt = data.prompt || '';
    const transcriptPath = data.transcript_path || null;
    const baseDir = process.cwd();

    let scopeKey = null;
    let reservation = { shouldInject: true, reserved: false };
    let output = null;
    let note = 'empty';

    try {
      scopeKey = buildInjectionScopeKey({ baseDir });
      reservation = reserveInjectionScope(sessionId, scopeKey, transcriptPath);

      if (reservation.shouldInject) {
        const result = await buildReminderContext({ sessionId, prompt, baseDir });
        output = result?.content || null;
        // Only burn the 5-min suppression window on a real, non-empty build —
        // an empty result (e.g. hooks config disables every section) must not
        // block the next turn from trying again.
        if (output) markRecentlyInjected(sessionId, scopeKey);
        note = output ? 'injected' : 'empty';
      } else {
        // Cooldown: skip buildReminderContext entirely — it runs a git
        // subprocess, plan-context file reads, and language/framework fs
        // detection just to have all of it discarded except contextualRules.
        // buildContextualRulesSection(prompt) with the default configDirName
        // ('.claude') is exactly what buildReminderContext's own
        // sections.contextualRules used to compute internally — calling it
        // directly keeps cooldown-turn output byte-equivalent.
        const contextualContent = buildContextualRulesSection(prompt).join('\n').trim();
        output = contextualContent || null;
        note = output ? 'contextual-during-cooldown' : 'cooldown';
      }
    } catch {
      // fail-open — if context errors, skip injection and release any reserved slot
      if (reservation.reserved) clearPendingInjection(sessionId, scopeKey);
      output = null;
      note = 'error';
    }

    if (output) {
      process.stdout.write(output + '\n');
      timer.end({ status: 'injected', exit: 0, note });
    } else {
      timer.end({ status: 'skip', exit: 0, note });
    }

    process.exit(0);
  }

  main().catch((e) => { logHookCrash('haily-rules', e); process.exit(0); });

} catch (e) {
  try { require('./haily-lib/logger.cjs').logHookCrash('haily-rules', e); } catch { /* ignore */ }
  process.exit(0);
}
