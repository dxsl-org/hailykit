import { createHash } from 'node:crypto';
import * as fs from 'node:fs';

/**
 * Pure, zero-dep helpers for building Codex `config.toml` agent registry entries
 * and safely escaping agent bodies for TOML multiline strings.
 *
 * Codex 2025+ only loads a custom agent when `config.toml` carries an
 * `[agents.<slug>]` table pointing at the per-agent `.toml` via `config_file`.
 * Writing the `.toml` file alone (the pre-upgrade behavior) left agents inert.
 *
 * Ported from claudekit-cli's `fm-to-codex-toml.ts` / `md-to-toml.ts`, trimmed
 * to `node:crypto` only (no `semver`/`proper-lockfile`).
 */

const MAX_CODEX_SLUG_LENGTH = 96;

/**
 * Escape a string for embedding inside a TOML multiline basic string (`"""…"""`).
 * Without this, a body containing `"""` closes the string early and a trailing
 * `"` merges with the closing delimiter — both corrupt the generated file.
 *
 * @param str - Raw agent body.
 */
export function escapeTomlMultiline(str: string): string {
  let e = str.replace(/\\/g, '\\\\');   // backslash first, so later escapes aren't doubled
  e = e.replace(/"""/g, '""\\"');       // break any triple-quote run
  if (e.endsWith('"')) e += '\n';       // a trailing quote must not touch the closing """
  return e;
}

/**
 * Convert an agent name to a snake_case Codex TOML table key.
 * NFKD-normalizes + strips diacritics, replaces non-alphanumerics with `_`,
 * lowercases, caps at 96 chars, and hashes a name that normalizes to empty.
 *
 * Security: output matches `[a-z0-9_]+` only, so it is safe as a filename
 * component — no path separators or `..` can survive.
 *
 * @param name - Agent frontmatter name (e.g. "haily-researcher" → "haily_researcher").
 */
export function toCodexSlug(name: string): string {
  // U+0300–U+036F = combining diacritical marks (ASCII-only source, no literal combining chars).
  const normalized = name.normalize('NFKD').replace(new RegExp('[\\u0300-\\u036f]', 'g'), '');
  let slug = normalized
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();

  if (!slug) return `agent_${createHash('sha256').update(name).digest('hex').slice(0, 8)}`;
  if (slug.length > MAX_CODEX_SLUG_LENGTH) slug = slug.slice(0, MAX_CODEX_SLUG_LENGTH).replace(/_+$/g, '');
  if (!slug) return `agent_${createHash('sha256').update(name).digest('hex').slice(0, 8)}`;
  return slug;
}

/**
 * Infer a Codex `sandbox_mode` from an agent's `tools:` frontmatter.
 * Any write-capable tool → `workspace-write`; otherwise any read tool →
 * `read-only`; otherwise null (omit, Codex uses its default). `task` counts
 * as write — spawned subagents may write (conservative). Parenthesized forms
 * like `Task(Explore)` are normalized to the bare tool name.
 *
 * @param tools - Comma/semicolon/pipe-separated tool list, or undefined.
 */
export function deriveSandboxMode(tools: string | undefined): 'workspace-write' | 'read-only' | null {
  if (typeof tools !== 'string' || !tools.trim()) return null;
  const list = tools
    .split(/[,;|]/)
    .map((t) => t.trim().toLowerCase().replace(/\(.*\)$/, ''))
    .filter(Boolean);
  const WRITE = ['bash', 'write', 'edit', 'multiedit', 'notebookedit', 'apply_patch', 'task'];
  const READ = ['read', 'grep', 'glob', 'ls', 'search'];
  if (list.some((t) => WRITE.includes(t))) return 'workspace-write';
  if (list.some((t) => READ.includes(t))) return 'read-only';
  return null;
}

/**
 * Build the 3-line `[agents.<slug>]` registry table for config.toml.
 *
 * @param slug        - snake_case key (also the `agents/<slug>.toml` basename).
 * @param description - Human description; falls back to the slug when empty.
 */
export function buildAgentConfigEntry(slug: string, description: string): string {
  return [
    `[agents.${slug}]`,
    `description = ${JSON.stringify(description || slug)}`,
    `config_file = ${JSON.stringify(`agents/${slug}.toml`)}`,
  ].join('\n');
}

/**
 * Collect `[agents.X]` slugs present OUTSIDE the hailykit-managed block.
 * Caller passes content with the managed block already stripped so user-owned
 * agent tables are never clobbered by a kit agent that normalizes to the same slug.
 *
 * @param unmanagedContent - config.toml content with the managed block removed.
 */
export function extractUnmanagedAgentSlugs(unmanagedContent: string): Set<string> {
  const slugs = new Set<string>();
  const re = /^\[agents\.(?:"([^"]+)"|([^\]\r\n]+))\]\s*$/gm;
  let m: RegExpExecArray | null = re.exec(unmanagedContent);
  while (m) {
    const slug = (m[1] || m[2] || '').trim();
    if (slug) slugs.add(slug);
    m = re.exec(unmanagedContent);
  }
  return slugs;
}

/**
 * Write a file atomically: write a sibling temp file, then rename over the target.
 * rename() is atomic on the same volume (POSIX + NTFS), so a crash never leaves a
 * half-written config.toml. The temp sits beside the target (same dir → same volume).
 * No lock — install/upgrade is a one-shot foreground command, not concurrent.
 *
 * @param filePath - Absolute target path.
 * @param content  - Full file content to write.
 */
export function atomicWriteToml(filePath: string, content: string): void {
  const tmp = `${filePath}.hailykit-tmp`;
  try {
    fs.writeFileSync(tmp, content, 'utf8');
    fs.renameSync(tmp, filePath);
  } catch (err) {
    try { fs.rmSync(tmp, { force: true }); } catch { /* best-effort temp cleanup */ }
    throw err;
  }
}

/**
 * Replace (or append) the hailykit-managed agents block in config.toml,
 * preserving all user content outside the sentinels. Idempotent: re-running
 * yields exactly one managed block. An empty block removes the managed section.
 *
 * @param existing - Current config.toml content ("" when absent).
 * @param block    - Inner block content (registry entries joined), or "" to remove.
 * @param start    - Start sentinel comment line.
 * @param end      - End sentinel comment line.
 */
export function mergeManagedTomlBlock(existing: string, block: string, start: string, end: string): string {
  const escaped = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const blockRe = new RegExp(`${escaped(start)}[\\s\\S]*?${escaped(end)}\\n?`, 'g');
  const base = existing.replace(blockRe, '').replace(/\n{3,}/g, '\n\n').trimEnd();

  if (!block.trim()) return base ? base + '\n' : '';

  const managed = `${start}\n${block.trim()}\n${end}`;
  return base ? `${base}\n\n${managed}\n` : `${managed}\n`;
}
