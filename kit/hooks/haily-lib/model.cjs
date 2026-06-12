#!/usr/bin/env node
/**
 * model.cjs — Model ID parsing + display helpers shared by session/tracer hooks.
 *
 * Handles three ID shapes seen after install:
 *   full IDs    — claude-sonnet-4-6, claude-haiku-4-5-20251001, claude-fable-5
 *   aliases     — opus / sonnet / haiku / fable (agent frontmatter, Agent-tool model opt)
 *   unknown     — returned verbatim (display must never fail)
 *
 * @module model
 */

'use strict';

/**
 * Map a model ID/alias to its kit/model-map.json tier name.
 * @param {string} modelId
 * @returns {string|null} 'deep' | 'thinking' | 'medium' | 'fast' | null when unknown
 */
function deriveTier(modelId) {
  const m = String(modelId || '').toLowerCase();
  if (m.includes('fable') || m.includes('mythos')) return 'deep';
  if (m.includes('opus')) return 'thinking';
  if (m.includes('sonnet')) return 'medium';
  if (m.includes('haiku')) return 'fast';
  return null;
}

/**
 * Human-friendly model name from an ID or alias.
 * "claude-sonnet-4-6" → "Sonnet 4.6" · "claude-haiku-4-5-20251001" → "Haiku 4.5"
 * "claude-fable-5" → "Fable 5" · "opus" → "Opus" · unknown → raw input.
 * @param {string} modelId
 * @returns {string}
 */
function formatModelDisplay(modelId) {
  // Strip bracketed variant suffixes like "claude-opus-4-8[1m]" before parsing.
  const id = String(modelId || '').trim().replace(/\[[^\]]*\]$/, '');
  if (/^(opus|sonnet|haiku|fable)$/i.test(id)) {
    return id.charAt(0).toUpperCase() + id.slice(1).toLowerCase();
  }
  // claude-<family>-<major>[-<minor>][-<yyyymmdd date stamp>]
  const m = id.match(/^claude-([a-z]+)-(\d+(?:-\d+)?)(?:-\d{8})?$/i);
  if (!m) return id;
  const family = m[1].charAt(0).toUpperCase() + m[1].slice(1);
  return `${family} ${m[2].replace('-', '.')}`;
}

module.exports = { deriveTier, formatModelDisplay };
