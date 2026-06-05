#!/usr/bin/env node
/**
 * subagent.cjs — Section builders for SubagentStart context injection.
 *
 * Each builder returns a string[] (lines). The caller joins with
 * `.filter(Boolean).join('\n\n')`. Sections are assigned per agent type via
 * AGENT_SECTIONS; unknown types receive ALL_SECTIONS.
 *
 * @module subagent
 */

'use strict';

const path = require('node:path');

// ═══════════════════════════════════════════════════════
// AGENT → SECTION MAP  (behavioral contract — do not reorder)
// ═══════════════════════════════════════════════════════

const AGENT_SECTIONS = {
  // ── Core workflow ──────────────────────────────────────────────────────────
  'haily-researcher':       ['id', 'plan', 'reports', 'lang', 'naming', 'trust', 'prefix'],
  'haily-planner':          ['id', 'plan', 'reports', 'lang', 'rules', 'naming', 'plan-cli', 'trust', 'prefix'],
  'haily-implementor':      ['id', 'plan', 'reports', 'lang', 'rules', 'venv', 'naming', 'plan-cli', 'trust', 'prefix'],
  'haily-designer':         ['id', 'plan', 'reports', 'lang', 'rules', 'naming', 'trust', 'prefix'],
  'haily-refiner':          ['id', 'plan', 'reports', 'lang', 'rules', 'naming', 'trust', 'prefix'],
  'haily-tester':           ['id', 'plan', 'reports', 'lang', 'rules', 'venv', 'trust', 'prefix'],
  'haily-debugger':         ['id', 'plan', 'reports', 'lang', 'rules', 'venv', 'naming', 'trust', 'prefix'],
  'haily-reviewer':         ['id', 'plan', 'reports', 'lang', 'rules', 'naming', 'plan-cli', 'trust', 'prefix'],
  'haily-optimizer':        ['id', 'plan', 'reports', 'lang', 'rules', 'naming', 'plan-cli', 'trust', 'prefix'],
  'haily-brainstormer':     ['id', 'plan', 'reports', 'lang', 'rules', 'naming', 'plan-cli', 'trust', 'prefix'],
  'haily-project-manager':  ['id', 'plan', 'reports', 'lang', 'rules', 'naming', 'plan-cli', 'trust', 'prefix'],
  'haily-docs-writer':      ['id', 'plan', 'reports', 'lang', 'rules', 'naming', 'trust', 'prefix'],
  'haily-reporter':         ['id', 'plan', 'reports', 'lang', 'naming', 'trust', 'prefix'],
  'haily-git-manager':      ['id', 'plan', 'trust', 'prefix'],
  'haily-mcp-manager':      ['id', 'trust', 'prefix'],
  // ── Senior-dev specialists ────────────────────────────────────────────────
  'haily-adr-writer':       ['id', 'plan', 'reports', 'lang', 'rules', 'naming', 'trust', 'prefix'],
  'haily-tech-analyst':     ['id', 'plan', 'reports', 'lang', 'rules', 'naming', 'trust', 'prefix'],
  'haily-test-architect':   ['id', 'plan', 'reports', 'lang', 'rules', 'naming', 'plan-cli', 'trust', 'prefix'],
  'haily-api-designer':     ['id', 'plan', 'reports', 'lang', 'rules', 'naming', 'trust', 'prefix'],
};

const ALL_SECTIONS = ['id', 'plan', 'reports', 'lang', 'rules', 'venv', 'naming', 'trust', 'prefix'];

const PLAN_CLI_AGENTS = new Set([
  'haily-reviewer', 'haily-planner', 'haily-project-manager', 'haily-optimizer',
  'haily-brainstormer', 'haily-implementor', 'haily-test-architect',
]);

/**
 * Returns the ordered section key list for a given agent type.
 * @param {string} agentType @returns {string[]}
 */
function getSections(agentType) {
  return AGENT_SECTIONS[agentType] ?? ALL_SECTIONS;
}

