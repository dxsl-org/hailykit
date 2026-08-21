#!/usr/bin/env node
/** Provider-aware agent model lookup for model-trace output. */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

function parseQuotedTomlField(content, field) {
  const match = content.match(new RegExp(`^${field}\\s*=\\s*(["'])(.*?)\\1\\s*$`, 'm'));
  return match ? match[2].trim() : '';
}

function readCodexAgents(agentDir) {
  const models = {};
  if (!fs.existsSync(agentDir)) return models;
  for (const file of fs.readdirSync(agentDir)) {
    if (!file.endsWith('.toml')) continue;
    try {
      const content = fs.readFileSync(path.join(agentDir, file), 'utf8');
      const name = parseQuotedTomlField(content, 'name')
        || file.replace(/\.toml$/, '').replace(/_/g, '-');
      const model = parseQuotedTomlField(content, 'model');
      models[name] = model || 'inherit';
    } catch { /* fail-open */ }
  }
  return models;
}

function readClaudeAgents(agentDir) {
  const models = {};
  if (!fs.existsSync(agentDir)) return models;
  for (const file of fs.readdirSync(agentDir)) {
    if (!file.endsWith('.md')) continue;
    try {
      const content = fs.readFileSync(path.join(agentDir, file), 'utf8');
      const match = content.match(/^model:\s*(.+)$/m);
      models[file.replace(/\.md$/, '')] = match ? match[1].trim() : 'inherit';
    } catch { /* fail-open */ }
  }
  return models;
}

/**
 * Read agent models from the provider that owns the running hook directory.
 * Codex must never fall back to ~/.claude because that produces plausible but
 * false model announcements such as `haily-refiner: sonnet`.
 */
function loadAgentModelMap(hookDir, env = process.env, cwd = process.cwd()) {
  const providerDir = path.dirname(hookDir);
  if (path.basename(providerDir).toLowerCase() === '.codex') {
    return {
      ...readCodexAgents(path.join(providerDir, 'agents')),
      ...readCodexAgents(path.join(cwd, '.codex', 'agents')),
    };
  }
  const settingsDir = env.HL_CLAUDE_SETTINGS_DIR || path.join(os.homedir(), '.claude');
  return {
    ...readClaudeAgents(path.join(settingsDir, 'agents')),
    ...readClaudeAgents(path.join(cwd, '.claude', 'agents')),
  };
}

module.exports = { loadAgentModelMap, readCodexAgents, readClaudeAgents };
