import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

/** Matches YAML frontmatter block at the start of a markdown file. */
const FRONTMATTER_RE = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;

/** Matches {skill:hc-cook} / {skill:hl-brainstorm} / {skill:hs-dfir} references in body text. */
const SKILL_REF_RE = /\{skill:((?:hc|hd|hl|hs)-[a-z][a-z0-9-]*)\}/g;

/**
 * Matches {agent:X}, {agents:A,B}, {agent-result:X} tags in skill body text.
 * Capture group 1 = tag type; group 2 = comma-separated role list.
 * NOTE: role chars include hyphens to support names like haily-reviewer, haily-project-manager.
 */
const AGENT_REF_RE = /\{(agents?(?:-result)?):([a-z][a-z0-9,-]*)\}/g;

/** Canonical agent roles. The installer warns (not throws) on unknown roles. */
export const AGENT_ROLES = new Set([
  'haily-researcher', 'haily-planner', 'haily-implementor',
  'haily-tester', 'haily-debugger', 'haily-reviewer',
  'haily-docs-writer', 'haily-git-manager', 'haily-project-manager',
  'scout', 'haily-designer', 'haily-refiner', 'haily-reporter',
  'haily-brainstormer', 'haily-mcp-manager', 'haily-test-architect', 'haily-tech-analyst',
  'haily-adr-writer', 'haily-api-designer', 'haily-optimizer',
]);

/** Discriminates {agent:X} vs {agents:A,B} vs {agent-result:X} tags. */
export type AgentRefType = 'agent' | 'agents' | 'agent-result';

/**
 * Canonical model tiers (provider-neutral). Ordered fast < medium < thinking < ultra.
 * Agent frontmatter pins use `fast | medium | thinking` as floor, with an optional
 * `model_max` ceiling. `ultra` is the top tier — resolved into skill text at
 * install time via `{model:ultra}` placeholders.
 */
export type ModelTier = 'thinking' | 'medium' | 'fast' | 'ultra';

/**
 * Built-in per-provider model name for each canonical tier. Agent frontmatter
 * uses the tier; the installer resolves it to the provider's real model at
 * install time.
 *
 * These are FALLBACK defaults only. The authoritative map ships as
 * `kit/model-map.json` in each release (loaded via loadModelMapOverrides),
 * so model-id churn is fixed by a catalog update — no code release needed.
 * Users can pin their own values in `~/.hailykit/model-map.json`.
 */
export const MODEL_MAP: Record<string, Record<ModelTier, string>> = {
  // `ultra` maps to each provider's strongest model. Pin a newer model in
  // ~/.hailykit/model-map.json when it becomes available.
  claude:      { fast: 'haiku',                         medium: 'sonnet',                       thinking: 'opus',                              ultra: 'fable-5' },
  codex:       { fast: 'gpt-5.4-mini',                  medium: 'gpt-5.4',                      thinking: 'gpt-5.5',                           ultra: 'gpt-5.5' },
  gemini:      { fast: 'gemini-3.1-flash-lite',         medium: 'gemini-3.5-flash',             thinking: 'gemini-3.1-pro-preview',            ultra: 'gemini-3.1-pro-preview' },
  antigravity: { fast: 'gemini-3.1-flash-lite',         medium: 'gemini-3.5-flash',             thinking: 'gemini-3.1-pro',                    ultra: 'gemini-3.1-pro' },
  // OpenCode config format is "provider/model-id" (e.g. anthropic/claude-sonnet-4-6).
  opencode:    { fast: 'anthropic/claude-haiku-4-5',    medium: 'anthropic/claude-sonnet-4-6',  thinking: 'anthropic/claude-opus-4-8',         ultra: 'anthropic/claude-fable-5' },
  // Cline is also a "provider/model-id" gateway; cross-review resolves its
  // reviewer model here (and swaps to a non-session provider when they collide).
  cline:       { fast: 'anthropic/claude-haiku-4-5',    medium: 'anthropic/claude-sonnet-4-6',  thinking: 'anthropic/claude-opus-4-8',         ultra: 'anthropic/claude-fable-5' },
  // Ollama models are local; these are hints — cross-review verifies against
  // `ollama list` and falls back to whatever is actually pulled.
  ollama:      { fast: 'llama3.2',                      medium: 'qwen2.5-coder:14b',            thinking: 'qwen2.5-coder:32b',                 ultra: 'qwen2.5-coder:32b' },
};