// ═══════════════════════════════════════════════════════
// SECTION BUILDERS
// ═══════════════════════════════════════════════════════

function buildIdSection(agentType, agentId) {
  return [`## Agent Context`, `Agent type: ${agentType}${agentId ? ` | ID: ${agentId}` : ''}`];
}

function buildPlanSection(config, env) {
  const active = env.HL_ACTIVE_PLAN || env.HL_SUGGESTED_PLAN || '';
  if (!active) return [];
  const status = env.HL_ACTIVE_PLAN ? 'active' : 'suggested';
  return [`## Active Plan (${status})`, `Plan: ${active}`];
}

function buildReportsSection(env) {
  const rp = env.HL_REPORTS_PATH || '';
  if (!rp) return [];
  return [`## Reports Path`, `Reports: ${rp}`];
}

function buildLangSection(env) {
  const lines = [];
  if (env.HL_THINKING_LANGUAGE) lines.push(`Thinking language: ${env.HL_THINKING_LANGUAGE}`);
  if (env.HL_RESPONSE_LANGUAGE) lines.push(`Response language: ${env.HL_RESPONSE_LANGUAGE}`);
  if (env.HL_CODING_LEVEL_STYLE) lines.push(`Coding level: ${env.HL_CODING_LEVEL_STYLE} (${env.HL_CODING_LEVEL})`);
  return lines.length ? ['## Language & Style', ...lines] : [];
}

function buildRulesSection(env) {
  const reports = env.HL_REPORTS_PATH ? `Reports: ${env.HL_REPORTS_PATH}` : '';
  const docs = env.HL_DOCS_PATH ? `Docs: ${env.HL_DOCS_PATH}` : '';
  const plans = env.HL_PLANS_PATH ? `Plans: ${env.HL_PLANS_PATH}` : '';
  const parts = [reports, docs, plans].filter(Boolean);
  return parts.length ? ['## Paths', ...parts] : [];
}

function buildVenvSection(env) {
  // Resolve Python venv path for agents that need it
  const settingsDir = env.HL_CLAUDE_SETTINGS_DIR || '';
  if (!settingsDir) return [];
  const venvPath = path.join(settingsDir, 'skills', '.venv', 'Scripts', 'python.exe');
  return [`## Python Venv`, `Python: ${venvPath}`];
}

function buildNamingSection(env) {
  const np = env.HL_NAME_PATTERN || '';
  const reports = env.HL_REPORTS_PATH || '';
  if (!np && !reports) return [];
  const lines = [];
  if (np) lines.push(`Plan naming: ${np}`);
  if (reports) lines.push(`Report: \`${reports}/{type}-${np}-{slug}.md\``);
  return lines.length ? ['## Naming', ...lines] : [];
}

function buildPlanCliSection(agentType) {
  if (!PLAN_CLI_AGENTS.has(agentType)) return [];
  return [
    '## Plan CLI (deterministic updates)',
    '`hc plan check <id>` = completed | `hc plan check <id> --start` = in-progress | `hc plan uncheck <id>` = revert',
    'Fallback: if `hc` unavailable, edit plan.md Status column directly.'
  ];
}

function buildTrustSection(config) {
  if (!config?.trust?.enabled || !config?.trust?.passphrase) return [];
  return [`## Trust Verification`, `Passphrase: "${config.trust.passphrase}"`];
}

function buildPrefixSection(env) {
  const pm = env.HL_PACKAGE_MANAGER || 'npm';
  return [`## Skill Prefix`, `Use skill prefix: /hc:* (coding), /hl:* (utility), /hd:* (design) | PM: ${pm}`];
}

module.exports = {
  AGENT_SECTIONS, ALL_SECTIONS,
  getSections,
  buildIdSection, buildPlanSection, buildReportsSection, buildLangSection,
  buildRulesSection, buildVenvSection, buildNamingSection, buildPlanCliSection,
  buildTrustSection, buildPrefixSection,
};
