#!/usr/bin/env node
/**
 * config.cjs — HailyKit hook config loading and shared utilities.
 *
 * Merges DEFAULT_CONFIG → global ~/.claude/haily.json → local .claude/haily.json. Provides
 * env-var writing, path resolution, and git helpers. Session-state locking
 * and naming-pattern formatting are delegated to sibling modules and
 * re-exported here so every hook needs only one import site.
 *
 * @module config
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');

const LOCAL_CONFIG_PATH = '.claude/haily.json';
const GLOBAL_CONFIG_PATH = path.join(os.homedir(), '.claude', 'haily.json');

// ═══════════════════════════════════════════════════════
// DEFAULT CONFIG (user-facing contract — never rename fields)
// ═══════════════════════════════════════════════════════

const DEFAULT_CONFIG = {
  plan: {
    namingFormat: '{date}-{issue}-{slug}',
    dateFormat: 'YYMMDD-HHmm',
    issuePrefix: null,
    reportsDir: 'reports',
    resolution: {
      order: ['session', 'branch'],
      branchPattern: '(?:feat|fix|chore|refactor|docs)/(?:[^/]+/)?(.+)'
    },
    validation: {
      mode: 'prompt',
      minQuestions: 3,
      maxQuestions: 8,
      focusAreas: ['assumptions', 'risks', 'tradeoffs', 'architecture']
    }
  },
  paths: { docs: 'docs', plans: '.agents' },
  docs: { maxLoc: 800 },
  locale: { thinkingLanguage: null, responseLanguage: null },
  assistant: {
    name: null,
    addressStyle: null,
    language: null,
    codeComments: 'en',
    documentation: 'en'
  },
  guard: {
    block: [
      'node_modules', 'dist', 'build', '.next', '.nuxt',
      '__pycache__', '.venv', 'venv', 'vendor', 'target',
      '.git', 'coverage'
    ],
    allow: []
  },
  trust: { passphrase: null, enabled: false },
  project: { type: 'auto', packageManager: 'auto', framework: 'auto' },
  skills: { research: { useGemini: false } },
  assertions: [],
  hooks: {
    'session-init': true, 'subagent-init': true, 'dev-rules-reminder': true,
    'scout-block': true, 'privacy-block': true,
    'session-state': true, 'workflow-artifact-gate': false,
    // 'read-scope-warn' — opt-in feature flag inside haily-access (privacy-block):
    //   when true, Read/Glob/Grep outside CWD also emits [DIR READ] warning.
    'read-scope-warn': false,
    'privacy-approval-flow': false,
    'haily-optimize': false,
    'haily-pii': false,
    'haily-usage': true,
    'model-tracer': true
  },
  codingLevel: 5,
  workflowArtifactGate: {
    enabled: true,
    softStages: ['finalize', 'commit'],
    hardStages: ['ship', 'push', 'pr', 'deploy'],
    highRiskAutoStop: true,
    enforceOnMissing: false
  }
};

// ═══════════════════════════════════════════════════════
// CONFIG LOADING
// ═══════════════════════════════════════════════════════

/**
 * Deep merge objects. Arrays replaced entirely. Empty `{}` source = inherit parent.
 * @param {Object} target @param {Object} source @returns {Object}
 */
function deepMerge(target, source) {
  if (!source || typeof source !== 'object') return target;
  if (!target || typeof target !== 'object') return source;
  const result = { ...target };
  for (const [key, src] of Object.entries(source)) {
    if (Array.isArray(src)) {
      result[key] = [...src];
    } else if (src !== null && typeof src === 'object') {
      if (Object.keys(src).length === 0) continue; // {} = inherit, no override
      result[key] = deepMerge(target[key] || {}, src);
    } else {
      result[key] = src;
    }
  }
  return result;
}

/**
 * Load a single config file. Returns null if missing or unparseable.
 * @param {string} configPath @returns {Object|null}
 */
