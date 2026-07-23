import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { OcrJobConfig, OcrProviderEntry, OcrTierProvider } from './types';

/**
 * Minimal reader for the `ocr` block of `haily.json`. Mirrors
 * `cli/lib/cross-review/config.ts`: validates only the keys this tool owns,
 * ignores everything else. Merge order matches the hook contract (`haily-lib/
 * config.cjs`): global `~/.claude/haily.json` first, local `<cwd>/.claude/
 * haily.json` next, `--config <path>` (highest precedence) last. A missing
 * or malformed file at any layer contributes nothing, so the zero-config
 * default path (venv ladder + engine defaults) always works. Leaf module.
 */

const MAX_TIERS = new Set(['local', 'flash', 'pro']);
const GRADES = new Set(['POOR', 'FAIR', 'GOOD', 'EXCELLENT']);
const PROVIDER_KINDS = new Set(['gemini', 'openai', 'cli']);

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

/** Read a `--config <path>` file: accepts either a standalone ocr-config
 *  object (the common case — a file dedicated to provider setup) or a full
 *  `haily.json` with an `ocr` block, so a copy of either shape works. `{}`
 *  on any problem (missing file, malformed JSON) — never throws. */
function readConfigFile(configPath: string): Record<string, unknown> {
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch {
    return {};
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {};
  const obj = raw as Record<string, unknown>;
  const block = obj.ocr;
  if (typeof block === 'object' && block !== null && !Array.isArray(block)) return block as Record<string, unknown>;
  return obj;
}

/** Load and sanitize `ocr` config across three layers, lowest to highest
 *  precedence: global `~/.claude/haily.json`, local `<cwd>/.claude/haily.json`,
 *  then `--config <path>` (relative paths resolve against `cwd`) if given. */
export function loadOcrConfig(cwd: string, configPath?: string): OcrConfig {
  const globalBlock = readOcrBlock(path.join(os.homedir(), '.claude', 'haily.json'));
  const localBlock = readOcrBlock(path.join(cwd, '.claude', 'haily.json'));
  const merged = { ...globalBlock, ...localBlock };
  if (configPath) {
    const resolved = path.isAbsolute(configPath) ? configPath : path.resolve(cwd, configPath);
    Object.assign(merged, readConfigFile(resolved));
  }
  return sanitize(merged);
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
  const providers = sanitizeProviders(b.providers);
  if (providers) out.providers = providers;
  const tierProvider = sanitizeTierProvider(b.tier_provider);
  if (tierProvider) out.tier_provider = tierProvider;
  return out;
}

/** Whitelist-extracts only recognized fields onto a fresh object — an inline
 *  key VALUE (`api_key`/`key`/`apikey`) is never a recognized field, so it is
 *  dropped by construction, never copied onto `entry` or forwarded to the
 *  job JSON the Python engine reads (see `OcrProviderEntry`'s security note). */
function sanitizeProviderEntry(raw: unknown): OcrProviderEntry | undefined {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return undefined;
  const r = raw as Record<string, unknown>;
  if (typeof r.kind !== 'string' || !PROVIDER_KINDS.has(r.kind)) return undefined;
  const entry: OcrProviderEntry = { kind: r.kind as OcrProviderEntry['kind'] };
  if (typeof r.model === 'string' && r.model.trim()) entry.model = r.model.trim();
  if (typeof r.api_key_env === 'string' && r.api_key_env.trim()) entry.api_key_env = r.api_key_env.trim();
  if (typeof r.base_url === 'string' && r.base_url.trim()) entry.base_url = r.base_url.trim();
  if (Array.isArray(r.command) && r.command.length && r.command.every((c) => typeof c === 'string')) {
    entry.command = r.command as string[];
  }
  return entry;
}

function sanitizeProviders(raw: unknown): Record<string, OcrProviderEntry> | undefined {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return undefined;
  const out: Record<string, OcrProviderEntry> = {};
  for (const [name, value] of Object.entries(raw as Record<string, unknown>)) {
    const entry = sanitizeProviderEntry(value);
    if (entry) out[name] = entry;
  }
  return Object.keys(out).length ? out : undefined;
}

function sanitizeTierProvider(raw: unknown): OcrTierProvider | undefined {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return undefined;
  const r = raw as Record<string, unknown>;
  const out: OcrTierProvider = {};
  if (typeof r.flash === 'string' && r.flash.trim()) out.flash = r.flash.trim();
  if (typeof r.pro === 'string' && r.pro.trim()) out.pro = r.pro.trim();
  return Object.keys(out).length ? out : undefined;
}
