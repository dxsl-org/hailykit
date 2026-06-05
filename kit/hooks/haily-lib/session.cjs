#!/usr/bin/env node
/**
 * session.cjs — Session-state persistence with file locking.
 *
 * Manages the per-session JSON state stored in os.tmpdir(). Uses an exclusive
 * lock file with stale-lock breaking to prevent concurrent corruption. Re-exported
 * through config.cjs — callers should not import this file directly.
 *
 * @module session
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');

// ═══════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════

const SESSION_STATE_LOCK_TIMEOUT_MS = 500;
const SESSION_STATE_LOCK_RETRY_MS = 10;
const SESSION_STATE_LOCK_STALE_MS = 5000;

// ═══════════════════════════════════════════════════════
// SESSION FILE PATHS
// ═══════════════════════════════════════════════════════

/**
 * Temp file path for a session's state JSON.
 * @param {string} sessionId
 * @returns {string}
 */
function getSessionTempPath(sessionId) {
  return path.join(os.tmpdir(), `hl-session-${sessionId}.json`);
}

function _getLockPath(sessionId) {
  return getSessionTempPath(sessionId) + '.lock';
}

// ═══════════════════════════════════════════════════════
// ATOMIC READ / WRITE
// ═══════════════════════════════════════════════════════

/**
 * Read session state from temp file. Returns null if missing or unreadable.
 * @param {string} sessionId
 * @returns {Object|null}
 */
function readSessionState(sessionId) {
  if (!sessionId) return null;
  try {
    const content = fs.readFileSync(getSessionTempPath(sessionId), 'utf8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Write session state atomically (write-to-tmp then rename).
 * @param {string} sessionId
 * @param {Object} state
 * @returns {boolean}
 */
function writeSessionState(sessionId, state) {
  if (!sessionId) return false;
  const dest = getSessionTempPath(sessionId);
  const tmp = dest + '.' + Math.random().toString(36).slice(2);
  try {
    fs.writeFileSync(tmp, JSON.stringify(state, null, 2), 'utf8');
    fs.renameSync(tmp, dest);
    return true;
  } catch {
    try { fs.unlinkSync(tmp); } catch { /* ignore */ }
    return false;
  }
}

// ═══════════════════════════════════════════════════════
// FILE LOCKING
// ═══════════════════════════════════════════════════════

function _sleepSync(ms) {
  if (ms <= 0) return;
  // NOTE: Atomics.wait blocks the thread without busy-spinning. Falls back to
  // busy-wait only when SharedArrayBuffer is unavailable (e.g. some CI envs).
  if (typeof SharedArrayBuffer === 'function' && typeof Atomics?.wait === 'function') {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
    return;
  }
  const end = Date.now() + ms;
  while (Date.now() < end) { /* busy fallback */ }
}

function _removeStale(lockPath) {
  try {
    const age = Date.now() - fs.statSync(lockPath).mtimeMs;
    if (age < SESSION_STATE_LOCK_STALE_MS) return false;
    fs.unlinkSync(lockPath);
    return true;
  } catch {
    return false;
  }
}

function _acquireLock(sessionId) {
  const lockPath = _getLockPath(sessionId);
  const deadline = Date.now() + SESSION_STATE_LOCK_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      fs.writeFileSync(lockPath, String(process.pid), { flag: 'wx' });
      return { lockPath };
    } catch {
      _removeStale(lockPath);
      _sleepSync(SESSION_STATE_LOCK_RETRY_MS);
    }
  }
  return null; // timed out — caller proceeds without lock (fail-open)
}

function _releaseLock(lock) {
  if (!lock?.lockPath) return;
  try { fs.unlinkSync(lock.lockPath); } catch { /* ignore */ }
}

// ═══════════════════════════════════════════════════════
// STATE UPDATER
// ═══════════════════════════════════════════════════════

/**
 * Lock → read → apply updater → write → unlock. Fail-open: if lock times out,
 * attempts the update without a lock (last-writer-wins, acceptable for low-freq updates).
 * @param {string} sessionId
 * @param {(state: Object) => Object} updater — must return the new state
 * @returns {boolean}
 */
function updateSessionState(sessionId, updater) {
  if (!sessionId || typeof updater !== 'function') return false;
  const lock = _acquireLock(sessionId);
  try {
    const current = readSessionState(sessionId) || {};
    return writeSessionState(sessionId, updater(current));
  } finally {
    _releaseLock(lock);
  }
}

// ═══════════════════════════════════════════════════════
// PLAN PATH RESOLUTION
// ═══════════════════════════════════════════════════════

/** Find the most recently modified plan.md under a plans directory. */
function findMostRecentPlan(plansDir) {
  try {
    if (!fs.existsSync(plansDir)) return null;
    let newest = null, newestTime = 0;
    for (const e of fs.readdirSync(plansDir, { withFileTypes: true })) {
      if (!e.isDirectory()) continue;
      const f = path.join(plansDir, e.name, 'plan.md');
      try { const t = fs.statSync(f).mtimeMs; if (t > newestTime) { newestTime = t; newest = f; } } catch { /* skip */ }
    }
    return newest;
  } catch { return null; }
}

function _git(args) {
  try { return execFileSync(args[0], args.slice(1), { encoding: 'utf8', timeout: 5000, stdio: ['pipe','pipe','pipe'], windowsHide: true }).trim() || null; } catch { return null; }
}

/**
 * Resolve the active plan path: session state (explicit) → branch pattern match.
 * @param {string} sessionId
 * @param {Object} config
 * @returns {{ path: string|null, resolvedBy: 'session'|'branch'|null }}
 */
function resolvePlanPath(sessionId, config) {
  const state = readSessionState(sessionId);
  if (state?.activePlan && fs.existsSync(state.activePlan)) {
    return { path: state.activePlan, resolvedBy: 'session' };
  }
  const branch = _git(['git', 'branch', '--show-current']);
  if (branch) {
    const pattern = config?.plan?.resolution?.branchPattern;
    if (pattern) {
      try {
        const m = branch.match(new RegExp(pattern));
        if (m) {
          const slug = m[1].replace(/[^a-z0-9-]/gi, '-').toLowerCase();
          const plansDir = path.join(process.cwd(), config?.paths?.plans || '.agents');
          if (fs.existsSync(plansDir)) {
            for (const e of fs.readdirSync(plansDir, { withFileTypes: true })) {
              if (e.isDirectory() && e.name.includes(slug)) {
                const f = path.join(plansDir, e.name, 'plan.md');
                if (fs.existsSync(f)) return { path: f, resolvedBy: 'branch' };
              }
            }
          }
        }
      } catch { /* ignore bad pattern */ }
    }
  }
  return { path: null, resolvedBy: null };
}

module.exports = {
  getSessionTempPath,
  readSessionState,
  writeSessionState,
  updateSessionState,
  resolvePlanPath,
  findMostRecentPlan,
};
