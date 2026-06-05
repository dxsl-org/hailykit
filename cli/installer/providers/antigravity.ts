import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { BaseProvider, type ConvertedSkill } from './base.js';
import { resolveSkillRefs } from '../converter.js';

/**
 * Antigravity provider (Google AI IDE, forked from VS Code by former Windsurf team).
 *
 * Antigravity supports SKILL.md natively — same format as HailyKit/Claude Code.
 * Skills are copied directly to the skills/ directory without conversion.
 * Hooks are not supported.
 *
 * Directory layout:
 *   Global:  ~/.antigravity/skills/   (SKILL.md files, same format)
 *   Project: .antigravity/skills/
 */
export class AntigravityProvider extends BaseProvider {
  get name(): string { return 'antigravity'; }
  get label(): string { return 'Antigravity'; }

  globalDir(): string { return path.join(os.homedir(), '.antigravity'); }
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

    const destSkillsDir = path.join(targetProviderDir, 'skills');
    fs.mkdirSync(destSkillsDir, { recursive: true });

    let count = 0;
    for (const skillName of fs.readdirSync(srcSkillsDir)) {
      const srcSkillDir = path.join(srcSkillsDir, skillName);
      const skillMd = path.join(srcSkillDir, 'SKILL.md');
      if (!fs.existsSync(skillMd)) continue;

      const destSkillDir = path.join(destSkillsDir, skillName);
      this._copyDir(srcSkillDir, destSkillDir);
      count++;
    }
    return count;
  }

  // Antigravity reads rules from the same SKILL.md context system — no separate rules file needed.
  installRules(_extractedClaudeDir: string, _targetProviderDir: string): void { /* no-op */ }

  // Antigravity is a Claude Code fork — uses /hc:cook slash syntax.
  protected override skillRef(prefix: string, name: string): string {
    return `/${prefix}:${name}`;
  }

  private _copyDir(src: string, dest: string): void {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      if (entry.isDirectory()) {
        this._copyDir(srcPath, destPath);
      } else if (entry.name.endsWith('.md')) {
        // Resolve {skill:x:y} → /hc:cook in all markdown files.
        const content = resolveSkillRefs(
          fs.readFileSync(srcPath, 'utf8'),
          (p, n) => this.skillRef(p, n),
        );
        fs.writeFileSync(destPath, content, 'utf8');
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }

  // Not used — installSkills is fully overridden above.
  convertSkill(_content: string, _internalName: string): ConvertedSkill | null { return null; }
}
