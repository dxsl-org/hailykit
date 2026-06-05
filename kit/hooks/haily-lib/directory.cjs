#!/usr/bin/env node
/**
 * directory.cjs — Pattern matching and command allowlisting for directory access guard.
 *
 * Determines whether a tool call should be blocked by haily.json[guard.block] patterns or broad-glob
 * detection. Build commands, venv executables, and venv creation commands are always
 * allowed through. Delegates pattern matching to the directory-guard submodule.
 *
 * @module directory
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

// ═══════════════════════════════════════════════════════
// COMMAND PATTERNS  (verbatim from spec — do not change)
// ═══════════════════════════════════════════════════════

// NOTE: These regex strings are a behavioral contract. Pattern-matcher tests depend on them.
const BUILD_COMMAND_PATTERN = /^(npm|pnpm|yarn|bun)\s+([^\s]+\s+)*(run\s+)?(build|test|lint|dev|start|install|ci|add|remove|update|publish|pack|init|create|exec)/;
const VENV_EXECUTABLE_PATTERN = /(^|[/\\])\.?venv[/\\](bin|Scripts)[/\\]/;
const VENV_CREATION_PATTERN = /^(python3?|py)\s+(-[\w.]+\s+)*-m\s+venv\s+|^uv\s+venv(\s|$)|^virtualenv\s+/;
// Also allow: cargo, make, pip, go, dotnet build-like commands
const TOOL_COMMAND_PATTERN = /^(cargo|make|cmake|gradle|mvn|dotnet|go|pip3?|poetry|uv)\s+(build|test|run|check|install|fmt|vet|clean|add|remove|update|sync|lock)/;
// Infra/cloud tools: kubectl, terraform, helm, docker; always allow their standard sub-commands.
const INFRA_COMMAND_PATTERN = /^(kubectl|terraform|helm|docker|docker\s+compose|docker-compose)\s+(apply|get|describe|delete|exec|logs|init|plan|install|upgrade|uninstall|list|build|push|pull|run|compose|ps|start|stop|create|deploy|rollout|status|scale|port-forward|diff|output|validate|refresh|import|state|workspace)/;

// ═══════════════════════════════════════════════════════
// COMMAND CLASSIFICATION
// ═══════════════════════════════════════════════════════

/** Strip env-var prefixes and sudo/timeout wrappers. */
function stripCommandPrefix(command) {
  if (!command) return '';
  let s = command.trim();
  // Remove VAR=val prefixes
  s = s.replace(/^(\w+=\S+\s+)+/, '');
  // Remove sudo/env/timeout wrappers
  s = s.replace(/^(sudo|env|timeout\s+\S+)\s+/, '');
  return s.trim();
}

/** @param {string} command @returns {boolean} */
function isBuildCommand(command) {
  const s = stripCommandPrefix(command);
  return BUILD_COMMAND_PATTERN.test(s) || TOOL_COMMAND_PATTERN.test(s) || INFRA_COMMAND_PATTERN.test(s);
}

/** @param {string} command @returns {boolean} */
function isVenvExecutable(command) {
  return VENV_EXECUTABLE_PATTERN.test(command || '');
}

/** @param {string} command @returns {boolean} */
function isVenvCreationCommand(command) {
  return VENV_CREATION_PATTERN.test((command || '').trim());
}

/**
 * Returns true when the command is unconditionally allowed.
 * @param {string} command @returns {boolean}
 */
function isAllowedCommand(command) {
  const s = stripCommandPrefix(command || '');
  return isBuildCommand(s) || isVenvExecutable(s) || isVenvCreationCommand(s);
}

/** Split compound shell commands at &&, ||, ; boundaries. */
function splitCompoundCommand(command) {
  return (command || '').split(/&&|\|\||;/).map((s) => s.trim()).filter(Boolean);
}

// ═══════════════════════════════════════════════════════
// GIT + HLIGNORE RESOLUTION
// ═══════════════════════════════════════════════════════

/** @param {string} startDir @returns {string|null} */
function findGitRoot(startDir) {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], {
      encoding: 'utf8', timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true, cwd: startDir
    }).trim() || null;
  } catch { return null; }
}

// ═══════════════════════════════════════════════════════
// MAIN ENTRY
// ═══════════════════════════════════════════════════════

const { loadPatterns, createMatcher, matchPath } = require('../haily-guard/pattern.cjs');
const { extractFromToolInput } = require('../haily-guard/path.cjs');
const { detectBroadPatternIssue, formatBroadPatternError } = require('../haily-guard/broad.cjs');
const { formatBlockedError } = require('../haily-guard/error.cjs');
const { loadConfig } = require('./config.cjs');

/**
 * Check whether the tool call should be blocked.
 * @param {{ toolName: string, toolInput: Object, options?: Object }} param
 * @returns {{ blocked: boolean, reason: string|null, pattern: string|null, message: string|null }}
 */
function checkScoutBlock({ toolName, toolInput, options = {} }) {
  const cwd = options.cwd || process.cwd();
  const configDirName = options.configDirName || '.claude';

  // Check bash command allowlist first
  if (toolName === 'Bash') {
    const cmd = toolInput?.command || '';
    const parts = splitCompoundCommand(cmd);
    if (parts.every((p) => isAllowedCommand(p) || isAllowedCommand(stripCommandPrefix(p)))) {
      return { blocked: false, reason: null, pattern: null, message: null };
    }
  }

  // NOTE: Broad-pattern check runs before path extraction to preserve the path
  // context (toolInput.path) that detectBroadPatternIssue needs to distinguish
  // "**/*.ts" scoped to a specific dir (OK) from "**/*.ts" at project root (BLOCK).
  if (toolName === 'Glob' && toolInput?.pattern) {
    const broadIssue = detectBroadPatternIssue(toolInput);
    if (broadIssue?.blocked) {
      return { blocked: true, reason: 'broad-pattern', pattern: toolInput.pattern, message: formatBroadPatternError(broadIssue) };
    }
  }

  const candidates = extractFromToolInput(toolInput);
  if (candidates.length === 0) return { blocked: false, reason: null, pattern: null, message: null };

  // Load ignore patterns from merged config (DEFAULT → global → project haily.json).
  const cfg = loadConfig({ includeProject: true, includeAssertions: false, includeLocale: false });
  const patterns = loadPatterns(cfg.guard?.block, cfg.guard?.allow);
  const matcher = createMatcher(patterns);

  for (const candidate of candidates) {
    const matchResult = matchPath(matcher, candidate);
    if (matchResult?.blocked) {
      const configPath = path.join(cwd, configDirName, 'haily.json');
      const msg = formatBlockedError({ path: candidate, pattern: matchResult.pattern, tool: toolName, configPath });
      return { blocked: true, reason: 'ignore-pattern', pattern: matchResult.pattern || candidate, message: msg };
    }
  }

  return { blocked: false, reason: null, pattern: null, message: null };
}

module.exports = {
  checkScoutBlock, isBuildCommand, isVenvExecutable, isVenvCreationCommand,
  isAllowedCommand, splitCompoundCommand, stripCommandPrefix,
  findGitRoot,
  BUILD_COMMAND_PATTERN, VENV_EXECUTABLE_PATTERN, VENV_CREATION_PATTERN,
  TOOL_COMMAND_PATTERN, INFRA_COMMAND_PATTERN,
};