const VALID_TIERS: ReadonlySet<string> = new Set(['thinking', 'medium', 'fast', 'ultra']);

/** Per-provider tier overrides merged over MODEL_MAP (kit release, then user). */
let modelMapOverrides: Record<string, Partial<Record<ModelTier, string>>> = {};

/**
 * Read and sanitize a model-map JSON file: `{ provider: { tier: modelId } }`.
 * Unknown tiers and non-string values are dropped; a missing or malformed
 * file yields null so callers fall back silently — a bad override must never
 * break an install.
 */
function readModelMapFile(filePath: string): Record<string, Partial<Record<ModelTier, string>>> | null {
  try {
    const raw: unknown = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
    const out: Record<string, Partial<Record<ModelTier, string>>> = {};
    for (const [provider, tiers] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof tiers !== 'object' || tiers === null || Array.isArray(tiers)) continue;
      const entry: Partial<Record<ModelTier, string>> = {};
      for (const [tier, model] of Object.entries(tiers as Record<string, unknown>)) {
        if (VALID_TIERS.has(tier) && typeof model === 'string' && model.trim()) {
          entry[tier as ModelTier] = model.trim();
        }
      }
      if (Object.keys(entry).length) out[provider] = entry;
    }
    return out;
  } catch {
    return null;
  }
}

/**
 * Load model-map overrides before any agent conversion. Precedence (low → high):
 * built-in MODEL_MAP < `<kitDir>/model-map.json` (release catalog)
 * < `~/.hailykit/model-map.json` (user pin; dir overridable via HAILYKIT_HOME).
 * Resets prior state on each call.
 *
 * @param kitDir - Extracted release `kit/` directory; omit to load only the user file.
 */
export function loadModelMapOverrides(kitDir?: string): void {
  modelMapOverrides = {};
  const userDir = process.env.HAILYKIT_HOME || path.join(os.homedir(), '.hailykit');
  const sources = [
    kitDir ? path.join(kitDir, 'model-map.json') : null,
    path.join(userDir, 'model-map.json'),
  ];
  for (const src of sources) {
    if (!src) continue;
    const parsed = readModelMapFile(src);
    if (!parsed) continue;
    for (const [provider, tiers] of Object.entries(parsed)) {
      modelMapOverrides[provider] = { ...modelMapOverrides[provider], ...tiers };
    }
  }
}

/**
 * Effective tier→model map for a provider: built-in defaults merged with any
 * loaded overrides. Unknown providers fall back to the Claude map.
 */
export function getModelMap(provider: string): Record<ModelTier, string> {
  const base = MODEL_MAP[provider] ?? MODEL_MAP.claude;
  const over = modelMapOverrides[provider];
  return over ? { ...base, ...over } : base;
}

/**
 * Optional per-provider, per-tier reasoning-effort hints (e.g. Codex
 * `model_reasoning_effort`). Empty today — kept separate from MODEL_MAP so the
 * typed tier→model contract stays clean. Populate when a provider needs an
 * explicit effort; consumers emit the hint only when a value is present.
 */
export const MODEL_EFFORT_MAP: Record<string, Partial<Record<ModelTier, string>>> = {};

/**
 * Resolve the reasoning-effort hint for a provider/tier, or undefined when none
 * is configured (the common case). Lets agent converters emit
 * `model_reasoning_effort` without inventing data.
 *
 * @param provider - Provider key (e.g. "codex").
 * @param tier     - Model tier.
 */
export function getModelEffort(provider: string, tier: ModelTier): string | undefined {
  return MODEL_EFFORT_MAP[provider]?.[tier];
}

/**
 * Providers where the active model is user-configured at runtime (not fixed per-install).
 * For these providers, the `model:` tier line is stripped from agent files so the
 * provider uses whatever model the developer has selected in their editor settings.
 */
const USER_CONFIGURED_MODEL_PROVIDERS = new Set(['cursor', 'zed', 'windsurf', 'crush', 'opencode', 'kimi', 'cline']);

/** Matches a `model: <tier>` frontmatter line (with optional trailing whitespace). */
const MODEL_TIER_RE = /^(model:\s*)(thinking|medium|fast|ultra)\s*$/m;

