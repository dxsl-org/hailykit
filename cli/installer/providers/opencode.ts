import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { BaseProvider, type ConvertedSkill } from './base.js';
import { toOpenCodeMd, resolveSkillRefs, resolveAgentRefs, resolveModel } from '../converter.js';

/**
 * OpenCode provider.
 * Skills  → ~/.config/opencode/commands/hl-<name>.md
 * Agents  → ~/.config/opencode/agents/<name>.md  (model tier resolved to anthropic/model-id)
 * Hooks   → not supported
 * Rules   → ~/.config/opencode/hailykit-rules.md
 */
export class OpenCodeProvider extends BaseProvider {
  get name(): string { return 'opencode'; }
  get label(): string { return 'OpenCode'; }

  globalDir(): string { return path.join(os.homedir(), '.config', 'opencode'); }
  protected _projectDirName(): string { return '.opencode'; }
  commandsSubDir(): string { return 'commands'; }
  hooksSupported(): boolean { return false; }

  // NOTE: OpenCode slash commands use the colon-prefixed format: /hc:cook
  protected override skillRef(prefix: string, name: string): string {
    return `/${prefix}:${name}`;
  }

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
      // Resolves model: thinking → anthropic/claude-opus-4-5 (OpenCode provider/model format).
      content = resolveModel(content, this.name);
      content = resolveSkillRefs(content, (p, n) => this.skillRef(p, n));
      content = resolveAgentRefs(content, (t, r) => this.agentRef(t, r));
      fs.writeFileSync(path.join(outDir, f), content, 'utf8');
    }
  }
}
