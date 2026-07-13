#!/usr/bin/env node
/**
 * context.cjs - Context/reminder building for session injection
 *
 * Extracted from dev-rules-reminder.cjs for reuse in both Claude hooks and OpenCode plugins.
 * Builds session context, rules, paths, and plan information.
 *
 * @module context
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

// Usage cache file path (written by haily-usage.cjs hook)
const USAGE_CACHE_FILE = path.join(os.tmpdir(), 'hl-usage-limits-cache.json');
const RECENT_INJECTION_TTL_MS = 5 * 60 * 1000;
const PENDING_INJECTION_TTL_MS = 30 * 1000;
const WARN_THRESHOLD = 70;
const CRITICAL_THRESHOLD = 90;
const {
  loadConfig,
  resolvePlanPath,
  getReportsPath,
  resolveNamingPattern,
  normalizePath,
  getGitBranch,
  readSessionState,
  updateSessionState
} = require('./config.cjs');
const { detectPrimaryLanguage, detectFramework, detectFrameworkExtras } = require('./project.cjs');

function execSafe(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch {
    return null;
  }
}

/**
 * Resolve rules file path (local or global) with backward compat
 * @param {string} filename - Rules filename
 * @param {string} [configDirName='.claude'] - Config directory name
 * @returns {string|null} Resolved path or null
 */
function resolveRulesPath(filename, configDirName = '.claude') {
  // Try rules/ first (new location)
  const localRulesPath = path.join(process.cwd(), configDirName, 'rules', filename);
  const globalRulesPath = path.join(os.homedir(), '.claude', 'rules', filename);

  if (fs.existsSync(localRulesPath)) return `${configDirName}/rules/${filename}`;
  if (fs.existsSync(globalRulesPath)) return `~/.claude/rules/${filename}`;

  // Backward compat: try workflows/ (legacy location)
  const localWorkflowsPath = path.join(process.cwd(), configDirName, 'workflows', filename);
  const globalWorkflowsPath = path.join(os.homedir(), '.claude', 'workflows', filename);

  if (fs.existsSync(localWorkflowsPath)) return `${configDirName}/workflows/${filename}`;
  if (fs.existsSync(globalWorkflowsPath)) return `~/.claude/workflows/${filename}`;

  return null;
}

/**
 * Resolve standards file path (local or global) with legacy rules/ fallback.
 *
 * Standards files (lang-*.md, framework-*.md) live in
 * standards/ instead of rules/ because Claude Code auto-loads ~/.claude/rules/
 * into every session — putting these large files there causes 400K+ tokens
 * of static context bloat. Hook injects them on-demand based on detected stack.
 *
 * Falls back to rules/ for one release to cover users mid-upgrade. Remove
 * fallback in v3.2 per hailykit.md deletion rule.
 *
 * @param {string} filename - Standards filename (e.g. 'lang-typescript.md')
 * @param {string} [configDirName='.claude'] - Config directory name
 * @returns {string|null} Resolved path or null
 */
function resolveStandardsPath(filename, configDirName = '.claude') {
  // New location (preferred)
  const localStandardsPath = path.join(process.cwd(), configDirName, 'standards', filename);
  const globalStandardsPath = path.join(os.homedir(), '.claude', 'standards', filename);

  if (fs.existsSync(localStandardsPath)) return `${configDirName}/standards/${filename}`;
  if (fs.existsSync(globalStandardsPath)) return `~/.claude/standards/${filename}`;

  // Legacy: rules/ (one-release transition, removed in v3.2)
  const localRulesPath = path.join(process.cwd(), configDirName, 'rules', filename);
  const globalRulesPath = path.join(os.homedir(), '.claude', 'rules', filename);

  if (fs.existsSync(localRulesPath)) return `${configDirName}/rules/${filename}`;
  if (fs.existsSync(globalRulesPath)) return `~/.claude/rules/${filename}`;

  return null;
}

/**
 * Resolve contextual rule path (local or global).
 *
 * Contextual rules live in contextual/ instead of rules/ so Claude Code does
 * NOT auto-load them every session. The hook injects them on-demand based on
 * keyword detection in the user prompt. Falls back to rules/ for one release
 * to cover users mid-upgrade.
 *
 * @param {string} filename - Contextual rule filename
 * @param {string} [configDirName='.claude'] - Config directory name
 * @returns {string|null} Resolved path or null
 */
function resolveContextualPath(filename, configDirName = '.claude') {
  const localPath = path.join(process.cwd(), configDirName, 'contextual', filename);
  const globalPath = path.join(os.homedir(), '.claude', 'contextual', filename);
  if (fs.existsSync(localPath)) return `${configDirName}/contextual/${filename}`;
  if (fs.existsSync(globalPath)) return `~/.claude/contextual/${filename}`;
  // Legacy: rules/ (one-release transition, remove in v3.3 per hailykit.md deletion rule)
  const localRulesPath = path.join(process.cwd(), configDirName, 'rules', filename);
  const globalRulesPath = path.join(os.homedir(), '.claude', 'rules', filename);
  if (fs.existsSync(localRulesPath)) return `${configDirName}/rules/${filename}`;
  if (fs.existsSync(globalRulesPath)) return `~/.claude/rules/${filename}`;
  return null;
}

/**
 * Resolve script file path (local or global)
 * @param {string} filename - Script filename
 * @param {string} [configDirName='.claude'] - Config directory name
 * @returns {string|null} Resolved path or null
 */
function resolveScriptPath(filename, configDirName = '.claude') {
  const localPath = path.join(process.cwd(), configDirName, 'scripts', filename);
  const globalPath = path.join(os.homedir(), '.claude', 'scripts', filename);
  if (fs.existsSync(localPath)) return `${configDirName}/scripts/${filename}`;
  if (fs.existsSync(globalPath)) return `~/.claude/scripts/${filename}`;
  return null;
}

