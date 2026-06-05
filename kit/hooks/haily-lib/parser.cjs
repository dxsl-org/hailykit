#!/usr/bin/env node
/**
 * parser.cjs — Parse a Claude Code transcript JSONL into a structured snapshot.
 *
 * Extracts session start time, agent activity, and todo items from the transcript
 * file path provided by Claude Code. Used by state.cjs to build
 * the statusline activity snapshot.
 *
 * Contract: [INFERRED] from state.cjs usage at line 148.
 * Return shape confirmed by consuming fields: sessionStart, agents[], todos[].
 *
 * @module parser
 */

'use strict';

const fs = require('node:fs');

const EMPTY_RESULT = { sessionStart: null, agents: [], todos: [] };

/**
 * Parse a transcript file and return structured activity data.
 * Always resolves (never rejects) — returns EMPTY_RESULT on any error.
 * @param {string|null} transcriptPath
 * @returns {Promise<{ sessionStart: string|null, agents: Object[], todos: Object[] }>}
 */
async function parseTranscript(transcriptPath) {
  if (!transcriptPath) return { ...EMPTY_RESULT };
  try {
    const content = fs.readFileSync(transcriptPath, 'utf8');
    const lines = content.split('\n').filter(Boolean);

    let sessionStart = null;
    const agents = [];
    const todos = [];

    for (const line of lines) {
      let entry;
      try { entry = JSON.parse(line); } catch { continue; }

      // Session start timestamp: first entry with a timestamp
      if (!sessionStart && entry.timestamp) {
        sessionStart = entry.timestamp;
      }

      // Agent activity: entries where an agent was spawned or completed
      if (entry.type === 'agent_start' || entry.type === 'subagent_start') {
        agents.push({
          agentType: entry.agent_type || entry.agentType || 'unknown',
          agentId: entry.agent_id || entry.agentId || null,
          startedAt: entry.timestamp || null,
          status: 'running'
        });
      }

      if (entry.type === 'agent_stop' || entry.type === 'subagent_stop') {
        const id = entry.agent_id || entry.agentId;
        const existing = id ? agents.find((a) => a.agentId === id) : null;
        if (existing) {
          existing.status = 'done';
          existing.completedAt = entry.timestamp || null;
        } else {
          agents.push({
            agentType: entry.agent_type || 'unknown',
            agentId: id || null,
            completedAt: entry.timestamp || null,
            status: 'done'
          });
        }
      }

      // Todo items from TodoWrite tool calls
      if (entry.type === 'tool_use' && entry.name === 'TodoWrite') {
        const items = entry.input?.todos || [];
        for (const item of items) {
          if (item && typeof item === 'object') {
            todos.push({
              id: item.id || null,
              content: item.content || '',
              status: item.status || 'pending',
              priority: item.priority || 'medium'
            });
          }
        }
      }
    }

    return { sessionStart, agents, todos };
  } catch {
    return { ...EMPTY_RESULT };
  }
}

module.exports = { parseTranscript };
