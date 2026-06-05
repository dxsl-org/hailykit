/** Matches YAML frontmatter block at the start of a markdown file. */
const FRONTMATTER_RE = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;

/** Matches {skill:hc-cook} / {skill:hl-brainstorm} references in body text. */
const SKILL_REF_RE = /\{skill:((?:hc|hd|hl)-[a-z][a-z0-9-]*)\}/g;

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

/** Canonical model tiers used in agent frontmatter (provider-neutral). */
export type ModelTier = 'thinking' | 'medium' | 'fast';

/**
 * Per-provider model name for each canonical tier. Agent frontmatter uses the
 * tier; the installer resolves it to the provider's real model at install time.
 *
 * NOTE: non-Claude model names are best-effort defaults — adjust to the
 * provider's current model identifiers as they change.
 */
export const MODEL_MAP: Record<string, Record<ModelTier, string>> = {
  claude:      { thinking: 'opus',                              medium: 'sonnet',                              fast: 'haiku' },
  codex:       { thinking: 'gpt-5',                            medium: 'gpt-5',                              fast: 'gpt-5-mini' },
  gemini:      { thinking: 'gemini-2.5-pro',                   medium: 'gemini-2.5-flash',                   fast: 'gemini-3.1-flash-lite' },
  antigravity: { thinking: 'gemini-3.1-pro',                   medium: 'gemini-3.5-flash',                   fast: 'gemini-3.1-flash-lite' },
  // Cursor uses Anthropic model IDs directly (no Cursor-specific aliases for API passthrough).
  cursor:      { thinking: 'claude-opus-4-8',                  medium: 'claude-sonnet-4-6',                  fast: 'claude-haiku-4-5' },
  // OpenCode config format is "provider/model-id" (e.g. anthropic/claude-sonnet-4-5).
  opencode:    { thinking: 'anthropic/claude-opus-4-5',        medium: 'anthropic/claude-sonnet-4-5',        fast: 'anthropic/claude-haiku-4-5' },
  // Windsurf uses proprietary SWE-* models; selection is GUI-only but IDs appear in settings schema.
  windsurf:    { thinking: 'swe-1-6',                          medium: 'swe-1-5',                            fast: 'swe-1-6-fast' },
  // Zed routes Claude via the zed.dev proxy; model IDs are standard Anthropic strings.
  zed:         { thinking: 'claude-opus-4-8',                  medium: 'claude-sonnet-4-6',                  fast: 'claude-haiku-4-5' },
};

/** Matches a `model: <tier>` frontmatter line. */
const MODEL_TIER_RE = /^(model:\s*)(thinking|medium|fast)\s*$/m;

/**
 * Resolve a `model: <tier>` frontmatter line to the provider's real model name.
 * Falls back to the Claude map for providers without an explicit entry.
 * Content without a tier line (or already a concrete model) is returned unchanged.
 *
 * @param content  - File content containing a `model:` frontmatter line.
 * @param provider - Provider key (claude, codex, gemini, …).
 */
export function resolveModel(content: string, provider: string): string {
  const map = MODEL_MAP[provider] ?? MODEL_MAP.claude;
  return content.replace(MODEL_TIER_RE, (_m, prefix, tier) => `${prefix}${map[tier as ModelTier]}`);
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
 * Derive the command slug from SKILL.md frontmatter `name:` field.
 * `name: hc-cook`      → `hc-cook`   (current hyphen format)
 * `name: hc:cook`      → `hc-cook`   (legacy colon format)
 * `name: plan`         → `hl-plan`   (legacy no-prefix — assumes hl domain)
 *
 * @param frontmatter - Parsed frontmatter from parseFrontmatter().
 * @param fallback    - Directory name used when frontmatter has no `name` field.
 */
export function toCommandName(
  frontmatter: Record<string, string>,
  fallback?: string,
): string {
  const raw = frontmatter.name || fallback || '';
  // Current format: already hyphenated — hc-cook, hl-brainstorm, hd-ui-ux
  if (/^(hc|hd|hl)-/.test(raw)) return raw;
  // Legacy colon format: hc:cook → hc-cook
  if (/^(hc|hd|hl):/.test(raw)) return raw.replace(':', '-');
  // Legacy bare name: no prefix → assume hl domain
  return `hl-${raw.replace(/^hl[:-]/, '')}`;
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