/** Matches a `model: <tier>` line to remove it entirely (including the trailing newline). */
const MODEL_LINE_STRIP_RE = /^model:[ \t]*(thinking|medium|fast|ultra)[ \t]*\r?\n?/m;

/** Matches {model:<tier>} placeholders in skill body text. */
const MODEL_REF_RE = /\{model:(thinking|medium|fast|ultra)\}/g;

/**
 * Resolve a `model: <tier>` frontmatter line to the provider's real model name.
 * For user-configured providers (cursor, zed), the line is stripped so the editor
 * uses its own default. Falls back to the Claude map for unknown providers.
 * Content without a tier line (or already a concrete model) is returned unchanged.
 *
 * @param content  - File content containing a `model:` frontmatter line.
 * @param provider - Provider key (claude, codex, gemini, …).
 */
export function resolveModel(content: string, provider: string): string {
  if (USER_CONFIGURED_MODEL_PROVIDERS.has(provider)) {
    return content.replace(MODEL_LINE_STRIP_RE, '');
  }
  const map = getModelMap(provider);
  return content.replace(MODEL_TIER_RE, (_m, prefix, tier) => `${prefix}${map[tier as ModelTier]}`);
}

/**
 * Resolve `{model:<tier>}` placeholders in skill body text to the provider's
 * real model name. Used by ultra-mode escalation sections so installed skill
 * text names a concrete model (e.g. "pass model: opus to Task calls").
 * Resolves for ALL providers — the placeholder must never ship verbatim.
 *
 * @param content  - Skill body text containing `{model:ultra}` style refs.
 * @param provider - Provider key (claude, codex, gemini, …).
 */
export function resolveModelRefs(content: string, provider: string): string {
  const map = getModelMap(provider);
  return content.replace(MODEL_REF_RE, (_m, tier) => map[tier as ModelTier]);
}

export interface ParsedSkill {
  frontmatter: Record<string, string>;
  /** Fields from the `metadata:` YAML block — agentskills.io extension point. */
  metadata: Record<string, string>;
  body: string;
}

/**
 * Parse YAML frontmatter from SKILL.md content.
 * Handles simple top-level `key: value` lines and a single-level `metadata:` block.
 *
 * @param content - Raw SKILL.md file content.
 */
