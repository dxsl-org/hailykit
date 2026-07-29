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
const { deriveTier } = require('./model.cjs');

// ═══════════════════════════════════════════════════════
// AGENT → SECTION MAP  (behavioral contract — do not reorder)
// ═══════════════════════════════════════════════════════

// NOTE: 'econ' (Output Economy reminder) is appended to every row and to
// ALL_SECTIONS — unlike 'reasoning' it is NOT tier-gated (see buildEconSection):
// concise reporting is model-independent, so every agent type gets it regardless
// of HL_MODEL_TIER. The 'reasoning' key is never written here — `getSections`
// derives it from JUDGMENT_AGENTS so the two cannot disagree.
const AGENT_SECTIONS = {
  // ── Core workflow ──────────────────────────────────────────────────────────
  'haily-researcher':       ['id', 'plan', 'reports', 'lang', 'naming', 'trust', 'prefix', 'econ'],
  'haily-planner':          ['id', 'plan', 'reports', 'lang', 'rules', 'naming', 'plan-cli', 'trust', 'prefix', 'econ'],
  'haily-implementor':      ['id', 'plan', 'reports', 'lang', 'rules', 'venv', 'naming', 'plan-cli', 'trust', 'prefix', 'econ'],
  'haily-designer':         ['id', 'plan', 'reports', 'lang', 'rules', 'naming', 'trust', 'prefix', 'econ'],
  'haily-refiner':          ['id', 'plan', 'reports', 'lang', 'rules', 'naming', 'trust', 'prefix', 'econ'],
  'haily-tester':           ['id', 'plan', 'reports', 'lang', 'rules', 'venv', 'trust', 'prefix', 'econ'],
  'haily-debugger':         ['id', 'plan', 'reports', 'lang', 'rules', 'venv', 'naming', 'trust', 'prefix', 'econ'],
  'haily-reviewer':         ['id', 'plan', 'reports', 'lang', 'rules', 'naming', 'plan-cli', 'trust', 'prefix', 'econ'],
  'haily-optimizer':        ['id', 'plan', 'reports', 'lang', 'rules', 'naming', 'plan-cli', 'trust', 'prefix', 'econ'],
  'haily-brainstormer':     ['id', 'plan', 'reports', 'lang', 'rules', 'naming', 'plan-cli', 'trust', 'prefix', 'econ'],
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
  'haily-advisor':          ['id', 'plan', 'trust', 'prefix', 'econ'],
};

const ALL_SECTIONS = ['id', 'plan', 'reports', 'lang', 'rules', 'venv', 'naming', 'trust', 'prefix', 'econ'];

const PLAN_CLI_AGENTS = new Set([
  'haily-reviewer', 'haily-planner', 'haily-project-manager', 'haily-optimizer',
  'haily-brainstormer', 'haily-implementor', 'haily-test-architect',
]);

// Agents whose work is single-pass judgment (architecture, review, root-cause,
// debate) rather than mechanical execution — the reasoning harness targets these.
// This list is the ONLY place membership is declared: `getSections` derives the
// 'reasoning' key from it, so a row in AGENT_SECTIONS can never drift out of
// agreement with it. Mechanical, pinned/capped, apex, and unknown agent types are
// excluded by construction, since only listed names get the key.
const JUDGMENT_AGENTS = ['haily-planner', 'haily-reviewer', 'haily-debugger', 'haily-brainstormer'];

const JUDGMENT_AGENT_SET = new Set(JUDGMENT_AGENTS);

/**
 * Ordered section key list for an agent type. The 'reasoning' key is appended
 * ahead of 'econ' for judgment agents only; the builder itself still no-ops on
 * an ultra/empty/unrecognized tier, so this is routing, not a tier decision.
 * @param {string} agentType @returns {string[]}
 */
function getSections(agentType) {
  const base = AGENT_SECTIONS[agentType] ?? ALL_SECTIONS;
  if (!JUDGMENT_AGENT_SET.has(agentType)) return base;
  return [...base.filter((key) => key !== 'econ'), 'reasoning', 'econ'];
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

// The `thinking` tier gets a compressed form: it needs the sequence named, not
// spelled out. Budgets are ≤120 est. tokens full / ≤80 compressed, asserted at
// runtime by cli/tests/haily-subagent-reasoning-harness.test.ts.
const HARNESS_FULL = [
  'Outcome Floor: state what must hold for your answer to be usable; if it cannot hold, say that instead of answering.',
  'Ground: every claim names a source you actually opened.',
  'Split: mark each statement as observed or inferred.',
  'Attack: try to break your own conclusion before reporting it.',
  'Deliver: verdict plus what would change it, in whatever format your report contract already requires.',
].join('\n');

const HARNESS_COMPRESSED =
  'Floor: state what must hold for the answer to be usable. Ground each claim in a source you opened. '
  + 'Mark observed vs inferred. Attack your own conclusion first. Deliver verdict plus what would change it.';

/**
 * Mechanical reasoning sequence for judgment agents (see JUDGMENT_AGENTS)
 * running below the top tier: Outcome Floor → Ground → Split → Attack → Deliver.
 *
 * OFF BY DEFAULT — opt in with `haily.json` `reasoningHarness.enabled: true`.
 * Every measurement taken so far says an empty prelude beats this text. On the eval
 * fixtures under `cli/tests/fixtures/reasoning-harness-repo/`, no injected wording has
 * ever outscored injecting nothing, at either weak tier, on local models or on the
 * Claude models those tiers actually resolve to. The evidence is still narrow —
 * single-turn strict-JSON questions, which is not what real agents do — so the mechanism
 * is kept and gated rather than deleted, and anyone re-enabling it is expected to
 * re-measure with `scripts/run-reasoning-evals.mjs` first.
 *
 * Empty, 'ultra', or any unrecognized HL_MODEL_TIER yields `[]`. Ultra already
 * reasons at max budget, and an unknown tier must no-op rather than guess.
 *
 * NOTE: the sequence deliberately prescribes no output shape — it defers to the
 * agent's own report contract. The wording it replaces did prescribe one ("end
 * with verdict + confidence"), and that clause was measured competing with the
 * caller's required structure: on a local 7b model it drove the mean score from
 * 0.500 to 0.000 with failing outputs running 2,000–2,800 bytes of prose against
 * 200–450 for successes, and on Claude Sonnet it reached the answer schema as an
 * unknown `summary_confidence` field that failed the parse outright. A prescribed
 * format here corrupts the caller's contract regardless of model strength, so any
 * edit reintroducing one must re-measure first.
 *
 * NOTE: `ultrathink` is a Claude-specific extended-thinking trigger, so it is
 * gated on the session model resolving to the Claude family — a non-Claude model
 * gains nothing from the keyword and may be confused by it. Tier alone is not
 * enough of a gate, since non-Claude ids also resolve to a tier.
 * @param {NodeJS.ProcessEnv} env
 * @param {{ reasoningHarness?: { enabled?: boolean } }} [config] `haily.json` contents
 * @returns {string[]}
 */
function buildReasoningHarness(env, config) {
  if (config?.reasoningHarness?.enabled !== true) return [];
  const tier = env.HL_MODEL_TIER || '';
  if (!THINK_BOOST_TIERS.has(tier)) return [];
  const claudeFamily = deriveTier(env.HL_SESSION_MODEL || '') !== null;
  const body = tier === 'thinking' ? HARNESS_COMPRESSED : HARNESS_FULL;
  return ['## Reasoning Procedure', claudeFamily ? `ultrathink: ${body}` : body];
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
  buildTrustSection, buildPrefixSection, buildReasoningHarness,
  buildEconSection,
};
