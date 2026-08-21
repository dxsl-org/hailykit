import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { BaseProvider, type ConvertedSkill, type InstallAgentsResult } from './base.js';
import {
  parseFrontmatter, resolveSkillRefs, resolveAgentRefs, isProviderAllowed,
  getModelMap, getModelEffort, resolveModel, resolveModelRefs, type ModelTier, type AgentRefType,
} from '../converter.js';
import {
  installHookWrappers,
  buildCodexHooksJson,
  buildTimeoutsByPath,
} from './codex-hook-compat.js';
import { writeCodexConfigToml } from './codex-config.js';
import {
  escapeTomlMultiline,
  toCodexSlug,
  buildAgentConfigEntry,
  deriveSandboxMode,
  extractManagedTomlBlock,
  extractUnmanagedAgentSlugs,
  mergeManagedTomlBlock,
  atomicWriteToml,
} from './codex-toml.js';
import {
  AGENTS_MANIFEST,
  agentMarkerPath,
  agentTomlPath,
  extractAgentTableSpans,
  isManagedCodexAgent,
  readAgentOwnershipMarker,
  readManagedCodexAgentSlugs,
  removeAgentTableSpans,
  removeManagedCodexAgent,
  writeCodexAgentManifest,
  writeManagedCodexAgent,
} from './codex-agent-migration.js';
import { isGeneratedCodexAgentToml } from './codex-agent-legacy.js';
import { warnIfCodexHooksUnsupported } from './codex-version.js';

const AGENTS_SENTINEL_START = '# --- hailykit-agents-start ---';
const AGENTS_SENTINEL_END = '# --- hailykit-agents-end ---';
const KNOWN_TIERS = new Set<string>(['thinking', 'medium', 'fast', 'ultra']);
const SKILLS_MANIFEST = 'hailykit-installed-skills.json';
const SKILL_OWNERSHIP_MARKER = '.hailykit-codex-skill.json';
const SAFE_SKILL_DIR_RE = /^[a-z][a-z0-9-]*$/;

interface KitAgentSpec {
  name: string;
  description: string;
  slug: string;
  resolvedBody: string;
  toml: string;
}

type AgentOwnershipStatus = 'fresh' | 'managed' | 'adoptableLegacy' | 'userOwned';

interface ClassifiedAgentOwnership {
  status: AgentOwnershipStatus;
  reason: string;
}

const LEGACY_AGENT_FINGERPRINT_CANDIDATES = [
  '## Report Contract',
  '## Output Contract',
  'docs/engineering-standards.md',
  '## Naming',
  '.agents/reports/',
  'Agent Report Contract',
];

function readSkillsManifest(providerDir: string): string[] {
  try {
    const raw: unknown = JSON.parse(
      fs.readFileSync(path.join(providerDir, SKILLS_MANIFEST), 'utf8'));
    return Array.isArray(raw)
      ? raw.filter((name): name is string =>
        typeof name === 'string' && SAFE_SKILL_DIR_RE.test(name))
      : [];
  } catch {
    return [];
  }
}

function isCodexManagedSkillDir(skillDir: string): boolean {
  try {
    const marker = JSON.parse(
      fs.readFileSync(path.join(skillDir, SKILL_OWNERSHIP_MARKER), 'utf8')) as unknown;
    return typeof marker === 'object' && marker !== null &&
      (marker as Record<string, unknown>).provider === 'codex';
  } catch {
    return false;
  }
}

function isLegacyHailyKitSkillDir(skillDir: string): boolean {
  try {
    const parsed = parseFrontmatter(
      fs.readFileSync(path.join(skillDir, 'SKILL.md'), 'utf8'));
    if (parsed.metadata.author === 'HailyKit') return true;
    // NOTE: colon-form names under HailyKit's historical prefixes (ha/hc/hd/hi/hl/hm/hs)
    // existed only in pre-rename installs — Codex's own name constraint (^[a-z0-9-]+$)
    // forbids them, so none can be user-authored. Ported skills carry a third-party
    // author, and renamed/deleted skills have no canonical counterpart, so neither
    // author nor a current-catalog lookup can identify them; the name form alone can.
    const separator = String.fromCharCode(58);
    return new RegExp(`^h(a|c|d|i|l|m|s)${separator}`).test(parsed.frontmatter.name ?? '');
  } catch {
    return false;
  }
}

