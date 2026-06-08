import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { BaseProvider, type ConvertedSkill } from './base.js';
import { resolveSkillRefs, resolveAgentRefs, resolveModel } from '../converter.js';

/**
 * Zed editor provider.
 *
 * Spec: 1.5.4 (2026-06-06) — rapid release cadence
 * Docs: https://zed.dev/docs/ai/skills
 *       https://zed.dev/docs/ai
 *
 * As of Zed v1.4.0, native SKILL.md is supported at `.agents/skills/<name>/SKILL.md`
 * (project) and `~/.agents/skills/<name>/SKILL.md` (global) — invoked via `/skill-name`.
 * TODO: replace the rules-summary approach with native SKILL.md installation to `.agents/skills/`.
 * Currently installs a single hailykit-skills.md summary because Zed lacked skill support
 * at the time of initial implementation.
 *
 * Hooks: not implemented in Zed (open feature request #57943, no timeline).
 * Skills: install as rules summary for now; native `.agents/skills/` path is available.
 */
export class ZedProvider extends BaseProvider {
  get name(): string { return 'zed'; }
  get label(): string { return 'Zed'; }

  globalDir(): string { return path.join(os.homedir(), '.zed'); }
  protected _projectDirName(): string { return '.zed'; }
  hooksSupported(): boolean { return false; }

  /**
   * Override: instead of generating per-skill command files,
   * generate a single skills-overview rules file so Zed's AI assistant
   * is aware of available HailyKit workflows.
   */
  installSkills(extractedClaudeDir: string, targetProviderDir: string): number {
    const srcSkillsDir = path.join(extractedClaudeDir, 'skills');
    if (!fs.existsSync(srcSkillsDir)) return 0;

    const lines: string[] = [
      '# HailyKit Skills Reference',
      '',
      'The following HailyKit workflow skills are available in this project.',
      'Invoke them by describing the task naturally — the assistant will apply the appropriate workflow.',
      '',
    ];

    let count = 0;
    for (const skillName of fs.readdirSync(srcSkillsDir).sort()) {
      const skillMd = path.join(srcSkillsDir, skillName, 'SKILL.md');
      if (!fs.existsSync(skillMd)) continue;

      const content = fs.readFileSync(skillMd, 'utf8');
      const descMatch = content.match(/^description:\s*(.+)$/m);
      const desc = descMatch ? descMatch[1].trim().replace(/^["']|["']$/g, '') : '';
      if (desc) {
        lines.push(`- **${skillName}**: ${desc}`);
        count++;
      }
    }

    if (count === 0) return 0;

    fs.mkdirSync(targetProviderDir, { recursive: true });
    fs.writeFileSync(
      path.join(targetProviderDir, 'hailykit-skills.md'),
      lines.join('\n') + '\n',
      'utf8',
    );
    return count;
  }

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

    fs.mkdirSync(targetProviderDir, { recursive: true });
    fs.writeFileSync(
      path.join(targetProviderDir, 'hailykit-rules.md'),
      parts.join('\n\n---\n\n') + '\n',
      'utf8',
    );
  }

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

  // Not used — installSkills is fully overridden above.
  convertSkill(_content: string, _internalName: string): ConvertedSkill | null { return null; }
}
