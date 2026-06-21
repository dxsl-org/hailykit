import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { BaseProvider, type ConvertedSkill } from './base.js';
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
  extractUnmanagedAgentSlugs,
  mergeManagedTomlBlock,
  atomicWriteToml,
} from './codex-toml.js';
import { warnIfCodexHooksUnsupported } from './codex-version.js';

const AGENTS_SENTINEL_START = '# --- hailykit-agents-start ---';
const AGENTS_SENTINEL_END = '# --- hailykit-agents-end ---';
const KNOWN_TIERS = new Set<string>(['thinking', 'medium', 'fast', 'deep']);

/**
 * Build the default scaffold content for a fresh or reset AGENTS.md.
 * @param rulesBlock - The sentinel-wrapped HailyKit rules block.
 */
function _agentsMdScaffold(rulesBlock: string): string {
  return [
    '# Agent Instructions',
    '',
    '<!-- Scaffolded by HailyKit. Add your own instructions above the rules block. -->',
    '<!-- Skills are in ~/.codex/skills/*/SKILL.md and regenerated on every upgrade. -->',
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
 *           Hooks skipped on Windows (not supported by Codex CLI there).
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
   * @param targetProviderDir  - ~/.codex/ (unused for skills path; kept for interface compat).
   * @returns Number of skills installed.
   */
  installSkills(extractedClaudeDir: string, _targetProviderDir: string): number {
    const srcSkillsDir = path.join(extractedClaudeDir, 'skills');
    if (!fs.existsSync(srcSkillsDir)) return 0;

    // NOTE: Codex 2025+ canonical global skills path is ~/.agents/skills/, not ~/.codex/skills/.
    const skillsOutDir = path.join(os.homedir(), '.agents', 'skills');
    let count = 0;

    for (const skillName of fs.readdirSync(srcSkillsDir).sort()) {
      const skillSrcDir = path.join(srcSkillsDir, skillName);
      const skillMd = path.join(skillSrcDir, 'SKILL.md');
      if (!fs.existsSync(skillMd)) continue;

      const content = fs.readFileSync(skillMd, 'utf8');
      const parsed = parseFrontmatter(content);
      if (!isProviderAllowed(parsed, this.name)) continue;

      const destDir = path.join(skillsOutDir, skillName);
      fs.mkdirSync(destDir, { recursive: true });
      this._copySkillDir(skillSrcDir, destDir, skillName);
      count++;
    }

    return count;
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
  installAgents(extractedClaudeDir: string, targetProviderDir: string): void {
    const agentsDir = path.join(extractedClaudeDir, 'agents');
    if (!fs.existsSync(agentsDir)) return;

    const outDir = path.join(targetProviderDir, 'agents');
    fs.mkdirSync(outDir, { recursive: true });

    const configPath = path.join(targetProviderDir, 'config.toml');
    const existingConfig = fs.existsSync(configPath) ? fs.readFileSync(configPath, 'utf8') : '';
    // Strip the managed block before scanning so only USER-owned tables count as unmanaged.
    const unmanaged = extractUnmanagedAgentSlugs(
      mergeManagedTomlBlock(existingConfig, '', AGENTS_SENTINEL_START, AGENTS_SENTINEL_END),
    );

    const entries = new Map<string, string>();
    for (const file of fs.readdirSync(agentsDir).sort()) {
      if (!file.endsWith('.md')) continue;

      const content = fs.readFileSync(path.join(agentsDir, file), 'utf8');
      const { frontmatter, body } = parseFrontmatter(content);

      const name = frontmatter.name || file.replace(/\.md$/, '');
      const description = frontmatter.description || '';
      const slug = toCodexSlug(name);

      if (unmanaged.has(slug) || entries.has(slug)) {
        console.warn(`    Skipped agent ${name}: [agents.${slug}] already exists (user-defined or duplicate)`);
        continue;
      }

      const resolvedBody = resolveModelRefs(
        resolveSkillRefs(
          resolveAgentRefs(body, (t, r) => this.agentRef(t, r)),
          (p, n) => this.skillRef(p, n),
        ),
        this.name,
      );

      const lines = [
        `name = ${JSON.stringify(name)}`,
        `description = ${JSON.stringify(description)}`,
      ];

      // model: resolve a known tier to its concrete id; preserve an unknown
      // concrete id as a comment (never emit `model = undefined`).
      const rawModel = frontmatter.model;
      if (rawModel == null || KNOWN_TIERS.has(rawModel)) {
        const tier = (rawModel ?? 'medium') as ModelTier;
        lines.push(`model = ${JSON.stringify(getModelMap('codex')[tier])}`);
        const effort = getModelEffort('codex', tier);
        if (effort) lines.push(`model_reasoning_effort = ${JSON.stringify(effort)}`);
      } else {
        lines.push(`# model = ${JSON.stringify(String(rawModel).trim())}`);
      }

      const sandbox = deriveSandboxMode(typeof frontmatter.tools === 'string' ? frontmatter.tools : undefined);
      if (sandbox) lines.push(`sandbox_mode = ${JSON.stringify(sandbox)}`);

      lines.push('', 'developer_instructions = """', escapeTomlMultiline(resolvedBody), '"""', '');
      const toml = lines.join('\n');

      fs.writeFileSync(path.join(outDir, `${slug}.toml`), toml, 'utf8');
      entries.set(slug, buildAgentConfigEntry(slug, description));
    }

    const block = [...entries.keys()].sort().map((s) => entries.get(s)!).join('\n\n');
    const merged = mergeManagedTomlBlock(existingConfig, block, AGENTS_SENTINEL_START, AGENTS_SENTINEL_END);
    if (merged !== existingConfig) {
      fs.mkdirSync(targetProviderDir, { recursive: true });
      atomicWriteToml(configPath, merged);
    }
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
      '> See `~/.codex/skills/` for full skill instructions.',
      '',
      parts.join('\n\n---\n\n'),
      SENTINEL_END,
    ].join('\n');

    // Marker present in HailyKit scaffolds written before v3.4.0.
    // Files with this marker are entirely auto-generated — safe to replace.
    const OLD_SCAFFOLD_MARKER = 'hailykit-skills.md and hailykit-rules.md are regenerated on upgrade';

    const agentsMd = path.join(targetProviderDir, 'AGENTS.md');

    if (fs.existsSync(agentsMd)) {
      let existing = fs.readFileSync(agentsMd, 'utf8');
      const isOldScaffold = existing.includes(OLD_SCAFFOLD_MARKER);

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
   * Install Codex-compatible hooks:
   *   1. Skip entirely on Windows (Codex CLI does not support hooks there)
   *   2. Copy hook scripts from release into ~/.codex/hooks/
   *   3. Generate protocol-translation wrapper shims (codex-hook-compat)
   *   4. Write hooks.json pointing at wrappers
   *   5. Enable hooks feature flag in config.toml
   */
  installHooks(extractedClaudeDir: string, targetProviderDir: string): void {
    if (process.platform === 'win32') {
      console.log('    Hooks: skipped (Codex CLI does not support hooks on Windows)');
      return;
    }

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
    const hooksArray = buildCodexHooksJson(allHooks, destHooksDir, wrapperMap);
    if (hooksArray.length === 0) return;

    fs.mkdirSync(targetProviderDir, { recursive: true });
    fs.writeFileSync(
      path.join(targetProviderDir, 'hooks.json'),
      JSON.stringify(hooksArray, null, 2),
      'utf8',
    );

    writeCodexConfigToml(targetProviderDir);
  }

  uninstall(providerDir: string): void {
    super.uninstall(providerDir);

    // Strip the managed [agents.X] registry block from config.toml — base uninstall
    // removes agents/ but would otherwise leave dangling config entries Codex warns on.
    this._removeSentinelBlock(path.join(providerDir, 'config.toml'), AGENTS_SENTINEL_START, AGENTS_SENTINEL_END);

    // Remove HailyKit skill dirs from ~/.agents/skills/ (all hl-* and hc-* dirs)
    const agentsSkillsDir = path.join(os.homedir(), '.agents', 'skills');
    if (!fs.existsSync(agentsSkillsDir)) return;
    let count = 0;
    for (const entry of fs.readdirSync(agentsSkillsDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith('hl-') || entry.name.startsWith('hc-')) {
        fs.rmSync(path.join(agentsSkillsDir, entry.name), { recursive: true, force: true });
        count++;
      }
    }
    if (count > 0) console.log(`    Removed ${count} skills from ~/.agents/skills/`);
  }

  // Not used — installSkills is fully overridden above.
  convertSkill(_content: string, _internalName: string): ConvertedSkill | null { return null; }
}
