import * as fs from 'node:fs';
import * as path from 'node:path';
import { atomicWriteToml } from './codex-toml.js';

/**
 * Idempotent, self-healing writer for `[features] hooks = true` in ~/.codex/config.toml.
 *
 * Verified against developers.openai.com/codex/hooks (6/2026): the current flag is
 * `[features] hooks` (hooks are on by default; `hooks = false` disables). `codex_hooks`
 * is legacy/deprecated. Writing `hooks = true` is redundant-but-harmless on the latest
 * Codex — kept for transitional/older builds.
 *
 * Replaces the old fragile writer (early-returned on sentinel, naive `[features]`
 * replace, no self-heal). Strategy each run: strip stale managed blocks → if a real
 * `[features]` section exists, ensure `hooks = true` inside it (insert / flip
 * false→true / drop legacy `codex_hooks`) → else append a managed block → atomic write.
 *
 * Ported from claudekit-cli's codex-features-flag.ts, trimmed to sync + no lock.
 */

const SENTINEL_START = '# --- hailykit-hooks-start ---';
const SENTINEL_END = '# --- hailykit-hooks-end ---';
const CURRENT_FLAG = 'hooks';
const LEGACY_FLAG = 'codex_hooks';

const MANAGED_BLOCK = `${SENTINEL_START}\n[features]\n${CURRENT_FLAG} = true\n${SENTINEL_END}`;

/**
 * Enable the Codex hooks feature flag, preserving all user content.
 * @param providerDir - Absolute path to ~/.codex/ (or project .codex/).
 */
export function writeCodexConfigToml(providerDir: string): void {
  const configPath = path.join(providerDir, 'config.toml');
  const existing = fs.existsSync(configPath) ? fs.readFileSync(configPath, 'utf8') : '';

  // Step 1: strip every managed block (handles duplicates left by older bugs).
  const stripped = stripManagedBlocks(existing);

  // Step 2: a user-owned `[features]` section (not a `[features.sub]` sub-table)?
  const headerIdx = findFeaturesSectionStart(stripped);
  let next: string;
  if (headerIdx !== -1) {
    next = ensureFlagInFeaturesSection(stripped, headerIdx);
  } else {
    // Step 3: no `[features]` — append a self-contained managed block.
    const base = stripped.trimEnd();
    next = base ? `${base}\n\n${MANAGED_BLOCK}\n` : `${MANAGED_BLOCK}\n`;
  }

  if (next === existing) return; // already correct — no write
  fs.mkdirSync(providerDir, { recursive: true });
  atomicWriteToml(configPath, next);
}

/** Strip every `# --- hailykit-hooks-start --- … end ---` block (handles multiples). */
function stripManagedBlocks(content: string): string {
  const re = new RegExp(`\\n?${escapeRe(SENTINEL_START)}[\\s\\S]*?${escapeRe(SENTINEL_END)}\\n?`, 'g');
  return content.replace(re, '\n').replace(/\n{3,}/g, '\n\n').replace(/^\n+/, '');
}

/** Byte offset of a plain `[features]` header, or -1 (ignores `[features.sub]`). */
function findFeaturesSectionStart(content: string): number {
  const m = /^[ \t]*\[features\][ \t]*(?:#[^\r\n]*)?$/m.exec(content);
  return m ? m.index : -1;
}

/**
 * Within the `[features]` section, ensure `hooks = true`: insert when missing,
 * flip `= false` → `= true`, and drop any legacy `codex_hooks` line. The section
 * ends at the next `[table]` header or EOF.
 */
function ensureFlagInFeaturesSection(content: string, headerStartIdx: number): string {
  const headerLineEnd = content.indexOf('\n', headerStartIdx);
  const bodyStart = headerLineEnd === -1 ? content.length : headerLineEnd + 1;
  const rest = content.slice(bodyStart);
  const nextHeader = /\n\[[^\]]+\]/.exec(rest);
  const bodyEnd = nextHeader ? bodyStart + nextHeader.index + 1 : content.length;

  let body = content.slice(bodyStart, bodyEnd);
  // Drop legacy codex_hooks lines.
  body = body.replace(new RegExp(`^[ \\t]*${LEGACY_FLAG}[ \\t]*=[ \\t]*(?:true|false)[ \\t]*(?:#[^\\r\\n]*)?[ \\t]*\\r?\\n?`, 'gm'), '');

  const flagRe = new RegExp(`^([ \\t]*${CURRENT_FLAG}[ \\t]*=[ \\t]*)(true|false)([ \\t]*#[^\\r\\n]*)?[ \\t]*$`, 'm');
  const flagMatch = flagRe.exec(body);
  if (flagMatch) {
    if (flagMatch[2] !== 'true') {
      body = body.replace(flagRe, (_m, prefix: string, _v, trailing) => `${prefix}true${trailing ?? ''}`);
    }
  } else {
    // Insert at the end of the section, trimming a trailing blank line first.
    const trimmed = body.replace(/\n+$/, '\n');
    const needsNl = trimmed.length > 0 && !trimmed.endsWith('\n');
    body = `${trimmed}${needsNl ? '\n' : ''}${CURRENT_FLAG} = true\n`;
  }

  return content.slice(0, bodyStart) + body + content.slice(bodyEnd);
}

function escapeRe(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
