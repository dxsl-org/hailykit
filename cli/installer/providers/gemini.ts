import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { BaseProvider, type ConvertedSkill } from './base.js';
import {
  parseFrontmatter, isProviderAllowed, toGeminiToml,
  resolveSkillRefs, resolveAgentRefs, resolveModel,
} from '../converter.js';

const GEMINI_MD_START = '<!-- hailykit-managed-start -->';
const GEMINI_MD_END = '<!-- hailykit-managed-end -->';

/**
 * Gemini CLI provider — installs into ~/.gemini/ (or .gemini/ for project scope).
 *
 * Output: TOML slash commands in commands/, native SKILL.md in skills/,
 * rule files copied directly, GEMINI.md with a managed file-ref block, agents in agents/.
 */
export class GeminiProvider extends BaseProvider {
  get name(): string { return 'gemini'; }
  get label(): string { return 'Gemini CLI'; }

  globalDir(): string { return path.join(os.homedir(), '.gemini'); }
  protected _projectDirName(): string { return '.gemini'; }
  commandsSubDir(): string { return 'commands'; }
  hooksSupported(): boolean { return false; }

  convertSkill(content: string, internalName: string): ConvertedSkill {
    const { cmdName, description, body } = this._parseSkill(content, internalName);
    return { filename: `${cmdName}.toml`, content: toGeminiToml(description, body) };
  }

  /**
   * Install TOML slash commands (via super) AND copy SKILL.md files to skills/.
   * Returns the TOML count — native copy is a side effect, not an additional tally.
   */
  installSkills(extractedClaudeDir: string, targetProviderDir: string): number {
    const count = super.installSkills(extractedClaudeDir, targetProviderDir);
    this._installNativeSkills(extractedClaudeDir, targetProviderDir);
    return count;
  }

  /**
   * Copy each rule file directly to targetProviderDir (no concatenation), then
   * upsert a managed @import block in GEMINI.md so Gemini CLI auto-loads the rules.
   */
  /**
   * Copy each rule file to targetProviderDir (no concatenation), resolving
   * {skill:x} refs to provider slash-command syntax. Then upsert a managed
   * file-ref block in GEMINI.md so Gemini CLI auto-loads the rules.
   */
  installRules(extractedClaudeDir: string, targetProviderDir: string): void {
    const rulesDir = path.join(extractedClaudeDir, 'rules');
    if (!fs.existsSync(rulesDir)) return;
    fs.mkdirSync(targetProviderDir, { recursive: true });
    const imports: string[] = [];
    for (const f of fs.readdirSync(rulesDir).sort()) {
      if (!f.endsWith('.md')) continue;
      const raw = fs.readFileSync(path.join(rulesDir, f), 'utf8').trim();
      const resolved = resolveSkillRefs(raw, (p, n) => this.skillRef(p, n));
      fs.writeFileSync(path.join(targetProviderDir, f), resolved, 'utf8');
      imports.push(f);
    }
    if (!imports.length) return;
    this._updateGeminiMd(targetProviderDir, imports);
  }

  /**
   * Copy agent markdown files to agents/ subdirectory.
   * No-ops gracefully when the agents directory is absent.
   */
  /**
   * Copy agent Markdown files to agents/, resolving model tiers, {skill:} and
   * {agent:} refs to Gemini-specific syntax before writing.
   */
  installAgents(extractedClaudeDir: string, targetProviderDir: string): void {
    const agentsDir = path.join(extractedClaudeDir, 'agents');
    if (!fs.existsSync(agentsDir)) return;
    const outDir = path.join(targetProviderDir, 'agents');
    fs.mkdirSync(outDir, { recursive: true });
    for (const f of fs.readdirSync(agentsDir)) {
      if (!f.endsWith('.md')) continue;
      let content = fs.readFileSync(path.join(agentsDir, f), 'utf8');
      content = resolveModel(content, this.name);
      content = resolveSkillRefs(content, (p, n) => this.skillRef(p, n));
      content = resolveAgentRefs(content, (t, r) => this.agentRef(t, r));
      fs.writeFileSync(path.join(outDir, f), content, 'utf8');
    }
  }

  /** Copy SKILL.md files verbatim to skills/<name>/SKILL.md, applying the same providers gate. */
  private _installNativeSkills(extractedClaudeDir: string, targetProviderDir: string): void {
    const skillsDir = path.join(extractedClaudeDir, 'skills');
    if (!fs.existsSync(skillsDir)) return;
    for (const entry of fs.readdirSync(skillsDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const skillMd = path.join(skillsDir, entry.name, 'SKILL.md');
      if (!fs.existsSync(skillMd)) continue;
      const content = fs.readFileSync(skillMd, 'utf8');
      if (!isProviderAllowed(parseFrontmatter(content), this.name)) continue;
      const outDir = path.join(targetProviderDir, 'skills', entry.name);
      fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(path.join(outDir, 'SKILL.md'), content, 'utf8');
    }
  }

  /**
   * Upsert a HailyKit managed block in GEMINI.md containing one @import line per rule file.
   * Creates the file when absent; replaces the block when present; appends when no block found.
   */
  private _updateGeminiMd(targetProviderDir: string, imports: string[]): void {
    const block = [GEMINI_MD_START, ...imports.map(f => `@${f}`), GEMINI_MD_END].join('\n');
    const geminiMd = path.join(targetProviderDir, 'GEMINI.md');

    if (!fs.existsSync(geminiMd)) {
      fs.writeFileSync(geminiMd, block + '\n', 'utf8');
      return;
    }

    const existing = fs.readFileSync(geminiMd, 'utf8');
    const s = existing.indexOf(GEMINI_MD_START);
    const e = existing.indexOf(GEMINI_MD_END);
    if (s !== -1 && e !== -1 && e > s) {
      // Replace block, preserve surrounding user content.
      const before = existing.slice(0, s);
      const after = existing.slice(e + GEMINI_MD_END.length);
      fs.writeFileSync(geminiMd, before + block + after, 'utf8');
    } else {
      // No existing block — append.
      const sep = existing.endsWith('\n') ? '' : '\n';
      fs.writeFileSync(geminiMd, existing + sep + '\n' + block + '\n', 'utf8');
    }
  }
}
