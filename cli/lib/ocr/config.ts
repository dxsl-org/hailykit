import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { OcrJobConfig } from './types';

/**
 * Minimal reader for the `ocr` block of `haily.json`. Mirrors
 * `cli/lib/cross-review/config.ts`: validates only the keys this tool owns,
 * ignores everything else. Merge order matches the hook contract (`haily-lib/
 * config.cjs`): global `~/.claude/haily.json` first, local `<cwd>/.claude/
 * haily.json` overrides it. A missing or malformed file at either layer
 * contributes nothing, so the zero-config default path (venv ladder + engine
 * defaults) always works. Leaf module.
 */

const MAX_TIERS = new Set(['local', 'flash', 'pro']);
const GRADES = new Set(['POOR', 'FAIR', 'GOOD', 'EXCELLENT']);

/** `ocr` block fields plus the one field the block owns beyond job config:
 *  the resolved python interpreter path (persisted by the installer/skill so
 *  non-Claude venv layouts don't depend on the hardcoded ladder fallback). */
export type OcrConfig = OcrJobConfig & { python?: string };

/** Read the `ocr` block from one `haily.json`; `{}` on any problem. */
function readOcrBlock(configPath: string): Record<string, unknown> {
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch {
    return {};
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {};
  const block = (raw as Record<string, unknown>).ocr;
  if (typeof block !== 'object' || block === null || Array.isArray(block)) return {};
  return block as Record<string, unknown>;
}

/** Load and sanitize `ocr` from `<cwd>/.claude/haily.json`, falling back to
 *  (and overridable by) `~/.claude/haily.json`; `{}` on any problem. */
export function loadOcrConfig(cwd: string): OcrConfig {
  const globalBlock = readOcrBlock(path.join(os.homedir(), '.claude', 'haily.json'));
  const localBlock = readOcrBlock(path.join(cwd, '.claude', 'haily.json'));
  return sanitize({ ...globalBlock, ...localBlock });
}

function sanitize(b: Record<string, unknown>): OcrConfig {
  const out: OcrConfig = {};
  if (typeof b.python === 'string' && b.python.trim()) out.python = b.python.trim();
  if (typeof b.max_tier === 'string' && MAX_TIERS.has(b.max_tier)) out.max_tier = b.max_tier as OcrConfig['max_tier'];
  if (typeof b.blur_min === 'number' && Number.isFinite(b.blur_min) && b.blur_min > 0) out.blur_min = b.blur_min;
  if (typeof b.escalate_below_grade === 'string' && GRADES.has(b.escalate_below_grade)) {
    out.escalate_below_grade = b.escalate_below_grade as OcrConfig['escalate_below_grade'];
  }
  if (typeof b.route_tables_to_vlm === 'boolean') out.route_tables_to_vlm = b.route_tables_to_vlm;
  if (typeof b.long_edge_min === 'number' && Number.isFinite(b.long_edge_min) && b.long_edge_min > 0) {
    out.long_edge_min = b.long_edge_min;
  }
  if (typeof b.rpm === 'number' && Number.isFinite(b.rpm) && b.rpm > 0) out.rpm = b.rpm;
  if (typeof b.models === 'object' && b.models !== null && !Array.isArray(b.models)) {
    const m = b.models as Record<string, unknown>;
    const models: { flash?: string; pro?: string } = {};
    if (typeof m.flash === 'string' && m.flash.trim()) models.flash = m.flash.trim();
    if (typeof m.pro === 'string' && m.pro.trim()) models.pro = m.pro.trim();
    if (models.flash || models.pro) out.models = models;
  }
  if (Array.isArray(b.ocr_lang) && b.ocr_lang.length && b.ocr_lang.every((x) => typeof x === 'string')) {
    out.ocr_lang = b.ocr_lang as string[];
  }
  return out;
}
