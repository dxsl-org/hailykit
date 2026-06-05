import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { BaseProvider, type ConvertedSkill } from './base.js';
import { toWindsurfMd, resolveSkillRefs, resolveAgentRefs, resolveModel } from '../converter.js';

// Maps Claude Code event names to the Windsurf events they correspond to.
// SessionStart and Stop have no direct Windsurf equivalent.
const CLAUDE_TO_WINDSURF: Record<string, string[]> = {
  PreToolUse:       ['pre_run_command', 'pre_mcp_tool_use'],
  PostToolUse:      ['post_run_command', 'post_mcp_tool_use'],
  UserPromptSubmit: ['pre_user_prompt'],
};

interface WindsurfHookEntry {
  command: string;
}

/**
 * Windsurf provider.
 * Skills → ~/.codeium/windsurf/global_workflows/hl-<name>.md
 * Hooks  → ~/.codeium/windsurf/hooks/<name>.cjs + hooks.json (mapped from Claude Code events)
 * Rules  → not a direct concept; workflows/skills cover this
 *
 * Windsurf hook events (12 total):
 *   pre_read_code, post_read_code, pre_write_code, post_write_code,
 *   pre_run_command, post_run_command, pre_mcp_tool_use, post_mcp_tool_use,
 *   pre_user_prompt, post_cascade_response, post_cascade_response_with_transcript,
 *   post_setup_worktree
 */
export class WindsurfProvider extends BaseProvider {
  get name(): string { return 'windsurf'; }
  get label(): string { return 'Windsurf'; }

  globalDir(): string { return path.join(os.homedir(), '.codeium', 'windsurf'); }
  protected _projectDirName(): string { return '.windsurf'; }
  commandsSubDir(): string { return 'workflows'; }
  hooksSupported(): boolean { return true; }

  convertSkill(content: string, internalName: string): ConvertedSkill {
    const { cmdName, description, body } = this._parseSkill(content, internalName);
    return { filename: `${cmdName}.md`, content: toWindsurfMd(description, body) };
  }

  /**
   * Copy hook scripts from the release and write hooks.json with Windsurf event mapping.
   * Claude Code .cjs scripts are invoked with `node` directly — no protocol wrapper
   * needed since Windsurf does not use an exit-code-2 block mechanism.
   */
  installHooks(extractedClaudeDir: string, targetProviderDir: string): void {
    const settingsPath = path.join(extractedClaudeDir, 'settings.json');
    if (!fs.existsSync(settingsPath)) return;

    let settings: unknown;
    try { settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8')); }
    catch { return; }

    if (typeof settings !== 'object' || settings === null) return;
    const allHooks = (settings as Record<string, unknown>).hooks;
    const hooksMap = (typeof allHooks === 'object' && allHooks !== null)
      ? allHooks as Record<string, unknown>
      : {};

    const srcHooksDir = path.join(extractedClaudeDir, 'hooks');
    const destHooksDir = path.join(targetProviderDir, 'hooks');
    if (fs.existsSync(srcHooksDir)) {
      this._copyHookDir(srcHooksDir, destHooksDir);
    }

    const hooks: Record<string, WindsurfHookEntry[]> = {};
    const destNorm = destHooksDir.replace(/\\/g, '/');

    for (const [claudeEvent, wsEvents] of Object.entries(CLAUDE_TO_WINDSURF)) {
      const groups = hooksMap[claudeEvent];
      for (const group of (Array.isArray(groups) ? groups : [])) {
        const hookList = (typeof group === 'object' && group !== null)
          ? (group as Record<string, unknown>).hooks
          : undefined;
        for (const hook of (Array.isArray(hookList) ? hookList : [])) {
          if (typeof hook !== 'object' || hook === null) continue;
          const h = hook as Record<string, unknown>;
          if (h.type !== 'command' || typeof h.command !== 'string') continue;

          const m = h.command.match(/node\s+\.claude\/hooks\/(.+\.cjs)/);
          if (!m) continue;

          const absScript = `${destNorm}/${m[1]}`;
          for (const wsEvent of wsEvents) {
            if (!hooks[wsEvent]) hooks[wsEvent] = [];
            hooks[wsEvent].push({ command: `node "${absScript}"` });
          }
        }
      }
    }

    if (Object.keys(hooks).length === 0) return;
    fs.mkdirSync(targetProviderDir, { recursive: true });
    fs.writeFileSync(
      path.join(targetProviderDir, 'hooks.json'),
      JSON.stringify({ hooks }, null, 2),
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
}
