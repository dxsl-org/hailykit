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

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

/**
 * Map a model ID/alias to its kit/model-map.json tier name.
 *
 * NOTE: return value uses the DISPLAY vocabulary ('deep' for the top tier),
 * kept verbatim because haily-tracer already depends on this exact string.
 * Consumers that need the canonical HL_MODEL_TIER vocabulary (fast|medium|
 * thinking|ultra) must go through `canonicalTier()` instead, which normalizes
 * 'deep' → 'ultra'.
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

const CANONICAL_TIERS = ['fast', 'medium', 'thinking', 'ultra'];

/** 'deep' (deriveTier's Claude-family display value) → 'ultra' (canonical
 *  HL_MODEL_TIER vocabulary). Kept as its own step so the collision with the
 *  `--deep` flag string never leaks past this module. */
function normalizeTierName(tier) {
  return tier === 'deep' ? 'ultra' : tier;
}

let cachedModelMap = null;

/**
 * Load the provider tier table for reverse lookup: user pin
 * (~/.hailykit/model-map.json) wins over the built-in kit/model-map.json.
 * Cached for the process lifetime — hooks are short-lived, one read is enough.
 * @returns {Object}
 */
function loadModelMapForLookup() {
  if (cachedModelMap) return cachedModelMap;
  const candidates = [
    path.join(os.homedir(), '.hailykit', 'model-map.json'),
    path.join(__dirname, '..', '..', 'model-map.json'),
  ];
  for (const file of candidates) {
    try {
      cachedModelMap = JSON.parse(fs.readFileSync(file, 'utf8'));
      return cachedModelMap;
    } catch { /* try next candidate */ }
  }
  cachedModelMap = {};
  return cachedModelMap;
}

/**
 * Reverse-lookup a non-Claude model id (gpt-*, qwen-*, gemini-*, ...) against
 * the provider tier tables so non-Claude sessions still resolve a tier instead
 * of always falling back to null. Claude ids are excluded — `deriveTier`
 * already owns that family via substring heuristics. First match wins; when a
 * provider maps multiple tiers to the same id (e.g. gemini's flat table) the
 * result is any one of those tiers, which is fine because they're identical.
 * @param {string} modelId @returns {string|null}
 */
function reverseLookupTier(modelId) {
  const id = String(modelId || '').toLowerCase();
  if (!id) return null;
  const map = loadModelMapForLookup();
  const providers = Object.keys(map).filter((p) => p !== 'claude');

  // Pass 1: exact match, across every provider, before any fuzzy attempt.
  // Without this a shorter tier's value that happens to be a substring of a
  // longer one (codex fast="gpt-5.4-mini", medium="gpt-5.4") would let the
  // fuzzy pass below mis-resolve an exact "gpt-5.4" id to the wrong tier.
  for (const provider of providers) {
    const tiers = map[provider] || {};
    for (const tier of CANONICAL_TIERS) {
      if (String(tiers[tier] || '').toLowerCase() === id) return tier;
    }
  }
  // Pass 2: fuzzy fallback for runtime ids carrying a suffix the map's
  // canonical name doesn't (date stamps, quantization tags, etc.).
  for (const provider of providers) {
    const tiers = map[provider] || {};
    for (const tier of CANONICAL_TIERS) {
      const candidate = String(tiers[tier] || '').toLowerCase();
      if (candidate && (id.includes(candidate) || candidate.includes(id))) return tier;
    }
  }
  return null;
}

/**
 * Canonical-vocabulary tier for a model id: 'fast'|'medium'|'thinking'|'ultra'|null.
 * Tries the Claude family first (`deriveTier`, 'deep' normalized to 'ultra'),
 * then reverse-looks-up the model map for other providers. Unresolvable ids
 * return null so every consumer can no-op safely — never guess a tier.
 * @param {string} modelId @returns {string|null}
 */
function canonicalTier(modelId) {
  const claudeTier = deriveTier(modelId);
  if (claudeTier) return normalizeTierName(claudeTier);
  return reverseLookupTier(modelId);
}

const TIER_RANK = { fast: 0, medium: 1, thinking: 2, ultra: 3 };

/**
 * Ordinal rank for tier comparisons (fast < medium < thinking < ultra).
 * Unknown/empty tiers rank -1 so a `tierRank(x) < tierRank('thinking')` guard
 * fails safe (no behavior change) instead of accidentally satisfying a
 * "less than" comparison.
 * @param {string} tier @returns {number}
 */
function tierRank(tier) {
  return TIER_RANK[tier] ?? -1;
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

module.exports = { deriveTier, formatModelDisplay, canonicalTier, tierRank };
