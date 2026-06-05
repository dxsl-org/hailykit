#!/usr/bin/env node
/**
 * state.cjs — Markdown state persistence for HailyKit sessions.
 *
 * Manages per-session state files under ~/.claude/session-states/{md5(cwd)}/.
 * State is stored as Markdown (latest.md) with rolling archives (archive-N.md).
 * Used by haily-state.cjs to persist progress across compactions.
 *
 * @module state
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');

const { parseTranscript } = require('./parser.cjs');
const {
  createEmptyActivitySnapshot, sanitizeActivitySnapshot,
  applyStatuslineEvent, shouldPreserveExistingSnapshot
} = require('./statusline.cjs');
const { updateSessionState, readSessionState } = require('./config.cjs');

const STATE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const MAX_ARCHIVES = 5;

// ═══════════════════════════════════════════════════════
// STATE DIRECTORY
// ═══════════════════════════════════════════════════════

/**
 * Returns the directory for this session's state files.
 * Uses MD5 of cwd so different projects get separate state dirs.
 * @param {string} sessionId
 * @returns {string}
 */
function getStateDir(sessionId) {
  const cwdHash = crypto.createHash('md5').update(process.cwd()).digest('hex').slice(0, 8);
  return path.join(os.homedir(), '.claude', 'session-states', `${cwdHash}-${sessionId || 'default'}`);
}

function _latestPath(sessionId) { return path.join(getStateDir(sessionId), 'latest.md'); }

// ═══════════════════════════════════════════════════════
// READ / WRITE
// ═══════════════════════════════════════════════════════

/**
 * Load the session's latest state. Returns null when missing or expired (>7 days).
 * @param {string} sessionId
 * @returns {string|null} Markdown content of last state
 */
function loadState(sessionId) {
  if (!sessionId) return null;
  try {
    const latestPath = _latestPath(sessionId);
    if (!fs.existsSync(latestPath)) return null;
    const stat = fs.statSync(latestPath);
    if (Date.now() - stat.mtimeMs > STATE_EXPIRY_MS) return null;
    return fs.readFileSync(latestPath, 'utf8');
  } catch { return null; }
}

/**
 * Write content atomically (write-to-tmp + rename).
 * @param {string} destPath @param {string} content @returns {boolean}
 */
function writeAtomic(destPath, content) {
  const tmp = destPath + '.' + Math.random().toString(36).slice(2);
  try {
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.writeFileSync(tmp, content, 'utf8');
    fs.renameSync(tmp, destPath);
    return true;
  } catch {
    try { fs.unlinkSync(tmp); } catch { /* ignore */ }
    return false;
  }
}

/**
 * Archive the current latest.md and rotate (keep last MAX_ARCHIVES).
 * @param {string} sessionId
 */
function archiveState(sessionId) {
  const stateDir = getStateDir(sessionId);
  const latestPath = _latestPath(sessionId);
  if (!fs.existsSync(latestPath)) return;
  try {
    // Rotate existing archives down (archive-4 → delete, archive-3 → archive-4, ...)
    for (let i = MAX_ARCHIVES - 1; i >= 1; i--) {
      const src = path.join(stateDir, `archive-${i}.md`);
      const dst = path.join(stateDir, `archive-${i + 1}.md`);
      if (fs.existsSync(src)) {
        if (i === MAX_ARCHIVES - 1) { try { fs.unlinkSync(dst); } catch { /* ignore */ } }
        fs.renameSync(src, dst);
      }
    }
    fs.renameSync(latestPath, path.join(stateDir, 'archive-1.md'));
  } catch { /* best-effort */ }
}

// ═══════════════════════════════════════════════════════
// STATE CONTENT BUILDERS
// ═══════════════════════════════════════════════════════

/** @param {Object} agentInfo @returns {string} */
function buildAgentSection(agentInfo) {
  const { agentType = 'unknown', agentId = '', completedAt = '' } = agentInfo || {};
  return `\n## Agent Result: ${agentType}${agentId ? ` (${agentId})` : ''} (${completedAt ? new Date(completedAt).toLocaleTimeString() : 'unknown'})\n- Completed at ${completedAt ? new Date(completedAt).toLocaleTimeString() : 'unknown'}\n`;
}

