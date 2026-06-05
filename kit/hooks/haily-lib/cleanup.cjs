#!/usr/bin/env node
/**
 * cleanup.cjs — One-time cleanup and agent-team detection for sessions.
 *
 * Provides two utilities used by haily-session.cjs:
 *  1. Orphaned `.shadowed/` skill cleanup (Issue #422 migration artifact).
 *  2. Agent-team membership detection from ~/.claude/teams/<team>/config.json.
 *
 * @module cleanup
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

// ═══════════════════════════════════════════════════════
// SHADOWED SKILL CLEANUP  (Issue #422)
// ═══════════════════════════════════════════════════════

/**
 * Recover any orphaned skills from `.claude/skills/.shadowed/` that were left
 * behind by the now-disabled skill-dedup hook. Moves them back to `.claude/skills/`.
 * Safe to call multiple times — no-ops if .shadowed/ doesn't exist.
 * @param {string} [configDir='.claude'] — relative config dir name
 * @returns {{ recovered: string[], errors: string[] }}
 */
function cleanupShadowedSkills(configDir = '.claude') {
  const shadowedDir = path.join(process.cwd(), configDir, 'skills', '.shadowed');
  const skillsDir = path.join(process.cwd(), configDir, 'skills');
  const result = { recovered: [], errors: [] };

  if (!fs.existsSync(shadowedDir)) return result;

  try {
    const entries = fs.readdirSync(shadowedDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const src = path.join(shadowedDir, entry.name);
      const dst = path.join(skillsDir, entry.name);
      try {
        if (!fs.existsSync(dst)) {
          fs.renameSync(src, dst);
          result.recovered.push(entry.name);
        }
      } catch (e) {
        result.errors.push(`${entry.name}: ${e.message}`);
      }
    }
    // Remove .shadowed/ if now empty
    try {
      const remaining = fs.readdirSync(shadowedDir);
      if (remaining.length === 0) fs.rmdirSync(shadowedDir);
    } catch { /* ignore */ }
  } catch { /* fail silently */ }

  return result;
}

// ═══════════════════════════════════════════════════════
// AGENT-TEAM DETECTION
// ═══════════════════════════════════════════════════════

/**
 * Detect whether the current session belongs to an agent team.
 * Reads ~/.claude/teams/<team>/config.json and matches the session ID.
 * @param {string} sessionId
 * @returns {{ teamName: string|null, memberCount: number, isTeamMember: boolean }}
 */
function detectAgentTeam(sessionId) {
  const teamsDir = path.join(os.homedir(), '.claude', 'teams');
  const empty = { teamName: null, memberCount: 0, isTeamMember: false };
  if (!sessionId || !fs.existsSync(teamsDir)) return empty;

  try {
    const teamDirs = fs.readdirSync(teamsDir, { withFileTypes: true })
      .filter((e) => e.isDirectory());

    for (const teamDir of teamDirs) {
      const configPath = path.join(teamsDir, teamDir.name, 'config.json');
      try {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        const members = config.members || [];
        const isMember = members.some(
          (m) => m.sessionId === sessionId || m.id === sessionId
        );
        if (isMember) {
          return {
            teamName: config.teamName || teamDir.name,
            memberCount: members.length,
            isTeamMember: true,
          };
        }
      } catch { /* skip malformed config */ }
    }
  } catch { /* ignore directory read errors */ }

  return empty;
}

/**
 * Build a human-readable team context line for session stdout.
 * @param {{ teamName: string, memberCount: number }} teamInfo
 * @returns {string}
 */
function formatTeamContextLine(teamInfo) {
  return `Agent Team: ${teamInfo.teamName} (${teamInfo.memberCount} members)`;
}

module.exports = { cleanupShadowedSkills, detectAgentTeam, formatTeamContextLine };