/**
 * Resolve skills venv Python path (local or global)
 * @param {string} [configDirName='.claude'] - Config directory name
 * @returns {string|null} Resolved venv Python path or null
 */
function resolveSkillsVenv(configDirName = '.claude') {
  const isWindows = process.platform === 'win32';
  const venvBin = isWindows ? 'Scripts' : 'bin';
  const pythonExe = isWindows ? 'python.exe' : 'python3';

  const localVenv = path.join(process.cwd(), configDirName, 'skills', '.venv', venvBin, pythonExe);
  const globalVenv = path.join(os.homedir(), '.claude', 'skills', '.venv', venvBin, pythonExe);

  if (fs.existsSync(localVenv)) {
    return isWindows
      ? `${configDirName}\\skills\\.venv\\Scripts\\python.exe`
      : `${configDirName}/skills/.venv/bin/python3`;
  }
  if (fs.existsSync(globalVenv)) {
    return isWindows
      ? '~\\.claude\\skills\\.venv\\Scripts\\python.exe'
      : '~/.claude/skills/.venv/bin/python3';
  }
  return null;
}

/**
 * Extract a compressed summary of the active phase from a plan directory.
 * Scans phase-*.md frontmatter for `status: in-progress` — more reliable than
 * parsing the plan.md table whose column count varies by plan format.
 * Returns phase heading + current todo checklist (~40-80 tokens).
 *
 * @param {string} planDir - Absolute path to the plan directory (contains phase-*.md files)
 * @returns {string|null} Compressed summary or null when not applicable/on error
 */
