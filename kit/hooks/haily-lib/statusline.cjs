#!/usr/bin/env node
/**
 * statusline.cjs — Activity snapshot helpers for the statusline display.
 *
 * Manages the per-session in-memory/state snapshot that tracks agent activity
 * and todo progress. Stored inside the session state object; never written to a
 * separate file.
 *
 * @module statusline
 */

'use strict';

const MAX_AGENTS = 10;

// ═══════════════════════════════════════════════════════
// SNAPSHOT SHAPE
// ═══════════════════════════════════════════════════════

/**
 * @returns {{ sessionStart: null, warmed: false, agents: [], todos: [] }}
 */
function createEmptyActivitySnapshot() {
  return { sessionStart: null, warmed: false, agents: [], todos: [] };
}

/**
 * Validate and clip a snapshot to safe bounds.
 * @param {*} snapshot
 * @returns {{ sessionStart: string|null, warmed: boolean, agents: Object[], todos: Object[] }}
 */
function sanitizeActivitySnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return createEmptyActivitySnapshot();
  return {
    sessionStart: typeof snapshot.sessionStart === 'string' ? snapshot.sessionStart : null,
    warmed: Boolean(snapshot.warmed),
    agents: Array.isArray(snapshot.agents)
      ? snapshot.agents.slice(-MAX_AGENTS).filter((a) => a && typeof a === 'object')
      : [],
    todos: Array.isArray(snapshot.todos)
      ? snapshot.todos.filter((t) => t && typeof t === 'object')
      : [],
    updatedAt: typeof snapshot.updatedAt === 'string' ? snapshot.updatedAt : null,
  };
}

// ═══════════════════════════════════════════════════════
// READ / WRITE  (stored inside session state, not a separate file)
// ═══════════════════════════════════════════════════════

const { readSessionState, updateSessionState } = require('./config.cjs');

/**
 * Read the activity snapshot from session state.
 * @param {string} sessionId
 * @returns {{ sessionStart: string|null, warmed: boolean, agents: Object[], todos: Object[] }}
 */
function readActivitySnapshot(sessionId) {
  if (!sessionId) return createEmptyActivitySnapshot();
  const state = readSessionState(sessionId);
  return sanitizeActivitySnapshot(state?.statusline);
}

/**
 * Write a new activity snapshot into session state.
 * @param {string} sessionId
 * @param {Object} snapshot
 * @returns {boolean}
 */
function writeActivitySnapshot(sessionId, snapshot) {
  if (!sessionId) return false;
  const sanitized = sanitizeActivitySnapshot(snapshot);
  return updateSessionState(sessionId, (state) => ({
    ...state,
    statusline: sanitized,
  }));
}

// ═══════════════════════════════════════════════════════
// SNAPSHOT MUTATION HELPERS
// ═══════════════════════════════════════════════════════

/**
 * Apply a hook event to the current snapshot and return the updated snapshot.
 * Called by state before writing.
 * @param {Object} current
 * @param {Object} stdinData — parsed hook stdin
 * @param {string} now — ISO timestamp
 * @returns {Object}
 */
function applyStatuslineEvent(current, stdinData, now) {
  const snap = sanitizeActivitySnapshot(current);
  snap.updatedAt = now;

  const hookEvent = stdinData?.hook_event_name;
  const toolName = stdinData?.tool_name;

  if (hookEvent === 'SubagentStop') {
    const agentType = stdinData?.agent_type || 'unknown';
    const agentId = stdinData?.agent_id || null;
    const existing = agentId ? snap.agents.find((a) => a.agentId === agentId) : null;
    if (existing) {
      existing.status = 'done';
      existing.completedAt = now;
    } else {
      snap.agents.push({ agentType, agentId, completedAt: now, status: 'done' });
    }
    // Clip to MAX_AGENTS
    if (snap.agents.length > MAX_AGENTS) snap.agents = snap.agents.slice(-MAX_AGENTS);
  }

  return snap;
}

/**
 * Decide whether to preserve the existing snapshot over a freshly parsed one.
 * @param {Object} current @param {Object} parsed @param {Object} transcript
 * @returns {boolean}
 */
function shouldPreserveExistingSnapshot(current, parsed, transcript) {
  // If current snapshot is warmed and recent, don't clobber it with a stale transcript parse
  if (!current.warmed) return false;
  const transcriptAgentCount = (transcript?.agents || []).length;
  const currentAgentCount = (current.agents || []).length;
  return currentAgentCount >= transcriptAgentCount;
}

module.exports = {
  createEmptyActivitySnapshot,
  sanitizeActivitySnapshot,
  readActivitySnapshot,
  writeActivitySnapshot,
  applyStatuslineEvent,
  shouldPreserveExistingSnapshot,
};
