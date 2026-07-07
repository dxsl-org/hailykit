#!/usr/bin/env node
/**
 * haily-subagent.cjs — SubagentStart hook that injects agent-type-specific
 * context into every spawned subagent's system prompt.
 *
 * Reads HL_* env vars written by haily-session.cjs and builds a context block
 * (~200 tokens) tailored to the agent type. Output is consumed by Claude Code as
 * the SubagentStart additionalContext injection.
 *
 * Config key (isHookEnabled): 'subagent-init'  ← preserved as user config contract
 * Exit codes: 0 always (fail-open)
 *
 * @module haily-subagent
 */

'use strict';

try {
  const fs = require('node:fs');
  const { isHookEnabled, loadConfig, readSessionState } = require('./haily-lib/config.cjs');
  const { createHookTimer, logHookCrash } = require('./haily-lib/logger.cjs');
  const { getSections, buildIdSection, buildPlanSection, buildReportsSection,
    buildLangSection, buildRulesSection, buildVenvSection, buildNamingSection,
    buildPlanCliSection, buildTrustSection, buildPrefixSection, buildThinkSection,
    buildReasonSection, buildEconSection
  } = require('./haily-lib/subagent.cjs');

  // NOTE: config key 'subagent-init' preserved — user-facing contract
  if (!isHookEnabled('subagent-init')) process.exit(0);

  // NOTE: recursive-spawn guard — prevents subagents from injecting into their own children
  if (process.env.SUBAGENT_CONTEXT_INJECTOR_ACTIVE === '1') process.exit(0);

  async function main() {
    const timer = createHookTimer('haily-subagent');
    let data;
    try { data = JSON.parse(fs.readFileSync(0, 'utf8')); } catch { process.exit(0); }

    const agentType = data.agent_type || 'unknown';
    const agentId = data.agent_id || '';
    const sessionId = data.session_id || process.env.HL_SESSION_ID || '';

    const config = loadConfig({ includeProject: false });
    const env = process.env;

    // Resolve active plan via session state (not branch) for task list coordination
    let activePlan = env.HL_ACTIVE_PLAN || '';
    if (!activePlan && sessionId) {
      try {
        const state = readSessionState(sessionId);
        if (state?.activePlan) activePlan = state.activePlan;
      } catch { /* fail-open */ }
    }
    const enrichedEnv = { ...env, HL_ACTIVE_PLAN: activePlan };

    // Build sections for this agent type
    const sectionKeys = getSections(agentType);
    const BUILDERS = {
      id:         () => buildIdSection(agentType, agentId),
      plan:       () => buildPlanSection(config, enrichedEnv),
      reports:    () => buildReportsSection(enrichedEnv),
      lang:       () => buildLangSection(enrichedEnv),
      rules:      () => buildRulesSection(enrichedEnv),
      venv:       () => buildVenvSection(enrichedEnv),
      naming:     () => buildNamingSection(enrichedEnv),
      'plan-cli': () => buildPlanCliSection(agentType),
      trust:      () => buildTrustSection(config),
      prefix:     () => buildPrefixSection(enrichedEnv),
      think:      () => buildThinkSection(enrichedEnv),
      reason:     () => buildReasonSection(enrichedEnv),
      econ:       () => buildEconSection(),
    };

    const parts = sectionKeys
      .map((key) => BUILDERS[key]?.() || [])
      .filter((lines) => lines.length > 0)
      .map((lines) => lines.join('\n'));

    const context = parts.join('\n\n');

    if (process.env.SUBAGENT_DEBUG === '1') {
      process.stderr.write(`[haily-subagent] type=${agentType} sections=${sectionKeys.join(',')}\n`);
    }

    process.stdout.write(JSON.stringify({
      hookSpecificOutput: { hookEventName: 'SubagentStart', additionalContext: context }
    }) + '\n');

    timer.end({ status: 'ok', exit: 0, agentType, sectionCount: parts.length });
    process.exit(0);
  }

  main().catch((e) => { logHookCrash('haily-subagent', e); process.exit(0); });

} catch (e) {
  try { require('./haily-lib/logger.cjs').logHookCrash('haily-subagent', e); } catch { /* ignore */ }
  process.exit(0);
}
