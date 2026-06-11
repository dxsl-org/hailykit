#!/usr/bin/env node
/**
 * haily-tracer.cjs — PreToolUse hook that announces which model a subagent will run on.
 *
 * Fires when the Agent tool is called. Reads the subagent_type from the tool input,
 * looks up the agent's installed frontmatter to get its model, and outputs a one-line
 * notification: ⚡ [haily-brainstormer] → thinking (claude-opus-4-8)
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

  const { isHookEnabled } = require('./haily-lib/config.cjs');
  const { createHookTimer, logHookCrash } = require('./haily-lib/logger.cjs');

  if (!isHookEnabled('model-tracer')) process.exit(0);

  // ── Tier derivation ─────────────────────────────────────────────────────────
  // Model IDs after install: claude-opus-4-8, claude-sonnet-4-6, claude-haiku-4-5-*
  // Tier names match kit/model-map.json keys; fallback: show raw model ID only.
  function deriveTier(modelId) {
    const m = modelId.toLowerCase();
    if (m.includes('opus'))   return 'thinking';
    if (m.includes('sonnet')) return 'medium';
    if (m.includes('haiku'))  return 'fast';
    return null;
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

    const agentFile = resolveAgentFile(subagentType);
    if (!agentFile) {
      timer.end({ status: 'skip', exit: 0, note: 'agent-file-not-found', subagentType });
      process.exit(0);
    }

    const modelId = extractModel(agentFile);
    if (!modelId) {
      timer.end({ status: 'skip', exit: 0, note: 'no-model-field', subagentType });
      process.exit(0);
    }

    const tier = deriveTier(modelId);
    const label = tier ? `${tier} (${modelId})` : modelId;
    process.stdout.write(`⚡ [${subagentType}] → ${label}\n`);

    timer.end({ status: 'ok', exit: 0, subagentType, modelId });
    process.exit(0);
  }

  main().catch((e) => { logHookCrash('haily-tracer', e); process.exit(0); });

} catch (e) {
  try { require('./haily-lib/logger.cjs').logHookCrash('haily-tracer', e); } catch { /* ignore */ }
  process.exit(0);
}
