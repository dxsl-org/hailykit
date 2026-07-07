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

// NOTE: 'econ' (Output Economy reminder) is appended to every row and to
// ALL_SECTIONS — unlike 'think'/'reason' it is NOT tier-gated (see
// buildEconSection): concise reporting is model-independent, so every agent
// type gets it regardless of HL_MODEL_TIER.
const AGENT_SECTIONS = {
  // ── Core workflow ──────────────────────────────────────────────────────────
  'haily-researcher':       ['id', 'plan', 'reports', 'lang', 'naming', 'trust', 'prefix', 'econ'],
  'haily-planner':          ['id', 'plan', 'reports', 'lang', 'rules', 'naming', 'plan-cli', 'trust', 'prefix', 'think', 'reason', 'econ'],
  'haily-implementor':      ['id', 'plan', 'reports', 'lang', 'rules', 'venv', 'naming', 'plan-cli', 'trust', 'prefix', 'econ'],
  'haily-designer':         ['id', 'plan', 'reports', 'lang', 'rules', 'naming', 'trust', 'prefix', 'econ'],
  'haily-refiner':          ['id', 'plan', 'reports', 'lang', 'rules', 'naming', 'trust', 'prefix', 'econ'],
  'haily-tester':           ['id', 'plan', 'reports', 'lang', 'rules', 'venv', 'trust', 'prefix', 'econ'],
  'haily-debugger':         ['id', 'plan', 'reports', 'lang', 'rules', 'venv', 'naming', 'trust', 'prefix', 'think', 'reason', 'econ'],
  'haily-reviewer':         ['id', 'plan', 'reports', 'lang', 'rules', 'naming', 'plan-cli', 'trust', 'prefix', 'think', 'reason', 'econ'],
  'haily-optimizer':        ['id', 'plan', 'reports', 'lang', 'rules', 'naming', 'plan-cli', 'trust', 'prefix', 'econ'],
  'haily-brainstormer':     ['id', 'plan', 'reports', 'lang', 'rules', 'naming', 'plan-cli', 'trust', 'prefix', 'think', 'reason', 'econ'],
  'haily-project-manager':  ['id', 'plan', 'reports', 'lang', 'rules', 'naming', 'plan-cli', 'trust', 'prefix', 'econ'],
  'haily-docs-writer':      ['id', 'plan', 'reports', 'lang', 'rules', 'naming', 'trust', 'prefix', 'econ'],
  'haily-reporter':         ['id', 'plan', 'reports', 'lang', 'naming', 'trust', 'prefix', 'econ'],
  'haily-git-manager':      ['id', 'plan', 'trust', 'prefix', 'econ'],
  'haily-mcp-manager':      ['id', 'trust', 'prefix', 'econ'],
  // ── Senior-dev specialists ────────────────────────────────────────────────
  'haily-adr-writer':       ['id', 'plan', 'reports', 'lang', 'rules', 'naming', 'trust', 'prefix', 'econ'],
  'haily-tech-analyst':     ['id', 'plan', 'reports', 'lang', 'rules', 'naming', 'trust', 'prefix', 'econ'],
  'haily-test-architect':   ['id', 'plan', 'reports', 'lang', 'rules', 'naming', 'plan-cli', 'trust', 'prefix', 'econ'],
  'haily-api-designer':     ['id', 'plan', 'reports', 'lang', 'rules', 'naming', 'trust', 'prefix', 'econ'],
  // ── Apex (adjudication-only, top-tier by definition — no think boost) ──────
  'haily-judge':            ['id', 'plan', 'trust', 'prefix', 'econ'],
};

const ALL_SECTIONS = ['id', 'plan', 'reports', 'lang', 'rules', 'venv', 'naming', 'trust', 'prefix', 'econ'];

const PLAN_CLI_AGENTS = new Set([
  'haily-reviewer', 'haily-planner', 'haily-project-manager', 'haily-optimizer',
  'haily-brainstormer', 'haily-implementor', 'haily-test-architect',
]);

// Agents whose work is single-pass judgment (architecture, review, root-cause,
// debate) rather than mechanical execution — the extended-thinking directive
// targets these. A later phase (--deep model escalation) reuses this list, so
// keep it exported rather than inlining the agent names elsewhere.
const JUDGMENT_AGENTS = ['haily-planner', 'haily-reviewer', 'haily-debugger', 'haily-brainstormer'];

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
  return [`## Skill Prefix`, `Use skill prefix: /hc-* (coding), /hl-* (utility), /hs-* (security ops) | PM: ${pm}`];
}

// Explicit allowlist (not a rank comparison) — an unrecognized or future tier
// string must no-op rather than accidentally satisfy a "< ultra" check.
const THINK_BOOST_TIERS = new Set(['thinking', 'medium', 'fast']);

/**
 * Extended-thinking directive for judgment agents running below the deep tier.
 * Empty, 'ultra', or any unrecognized HL_MODEL_TIER value yields `[]` — the
 * ultra tier already reasons at max budget, and unknown/non-Claude sessions
 * must never receive a Claude-specific keyword that could confuse them.
 * @param {NodeJS.ProcessEnv} env @returns {string[]}
 */
function buildThinkSection(env) {
  const tier = env.HL_MODEL_TIER || '';
  if (!THINK_BOOST_TIERS.has(tier)) return [];
  return [
    `## Depth Directive`,
    `ultrathink: reason exhaustively before concluding — verify assumptions, consider alternatives, and check your work before responding.`,
  ];
}

/**
 * Reasoning-contract scaffold for judgment agents (see JUDGMENT_AGENTS) running
 * below the deep tier. Shares THINK_BOOST_TIERS gate with buildThinkSection —
 * same fail-safe rule: empty, 'ultra', or unrecognized tier yields `[]`. Ultra
 * sessions already reason at max budget without a forced template; forcing one
 * on unknown/non-Claude sessions risks confusing a model with no such contract.
 * @param {NodeJS.ProcessEnv} env @returns {string[]}
 */
function buildReasonSection(env) {
  const tier = env.HL_MODEL_TIER || '';
  if (!THINK_BOOST_TIERS.has(tier)) return [];
  return [
    `## Reasoning Contract`,
    `State competing hypotheses/options → cite file:line evidence per claim → end with verdict + confidence (high/medium/low) + what would change it.`,
  ];
}

/**
 * Condensed Output Economy reminder for subagent reports. Applied to every
 * agent type (see AGENT_SECTIONS/ALL_SECTIONS note above) — unlike
 * buildThinkSection/buildReasonSection this is NOT gated by HL_MODEL_TIER;
 * concise reporting is a behavior contract, not a reasoning-budget boost, so
 * it costs nothing to apply uniformly. Two lines by design (see
 * docs/token-overhead.md 'econ' entry). Never mentions or governs the
 * model-trace announcement (`haily-tracer.cjs` / `🤖 [agent]: model` lines) —
 * that is a separate, protected mechanism this directive must not touch.
 * @returns {string[]}
 */
function buildEconSection() {
  return [
    `## Output Economy`,
    `Report per your Report Contract: finding first, no process narration, evidence as file:line. Full sentences for what you keep.`,
  ];
}

module.exports = {
  AGENT_SECTIONS, ALL_SECTIONS, JUDGMENT_AGENTS,
  getSections,
  buildIdSection, buildPlanSection, buildReportsSection, buildLangSection,
  buildRulesSection, buildVenvSection, buildNamingSection, buildPlanCliSection,
  buildTrustSection, buildPrefixSection, buildThinkSection, buildReasonSection,
  buildEconSection,
};