function removeLegacySkillDirs(skillsRoot: string): number {
  if (!fs.existsSync(skillsRoot)) return 0;
  let removed = 0;
  for (const entry of fs.readdirSync(skillsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const skillDir = path.join(skillsRoot, entry.name);
    if (!isLegacyHailyKitSkillDir(skillDir)) continue;
    fs.rmSync(skillDir, { recursive: true, force: true });
    removed++;
  }
  return removed;
}

/** Pre-full-dir installs generated these single-file digests in ~/.codex/;
 * nothing regenerates them anymore, and their colon-form skill lists actively
 * mislead the model. Returns how many existed and were removed. */
function removeLegacyGeneratedFiles(providerDir: string): number {
  let removed = 0;
  for (const legacyFile of ['hailykit-skills.md', 'hailykit-rules.md']) {
    const filePath = path.join(providerDir, legacyFile);
    if (!fs.existsSync(filePath)) continue;
    fs.rmSync(filePath, { force: true });
    removed++;
  }
  return removed;
}

function buildAgentToml(spec: Omit<KitAgentSpec, 'toml'>, rawModel: string | undefined, tools: string | undefined): string {
  const lines = [
    `name = ${JSON.stringify(spec.name)}`,
    `description = ${JSON.stringify(spec.description)}`,
  ];

  if (rawModel == null || KNOWN_TIERS.has(rawModel)) {
    const tier = (rawModel ?? 'medium') as ModelTier;
    lines.push(`model = ${JSON.stringify(getModelMap('codex')[tier])}`);
    const effort = getModelEffort('codex', tier);
    if (effort) lines.push(`model_reasoning_effort = ${JSON.stringify(effort)}`);
  } else {
    lines.push(`# model = ${JSON.stringify(String(rawModel).trim())}`);
  }

  const sandbox = deriveSandboxMode(tools);
  if (sandbox) lines.push(`sandbox_mode = ${JSON.stringify(sandbox)}`);

  lines.push('', 'developer_instructions = """', escapeTomlMultiline(spec.resolvedBody), '"""', '');
  return lines.join('\n');
}

function buildKitAgentSpec(
  filePath: string,
  agentRef: (type: AgentRefType, roles: string[]) => string,
  skillRef: (prefix: string, name: string) => string,
): KitAgentSpec {
  const content = fs.readFileSync(filePath, 'utf8');
  const { frontmatter, body } = parseFrontmatter(content);
  const name = frontmatter.name || path.basename(filePath, '.md');
  const description = frontmatter.description || '';
  const slug = toCodexSlug(name);
  const resolvedBody = resolveModelRefs(
    resolveSkillRefs(
      resolveAgentRefs(body, agentRef),
      skillRef,
    ),
    'codex',
  );
  const specBase = { name, description, slug, resolvedBody };
  return {
    ...specBase,
    toml: buildAgentToml(
      specBase,
      typeof frontmatter.model === 'string' ? frontmatter.model : undefined,
      typeof frontmatter.tools === 'string' ? frontmatter.tools : undefined,
    ),
  };
}

function isAdoptableLegacyAgent(providerDir: string, spec: KitAgentSpec, tableContent: string): boolean {
  const configPointer = tableContent.match(/^\s*config_file\s*=\s*"([^"\r\n]+)"\s*$/m)?.[1];
  if (configPointer !== `agents/${spec.slug}.toml`) return false;
  const tomlPath = agentTomlPath(providerDir, spec.slug);
  if (!fs.existsSync(tomlPath)) return false;
  return isGeneratedCodexAgentToml(fs.readFileSync(tomlPath, 'utf8'), {
    name: spec.name,
    legacyFingerprints: LEGACY_AGENT_FINGERPRINT_CANDIDATES.filter((fingerprint) =>
      spec.resolvedBody.includes(fingerprint)),
  });
}

