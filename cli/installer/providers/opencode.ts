import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { BaseProvider, type ConvertedSkill } from './base.js';
import { toOpenCodeMd, resolveSkillRefs, resolveAgentRefs, resolveModel } from '../converter.js';

/**
 * OpenCode provider (https://opencode.ai — SST terminal TUI).
 * Skills  → <configDir>/commands/hc-<name>.md (also discovered at .agents/skills/, .claude/skills/)
 * Agents  → <configDir>/agents/<name>.md  (model tier stripped; user configures in opencode.json)
 * Hooks   → not installed (OpenCode hooks require JS/TS plugin modules, not shell commands)
 * Rules   → <configDir>/hailykit-rules.md
 *
 * NOTE: Native SKILL.md discovery added in v1.16.0 (2026-06-02). OpenCode now scans
 * .opencode/skills/, .agents/skills/, and .claude/skills/ for SKILL.md files automatically.
 * Skills installed to .agents/skills/ by other providers will be auto-discovered by OpenCode.
 *
 * Spec: 1.16.2 (2026-06-05) — skills new in v1.16.0
 * Docs: https://opencode.ai/docs/skills/
 *       https://opencode.ai/docs/plugins/
 *       https://opencode.ai/changelog
 *
 * Config dir per OS (XDG spec):
 *   Linux/Unix : ~/.config/opencode/
 *   macOS      : ~/Library/Application Support/opencode/
 *   Windows    : %APPDATA%\opencode\
 */
export class OpenCodeProvider extends BaseProvider {
  get name(): string { return 'opencode'; }
  get label(): string { return 'OpenCode'; }

  globalDir(): string {
    if (process.platform === 'darwin') {
      return path.join(os.homedir(), 'Library', 'Application Support', 'opencode');
    }
    if (process.platform === 'win32') {
      const appData = process.env['APPDATA'] ?? path.join(os.homedir(), 'AppData', 'Roaming');
      return path.join(appData, 'opencode');
    }
    const xdgConfig = process.env['XDG_CONFIG_HOME'] ?? path.join(os.homedir(), '.config');
    return path.join(xdgConfig, 'opencode');
  }

  protected _projectDirName(): string { return '.opencode'; }
  commandsSubDir(): string { return 'commands'; }
  hooksSupported(): boolean { return false; }

  convertSkill(content: string, internalName: string): ConvertedSkill {
    const { cmdName, description, body } = this._parseSkill(content, internalName);
    return { filename: `${cmdName}.md`, content: toOpenCodeMd(description, body) };
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
}
