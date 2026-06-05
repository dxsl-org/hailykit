#!/usr/bin/env node
/**
 * logger.cjs — Structured JSONL logging for HailyKit hooks.
 *
 * Appends one JSON line per event to `.logs/hook-log.jsonl`. Auto-rotates at
 * MAX_LOG_LINES by keeping the most recent KEEP_LOG_LINES lines. Uses a lock
 * file to prevent concurrent writes from corrupting the log.
 *
 * @module logger
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

// ═══════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════

const MAX_LOG_LINES = 1000;
const KEEP_LOG_LINES = 500;
const LOCK_STALE_MS = 3000;
const LOCK_RETRY_MS = 5;
const LOCK_TIMEOUT_MS = 200;

// ═══════════════════════════════════════════════════════
// INTERNAL HELPERS
// ═══════════════════════════════════════════════════════

function _logPath() {
  return path.join(process.cwd(), '.logs', 'hook-log.jsonl');
}

function _lockPath() {
  return _logPath() + '.lock';
}

function _ensureDir() {
  try { fs.mkdirSync(path.dirname(_logPath()), { recursive: true }); } catch { /* ignore */ }
}

function _acquireLock() {
  const lp = _lockPath();
  const deadline = Date.now() + LOCK_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      fs.writeFileSync(lp, String(process.pid), { flag: 'wx' });
      return lp;
    } catch {
      try {
        const age = Date.now() - fs.statSync(lp).mtimeMs;
        if (age > LOCK_STALE_MS) fs.unlinkSync(lp);
      } catch { /* ignore */ }
      const end = Date.now() + LOCK_RETRY_MS;
      while (Date.now() < end) { /* spin */ }
    }
  }
  return null;
}

function _releaseLock(lp) {
  if (!lp) return;
  try { fs.unlinkSync(lp); } catch { /* ignore */ }
}

function _rotateIfNeeded(logPath) {
  try {
    const lines = fs.readFileSync(logPath, 'utf8').split('\n').filter(Boolean);
    if (lines.length < MAX_LOG_LINES) return;
    fs.writeFileSync(logPath, lines.slice(-KEEP_LOG_LINES).join('\n') + '\n', 'utf8');
  } catch { /* no-op if file missing */ }
}

// ═══════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════

/**
 * Append one structured log entry to hook-log.jsonl.
 * Never throws — all errors swallowed to keep hooks fail-open.
 * @param {string} hookName
 * @param {Object} data
 */
function logHook(hookName, data) {
  try {
    _ensureDir();
    const entry = JSON.stringify({
      ts: new Date().toISOString(),
      hook: hookName,
      pid: process.pid,
      ...data
    });
    const lp = _acquireLock();
    try {
      _rotateIfNeeded(_logPath());
      fs.appendFileSync(_logPath(), entry + '\n', 'utf8');
    } finally {
      _releaseLock(lp);
    }
  } catch { /* fail silently */ }
}

/**
 * Create a timing wrapper. Call `timer.end({ status, exit, note? })` on every
 * exit path to log hook duration and outcome.
 * @param {string} hookName
 * @param {Object} [baseData]
 * @returns {{ end: (result: Object) => void }}
 */
function createHookTimer(hookName, baseData = {}) {
  const start = Date.now();
  return {
    end(result = {}) {
      logHook(hookName, { ...baseData, ...result, durationMs: Date.now() - start });
    }
  };
}

/**
 * Log an unhandled exception from a hook's outer crash wrapper.
 * @param {string} hookName
 * @param {Error} error
 * @param {Object} [data]
 */
function logHookCrash(hookName, error, data = {}) {
  logHook(hookName, {
    status: 'crash',
    exit: 0,
    error: error?.message || String(error),
    stack: error?.stack?.split('\n').slice(0, 3).join(' | '),
    ...data
  });
}

module.exports = { logHook, createHookTimer, logHookCrash };