function classifyAgentOwnership(
  providerDir: string,
  spec: KitAgentSpec,
  managedSlugs: ReadonlySet<string>,
  unmanagedTables: ReadonlyMap<string, string>,
  duplicateUnmanagedSlugs: ReadonlySet<string>,
): ClassifiedAgentOwnership {
  const unmanagedTable = unmanagedTables.get(spec.slug);
  if (duplicateUnmanagedSlugs.has(spec.slug)) {
    return { status: 'userOwned', reason: 'multiple unmanaged registry entries exist' };
  }
  if (managedSlugs.has(spec.slug)) {
    if (unmanagedTable) {
      return { status: 'userOwned', reason: 'conflicting unmanaged registry entry exists' };
    }
    return { status: 'managed', reason: 'sentinel-managed registry entry exists' };
  }
  if (isManagedCodexAgent(providerDir, spec.slug)) {
    if (unmanagedTable) {
      const expectedEntry = buildAgentConfigEntry(spec.slug, spec.description);
      if (unmanagedTable.trim() === expectedEntry) {
        return { status: 'adoptableLegacy', reason: 'ownership marker and exact registry entry prove HailyKit ownership' };
      }
      return { status: 'userOwned', reason: 'unmanaged registry entry differs from the marked HailyKit entry' };
    }
    return { status: 'managed', reason: 'ownership marker proves HailyKit ownership' };
  }
  if (!unmanagedTable) {
    if (fs.existsSync(agentTomlPath(providerDir, spec.slug))) {
      return { status: 'userOwned', reason: 'unregistered agent TOML already exists' };
    }
    return { status: 'fresh', reason: 'fresh install' };
  }
  if (isAdoptableLegacyAgent(providerDir, spec, unmanagedTable)) {
    return { status: 'adoptableLegacy', reason: 'legacy HailyKit registry and TOML shape matched' };
  }
  return { status: 'userOwned', reason: 'unmanaged registry entry failed legacy adoption checks' };
}

/**
 * Build the default scaffold content for a fresh or reset AGENTS.md.
 * @param rulesBlock - The sentinel-wrapped HailyKit rules block.
 */
function _agentsMdScaffold(rulesBlock: string): string {
  return [
    '# Agent Instructions',
    '',
    '<!-- Scaffolded by HailyKit. Add your own instructions above the rules block. -->',
    '<!-- Skills are in .agents/skills/ (project) or ~/.agents/skills/ (global). -->',
    '',
    rulesBlock,
    '',
  ].join('\n');
}

/**
 * OpenAI Codex CLI provider.
 *
 * Skills:   Full skill directories are installed to ~/.agents/skills/<dir-name>/.
 *           Codex 2025+ discovers skills at ~/.agents/skills/ (global) and
 *           .agents/skills/ (repo-level). Config/meta stays in ~/.codex/.
 *           The `name:` frontmatter field is rewritten to the kebab-case dir name
 *           (Codex ^[a-z0-9-]+$ constraint). Angle brackets stripped from description.
 *           Skills surface via `$skill-name` mentions in chat.
 *
 * Agents:   kit/agents/*.md → ~/.codex/agents/<name>.toml (Codex custom agent TOML).
 *           Enables NL agent invocation: "Use the haily-researcher agent for this step."
 *
 * Rules:    All rules/ files concatenated into a sentinel-managed block inside
 *           ~/.codex/AGENTS.md. Block replaced on upgrade; user content preserved.
 *
 * Hooks:    Claude Code hook scripts copied to ~/.codex/hooks/ with Codex-protocol
 *           wrapper shims. hooks.json regenerated; [features] hooks = true written.
 *           Cross-platform incl. Windows (wrappers are shebang-free, invoked as
 *           `node "<abs>"`; Codex supports Windows hooks per 6/2026 docs).
 *
 * Spec: 2025+ (no semver) — researched 2026-06-08
 * Docs: https://developers.openai.com/codex/skills
 *       https://developers.openai.com/codex/hooks
 *       https://developers.openai.com/codex/guides/agents-md
 *
 * Directory layout after install:
 *   ~/.agents/skills/<name>/             ← full skill dirs (SKILL.md + refs + assets)
 *   ~/.codex/
 *     agents/<name>.toml                 ← custom agent definitions
 *     AGENTS.md                          ← managed rules block; user content preserved
 *     hooks/*.cjs                        ← hook scripts + Codex wrapper shims
 *     hooks.json                         ← points at wrappers
 *     config.toml                        ← [features] hooks = true
 *     .hailykit-meta.json
 */
export class CodexProvider extends BaseProvider {
  get name(): string { return 'codex'; }
  get label(): string { return 'Codex CLI'; }