/**
 * Format a session state into a Markdown snapshot.
 * @param {Object} state — session state from readSessionState
 * @param {string} [agentSection] — optional agent completion section to append
 * @returns {string}
 */
function buildStateContent(state, agentSection) {
  const snap = sanitizeActivitySnapshot(state?.statusline);
  const now = new Date().toLocaleString();
  const completedTodos = snap.todos.filter((t) => t.status === 'completed').length;
  const pendingTodos = snap.todos.filter((t) => t.status !== 'completed').length;
  const agentCount = snap.agents.length;
  let content = `# Session State\n<!-- Generated: ${new Date().toISOString()} -->\n<!-- Branch: ${state?.gitBranch || 'unknown'} -->\n<!-- Plan: ${state?.activePlan || 'none'} -->\n\n`;
  content += `## What Worked (Verified)\n- (No completed tasks recorded)\n\n`;
  content += `## What's Left\n${pendingTodos > 0 ? `- [ ] ${pendingTodos} pending task(s)` : '- (nothing pending)'}\n\n`;
  content += `## Next Session Start\n- **First action:** Review plan and continue\n- Run \`npm test\` before claiming any task done\n`;
  if (agentCount > 0) content += `\n## Agent Activity (${agentCount} agents)\n`;
  if (agentSection) content += agentSection;
  return content;
}

/**
 * Extract session summary data from stored state.
 * @param {string} sessionId @returns {Object}
 */
function extractSessionData(sessionId) {
  const state = readSessionState(sessionId);
  return { activePlan: state?.activePlan || null, gitBranch: state?.gitBranch || null, statusline: state?.statusline || createEmptyActivitySnapshot() };
}

// ═══════════════════════════════════════════════════════
// PERSIST + REFRESH
// ═══════════════════════════════════════════════════════

/**
 * Refresh the statusline activity snapshot from the transcript.
 * @param {string} sessionId @param {Object} stdinData @param {string|null} [transcriptPath]
 */
async function refreshStatuslineSnapshot(sessionId, stdinData, transcriptPath) {
  if (!sessionId) return;
  const now = new Date().toISOString();
  const transcript = transcriptPath ? await parseTranscript(transcriptPath) : { sessionStart: null, agents: [], todos: [] };
  updateSessionState(sessionId, (state) => {
    const current = sanitizeActivitySnapshot(state?.statusline);
    const parsed = applyStatuslineEvent({ ...current, sessionStart: transcript.sessionStart || current.sessionStart, agents: transcript.agents || current.agents, todos: transcript.todos || current.todos, warmed: true }, stdinData, now);
    const next = shouldPreserveExistingSnapshot(current, parsed, transcript) ? applyStatuslineEvent(current, stdinData, now) : parsed;
    return { ...state, statusline: next, lastTranscriptPath: transcriptPath || state?.lastTranscriptPath };
  });
}

/**
 * Persist a full markdown state snapshot to ~/.claude/session-states/{dir}/latest.md.
 * @param {string} sessionId @param {Object} stdinData @param {string|null} transcriptPath @param {string} hookEvent
 */
async function persistState(sessionId, stdinData, transcriptPath, hookEvent) {
  if (!sessionId) return { success: false, reason: 'no-session-id' };
  await refreshStatuslineSnapshot(sessionId, stdinData, transcriptPath);
  const state = readSessionState(sessionId) || {};
  const agentSection = hookEvent === 'SubagentStop' ? buildAgentSection({ agentType: stdinData?.agent_type, agentId: stdinData?.agent_id, completedAt: new Date().toISOString() }) : null;
  const content = buildStateContent(state, agentSection);
  const written = writeAtomic(_latestPath(sessionId), content);
  return written ? { success: true } : { success: false, reason: 'write-failed' };
}

module.exports = {
  getStateDir, loadState, persistState, archiveState,
  refreshStatuslineSnapshot, extractSessionData,
  buildStateContent, buildAgentSection, writeAtomic,
};