export function parseFrontmatter(content: string): ParsedSkill {
  // Normalize CRLF → LF so the regex works on Windows-authored files.
  const match = content.replace(/\r\n/g, '\n').match(FRONTMATTER_RE);
  if (!match) return { frontmatter: {}, metadata: {}, body: content.trim() };

  const fm: Record<string, string> = {};
  const meta: Record<string, string> = {};
  let inMetadata = false;

  for (const line of match[1].split('\n')) {
    if (line.trimEnd() === 'metadata:') {
      inMetadata = true;
      continue;
    }
    if (inMetadata && /^  [a-zA-Z]/.test(line)) {
      const m = line.match(/^  ([a-zA-Z_-]+):\s*(.+)$/);
      if (m) meta[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
    } else if (!/^\s/.test(line)) {
      inMetadata = false;
      const m = line.match(/^([a-zA-Z_-]+):\s*(.+)$/);
      if (m) fm[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
    }
  }

  return { frontmatter: fm, metadata: meta, body: match[2].trim() };
}

/**
 * Strip everything but kebab-case characters from a command slug.
 *
 * The returned name is used directly as a filename component (`${name}.toml`,
 * `${name}.md`), so any `/`, `\`, `..`, or null byte in a frontmatter `name:`
 * could write outside the commands directory. Registered skill names are all
 * `[a-z0-9-]`, so this never alters a legitimate name — it only neutralizes a
 * hand-crafted/tampered SKILL.md.
 */
function sanitizeSlug(s: string): string {
  return s.replace(/[^A-Za-z0-9-]/g, '');
}

/**
 * Derive the command slug from SKILL.md frontmatter `name:` field.
 * `name: hc-cook`      → `hc-cook`   (current hyphen format)
 * `name: hc:cook`      → `hc-cook`   (legacy colon format)
 * `name: plan`         → `hl-plan`   (legacy no-prefix — assumes hl domain)
 *
 * Output is sanitized to kebab-case — it is used as a filename, so path
 * separators and traversal sequences must never survive.
 *
 * @param frontmatter - Parsed frontmatter from parseFrontmatter().
 * @param fallback    - Directory name used when frontmatter has no `name` field.
 */
export function toCommandName(
  frontmatter: Record<string, string>,
  fallback?: string,
): string {
  const raw = frontmatter.name || fallback || '';
  // Current format: already hyphenated — hc-cook, hl-brainstorm, hd-ui-ux, hs-dfir
  if (/^(hc|hd|hl|hs)-/.test(raw)) return sanitizeSlug(raw);
  // Legacy colon format: hc:cook → hc-cook
  if (/^(hc|hd|hl|hs):/.test(raw)) return sanitizeSlug(raw.replace(':', '-'));
  // Legacy bare name: no prefix → assume hl domain
  return `hl-${sanitizeSlug(raw.replace(/^hl[:-]/, ''))}`;
}

/**
 * Replace all {skill:hc-cook} references in a body string with
 * provider-specific invocation syntax.
 *
 * The callback receives the prefix and bare name separately so providers
 * can format them however they need (e.g. `/hc-cook`, `$hc-cook`, `@hc-cook`).
 *
 * @param body  - Body text containing `{skill:hc-cook}` refs.
 * @param toRef - Maps (prefix, bareName) → provider-specific string.
 */
export function resolveSkillRefs(
  body: string,
  toRef: (prefix: string, name: string) => string,
): string {
  return body.replace(SKILL_REF_RE, (_, skillName: string) => {
    // Split "hc-mcp-builder" → prefix="hc", name="mcp-builder"
    const dashIdx = skillName.indexOf('-');
    const prefix = skillName.slice(0, dashIdx);
    const name = skillName.slice(dashIdx + 1);
    return toRef(prefix, name);
  });
}

/**
 * Replace all {agent:X}, {agents:A,B}, {agent-result:X} tags in a body string
 * with provider-specific agent-spawn instructions.
 *
 * Unknown roles emit a console.warn (development guard) but are still passed
 * to the callback — the provider decides how to handle them.
 *
 * @param body  - Body text containing agent ref tags.
 * @param toRef - Maps (type, roles) → provider-specific string.
 */
export function resolveAgentRefs(
  body: string,
  toRef: (type: AgentRefType, roles: string[]) => string,
): string {
  return body.replace(AGENT_REF_RE, (_, type, rolesStr: string) => {
    const roles = rolesStr.split(',').map((r) => r.trim()).filter(Boolean);
    for (const role of roles) {
      if (!AGENT_ROLES.has(role)) {
        console.warn(`[hailykit] Unknown agent role: "${role}" — check AGENT_ROLES in converter.ts`);
      }
    }
    return toRef(type as AgentRefType, roles);
  });
}

/**
 * Check if a skill is allowed for the given provider.
 * Reads `metadata.providers` first; falls back to top-level `providers` for
 * backward compatibility with skills not yet migrated.
 * When absent or `*`, all providers are allowed.
 * Otherwise a comma-separated allowlist: `"gemini"` or `"gemini,cursor"`.
 *
 * @param skill    - Parsed skill from parseFrontmatter().
 * @param provider - Provider key (claude, gemini, cursor, …).
 */
export function isProviderAllowed(
  skill: ParsedSkill,
  provider: string,
): boolean {
  const raw = skill.metadata['providers'] ?? skill.frontmatter['providers'];
  if (!raw || raw === '*') return true;
  return raw.split(',').map(p => p.trim().toLowerCase()).includes(provider.toLowerCase());
}

/**
 * Convert skill body to Gemini CLI TOML format.
 *
 * @param description - Skill description for the TOML `description` field.
 * @param body        - Skill body text (the instruction content).
 */
export function toGeminiToml(description: string, body: string): string {
  // JSON.stringify produces a valid TOML basic string — handles \, ", \n, \r, \t, and all
  // other escape sequences consistently with toWindsurfMd/toOpenCodeMd.
  const desc = JSON.stringify(description || '');
  // TOML literal strings (single-quoted) cannot contain single quotes or control chars,
  // so use a basic multi-line string. Escape \ and " to keep the block well-formed;
  // a run of three or more quotes near the closing delimiter would terminate early,
  // so replace every " with \" inside the body before wrapping.
  const escaped = body.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `description = ${desc}\nprompt = """\n${escaped}\n"""\n`;
}

/**
 * Convert skill body to Cursor markdown format (plain markdown, no frontmatter).
 */
export function toCursorMd(body: string): string {
  return body + '\n';
}

/**
 * Convert skill body to Windsurf markdown format (YAML frontmatter + body).
 */
export function toWindsurfMd(description: string, body: string): string {
  const desc = JSON.stringify(description || '');
  return `---\ntrigger: manual\ndescription: ${desc}\n---\n\n${body}\n`;
}

/**
 * Convert skill body to OpenCode markdown format (YAML frontmatter + body).
 */
export function toOpenCodeMd(description: string, body: string): string {
  const desc = JSON.stringify(description || '');
  return `---\ndescription: ${desc}\n---\n\n${body}\n`;
}

/**
 * Convert skill body to Crush markdown format (Agent Skills open standard).
 * Crush discovers skills by the `name:` field and `user-invocable: true` flag.
 *
 * @param name        - Command slug used as the skill's invocation name.
 * @param description - Skill description shown in the slash-command picker.
 * @param body        - Skill body text (the instruction content).
 */
export function toCrushMd(name: string, description: string, body: string): string {
  const desc = JSON.stringify(description || '');
  return `---\nname: ${name}\ndescription: ${desc}\n---\n\n${body}\n`;
}

/**
 * Convert skill body to Kimi Code markdown format (Agent Skills open standard).
 * Kimi Code discovers skills by the `name:` and `description:` frontmatter fields.
 *
 * @param name        - Command slug used as the skill's invocation name.
 * @param description - Skill description shown in the skill picker.
 * @param body        - Skill body text (the instruction content).
 */
export function toKimiMd(name: string, description: string, body: string): string {
  const desc = JSON.stringify(description || '');
  return `---\nname: ${name}\ndescription: ${desc}\n---\n\n${body}\n`;
}

/**
 * Convert skill body to Cline markdown format (Agent Skills open standard).
 * Cline discovers skills by the `name:` and `description:` frontmatter fields
 * inside a <name>/SKILL.md directory under ~/.cline/skills/.
 *
 * @param name        - Command slug used as the skill's invocation name.
 * @param description - Skill description shown in the skill picker.
 * @param body        - Skill body text (the instruction content).
 */
export function toClineMd(name: string, description: string, body: string): string {
  const desc = JSON.stringify(description || '');
  return `---\nname: ${name}\ndescription: ${desc}\n---\n\n${body}\n`;
}

/**
 * Convert a directory-based skill (SKILL.md plus supporting markdown files in subdirectories
 * such as references/) into a single flat markdown file suitable for providers that only
 * support flat markdown files (e.g., Gemini CLI, Antigravity).
 *
 * @param srcSkillDir    - Absolute path to the source skill directory containing SKILL.md.
 * @param resolveContent - Callback to resolve provider-specific syntax (refs, models) on each markdown file.
 */
export function bundleFlatSkill(srcSkillDir: string, resolveContent: (raw: string) => string): string {
  const skillMd = path.join(srcSkillDir, 'SKILL.md');
  const baseContent = resolveContent(fs.readFileSync(skillMd, 'utf8'));

  const mdFiles: { relPath: string; absPath: string }[] = [];
  const collect = (dir: string, relPrefix = '') => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const entryRel = relPrefix ? `${relPrefix}/${entry.name}` : entry.name;
      const entryAbs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        collect(entryAbs, entryRel);
      } else if (entry.name.endsWith('.md') && entry.name !== 'SKILL.md') {
        mdFiles.push({ relPath: entryRel, absPath: entryAbs });
      }
    }
  };
  collect(srcSkillDir);

  if (mdFiles.length === 0) {
    return baseContent;
  }

  const skillName = path.basename(srcSkillDir);
  const hailyHome = process.env['HAILYKIT_HOME'] || path.join(os.homedir(), '.hailykit');

  let bundled = baseContent.replace(/\s+$/, '');
  mdFiles.sort((a, b) => a.relPath.localeCompare(b.relPath));
  for (const { relPath } of mdFiles) {
    const centralRefPath = path.join(hailyHome, 'kit', 'skills', skillName, relPath);
    bundled += `\n\n---\n\n# Reference: ${relPath}\n> [!IMPORTANT]\n> To view detailed instructions for this section, run the \`view_file\` (or \`read_file\`) tool on:\n> \`${centralRefPath}\``;
  }

  return bundled + '\n';
}