  globalDir(): string { return path.join(os.homedir(), '.codex'); }
  protected _projectDirName(): string { return '.codex'; }
  hooksSupported(): boolean { return true; }

  protected skillRef(prefix: string, name: string): string {
    return `$${prefix}-${name}`;
  }

  protected agentRef(type: AgentRefType, roles: string[]): string {
    // NOTE: Codex agents are invoked by natural language, not $-prefix.
    // The $-prefix is for skills only; agents use ~/.codex/agents/<name>.toml.
    if (type === 'agent-result') {
      return `Using the ${roles[0]} agent output above:`;
    }
    if (type === 'agents') {
      const listed = roles.map((r) => `the ${r} agent`).join(', then ');
      return `Use ${listed} for this step.`;
    }
    return `Use the ${roles[0]} agent for this step.`;
  }

  private _getSkillsRoot(providerDir: string): string {
    return path.join(path.dirname(path.resolve(providerDir)), '.agents', 'skills');
  }

  private _removeLegacySkills(providerDir: string): number {
    return removeLegacySkillDirs(path.join(providerDir, 'skills'));
  }

  // ── Skills ────────────────────────────────────────────────────────────────

  /**
   * Override: install full skill directories into ~/.agents/skills/<dir-name>/.
   *
   * Codex 2025+ discovers skills at ~/.agents/skills/ (global). Config stays
   * in ~/.codex/. The full directory is copied (SKILL.md + references/ + assets/).
   *
   * Transformations applied to SKILL.md only:
   *   1. `name:` — rewritten to kebab-case dir name (Codex ^[a-z0-9-]+$ constraint)
   *   2. `description:` — angle brackets stripped (Codex spec disallows)
   *   3. {agent:X} and {skill:X} refs resolved to Codex syntax
   *
   * @param extractedClaudeDir - Source kit/ dir from the release zip.
   * @param targetProviderDir  - Provider config dir; its parent determines skill scope.
   * @returns Number of skills installed.
   */
  installSkills(extractedClaudeDir: string, targetProviderDir: string): number {
    // Legacy cleanup runs before the source guard — a zip without kit/skills/
    // must still heal a machine carrying pre-rename artifacts.
    const legacyRemoved = this._removeLegacySkills(targetProviderDir);
    if (legacyRemoved > 0) {
      console.log(`    Removed ${legacyRemoved} legacy HailyKit skill(s) from provider-local skills/`);
    }
    const digestsRemoved = removeLegacyGeneratedFiles(targetProviderDir);
    if (digestsRemoved > 0) {
      console.log(`    Removed ${digestsRemoved} legacy generated digest file(s)`);
    }

    const srcSkillsDir = path.join(extractedClaudeDir, 'skills');
    if (!fs.existsSync(srcSkillsDir)) return 0;

    const skillsOutDir = this._getSkillsRoot(targetProviderDir);
    const installed: string[] = [];

    for (const skillName of fs.readdirSync(srcSkillsDir).sort()) {
      const skillSrcDir = path.join(srcSkillsDir, skillName);
      const skillMd = path.join(skillSrcDir, 'SKILL.md');
      if (!fs.existsSync(skillMd)) continue;

      const content = fs.readFileSync(skillMd, 'utf8');
      const parsed = parseFrontmatter(content);
      if (!isProviderAllowed(parsed, this.name)) continue;

      const destDir = path.join(skillsOutDir, skillName);
      const wasManaged = isCodexManagedSkillDir(destDir);
      const existed = fs.existsSync(destDir);
      if (existed && !wasManaged) {
        console.warn(`    Skipped ${skillName}: existing skill is not managed by HailyKit Codex`);
        continue;
      }
      if (wasManaged) {
        fs.rmSync(destDir, { recursive: true, force: true });
      }
      fs.mkdirSync(destDir, { recursive: true });
      this._copySkillDir(skillSrcDir, destDir, skillName);
      fs.writeFileSync(
        path.join(destDir, SKILL_OWNERSHIP_MARKER),
        JSON.stringify({ provider: this.name, skill: skillName }) + '\n',
        'utf8',
      );
      installed.push(skillName);
    }

    const installedSet = new Set(installed);
    for (const stale of readSkillsManifest(targetProviderDir)) {
      const staleDir = path.join(skillsOutDir, stale);
      if (!installedSet.has(stale) && isCodexManagedSkillDir(staleDir)) {
        fs.rmSync(staleDir, { recursive: true, force: true });
      }
    }

    fs.mkdirSync(targetProviderDir, { recursive: true });
    fs.writeFileSync(
      path.join(targetProviderDir, SKILLS_MANIFEST),
      JSON.stringify(installed, null, 2) + '\n',
      'utf8',
    );

    return installed.length;
  }