function loadConfigFromPath(configPath) {
  try {
    if (!fs.existsSync(configPath)) return null;
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch { return null; }
}

/**
 * Load merged config: DEFAULT_CONFIG → global haily.json → local haily.json.
 * @param {{ includeProject?: boolean, includeAssertions?: boolean, includeLocale?: boolean }} [opts]
 * @returns {Object}
 */
function loadConfig(opts = {}) {
  let cfg = getDefaultConfig(
    opts.includeProject !== false,
    opts.includeAssertions !== false,
    opts.includeLocale !== false
  );
  const global_ = loadConfigFromPath(GLOBAL_CONFIG_PATH);
  const local_ = loadConfigFromPath(path.join(process.cwd(), LOCAL_CONFIG_PATH));
  if (global_) cfg = deepMerge(cfg, global_);
  if (local_) cfg = deepMerge(cfg, local_);
  return cfg;
}

/**
 * @param {boolean} [includeProject=true]
 * @param {boolean} [includeAssertions=true]
 * @param {boolean} [includeLocale=true]
 * @returns {Object}
 */
function getDefaultConfig(includeProject = true, includeAssertions = true, includeLocale = true) {
  const cfg = deepMerge({}, DEFAULT_CONFIG);
  if (!includeProject) delete cfg.project;
  if (!includeAssertions) delete cfg.assertions;
  if (!includeLocale) delete cfg.locale;
  return cfg;
}

/**
 * Returns true unless config.hooks[name] is explicitly false.
 * NOTE: `name` is the OLD hook basename — the user-config key contract.
 * @param {string} name @returns {boolean}
 */
function isHookEnabled(name) {
  const cfg = loadConfig({ includeProject: false, includeAssertions: false });
  return (cfg.hooks || {})[name] !== false;
}

// ═══════════════════════════════════════════════════════
// ENV-VAR WRITING
// ═══════════════════════════════════════════════════════

/**
 * Append `export KEY="value"` to CLAUDE_ENV_FILE. Best-effort, never throws.
 * @param {string} envFile @param {string} key @param {string|number} value
 */
function writeEnv(envFile, key, value) {
  if (!envFile || !key) return;
  try {
    const v = String(value ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    fs.appendFileSync(envFile, `export ${key}="${v}"\n`);
  } catch { /* best-effort */ }
}

// ═══════════════════════════════════════════════════════
// PATH HELPERS
// ═══════════════════════════════════════════════════════

/** Null-safe path normalisation; converts win32 separators to forward-slash. */
function normalizePath(p) {
  if (p == null || p === '') return null;
  return String(p).replace(/\\/g, '/').trim();
}

/** @param {*} p @returns {boolean} */
function isAbsolutePath(p) { return p ? path.isAbsolute(String(p)) : false; }

/**
 * Resolve the reports directory given an active plan context.
 * @param {string|null} planPath @param {string|null} resolvedBy
 * @param {Object} planConfig @param {Object} pathsConfig @param {string|null} [baseDir]
 * @returns {string}
 */
function getReportsPath(planPath, resolvedBy, planConfig, pathsConfig, baseDir = null) {
  const root = baseDir || process.cwd();
  if (planPath && resolvedBy) {
    return path.join(path.dirname(planPath), planConfig?.reportsDir || 'reports');
  }
  const plans = normalizePath(pathsConfig?.plans) || '.agents';
  return path.join(root, plans, planConfig?.reportsDir || 'reports');
}

// ═══════════════════════════════════════════════════════
// GIT / SHELL HELPERS
// ═══════════════════════════════════════════════════════

/**
 * Execute a command safely; returns trimmed stdout or null on error.
 * NOTE: Always pass an argv array — never interpolate user input into a shell string.
 * @param {string[]} args @param {{ cwd?: string, timeout?: number }} [opts]
 * @returns {string|null}
 */
function execSafe(args, opts = {}) {
  try {
    return execFileSync(args[0], args.slice(1), {
      encoding: 'utf8',
      timeout: opts.timeout ?? 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
      cwd: opts.cwd || process.cwd()
    }).trim() || null;
  } catch { return null; }
}

/** @param {string} [cwd] @returns {string|null} */
function getGitBranch(cwd) { return execSafe(['git', 'branch', '--show-current'], { cwd }); }

/** @param {string} [cwd] @returns {string|null} */
function getGitRoot(cwd) { return execSafe(['git', 'rev-parse', '--show-toplevel'], { cwd }); }

// ═══════════════════════════════════════════════════════
// RE-EXPORTS (naming patterns + session state)
// ═══════════════════════════════════════════════════════

const naming = require('./naming.cjs');
const session = require('./session.cjs');

module.exports = {
  DEFAULT_CONFIG,
  deepMerge, loadConfigFromPath, loadConfig, getDefaultConfig, isHookEnabled,
  writeEnv,
  normalizePath, isAbsolutePath, getReportsPath,
  execSafe: (cmd, opts) => execSafe(Array.isArray(cmd) ? cmd : cmd.split(' '), opts),
  getGitBranch, getGitRoot,
  sanitizePath: (p, root) => {
    const n = normalizePath(p);
    if (!n) return null;
    return isAbsolutePath(n) ? n : path.join(root || process.cwd(), n);
  },
  escapeShellValue: (s) => String(s ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"'),
  sanitizeConfig: (c) => c,
  // Naming patterns
  ...naming,
  // Session state
  getSessionTempPath: session.getSessionTempPath,
  readSessionState: session.readSessionState,
  writeSessionState: session.writeSessionState,
  updateSessionState: session.updateSessionState,
  resolvePlanPath: session.resolvePlanPath,
  findMostRecentPlan: session.findMostRecentPlan,
};
