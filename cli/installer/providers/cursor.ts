import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { BaseProvider, type ConvertedSkill } from './base.js';
import { toCursorMd, resolveSkillRefs, resolveAgentRefs, resolveModel } from '../converter.js';

// Maps Claude Code event names to the Cursor events they correspond to.
// SessionStart and UserPromptSubmit have no direct Cursor equivalent.
const CLAUDE_TO_CURSOR: Record<string, string[]> = {
  PreToolUse:  ['beforeShellExecution', 'beforeMCPExecution'],
  PostToolUse: ['afterFileEdit'],
  Stop:        ['stop'],
};

interface CursorHookEntry {
  command: string;
  type: string;
  timeout: number;
}

/**
 * Cursor provider.
 * Skills → ~/.cursor/commands/hl-<name>.md  (plain markdown, no frontmatter)
 * Hooks  → ~/.cursor/hooks/<name>.cjs + hooks.json (mapped from Claude Code events)
 * Rules  → ~/.cursor/rules/hailykit-rules.mdc
 *
 * Cursor hook events: beforeShellExecution, beforeMCPExecution,
 *                     beforeReadFile, afterFileEdit, stop
 *
 * NOTE: As of Cursor 3.7, there is NO confirmed lifecycle hook system for extensions.
 * The "CLI hooks" mention in January 2026 release notes refers to 10–20× caching speedups,
 * not event interceptors. The hook event names above were sourced from SDK documentation
 * for the Background Agent SDK (Cursor 3.7+). Verify hook support before relying on this.
 *
 * Spec: 3.7 (2026-06-05) — no semver, uses whole-number minor bumps
 * Docs: https://cursor.com/changelog
 *       https://cursor.com/docs/rules
 */
export class CursorProvider extends BaseProvider {
  get name(): string { return 'cursor'; }
  get label(): string { return 'Cursor'; }

  globalDir(): string { return path.join(os.homedir(), '.cursor'); }
  protected _projectDirName(): string { return '.cursor'; }
  commandsSubDir(): string { return 'commands'; }
  hooksSupported(): boolean { return true; }

  convertSkill(content: string, internalName: string): ConvertedSkill {
    const { cmdName, body } = this._parseSkill(content, internalName);
    return { filename: `${cmdName}.md`, content: toCursorMd(body) };
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

    const outDir = path.join(targetProviderDir, 'rules');
    fs.mkdirSync(outDir, { recursive: true });
    // Cursor rules use .mdc extension with alwaysApply frontmatter.
    const mdc = `---\ndescription: HailyKit workflow rules\nalwaysApply: true\n---\n\n${parts.join('\n\n---\n\n')}\n`;
    fs.writeFileSync(path.join(outDir, 'hailykit-rules.mdc'), mdc, 'utf8');
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

  /**
   * Copy hook scripts from the release and write hooks.json with Cursor event mapping.
   * Claude Code .cjs scripts are invoked with `node` directly — no protocol wrapper
   * needed since Cursor does not use an exit-code-2 block mechanism.
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

    const hooks: Record<string, CursorHookEntry[]> = {};
    const destNorm = destHooksDir.replace(/\\/g, '/');

    for (const [claudeEvent, cursorEvents] of Object.entries(CLAUDE_TO_CURSOR)) {
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
          for (const cursorEvent of cursorEvents) {
            if (!hooks[cursorEvent]) hooks[cursorEvent] = [];
            hooks[cursorEvent].push({
              command: `node "${absScript}"`,
              type: 'shell',
              timeout: typeof h.timeout === 'number' ? h.timeout : 10000,
            });
          }
        }
      }
    }

    if (Object.keys(hooks).length === 0) return;
    fs.mkdirSync(targetProviderDir, { recursive: true });
    fs.writeFileSync(
      path.join(targetProviderDir, 'hooks.json'),
      JSON.stringify({ version: 1, hooks }, null, 2),
    );
  }
}
