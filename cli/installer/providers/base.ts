import * as fs from 'node:fs';
import * as path from 'node:path';
import { parseFrontmatter, toCommandName, resolveSkillRefs, resolveAgentRefs, resolveModel, isProviderAllowed, type AgentRefType } from '../converter.js';

/** Result of convertSkill(); null means skip this skill. */
export interface ConvertedSkill {
  filename: string;
  content: string;
}

/**
 * Polymorphic surface used by install/upgrade/status commands.
 * ClaudeProvider satisfies this interface directly (no BaseProvider);
 * all other providers extend BaseProvider which also satisfies it.
 */
export interface Provider {
  readonly name: string;
  readonly label: string;
  globalDir(): string;
  projectDir(): string;
  hooksSupported(): boolean;
  installSkills(extractedClaudeDir: string, targetProviderDir: string): number;
  installRules(extractedClaudeDir: string, targetProviderDir: string): void;
  installHooks(extractedClaudeDir: string, targetProviderDir: string): void;
  /** Optional: generate provider-native agent definitions from kit/agents/. */
  installAgents?(extractedClaudeDir: string, targetProviderDir: string): void;
  readVersion(providerDir: string): string | null;
  writeVersion(providerDir: string, version: string): void;
}

// Directories and file suffixes skipped when copying hook scripts.
// Module-level constant so it is allocated once, not per recursive call.
const HOOK_COPY_SKIP_DIRS = new Set(['__tests__', 'tests', 'node_modules']);

/**
 * Base provider class. Subclasses override convertSkill() and path getters.
 *
 * Directory layout per provider:
 *   globalDir()   → e.g. ~/.gemini/
 *   projectDir()  → e.g. .gemini/ (relative to process.cwd())
 *   commandsSubDir() → sub-path within provider dir for commands
 *   hooksDir()    → sub-path for hooks output, or null if unsupported
 */
export abstract class BaseProvider implements Provider {
  abstract get name(): string;
  abstract get label(): string;

  abstract globalDir(): string;
  protected abstract _projectDirName(): string;

  projectDir(): string { return path.join(process.cwd(), this._projectDirName()); }
  commandsSubDir(): string { return 'commands'; }
  hooksSupported(): boolean { return false; }

  /**
   * Convert SKILL.md content to a provider-specific file.
   * Returns { filename, content } or null to skip this skill.
   */
  abstract convertSkill(skillContent: string, internalName: string): ConvertedSkill | null;

  /**
   * Install all skills from extractedClaudeDir into targetProviderDir.
   *
   * @param extractedClaudeDir - Path to source dir inside the extracted zip (claude/ or .claude/).
   * @param targetProviderDir  - Absolute path to the provider's install directory.
   * @returns Number of skills installed.
   */
  installSkills(extractedClaudeDir: string, targetProviderDir: string): number {
    const skillsDir = path.join(extractedClaudeDir, 'skills');
    if (!fs.existsSync(skillsDir)) return 0;

    const outDir = path.join(targetProviderDir, this.commandsSubDir());
    fs.mkdirSync(outDir, { recursive: true });

    let count = 0;
    const written = new Set<string>();
    for (const entry of fs.readdirSync(skillsDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const skillMd = path.join(skillsDir, entry.name, 'SKILL.md');
      if (!fs.existsSync(skillMd)) continue;

      const content = fs.readFileSync(skillMd, 'utf8');
      const parsed = parseFrontmatter(content);
      if (!isProviderAllowed(parsed, this.name)) continue;

      const result = this.convertSkill(content, entry.name);
      if (!result) continue;

      if (written.has(result.filename)) {
        console.warn(`  Skipped duplicate skill filename: ${result.filename} (from ${entry.name})`);
        continue;
      }
      written.add(result.filename);
      const destPath = path.join(outDir, result.filename);
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      fs.writeFileSync(destPath, result.content, 'utf8');
      count++;
    }
    return count;
  }

  /**
   * Install rules as a single concatenated context file.
   * Subclasses can override for provider-specific behavior.
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

    const outPath = path.join(targetProviderDir, 'hailykit-rules.md');
    fs.writeFileSync(outPath, parts.join('\n\n---\n\n'), 'utf8');
  }

  // No-op by default; providers with hook support override this.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  installHooks(_extractedClaudeDir: string, _targetProviderDir: string): void { /* no-op */ }

  /**
   * Recursively copy a hooks directory into dest, skipping test dirs and test files.
   * Shared by all providers that install hook scripts (Codex, Cursor, Windsurf).
   */
  protected _copyHookDir(src: string, dest: string): void {
    fs.mkdirSync(dest, { recursive: true });
    for (const ent of fs.readdirSync(src, { withFileTypes: true })) {
      if (HOOK_COPY_SKIP_DIRS.has(ent.name)) continue;
      if (ent.name.endsWith('.test.cjs')) continue;
      const s = path.join(src, ent.name);
      const d = path.join(dest, ent.name);
      if (ent.isDirectory()) this._copyHookDir(s, d);
      else fs.copyFileSync(s, d);
    }
  }

  /** Read installed version from provider dir metadata. Returns string or null. */
  readVersion(providerDir: string): string | null {
    const metaPath = path.join(providerDir, '.hailykit-meta.json');
    if (!fs.existsSync(metaPath)) return null;
    try {
      const parsed = JSON.parse(fs.readFileSync(metaPath, 'utf8')) as Record<string, unknown>;
      return typeof parsed.version === 'string' ? parsed.version : null;
    } catch { return null; }
  }

  writeVersion(providerDir: string, version: string): void {
    fs.mkdirSync(providerDir, { recursive: true });
    fs.writeFileSync(
      path.join(providerDir, '.hailykit-meta.json'),
      JSON.stringify({ version, installedAt: new Date().toISOString() }, null, 2),
    );
  }

  /**
   * Convert a {skill:prefix-name} reference to this provider's invocation syntax.
   * Default: `prefix-name` (e.g. `hc-cook`). Override per provider.
   */
  protected skillRef(prefix: string, name: string): string {
    return `${prefix}-${name}`;
  }

  /**
   * Convert an {agent:X}, {agents:A,B}, or {agent-result:X} tag to this
   * provider's agent-spawn instruction.
   * Default: sequential natural-language steps (for providers without sub-agent support).
   * Override in providers that have a native agent-spawn mechanism.
   */
  protected agentRef(type: AgentRefType, roles: string[]): string {
    if (type === 'agent-result') {
      return `Using the ${roles[0]} output above:`;
    }
    if (type === 'agents') {
      return roles
        .map((r, i) => `**Step ${i + 1} — ${r[0].toUpperCase() + r.slice(1)}:** [Perform ${r} work here]`)
        .join('\n');
    }
    return `**${roles[0][0].toUpperCase() + roles[0].slice(1)} step:** [Perform the following as a ${roles[0]} specialist:]`;
  }

  /** Shared helper: parse a SKILL.md and return cmdName, description, body with all refs resolved. */
  protected _parseSkill(
    content: string,
    internalName: string,
  ): { cmdName: string; description: string; body: string } {
    const { frontmatter, body } = parseFrontmatter(content);
    const cmdName = toCommandName(frontmatter, internalName);
    const description = frontmatter.description || '';
    const resolvedBody = resolveSkillRefs(
      resolveAgentRefs(body, (t, r) => this.agentRef(t, r)),
      (p, n) => this.skillRef(p, n),
    );
    return { cmdName, description, body: resolvedBody };
  }
}