function extractActivePhaseSummary(planDir) {
  try {
    if (!fs.existsSync(planDir)) return null;

    const phaseFiles = fs.readdirSync(planDir)
      .filter(f => /^phase-\d+/.test(f))
      .sort();

    for (const phaseFile of phaseFiles) {
      const phaseContent = fs.readFileSync(path.join(planDir, phaseFile), 'utf8');
      // Match frontmatter status field: status: in-progress (with or without space/hyphen)
      if (!phaseContent.match(/^status:\s*in[-\s]progress\s*$/im)) continue;

      const phaseNumMatch = phaseFile.match(/^phase-(\d+)/);
      const phaseNum = phaseNumMatch ? phaseNumMatch[1].padStart(2, '0') : '??';
      const titleMatch = phaseContent.match(/^# Phase \d+: (.+)/m)
        || phaseContent.match(/^title:\s*"?(.+?)"?\s*$/m);
      const todos = (phaseContent.match(/^- \[[ x]\] .+/gm) || []).slice(0, 8);
      const title = titleMatch ? titleMatch[1] : phaseFile;
      return `Phase ${phaseNum} in-progress: ${title}\nTodos: ${todos.join(' | ') || 'none'}`;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Build plan context from config and git info
 * @param {string|null} sessionId - Session ID
 * @param {Object} config - Loaded config
 * @returns {Object} Plan context object
 */
function buildPlanContext(sessionId, config) {
  const { plan, paths } = config;
  const gitBranch = getGitBranch();
  const resolved = resolvePlanPath(sessionId, config);
  const reportsPath = getReportsPath(resolved.path, resolved.resolvedBy, plan, paths);

  // Compute naming pattern directly for reliable injection
  const namePattern = resolveNamingPattern(plan, gitBranch);

  const planLine = resolved.resolvedBy === 'session'
    ? `- Plan: ${resolved.path}`
    : resolved.resolvedBy === 'branch'
      ? `- Plan: none | Suggested: ${resolved.path}`
      : `- Plan: none`;

  // Compressed active-phase summary (active plan only, ~40-80 tokens vs 300-500 for full content)
  let activePhaseSummary = null;
  if (resolved.resolvedBy === 'session' && resolved.path) {
    activePhaseSummary = extractActivePhaseSummary(path.dirname(resolved.path));
  }

  // Validation config (injected so LLM can reference it)
  const validation = plan.validation || {};
  const validationMode = validation.mode || 'prompt';
  const validationMin = validation.minQuestions || 3;
  const validationMax = validation.maxQuestions || 8;

  return { reportsPath, gitBranch, planLine, namePattern, validationMode, validationMin, validationMax, activePhaseSummary };
}

/**
 * Build a scope key for reminder dedup so cwd-sensitive output can re-inject when needed.
 * @param {Object} params
 * @param {string} [params.baseDir] - Working directory for the hook invocation
 * @returns {string} Stable scope key
 */
function buildInjectionScopeKey({ baseDir } = {}) {
  const cwdKey = normalizePath(path.resolve(baseDir || process.cwd())) || process.cwd();
  return cwdKey;
}

function parseTimestamp(value) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Date.parse(value);
  return NaN;
}

function getReminderScopeState(reminderState, scopeKey) {
  const scopes = reminderState?.scopes;
  if (!scopes || typeof scopes !== 'object') return null;
  const scopeState = scopes[scopeKey];
  return scopeState && typeof scopeState === 'object' ? scopeState : null;
}

function hasRecentInjection(scopeState, now = Date.now()) {
  const injectedTs = parseTimestamp(scopeState?.lastInjectedAt);
  return Number.isFinite(injectedTs) && now - injectedTs < RECENT_INJECTION_TTL_MS;
}

function hasPendingInjection(scopeState, now = Date.now()) {
  const pendingTs = parseTimestamp(scopeState?.pendingAt);
  return Number.isFinite(pendingTs) && now - pendingTs < PENDING_INJECTION_TTL_MS;
}

function pruneReminderScopes(scopes, now = Date.now()) {
  const nextScopes = {};
  for (const [scopeKey, scopeState] of Object.entries(scopes || {})) {
    if (!scopeState || typeof scopeState !== 'object') continue;
    if (hasRecentInjection(scopeState, now) || hasPendingInjection(scopeState, now)) {
      nextScopes[scopeKey] = scopeState;
    }
  }
  return nextScopes;
}

function wasTranscriptRecentlyInjected(transcriptPath, scopeKey = null) {
  try {
    if (!transcriptPath || !fs.existsSync(transcriptPath)) return false;
    const tail = fs.readFileSync(transcriptPath, 'utf-8').split('\n').slice(-150);
    const hasReminderMarker = tail.some(line => line.includes('## Plan Context'));
    if (!hasReminderMarker) return false;
    if (!scopeKey) return true;

    // The reminder output is cwd-sensitive; only treat transcript fallback as a match
    // when the same cwd-specific session lines were already injected recently.
    return tail.some(line => line === `- CWD: ${scopeKey}` || line === `- Working directory: ${scopeKey}`);
  } catch {
    return false;
  }
}

/**
 * Check if context was recently injected (prevent duplicate injection).
 * Uses session-scoped markers when a session ID is available, otherwise falls back to transcript scan.
 * @param {string} transcriptPath - Path to transcript file
 * @param {string|null} [sessionId] - Session identifier for temp-state dedup
 * @param {string|null} [scopeKey='session'] - Scope key for cwd/transcript-aware dedup
 * @returns {boolean} true if recently injected
 */
function wasRecentlyInjected(transcriptPath, sessionId = null, scopeKey = 'session') {
  try {
    if (sessionId) {
      const reminderState = readSessionState(sessionId)?.devRulesReminder;
      if (hasRecentInjection(getReminderScopeState(reminderState, scopeKey))) {
        return true;
      }
    }

    return wasTranscriptRecentlyInjected(transcriptPath, scopeKey);
  } catch {
    return false;
  }
}

/**
 * Reserve an injection slot atomically so concurrent hooks do not double-inject.
 * @param {string|null} sessionId - Session identifier
 * @param {string|null} [scopeKey='session'] - Scope key for cwd/transcript-aware dedup
 * @param {string|null} [transcriptPath] - Transcript path for legacy fallback when no session ID exists
 * @returns {{ shouldInject: boolean, reserved: boolean }} Whether to inject and whether a pending reservation was written
 */
function reserveInjectionScope(sessionId, scopeKey = 'session', transcriptPath = null) {
  const transcriptAlreadyInjected = wasTranscriptRecentlyInjected(transcriptPath, scopeKey);

  if (!sessionId) {
    return {
      shouldInject: !transcriptAlreadyInjected,
      reserved: false
    };
  }

  try {
    let shouldInject = false;
    const now = Date.now();
    const updated = updateSessionState(sessionId, (state) => {
      const reminderState = state.devRulesReminder && typeof state.devRulesReminder === 'object'
        ? state.devRulesReminder
        : {};
      const scopes = pruneReminderScopes(reminderState.scopes, now);
      const scopeState = getReminderScopeState({ scopes }, scopeKey) || {};

      if (hasRecentInjection(scopeState, now) || hasPendingInjection(scopeState, now)) {
        return state;
      }

      if (transcriptAlreadyInjected) {
        scopes[scopeKey] = {
          ...scopeState,
          lastInjectedAt: new Date(now).toISOString()
        };

        return {
          ...state,
          devRulesReminder: {
            ...reminderState,
            scopes
          }
        };
      }

      shouldInject = true;
      scopes[scopeKey] = {
        ...scopeState,
        pendingAt: new Date(now).toISOString()
      };

      return {
        ...state,
        devRulesReminder: {
          ...reminderState,
          scopes
        }
      };
    });

    if (!updated) {
      return {
        shouldInject: !transcriptAlreadyInjected,
        reserved: false
      };
    }

    return { shouldInject, reserved: shouldInject };
  } catch {
    return {
      shouldInject: !transcriptAlreadyInjected,
      reserved: false
    };
  }
}

/**
 * Persist a recent injection marker for the current session and clear the pending reservation.
 * @param {string|null} sessionId - Session identifier
 * @param {string|null} [scopeKey='session'] - Scope key for cwd/transcript-aware dedup
 * @returns {boolean} true when the marker is written
 */
function markRecentlyInjected(sessionId, scopeKey = 'session') {
  if (!sessionId) return false;

  try {
    return updateSessionState(sessionId, (state) => {
      const reminderState = state.devRulesReminder && typeof state.devRulesReminder === 'object'
        ? state.devRulesReminder
        : {};
      const scopes = pruneReminderScopes(reminderState.scopes);
      const scopeState = getReminderScopeState({ scopes }, scopeKey) || {};

      scopes[scopeKey] = {
        ...scopeState,
        lastInjectedAt: new Date().toISOString()
      };
      delete scopes[scopeKey].pendingAt;

      return {
        ...state,
        devRulesReminder: {
          ...reminderState,
          scopes
        }
      };
    });
  } catch {
    return false;
  }
}

/**
 * Clear a pending reservation when the hook fails after reserving a slot.
 * @param {string|null} sessionId - Session identifier
 * @param {string|null} [scopeKey='session'] - Scope key for cwd/transcript-aware dedup
 * @returns {boolean} true when cleanup succeeds
 */
function clearPendingInjection(sessionId, scopeKey = 'session') {
  if (!sessionId) return false;

  try {
    return updateSessionState(sessionId, (state) => {
      const reminderState = state.devRulesReminder && typeof state.devRulesReminder === 'object'
        ? state.devRulesReminder
        : {};
      const scopes = pruneReminderScopes(reminderState.scopes);
      const scopeState = getReminderScopeState({ scopes }, scopeKey);

      if (!scopeState || !scopeState.pendingAt) {
        return state;
      }

      const nextScopeState = { ...scopeState };
      delete nextScopeState.pendingAt;

      if (Object.keys(nextScopeState).length === 0) {
        delete scopes[scopeKey];
      } else {
        scopes[scopeKey] = nextScopeState;
      }

      return {
        ...state,
        devRulesReminder: {
          ...reminderState,
          scopes
        }
      };
    });
  } catch {
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION BUILDERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Build language section
 * @param {Object} params
 * @param {string} [params.thinkingLanguage] - Language for thinking
 * @param {string} [params.responseLanguage] - Language for response
 * @returns {string[]} Lines for language section
 */
function buildLanguageSection({ thinkingLanguage, responseLanguage }) {
  // Auto-default thinkingLanguage to 'en' when only responseLanguage is set
  const effectiveThinking = thinkingLanguage || (responseLanguage ? 'en' : null);
  const hasThinking = effectiveThinking && effectiveThinking !== responseLanguage;
  const hasResponse = responseLanguage;
  const lines = [];

  if (hasThinking || hasResponse) {
    lines.push(`## Language`);
    if (hasThinking) {
      lines.push(`- Thinking: Use ${effectiveThinking} for reasoning (logic, precision).`);
    }
    if (hasResponse) {
      lines.push(`- Response: Respond in ${responseLanguage} (natural, fluent).`);
    }
    lines.push(``);
  }

  return lines;
}

/**
 * Build assistant profile section from config.assistant.* fields.
 * Returns [] when all fields are null — no output for projects that don't set a persona.
 * @param {Object} [assistant] - config.assistant object
 * @returns {string[]}
 */
function buildAssistantSection(assistant = {}) {
  const { name, addressStyle, language, codeComments, documentation } = assistant;
  if (!name && !addressStyle && !language) return [];
  const lines = ['## Assistant Profile'];
  if (name)          lines.push(`- **Name:** ${name}`);
  if (language)      lines.push(`- **Conversation language:** ${language}`);
  if (addressStyle)  lines.push(`- **Address style:** ${addressStyle}`);
  if (codeComments)  lines.push(`- **Code comments:** ${codeComments}`);
  if (documentation) lines.push(`- **Documentation:** ${documentation}`);
  lines.push('');
  return lines;
}

/**
 * Build session section
 * @param {Object} [staticEnv] - Pre-computed static environment info
 * @returns {string[]} Lines for session section
 */
function buildSessionSection(staticEnv = {}) {
  const memUsed = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
  const memTotal = Math.round(os.totalmem() / 1024 / 1024);
  const memPercent = Math.round((memUsed / memTotal) * 100);
  const cpuUsage = Math.round((process.cpuUsage().user / 1000000) * 100);
  const cpuSystem = Math.round((process.cpuUsage().system / 1000000) * 100);

  return [
    `## Session`,
    `- DateTime: ${new Date().toLocaleString()}`,
    `- CWD: ${staticEnv.cwd || process.cwd()}`,
    `- Timezone: ${staticEnv.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone}`,
    `- Working directory: ${staticEnv.cwd || process.cwd()}`,
    `- OS: ${staticEnv.osPlatform || process.platform}`,
    `- User: ${staticEnv.user || process.env.USERNAME || process.env.USER}`,
    `- Locale: ${staticEnv.locale || process.env.LANG || ''}`,
    `- Memory usage: ${memUsed}MB/${memTotal}MB (${memPercent}%)`,
    `- CPU usage: ${cpuUsage}% user / ${cpuSystem}% system`,
    `- Spawning multiple subagents can cause performance issues, spawn and delegate tasks intelligently based on the available system resources.`,
    `- Remember that each subagent only has 200K tokens in context window, spawn and delegate tasks intelligently to make sure their context windows don't get bloated.`,
    `- IMPORTANT: Include these environment information when prompting subagents to perform tasks.`,
    ``
  ];
}

/**
 * Read usage limits from the unified flat cache (written by haily-usage.cjs).
 * @returns {{ ts: number, eligible: boolean, fiveHour: number|null, week: number|null, resetsAt: string|null }|null}
 */
function readUsageCache() {
  try {
    const cache = JSON.parse(fs.readFileSync(USAGE_CACHE_FILE, 'utf-8'));
    if (cache && typeof cache.ts === 'number' && Date.now() - cache.ts < 300_000 && cache.eligible) {
      return cache;
    }
  } catch { }
  return null;
}

/**
 * Format time until reset
 * @param {string} resetAt - ISO timestamp
 * @returns {string|null} Formatted time or null
 */
function formatTimeUntilReset(resetAt) {
  if (!resetAt) return null;
  const resetTime = new Date(resetAt);
  const remaining = Math.floor(resetTime.getTime() / 1000) - Math.floor(Date.now() / 1000);
  if (remaining <= 0 || remaining > 18000) return null; // Only show if < 5 hours
  const hours = Math.floor(remaining / 3600);
  const mins = Math.floor((remaining % 3600) / 60);
  return `${hours}h ${mins}m`;
}

/**
 * Format percentage with warning level
 * @param {number} value - Percentage value
 * @param {string} label - Label prefix
 * @returns {string} Formatted string with warning if applicable
 */
function formatUsagePercent(value, label) {
  const pct = Math.round(value);
  if (pct >= CRITICAL_THRESHOLD) return `${label}: ${pct}% [CRITICAL]`;
  if (pct >= WARN_THRESHOLD) return `${label}: ${pct}% [WARNING]`;
  return `${label}: ${pct}%`;
}

/**
 * Build context window section from statusline cache
 * @param {string} sessionId - Session ID
 * @returns {string[]} Lines for context section
 */
function buildContextSection(sessionId) {
  // TEMPORARILY DISABLED
  return [];
  if (!sessionId) return [];

  // RE-ENABLED IF NEEDED IN THE FUTURE
  try {
    const contextPath = path.join(os.tmpdir(), `ck-context-${sessionId}.json`);
    if (!fs.existsSync(contextPath)) return [];

    const data = JSON.parse(fs.readFileSync(contextPath, 'utf-8'));
    // Only use fresh data (< 5 min old - statusline updates every 300ms when active)
    if (Date.now() - data.timestamp > 300000) return [];

    const lines = [`## Current Session's Context`];

    // Format: 48% used (96K/200K tokens)
    const usedK = Math.round(data.tokens / 1000);
    const sizeK = Math.round(data.size / 1000);
    lines.push(`- Context: ${data.percent}% used (${usedK}K/${sizeK}K tokens)`);
    lines.push(`- **NOTE:** Optimize the workflow for token efficiency`);

    // Warning if high usage
    if (data.percent >= CRITICAL_THRESHOLD) {
      lines.push(`- **CRITICAL:** Context nearly full. Before compaction hits:`);
      lines.push(`  1. Update TodoWrite with current progress (completed + remaining)`);
      lines.push(`  2. Be extremely concise — no verbose explanations`);
      lines.push(`  3. Session state will auto-restore after compaction`);
    } else if (data.percent >= WARN_THRESHOLD) {
      lines.push(`- **WARNING:** Context usage moderate - be concise, optimize token efficiency, keep tool outputs short.`);
    }

    lines.push(``);
    return lines;
  } catch {
    return [];
  }
}

/**
 * Build usage section from cache
 * @returns {string[]} Lines for usage section
 */
function buildUsageSection() {
  const usage = readUsageCache();
  if (!usage) return [];

  const lines = [];
  const parts = [];

  if (typeof usage.fiveHour === 'number') {
    parts.push(formatUsagePercent(usage.fiveHour, '5h'));
    const timeLeft = formatTimeUntilReset(usage.resetsAt);
    if (timeLeft) parts.push(`resets in ${timeLeft}`);
  }

  if (typeof usage.week === 'number') {
    parts.push(formatUsagePercent(usage.week, '7d'));
  }

  if (parts.length > 0) {
    lines.push(`## Usage Limits`);
    lines.push(`- ${parts.join(' | ')}`);
    lines.push(``);
  }

  return lines;
}

/**
 * Build rules section
 * @param {Object} params
 * @param {string} [params.devRulesPath] - Path to dev rules
 * @param {string} [params.skillsVenv] - Path to skills venv
 * @param {string} [params.plansPath] - Absolute plans path (Issue #476: prevents wrong subdirectory creation)
 * @param {string} [params.docsPath] - Absolute docs path
 * @returns {string[]} Lines for rules section
 */
function buildRulesSection({ devRulesPath, skillsVenv, plansPath, docsPath }) {
  const lines = [`## Rules`];

  if (devRulesPath) {
    lines.push(`- Development rules: "${devRulesPath}"`);
  }

  // Issue #476: Use absolute paths to prevent LLM confusion in multi-CLAUDE.md projects
  const plansRef = plansPath || '.agents';
  const docsRef = docsPath || 'docs';
  lines.push(`- DO NOT create markdown files outside "${plansRef}" or "${docsRef}" unless user explicitly requests it.`);

  if (skillsVenv) {
    lines.push(`- Python scripts: use \`${skillsVenv}\``);
  }

  lines.push(``);

  return lines;
}

/**
 * Build output-verbosity section. Only emits for the non-default 'concise'
 * mode — 'standard' needs no reminder, so the common case pays zero extra
 * bytes on this 5-minute-TTL injection. Scope is MAIN-session chat only: it
 * never governs agent Report Contracts (kit/agents/*.md) or model-trace lines
 * (`haily-tracer.cjs`), which this hook does not touch.
 * @param {string} [verbosity] - config.output.verbosity value
 * @returns {string[]} Lines for the output-mode section
 */
function buildOutputModeSection(verbosity) {
  if (verbosity !== 'concise') return [];
  return [
    `## Output Mode`,
    `- Verbosity: concise — status lines ≤1 line, summaries lead with outcome, no decorative tables. Model-trace lines are exempt.`,
    ``
  ];
}

/**
 * Build modularization section
 * @returns {string[]} Lines for modularization section
 */
function buildModularizationSection() {
  return [
    `## **[IMPORTANT] Consider Modularization:**`,
    `- Check existing modules before creating new`,
    `- Analyze logical separation boundaries (functions, classes, concerns)`,
    `- Prefer kebab-case for JS/TS/Python/shell; respect language conventions (C#/Java use PascalCase, Go/Rust use snake_case)`,
    `- Write descriptive code comments`,
    `- After modularization, continue with main task`,
    `- When not to modularize: Markdown files, plain text files, bash scripts, configuration files, environment variables files, etc.`,
    ``
  ];
}

/**
 * Build paths section
 * @param {Object} params
 * @param {string} params.reportsPath - Reports path
 * @param {string} params.plansPath - Plans path
 * @param {string} params.docsPath - Docs path
 * @param {number} [params.docsMaxLoc=800] - Max lines of code for docs
 * @returns {string[]} Lines for paths section
 */
function buildPathsSection({ reportsPath, plansPath, docsPath, docsMaxLoc = 800 }) {
  return [
    `## Paths`,
    `Reports: ${reportsPath} | Plans: ${plansPath}/ | Docs: ${docsPath}/ | docs.maxLoc: ${docsMaxLoc}`,
    ``
  ];
}

/**
 * Build plan context section
 * @param {Object} params
 * @param {string} params.planLine - Plan status line
 * @param {string} params.reportsPath - Reports path
 * @param {string} [params.gitBranch] - Git branch
 * @param {string} params.validationMode - Validation mode
 * @param {number} params.validationMin - Min questions
 * @param {number} params.validationMax - Max questions
 * @returns {string[]} Lines for plan context section
 */
function buildPlanContextSection({ planLine, reportsPath, gitBranch, validationMode, validationMin, validationMax, activePhaseSummary }) {
  const lines = [
    `## Plan Context`,
    planLine,
    `- Reports: ${reportsPath}`
  ];

  if (gitBranch) {
    lines.push(`- Branch: ${gitBranch}`);
  }

  lines.push(`- Validation: mode=${validationMode}, questions=${validationMin}-${validationMax}`);

  if (activePhaseSummary) {
    lines.push(``);
    lines.push(activePhaseSummary);
  }

  lines.push(``);

  return lines;
}

/**
 * Build naming section
 * @param {Object} params
 * @param {string} params.reportsPath - Reports path
 * @param {string} params.plansPath - Plans path
 * @param {string} params.namePattern - Naming pattern
 * @returns {string[]} Lines for naming section
 */
function buildNamingSection({ reportsPath, plansPath, namePattern }) {
  return [
    `## Naming`,
    `- Report: \`${reportsPath}{type}-${namePattern}.md\``,
    `- Plan dir: \`${plansPath}/${namePattern}/\``,
    `- Replace \`{type}\` with: agent name, report type, or context`,
    `- Replace \`{slug}\` in pattern with: descriptive-kebab-slug`
  ];
}

/**
 * Build language-specific standards section by injecting the matching lang rules file content.
 * Returns [] only when no language was detected. When a language IS detected but no
 * standards file ships for it, emits a one-line miss-note instead of silent [] — a
 * weak model otherwise has no signal that scaffolding it expects is simply absent.
 * @param {string|null} language - Detected language key (e.g. 'typescript', 'golang')
 * @param {string} [configDirName='.claude'] - Config directory name
 * @returns {string[]} Lines to inject, or [] if nothing to inject
 */
function buildLangStandardsSection(language, configDirName = '.claude') {
  if (!language) return [];
  const filename = `lang-${language}.md`;
  const resolvedPath = resolveStandardsPath(filename, configDirName);
  if (!resolvedPath) {
    return [`## Language Standards (${language})`, `- No standards file shipped for ${language} — proceeding without language scaffolding.`, ``];
  }

  try {
    const fullPath = resolvedPath.startsWith('~')
      ? path.join(os.homedir(), resolvedPath.slice(1))
      : path.join(process.cwd(), resolvedPath);
    const content = fs.readFileSync(fullPath, 'utf8').trim();
    return [`## Language Standards (${language})`, content, ``];
  } catch {
    return [];
  }
}

/**
 * Build framework-specific standards section by injecting the matching framework rules file.
 * Returns [] when framework is null, unknown, or the file doesn't exist — silent no-op.
 * @param {string|null} framework - Detected framework key (e.g. 'next', 'react', 'tanstack-start')
 * @param {string} [configDirName='.claude'] - Config directory name
 * @returns {string[]} Lines to inject, or [] if nothing to inject
 */
function buildFrameworkStandardsSection(framework, configDirName = '.claude') {
  if (!framework) return [];
  const filename = `framework-${framework}.md`;
  const resolvedPath = resolveStandardsPath(filename, configDirName);
  if (!resolvedPath) return [];

  try {
    const fullPath = resolvedPath.startsWith('~')
      ? path.join(os.homedir(), resolvedPath.slice(1))
      : path.join(process.cwd(), resolvedPath);
    const content = fs.readFileSync(fullPath, 'utf8').trim();
    return [`## Framework Standards (${framework})`, content, ``];
  } catch {
    return [];
  }
}

/**
 * Build standards sections for secondary framework signals (libraries, tooling,
 * sub-frameworks). Each extra maps to a `framework-{name}.md` rule
 * file. Silently skips entries with no corresponding file.
 *
 * @param {string[]} extras - Array of extra framework keys (e.g. ['better-auth', 'monorepo'])
 * @param {string} [configDirName='.claude'] - Config directory name
 * @returns {string[]} Lines to inject (may be multiple sections concatenated)
 */
function buildFrameworkExtrasStandardsSection(extras, configDirName = '.claude') {
  if (!Array.isArray(extras) || extras.length === 0) return [];

  const sections = [];
  for (const extra of extras) {
    if (!extra || typeof extra !== 'string') continue;
    const filename = `framework-${extra}.md`;
    const resolvedPath = resolveStandardsPath(filename, configDirName);
    if (!resolvedPath) continue;
    try {
      const fullPath = resolvedPath.startsWith('~')
        ? path.join(os.homedir(), resolvedPath.slice(1))
        : path.join(process.cwd(), resolvedPath);
      const content = fs.readFileSync(fullPath, 'utf8').trim();
      sections.push(`## Framework Standards (${extra})`, content, ``);
    } catch { /* skip missing files silently */ }
  }
  return sections;
}

/**
 * Keyword + skill-slug triggers for on-demand contextual rule injection.
 * Each entry maps a rule file to a regex tested against the raw user prompt text.
 *
 * Prompts naturally carry the slash text a user types (e.g. `/hc-review`), so
 * matching skill invocation is the same code path as keyword matching — no new
 * hook/event is needed (see phase-03 Design Decision, Option A). Both legacy
 * colon form (`hc:review`) and current slash form (`/hc-review`) are matched
 * during the transition window.
 *
 * Slash-slug alternations use `(?<![\w./-])\/slug\b(?!\/)` instead of a plain
 * `\/slug\b`: the plain form false-positives on path mentions like
 * `kit/skills/hc-cook/SKILL.md` (the `\b` after "hc-cook" is satisfied by the
 * following "/" same as it would be by a space). The lookbehind rejects a
 * slash preceded by another path-ish char (word char, `.`, `-`, `/`); the
 * lookahead rejects a slash immediately followed by another `/` (path
 * continues). Together they only match the slug as a standalone command
 * token — start of string, or after whitespace/punctuation — not as a path
 * segment.
 */
const CONTEXTUAL_TRIGGERS = [
  {
    file: 'orchestration-protocol.md',
    // NOTE: matches spawn/subagent/delegate patterns, plus workflow skills that
    // spawn subagents internally (/hc-cook, /hc-goal, /hc-plan) — orchestration
    // rules are needed the moment one of those skills is invoked, not only when
    // the user spells out "spawn" or "delegate".
    pattern: /\bspawn\b|\bsubagent\b|\bsub-agent\b|\bdelegate\b|\bagent.?team\b|\bTask\s+tool\b|\borchestrat|(?<![\w./-])\/hc-cook\b(?!\/)|(?<![\w./-])\/hc-goal\b(?!\/)|(?<![\w./-])\/hc-plan\b(?!\/)/i
  },
  {
    file: 'team-coordination-rules.md',
    // NOTE: only needed inside Agent Team sessions
    pattern: /\bteammate\b|\bagent.?team\b|\bhl:team\b|\bSendMessage\b|\bTeam\b.*\bagent\b/i
  },
  {
    file: 'review-audit-self-decision.md',
    // NOTE: review/audit sessions need sticky-decision and threat-model rules.
    // Matches both legacy colon form and current slash form of the review/security skills.
    pattern: /\breview\b|\baudit\b|\bsecurity.?review\b|\bcode.?review\b|\bred.?team\b|\bhc:review\b|\bhc:security\b|(?<![\w./-])\/hc-review\b(?!\/)|(?<![\w./-])\/hc-security\b(?!\/)/i
  }
];

/**
 * Build contextual rule sections injected on-demand via prompt keyword/skill-slug detection.
 * Files live in contextual/ (not rules/) so Claude Code won't auto-load them.
 *
 * Dedup: each file injects at most once per call even if multiple triggers in
 * CONTEXTUAL_TRIGGERS resolve to the same filename (e.g. a future entry adding
 * a second pattern for an already-matched file).
 *
 * @param {string} prompt - User prompt text to scan for trigger keywords/skill slugs
 * @param {string} [configDirName='.claude'] - Config directory name
 * @returns {string[]} Lines to inject (may be empty)
 */
function buildContextualRulesSection(prompt, configDirName = '.claude') {
  if (!prompt) return [];
  const sections = [];
  const injectedFiles = new Set();
  for (const { file, pattern } of CONTEXTUAL_TRIGGERS) {
    if (injectedFiles.has(file)) continue;
    if (!pattern.test(prompt)) continue;
    const resolvedPath = resolveContextualPath(file, configDirName);
    if (!resolvedPath) continue;
    try {
      const fullPath = resolvedPath.startsWith('~')
        ? path.join(os.homedir(), resolvedPath.slice(1))
        : path.join(process.cwd(), resolvedPath);
      const content = fs.readFileSync(fullPath, 'utf8').trim();
      sections.push(content, ``);
      injectedFiles.add(file);
    } catch { /* skip missing files silently */ }
  }
  return sections;
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN ENTRY POINTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Build full reminder content from all sections
 * @param {Object} params - All parameters for building reminder
 * @returns {string[]} Array of lines
 */
function buildReminder(params) {
  const {
    sessionId,
    assistant,
    thinkingLanguage,
    responseLanguage,
    devRulesPath,
    skillsVenv,
    reportsPath,
    plansPath,
    docsPath,
    docsMaxLoc,
    planLine,
    gitBranch,
    namePattern,
    validationMode,
    validationMin,
    validationMax,
    activePhaseSummary,
    hooks,
    language,
    framework,
    frameworkExtras,
    configDirName,
    prompt,
    outputVerbosity
  } = params;

  // Respect hooks config — skip sections when their corresponding hook is disabled
  const hooksConfig = hooks || {};
  const contextEnabled = hooksConfig['context-tracking'] !== false;
  const usageEnabled = hooksConfig['haily-usage'] !== false;

  return [
    ...buildAssistantSection(assistant),
    ...buildLanguageSection({ thinkingLanguage, responseLanguage }),
    ...(contextEnabled ? buildContextSection(sessionId) : []),
    ...(usageEnabled ? buildUsageSection() : []),
    ...buildRulesSection({ devRulesPath, skillsVenv, plansPath, docsPath }),
    ...buildContextualRulesSection(prompt, configDirName),
    ...buildLangStandardsSection(language, configDirName),
    ...buildFrameworkStandardsSection(framework, configDirName),
    ...buildFrameworkExtrasStandardsSection(frameworkExtras, configDirName),
    ...buildPathsSection({ reportsPath, plansPath, docsPath, docsMaxLoc }),
    ...buildPlanContextSection({ planLine, reportsPath, gitBranch, validationMode, validationMin, validationMax, activePhaseSummary }),
    ...buildNamingSection({ reportsPath, plansPath, namePattern }),
    ...buildOutputModeSection(outputVerbosity)
  ];
}

/**
 * Build complete reminder context (unified entry point for plugins)
 *
 * @param {Object} [params]
 * @param {string} [params.sessionId] - Session ID
 * @param {Object} [params.config] - CK config (auto-loaded if not provided)
 * @param {Object} [params.staticEnv] - Pre-computed static environment info
 * @param {string} [params.configDirName='.claude'] - Config directory name
 * @param {string} [params.baseDir] - Base directory for absolute path resolution (Issue #327)
 * @param {string} [params.prompt] - User prompt text for contextual rule injection
 * @returns {{
 *   content: string,
 *   lines: string[],
 *   sections: Object
 * }}
 */
function buildReminderContext({ sessionId, config, staticEnv, configDirName = '.claude', baseDir, prompt } = {}) {
  // Load config if not provided
  const cfg = config || loadConfig({ includeProject: false, includeAssertions: false });

  // Resolve paths
  const devRulesPath = resolveRulesPath('coding.md', configDirName);
  const skillsVenv = resolveSkillsVenv(configDirName);

  // Detect primary language and framework from project files — silent no-op if unrecognized
  const language = detectPrimaryLanguage(baseDir || process.cwd());
  const framework = detectFramework();
  const frameworkExtras = detectFrameworkExtras();

  // Build plan context
  const planCtx = buildPlanContext(sessionId, cfg);

  // Issue #327: Use baseDir for absolute path resolution (subdirectory workflow support)
  // If baseDir provided, resolve paths as absolute; otherwise use relative paths
  const effectiveBaseDir = baseDir || null;
  const plansPathRel = normalizePath(cfg.paths?.plans) || '.agents';
  const docsPathRel = normalizePath(cfg.paths?.docs) || 'docs';

  // Build all parameters with absolute paths if baseDir provided
  const params = {
    sessionId,
    assistant: cfg.assistant,
    thinkingLanguage: cfg.locale?.thinkingLanguage,
    responseLanguage: cfg.locale?.responseLanguage,
    devRulesPath,
    skillsVenv,
    reportsPath: effectiveBaseDir ? path.join(effectiveBaseDir, planCtx.reportsPath) : planCtx.reportsPath,
    plansPath: effectiveBaseDir ? path.join(effectiveBaseDir, plansPathRel) : plansPathRel,
    docsPath: effectiveBaseDir ? path.join(effectiveBaseDir, docsPathRel) : docsPathRel,
    docsMaxLoc: Math.max(1, parseInt(cfg.docs?.maxLoc, 10) || 800),
    planLine: planCtx.planLine,
    gitBranch: planCtx.gitBranch,
    namePattern: planCtx.namePattern,
    validationMode: planCtx.validationMode,
    validationMin: planCtx.validationMin,
    validationMax: planCtx.validationMax,
    activePhaseSummary: planCtx.activePhaseSummary,
    staticEnv,
    hooks: cfg.hooks,
    language,
    framework,
    frameworkExtras,
    configDirName,
    prompt,
    outputVerbosity: cfg.output?.verbosity
  };

  const lines = buildReminder(params);

  // Respect hooks config for sections object too
  const hooksConfig = cfg.hooks || {};
  const contextEnabled = hooksConfig['context-tracking'] !== false;
  const usageEnabled = hooksConfig['haily-usage'] !== false;

  return {
    content: lines.join('\n'),
    lines,
    sections: {
      language: buildLanguageSection({ thinkingLanguage: params.thinkingLanguage, responseLanguage: params.responseLanguage }),
      context: contextEnabled ? buildContextSection(sessionId) : [],
      usage: usageEnabled ? buildUsageSection() : [],
      rules: buildRulesSection({ devRulesPath, skillsVenv, plansPath: params.plansPath, docsPath: params.docsPath }),
      contextualRules: buildContextualRulesSection(prompt, configDirName),
      langStandards: buildLangStandardsSection(language, configDirName),
      frameworkStandards: buildFrameworkStandardsSection(framework, configDirName),
      frameworkExtrasStandards: buildFrameworkExtrasStandardsSection(frameworkExtras, configDirName),
      paths: buildPathsSection({ reportsPath: params.reportsPath, plansPath: params.plansPath, docsPath: params.docsPath, docsMaxLoc: params.docsMaxLoc }),
      planContext: buildPlanContextSection(planCtx),
      naming: buildNamingSection({ reportsPath: params.reportsPath, plansPath: params.plansPath, namePattern: params.namePattern }),
      outputMode: buildOutputModeSection(params.outputVerbosity)
    }
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

module.exports = {
  // Main entry points
  buildReminderContext,
  buildReminder,

  // Section builders
  buildAssistantSection,
  buildLanguageSection,
  buildSessionSection,
  buildContextSection,
  buildUsageSection,
  buildRulesSection,
  buildLangStandardsSection,
  buildFrameworkStandardsSection,
  buildFrameworkExtrasStandardsSection,
  buildContextualRulesSection,
  buildModularizationSection,
  buildOutputModeSection,
  buildPathsSection,
  buildPlanContextSection,
  buildNamingSection,

  // Plan helpers
  extractActivePhaseSummary,
  buildPlanContext,

  // Helpers
  execSafe,
  resolveRulesPath,
  resolveStandardsPath,
  resolveContextualPath,
  resolveScriptPath,
  resolveSkillsVenv,
  buildPlanContext,
  buildInjectionScopeKey,
  wasRecentlyInjected,
  reserveInjectionScope,
  markRecentlyInjected,
  clearPendingInjection,

  // Backward compat alias
  resolveWorkflowPath: resolveRulesPath
};
