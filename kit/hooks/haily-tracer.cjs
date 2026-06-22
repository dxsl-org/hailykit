#!/usr/bin/env node
/**
 * haily-tracer.cjs — PreToolUse hook that announces which model a subagent will run on.
 *
 * Fires when the Agent tool is called. Model resolution order: explicit `model`
 * in the tool input → agent frontmatter pin → session model (HL_SESSION_MODEL /
 * session state, captured by haily-session at SessionStart). Always announces —
 * agents inheriting the session model are shown too, not skipped:
 *   🤖 [haily-brainstormer]: thinking (claude-opus-4-8)
 *   🤖 [Explore]: medium (claude-sonnet-4-6)
 *
 * Opt-in: set `"model-tracer": true` in haily.json hooks to enable.
 * Config key (isHookEnabled): 'model-tracer'  — default false
 * Exit codes: 0 always (fail-open, never blocks)
 *
 * @module haily-tracer
 */

'use strict';

try {
  const fs   = require('node:fs');
  const path = require('node:path');
  const os   = require('node:os');

  const { isHookEnabled, readSessionState } = require('./haily-lib/config.cjs');
  const { createHookTimer, logHookCrash } = require('./haily-lib/logger.cjs');
  const { deriveTier } = require('./haily-lib/model.cjs');

  if (!isHookEnabled('model-tracer')) process.exit(0);

  // ── Session model resolution ────────────────────────────────────────────────
  // Both sources are written by haily-session at SessionStart (the only hook
  // event that receives `model` on stdin). Session state is preferred: it is
  // refreshed on every SessionStart (resume/clear), while process.env may hold
  // the value captured when this process tree first sourced the env file.
  function resolveSessionModel(sessionId) {
    try {
      const state = sessionId ? readSessionState(sessionId) : null;
      if (state && typeof state.model === 'string' && state.model) return state.model;
    } catch { /* fail-open */ }
    return process.env.HL_SESSION_MODEL || '';
  }

  // ── Agent file resolution ────────────────────────────────────────────────────
  // Try local .claude/agents/ first (project-scoped), then global ~/.claude/agents/.
  function resolveAgentFile(agentType) {
    const settingsDir = process.env.HL_CLAUDE_SETTINGS_DIR || path.join(os.homedir(), '.claude');
    const candidates = [
      path.join(process.cwd(), '.claude', 'agents', `${agentType}.md`),
      path.join(settingsDir, 'agents', `${agentType}.md`),
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) return p;
    }
    return null;
  }

  // ── Frontmatter extraction ───────────────────────────────────────────────────
  // Reads the `model:` line from YAML frontmatter without a full YAML parser.
  function extractModel(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const match = content.match(/^model:\s*(.+)$/m);
      return match ? match[1].trim() : null;
    } catch {
      return null;
    }
  }

  async function main() {
    const timer = createHookTimer('haily-tracer');

    let data = {};
    try {
      const raw = fs.readFileSync(0, 'utf8');
      if (raw.trim()) data = JSON.parse(raw);
    } catch { process.exit(0); }

    const toolName    = data.tool_name || '';
    const toolInput   = data.tool_input || {};
    const subagentType = toolInput.subagent_type || '';

    if (toolName !== 'Agent' || !subagentType) {
      timer.end({ status: 'skip', exit: 0, note: 'not-agent-or-no-type' });
      process.exit(0);
    }

    // Explicit per-call override > agent frontmatter pin > session model.
    const overrideModel = typeof toolInput.model === 'string' ? toolInput.model.trim() : '';
    const agentFile = resolveAgentFile(subagentType);
    const pinnedModel = agentFile ? extractModel(agentFile) : null;
    const modelId = overrideModel || pinnedModel || resolveSessionModel(data.session_id || '');

    let label;
    if (modelId) {
      const tier = deriveTier(modelId);
      label = tier ? `${tier} (${modelId})` : modelId;
    } else {
      label = 'session model (inherit)';
    }
    process.stdout.write(`🤖 [${subagentType}]: ${label}\n`);

    timer.end({ status: 'ok', exit: 0, subagentType, modelId: modelId || 'inherit' });
    process.exit(0);
  }

  main().catch((e) => { logHookCrash('haily-tracer', e); process.exit(0); });

} catch (e) {
  try { require('./haily-lib/logger.cjs').logHookCrash('haily-tracer', e); } catch { /* ignore */ }
  process.exit(0);
}
