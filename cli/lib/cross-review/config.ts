import fs from 'node:fs';
import path from 'node:path';
import type { CrossReviewConfig, LegName } from './types';
import { LADDER } from './types';

/**
 * Minimal reader for the `crossReview` block of a project `.hl.json`. This is
 * NOT a general config framework — it validates only the keys cross-review owns
 * and ignores everything else. A missing or malformed file yields `{}` so the
 * zero-config default path (detection ladder) always works. Leaf module.
 */

const TIERS = new Set(['fast', 'medium', 'thinking', 'ultra']);

/** Load and sanitize `crossReview` from `<cwd>/.hl.json`; `{}` on any problem. */
export function loadCrossReviewConfig(cwd: string): CrossReviewConfig {
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(path.join(cwd, '.hl.json'), 'utf8'));
  } catch {
    return {};
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {};
  const block = (raw as Record<string, unknown>).crossReview;
  if (typeof block !== 'object' || block === null || Array.isArray(block)) return {};
  return sanitize(block as Record<string, unknown>);
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