  /** Recursively copy a skill dir; applies SKILL.md transformations to the main file only. */
  private _copySkillDir(src: string, dest: string, skillName: string): void {
    for (const ent of fs.readdirSync(src, { withFileTypes: true })) {
      const srcPath = path.join(src, ent.name);
      const destPath = path.join(dest, ent.name);
      if (ent.isDirectory()) {
        fs.mkdirSync(destPath, { recursive: true });
        this._copySkillDir(srcPath, destPath, skillName);
        continue;
      }
      if (ent.name === 'SKILL.md') {
        let content = fs.readFileSync(srcPath, 'utf8');
        content = resolveAgentRefs(content, (t, r) => this.agentRef(t, r));
        content = resolveSkillRefs(content, (p, n) => this.skillRef(p, n));
        content = resolveModel(content, this.name);
        content = resolveModelRefs(content, this.name);
        content = content.replace(/^(name:\s*).*$/m, `$1${skillName}`);
        // Codex disallows angle brackets in `description:` only — body text keeps
        // `<placeholder>` usage syntax (a whole-file strip mangles usage docs).
        content = content.replace(/^(description:\s*)(.*)$/m,
          (_m, prefix: string, desc: string) => prefix + desc.replace(/<[^>]+>/g, ''));
        fs.writeFileSync(destPath, content, 'utf8');
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }

  // ── Agents ────────────────────────────────────────────────────────────────

  /**
   * Generate ~/.codex/agents/<slug>.toml for each kit/agents/*.md file AND
   * register each as an `[agents.<slug>]` table in ~/.codex/config.toml.
   *
   * Codex 2025+ only loads a custom agent when config.toml carries an
   * `[agents.<slug>]` entry with `config_file = "agents/<slug>.toml"`. Writing
   * the per-agent .toml alone (the prior behavior) left every agent inert.
   *
   * The registry lives in a sentinel-managed block; user-authored `[agents.X]`
   * tables outside the block are preserved, and a kit agent whose slug collides
   * with such a user table is skipped with a warning.
   *
   * @param extractedClaudeDir - Source kit/ dir from the release zip.
   * @param targetProviderDir  - ~/.codex/.
   */
  installAgents(extractedClaudeDir: string, targetProviderDir: string): InstallAgentsResult {
    const agentsDir = path.join(extractedClaudeDir, 'agents');
    if (!fs.existsSync(agentsDir)) {
      return { installed: 0, updated: 0, migrated: 0, skippedUser: 0, skippedDuplicate: 0 };
    }

    const outDir = path.join(targetProviderDir, 'agents');
    fs.mkdirSync(outDir, { recursive: true });

    const configPath = path.join(targetProviderDir, 'config.toml');
    const existingConfig = fs.existsSync(configPath) ? fs.readFileSync(configPath, 'utf8') : '';
    const managedContent = extractManagedTomlBlock(existingConfig, AGENTS_SENTINEL_START, AGENTS_SENTINEL_END);
    const managedSlugs = extractUnmanagedAgentSlugs(managedContent);
    const unmanagedBase = mergeManagedTomlBlock(existingConfig, '', AGENTS_SENTINEL_START, AGENTS_SENTINEL_END);
    const unmanagedSpans = extractAgentTableSpans(unmanagedBase);
    const unmanagedTables = new Map(unmanagedSpans.map((span) => [span.slug, span.text] as const));
    const unmanagedCounts = new Map<string, number>();
    for (const span of unmanagedSpans) {
      unmanagedCounts.set(span.slug, (unmanagedCounts.get(span.slug) ?? 0) + 1);
    }
    const duplicateUnmanagedSlugs = new Set(
      [...unmanagedCounts].filter(([, count]) => count > 1).map(([slug]) => slug),
    );
    const managedTables = new Map(
      extractAgentTableSpans(managedContent).map((span) => [span.slug, span.text] as const),
    );
    const results: InstallAgentsResult = { installed: 0, updated: 0, migrated: 0, skippedUser: 0, skippedDuplicate: 0 };
    const adoptedLegacy = new Set<string>();
    const entries = new Map<string, string>();
    const installedSlugs: string[] = [];
    const preservedMarkedSlugs = new Set<string>();
    const seenKitSlugs = new Set<string>();

    for (const file of fs.readdirSync(agentsDir).sort()) {
      if (!file.endsWith('.md')) continue;
      const spec = buildKitAgentSpec(
        path.join(agentsDir, file),
        (type, roles) => this.agentRef(type, roles),
        (prefix, name) => this.skillRef(prefix, name),
      );

      if (seenKitSlugs.has(spec.slug)) {
        results.skippedDuplicate++;
        console.warn(`    Skipped agent ${spec.name}: normalized duplicate slug [agents.${spec.slug}] in this release`);
        continue;
      }
      seenKitSlugs.add(spec.slug);

      const ownership = classifyAgentOwnership(
        targetProviderDir,
        spec,
        managedSlugs,
        unmanagedTables,
        duplicateUnmanagedSlugs,
      );
      if (ownership.status === 'userOwned') {
        results.skippedUser++;
        if (isManagedCodexAgent(targetProviderDir, spec.slug)) preservedMarkedSlugs.add(spec.slug);
        console.warn(`    Skipped agent ${spec.name}: [agents.${spec.slug}] is user-owned (${ownership.reason})`);
        continue;
      }
      const entry = buildAgentConfigEntry(spec.slug, spec.description);
      let shouldWriteAgent = true;
      if (ownership.status === 'adoptableLegacy') {
        adoptedLegacy.add(spec.slug);
        results.migrated++;
      } else if (ownership.status === 'fresh') {
        results.installed++;
      } else {
        const tomlPath = agentTomlPath(targetProviderDir, spec.slug);
        const marker = readAgentOwnershipMarker(agentMarkerPath(targetProviderDir, spec.slug));
        const current = fs.existsSync(tomlPath) &&
          fs.readFileSync(tomlPath, 'utf8') === spec.toml &&
          marker?.name === spec.name &&
          managedTables.get(spec.slug)?.trim() === entry;
        shouldWriteAgent = !current;
        if (shouldWriteAgent) results.updated++;
      }

      if (shouldWriteAgent) {
        writeManagedCodexAgent(targetProviderDir, spec.slug, spec.name, spec.toml);
      }
      entries.set(spec.slug, entry);
      installedSlugs.push(spec.slug);
    }

    const unmanagedWithoutAdopted = removeAgentTableSpans(
      unmanagedBase,
      unmanagedSpans.filter((span) => adoptedLegacy.has(span.slug)),
    );
    const block = [...entries.keys()].sort().map((s) => entries.get(s)!).join('\n\n');
    const merged = mergeManagedTomlBlock(unmanagedWithoutAdopted, block, AGENTS_SENTINEL_START, AGENTS_SENTINEL_END);
    if (merged !== existingConfig) {
      fs.mkdirSync(targetProviderDir, { recursive: true });
      atomicWriteToml(configPath, merged);
    }
    const installedSet = new Set(installedSlugs);
    for (const staleSlug of readManagedCodexAgentSlugs(targetProviderDir)) {
      if (installedSet.has(staleSlug) || preservedMarkedSlugs.has(staleSlug)) continue;
      removeManagedCodexAgent(targetProviderDir, staleSlug);
    }
    writeCodexAgentManifest(targetProviderDir, installedSet);
    return results;
  }

  // ── Rules ─────────────────────────────────────────────────────────────────

  /**
   * Override: inject HailyKit rules as a sentinel-managed block inside
   * ~/.codex/AGENTS.md — the root-level file Codex actually reads at startup.
   *
   * Strategy (idempotent):
   *   - If AGENTS.md contains the sentinel block → replace it
   *   - If AGENTS.md exists but has no sentinel → append the block
   *   - If AGENTS.md does not exist → create it with a scaffold + block
   *
   * User content outside the sentinels is always preserved.
   */
  installRules(extractedClaudeDir: string, targetProviderDir: string): void {
    const rulesDir = path.join(extractedClaudeDir, 'rules');
    if (!fs.existsSync(rulesDir)) return;

    const parts: string[] = [];
    for (const f of fs.readdirSync(rulesDir).sort()) {
      if (!f.endsWith('.md')) continue;
      const raw = fs.readFileSync(path.join(rulesDir, f), 'utf8').trim();
      parts.push(resolveSkillRefs(raw, (p, n) => this.skillRef(p, n)));
    }
    if (!parts.length) return;

    const SENTINEL_START = '<!-- hailykit-rules-start -->';
    const SENTINEL_END   = '<!-- hailykit-rules-end -->';
    const block = [
      SENTINEL_START,
      '## HailyKit Workflow Rules',
      '',
      '> Skills are available via `$<skill-name>` in chat (e.g. `$hc-plan`).',
      '> See `.agents/skills/` (project) or `~/.agents/skills/` (global) for full instructions.',
      '',
      parts.join('\n\n---\n\n'),
      SENTINEL_END,
    ].join('\n');

    // Marker present in HailyKit scaffolds written before v3.4.0.
    // Files with this marker are entirely auto-generated — safe to replace.
    const OLD_SCAFFOLD_MARKER = 'hailykit-skills.md and hailykit-rules.md are regenerated on upgrade';

    fs.mkdirSync(targetProviderDir, { recursive: true });
    const agentsMd = path.join(targetProviderDir, 'AGENTS.md');

    if (fs.existsSync(agentsMd)) {
      let existing = fs.readFileSync(agentsMd, 'utf8');
      const isOldScaffold = existing.includes(OLD_SCAFFOLD_MARKER);

      // Scaffold comments live OUTSIDE the sentinels, so a generation whose
      // skills location moved leaves a stale pointer no block replacement
      // touches — heal the known legacy variant on every existing-file branch.
      existing = existing.replaceAll(
        '<!-- Skills are in ~/.codex/skills/*/SKILL.md and regenerated on every upgrade. -->',
        '<!-- Skills are in .agents/skills/ (project) or ~/.agents/skills/ (global). -->',
      );

      if (existing.includes(SENTINEL_START) && !isOldScaffold) {
        // Current managed install — replace only the sentinel block.
        existing = existing.replace(
          new RegExp(`${SENTINEL_START}[\\s\\S]*?${SENTINEL_END}`),
          block,
        );
        fs.writeFileSync(agentsMd, existing, 'utf8');
      } else if (isOldScaffold) {
        // Pre-v3.4.0 auto-generated scaffold — replace the whole file cleanly.
        fs.writeFileSync(agentsMd, _agentsMdScaffold(block), 'utf8');
      } else {
        // User-created file without any HailyKit content — append block.
        fs.writeFileSync(agentsMd, existing.trimEnd() + '\n\n' + block + '\n', 'utf8');
      }
    } else {
      fs.writeFileSync(agentsMd, _agentsMdScaffold(block), 'utf8');
    }
  }

  // ── Hooks ─────────────────────────────────────────────────────────────────

  /**
   * Install Codex-compatible hooks (cross-platform, incl. Windows):
   *   1. Copy hook scripts from release into ~/.codex/hooks/
   *   2. Generate protocol-translation wrapper shims (codex-hook-compat)
   *   3. Write hooks.json pointing at wrappers
   *   4. Enable hooks feature flag in config.toml
   *
   * Windows note: the generated artifacts are platform-neutral — wrappers carry
   * no shebang and hooks.json invokes them as `node "<abs-path>"`, which Codex
   * runs the same on Windows (verified: developers.openai.com/codex/hooks, 6/2026 —
   * Windows is supported; a `command_windows` override field even exists).
   */
  installHooks(extractedClaudeDir: string, targetProviderDir: string): void {
    const settingsPath = path.join(extractedClaudeDir, 'settings.json');
    if (!fs.existsSync(settingsPath)) return;

    let settings: unknown;
    try { settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8')); }
    catch { return; }

    if (typeof settings !== 'object' || settings === null) return;
    const allHooks = (settings as Record<string, unknown>).hooks;

    // Warn (never gate) when Codex is missing or older than the recommended baseline.
    warnIfCodexHooksUnsupported();

    const srcHooksDir = path.join(extractedClaudeDir, 'hooks');
    const destHooksDir = path.join(targetProviderDir, 'hooks');
    if (fs.existsSync(srcHooksDir)) {
      this._copyHookDir(srcHooksDir, destHooksDir);
    }

    const timeoutsByPath = buildTimeoutsByPath(allHooks, destHooksDir);
    const wrapperMap = installHookWrappers(destHooksDir, timeoutsByPath);
    const hooksConfig = buildCodexHooksJson(allHooks, destHooksDir, wrapperMap);
    if (Object.keys(hooksConfig.hooks).length === 0) return;

    fs.mkdirSync(targetProviderDir, { recursive: true });
    fs.writeFileSync(
      path.join(targetProviderDir, 'hooks.json'),
      JSON.stringify(hooksConfig, null, 2),
      'utf8',
    );

    writeCodexConfigToml(targetProviderDir);
  }

  uninstall(providerDir: string): void {
    const legacyRemoved = this._removeLegacySkills(providerDir);
    const digestsRemoved = removeLegacyGeneratedFiles(providerDir);
    let removedAgents = 0;
    for (const slug of readManagedCodexAgentSlugs(providerDir)) {
      if (removeManagedCodexAgent(providerDir, slug)) removedAgents++;
    }
    fs.rmSync(path.join(providerDir, AGENTS_MANIFEST), { force: true });
    const agentsDir = path.join(providerDir, 'agents');
    if (fs.existsSync(agentsDir) && fs.readdirSync(agentsDir).length === 0) {
      fs.rmSync(agentsDir, { recursive: true, force: true });
    }
    this._removeSentinelBlock(path.join(providerDir, 'config.toml'), AGENTS_SENTINEL_START, AGENTS_SENTINEL_END);
    const meta = path.join(providerDir, '.hailykit-meta.json');
    if (!fs.existsSync(meta)) {
      if (digestsRemoved > 0) {
        console.log(`    Removed ${digestsRemoved} legacy generated digest file(s)`);
      }
      if (legacyRemoved > 0) {
        console.log(`    Removed ${legacyRemoved} legacy HailyKit skill(s) from provider-local skills/`);
      }
      if (removedAgents > 0) console.log(`    Removed ${removedAgents} HailyKit agent(s) from .codex/agents/`);
      console.log('    Not installed (no .hailykit-meta.json found)');
      return;
    }
    const skillsRoot = this._getSkillsRoot(providerDir);
    const manifestSkills = readSkillsManifest(providerDir);
    let count = 0;
    for (const name of manifestSkills) {
      const skillDir = path.join(skillsRoot, name);
      if (!isCodexManagedSkillDir(skillDir)) continue;
      fs.rmSync(skillDir, { recursive: true, force: true });
      count++;
    }
    fs.rmSync(path.join(providerDir, SKILLS_MANIFEST), { force: true });
    if (digestsRemoved > 0) {
      console.log(`    Removed ${digestsRemoved} legacy generated digest file(s)`);
    }

    for (const sub of [this.commandsSubDir(), 'hooks']) {
      const dirPath = path.join(providerDir, sub);
      if (!fs.existsSync(dirPath)) continue;
      fs.rmSync(dirPath, { recursive: true, force: true });
      console.log(`    Removed ${sub}/`);
    }
    for (const file of ['hailykit-rules.md', 'hailykit-skills.md', 'hooks.json', 'CRUSH.md']) {
      const filePath = path.join(providerDir, file);
      if (!fs.existsSync(filePath)) continue;
      fs.rmSync(filePath);
      console.log(`    Removed ${file}`);
    }
    this._removeSentinelBlock(path.join(providerDir, 'AGENTS.md'), '<!-- hailykit-rules-start -->', '<!-- hailykit-rules-end -->');
    this._removeSentinelBlock(path.join(providerDir, 'GEMINI.md'), '<!-- hailykit-managed-start -->', '<!-- hailykit-managed-end -->');
    fs.rmSync(meta, { force: true });

    if (count > 0) console.log(`    Removed ${count} HailyKit skill(s) from .agents/skills/`);
    if (legacyRemoved > 0) {
      console.log(`    Removed ${legacyRemoved} legacy HailyKit skill(s) from provider-local skills/`);
    }
    if (removedAgents > 0) console.log(`    Removed ${removedAgents} HailyKit agent(s) from .codex/agents/`);
    console.log('    ✓ Uninstalled');
  }

  // Not used — installSkills is fully overridden above.
  convertSkill(_content: string, _internalName: string): ConvertedSkill | null { return null; }
}
