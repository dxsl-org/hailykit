import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { BaseProvider, type ConvertedSkill } from './base.js';
import { resolveSkillRefs, resolveModel, resolveModelRefs, parseFrontmatter, isProviderAllowed, bundleFlatSkill } from '../converter.js';

const SKILLS_MANIFEST = 'hailykit-installed-skills.json';
const SAFE_SKILL_DIR_RE = /^[a-z][a-z0-9-]*$/;

function readSkillsManifest(providerDir: string): string[] {
  try {
    const raw: unknown = JSON.parse(
      fs.readFileSync(path.join(providerDir, SKILLS_MANIFEST), 'utf8'));
    return Array.isArray(raw)
      ? raw.filter((n): n is string => typeof n === 'string' && SAFE_SKILL_DIR_RE.test(n))
      : [];
  } catch {
    return [];
  }
}

/**
 * Antigravity provider.
 *
 * ⚠ NAMING CONFLICT — two products share this name. Verify which one is installed:
 *   (A) antigravity.dev — VS Code fork by former Windsurf team; uses ~/.antigravity/; legacy
 *   (B) antigravity.google — Google's platform (evolved from Gemini CLI, sunset 2026-05-19);
 *       CLI: `agy` (npm: @google/antigravity); global: ~/.gemini/antigravity/; workspace: .agent/skills/
 * This installer currently targets (A). If targeting (B), update globalDir() and _projectDirName().
 *
 * Antigravity (A) supports SKILL.md natively — same format as HailyKit/Claude Code.
 * Skills are copied directly to the skills/ directory without conversion.
 * Hooks are not supported.
 *
 * Spec: 2.0.11 (2026-06-02, product B) / unknown (product A) — researched 2026-06-08
 * Docs (A): https://antigravity.dev/docs
 * Docs (B): https://antigravity.google/docs · https://codelabs.developers.google.com/getting-started-with-antigravity-skills
 *
 * Directory layout (product A):
 *   Global:  ~/.gemini/config/global_workflows/<skill-name>.md   (SKILL.md files, same format)
 *   Project: .antigravity/skills/<skill-name>/
 */
export class AntigravityProvider extends BaseProvider {
  get name(): string { return 'antigravity'; }
  get label(): string { return 'Antigravity'; }

  globalDir(): string { return path.join(os.homedir(), '.gemini', 'config', 'global_workflows'); }
  protected _projectDirName(): string { return '.antigravity'; }
  commandsSubDir(): string { return 'skills'; }
  hooksSupported(): boolean { return false; }

  /**
   * Override: copy the entire skills directory as-is (SKILL.md is native format).
   * No conversion needed.
   */
  installSkills(extractedClaudeDir: string, targetProviderDir: string): number {
    const srcSkillsDir = path.join(extractedClaudeDir, 'skills');
    if (!fs.existsSync(srcSkillsDir)) return 0;

    const isGlobal = targetProviderDir === this.globalDir();
    const destSkillsDir = isGlobal ? targetProviderDir : path.join(targetProviderDir, 'skills');
    fs.mkdirSync(destSkillsDir, { recursive: true });

    const installed: string[] = [];
    for (const skillName of fs.readdirSync(srcSkillsDir).sort()) {
      const srcSkillDir = path.join(srcSkillsDir, skillName);
      const skillMd = path.join(srcSkillDir, 'SKILL.md');
      if (!fs.existsSync(skillMd)) continue;

      const raw = fs.readFileSync(skillMd, 'utf8');
      if (!isProviderAllowed(parseFrontmatter(raw), this.name)) continue;

      const bundled = bundleFlatSkill(srcSkillDir, (text) => {
        let content = resolveSkillRefs(text, (p, n) => this.skillRef(p, n));
        content = resolveModel(content, this.name);
        content = resolveModelRefs(content, this.name);
        return content;
      });

      fs.writeFileSync(path.join(destSkillsDir, `${skillName}.md`), bundled, 'utf8');

      const destSkillDir = path.join(destSkillsDir, skillName);
      if (fs.existsSync(destSkillDir)) {
        fs.rmSync(destSkillDir, { recursive: true, force: true });
      }
      installed.push(skillName);
    }

    // Cleanup stale skills from previous installation
    for (const stale of readSkillsManifest(targetProviderDir)) {
      if (!installed.includes(stale)) {
        const staleMd = path.join(destSkillsDir, `${stale}.md`);
        if (fs.existsSync(staleMd)) fs.rmSync(staleMd, { force: true });
        const staleDir = path.join(destSkillsDir, stale);
        if (fs.existsSync(staleDir)) fs.rmSync(staleDir, { recursive: true, force: true });
      }
    }

    if (installed.length === 0) {
      fs.rmSync(path.join(targetProviderDir, SKILLS_MANIFEST), { force: true });
      return 0;
    }

    fs.mkdirSync(targetProviderDir, { recursive: true });
    fs.writeFileSync(
      path.join(targetProviderDir, SKILLS_MANIFEST),
      JSON.stringify(installed, null, 2) + '\n',
      'utf8',
    );

    return installed.length;
  }

  override uninstall(providerDir: string): void {
    const meta = path.join(providerDir, '.hailykit-meta.json');
    if (!fs.existsSync(meta)) {
      console.log('    Not installed (no .hailykit-meta.json found)');
      return;
    }
    const isGlobal = providerDir === this.globalDir();
    const destSkillsDir = isGlobal ? providerDir : path.join(providerDir, 'skills');
    let n = 0;
    for (const name of readSkillsManifest(providerDir)) {
      const mdFile = path.join(destSkillsDir, `${name}.md`);
      if (fs.existsSync(mdFile)) {
        fs.rmSync(mdFile, { force: true });
        n++;
      }
      const dir = path.join(destSkillsDir, name);
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    }
    if (n) console.log(`    Removed ${n} native skill(s) from ${destSkillsDir}`);
    fs.rmSync(path.join(providerDir, SKILLS_MANIFEST), { force: true });
    super.uninstall(providerDir);
  }

  // Antigravity reads rules from the same SKILL.md context system — no separate rules file needed.
  installRules(_extractedClaudeDir: string, _targetProviderDir: string): void { /* no-op */ }

  // Antigravity is a Claude Code fork — uses /hc-cook slash syntax (agentskills.io hyphen convention).
  protected override skillRef(prefix: string, name: string): string {
    return `/${prefix}-${name}`;
  }

  // Not used — installSkills is fully overridden above.
  convertSkill(_content: string, _internalName: string): ConvertedSkill | null { return null; }
}
