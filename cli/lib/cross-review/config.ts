import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { CrossReviewConfig, LegName } from './types';
import { LADDER } from './types';

/**
 * Minimal reader for the `crossReview` block of `haily.json`. This is NOT a
 * general config framework — it validates only the keys cross-review owns and
 * ignores everything else. Merge order matches the hook contract (`haily-lib/
 * config.cjs`): global `~/.claude/haily.json` first, local `<cwd>/.claude/
 * haily.json` overrides it. A missing or malformed file at either layer
 * contributes nothing, so the zero-config default path (detection ladder)
 * always works. Leaf module.
 */

const TIERS = new Set(['fast', 'medium', 'thinking', 'ultra']);

/** Read the `crossReview` block from one `haily.json`; `{}` on any problem. */
function readCrossReviewBlock(configPath: string): Record<string, unknown> {
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch {
    return {};
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {};
  const block = (raw as Record<string, unknown>).crossReview;
  if (typeof block !== 'object' || block === null || Array.isArray(block)) return {};
  return block as Record<string, unknown>;
}

/** Load and sanitize `crossReview` from `<cwd>/.claude/haily.json`, falling
 *  back to (and overridable by) `~/.claude/haily.json`; `{}` on any problem. */
export function loadCrossReviewConfig(cwd: string): CrossReviewConfig {
  const globalBlock = readCrossReviewBlock(path.join(os.homedir(), '.claude', 'haily.json'));
  const localBlock = readCrossReviewBlock(path.join(cwd, '.claude', 'haily.json'));
  return sanitize({ ...globalBlock, ...localBlock });
}

function sanitize(b: Record<string, unknown>): CrossReviewConfig {
  const out: CrossReviewConfig = {};
  if (typeof b.auto === 'boolean') out.auto = b.auto;
  if (typeof b.disable === 'boolean') out.disable = b.disable;
  if (typeof b.reviewer === 'string' && LADDER.includes(b.reviewer as LegName)) {
    out.reviewer = b.reviewer as LegName;
  }
  if (typeof b.model === 'string' && b.model.trim()) out.model = b.model.trim();
  if (typeof b.tier === 'string' && TIERS.has(b.tier)) out.tier = b.tier as CrossReviewConfig['tier'];
  if (typeof b.timeoutMs === 'number' && Number.isFinite(b.timeoutMs) && b.timeoutMs > 0) {
    out.timeoutMs = b.timeoutMs;
  }
  return out;
}
