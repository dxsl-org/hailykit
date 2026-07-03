import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { BaseProvider, type ConvertedSkill } from './base.js';
import { resolveSkillRefs, resolveAgentRefs, resolveModel, resolveModelRefs, parseFrontmatter, isProviderAllowed } from '../converter.js';

/** Manifest of natively installed skill dir names — read back on upgrade/uninstall. */
const SKILLS_MANIFEST = 'hailykit-installed-skills.json';

/**
 * A manifest entry is only trusted as a deletable dir name if it is a plain
 * lowercase path segment — no separators, dots, or leading dashes. Guards
 * against a tampered manifest without hard-coding skill prefixes (future
 * prefixes beyond hl-/hc- must still be cleaned up).
 */
const SAFE_SKILL_DIR_RE = /^[a-z][a-z0-9-]*$/;

/** Read the manifest's skill-name list; [] when absent or malformed. */
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
 * Zed editor provider.
 *
 * Spec: 1.5.4 (2026-06-06) — rapid release cadence
 * Docs: https://zed.dev/docs/ai/skills
 *       https://zed.dev/docs/ai
 *
 * Skills install natively (Zed v1.4.0+): SKILL.md at `.agents/skills/<name>/SKILL.md`
 * (project) and `~/.agents/skills/<name>/SKILL.md` (global) — invoked via `/skill-name`.
 * The skills root lives BESIDE the .zed dir, so it is derived from the provider
 * dir's parent. Installed names are recorded in a manifest for clean uninstall.
 *
 * Hooks: not implemented in Zed (open feature request #57943, no timeline).
 */
export class ZedProvider extends BaseProvider {
  get name(): string { return 'zed'; }
  get label(): string { return 'Zed'; }

  globalDir(): string {
    if (process.platform === 'win32') {
      const appData = process.env['APPDATA'] ?? path.join(os.homedir(), 'AppData', 'Roaming');
      return path.join(appData, 'Zed');
    }
    const xdgConfig = process.env['XDG_CONFIG_HOME'] ?? path.join(os.homedir(), '.config');
    return path.join(xdgConfig, 'zed');
  }

  protected _projectDirName(): string { return '.zed'; }
  hooksSupported(): boolean { return false; }

  private _getSkillsRoot(providerDir: string): string {
    if (path.basename(providerDir) === '.zed') {
      return path.join(path.dirname(providerDir), '.agents', 'skills');
    }
    return path.join(os.homedir(), '.agents', 'skills');
  }

  /** Zed native skills are invoked via /skill-name. */
  protected skillRef(prefix: string, name: string): string {
    return `/${prefix}-${name}`;
  }

  installSkills(extractedClaudeDir: string, targetProviderDir: string): number {
    const srcSkillsDir = path.join(extractedClaudeDir, 'skills');
    if (!fs.existsSync(srcSkillsDir)) return 0;

    const skillsRoot = this._getSkillsRoot(targetProviderDir);
    const installed: string[] = [];

    for (const skillName of fs.readdirSync(srcSkillsDir).sort()) {
      const srcDir = path.join(srcSkillsDir, skillName);
      const skillMd = path.join(srcDir, 'SKILL.md');
      if (!fs.existsSync(skillMd)) continue;

      const parsed = parseFrontmatter(fs.readFileSync(skillMd, 'utf8'));
      if (!isProviderAllowed(parsed, this.name)) continue;

      this._copySkillDir(srcDir, path.join(skillsRoot, skillName));
      installed.push(skillName);
    }

    // Upgrade cleanup: skills dropped from the catalog since the last install
    // would otherwise stay orphaned in .agents/skills/ forever. Runs even when
    // this release installs nothing (e.g. every skill filtered out).
    for (const stale of readSkillsManifest(targetProviderDir)) {
      if (!installed.includes(stale)) {
        fs.rmSync(path.join(skillsRoot, stale), { recursive: true, force: true });
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
    // Migration: drop the pre-native summary file from earlier installs.
    fs.rmSync(path.join(targetProviderDir, 'hailykit-skills.md'), { force: true });
    return installed.length;
  }

  /** Copy a skill dir recursively, resolving {skill:}/{agent:} refs in .md files. */
  private _copySkillDir(src: string, dest: string): void {
    fs.mkdirSync(dest, { recursive: true });
    for (const ent of fs.readdirSync(src, { withFileTypes: true })) {
      const srcPath = path.join(src, ent.name);
      const destPath = path.join(dest, ent.name);
      if (ent.isDirectory()) {
        this._copySkillDir(srcPath, destPath);
      } else if (ent.name.endsWith('.md')) {
        let content = fs.readFileSync(srcPath, 'utf8');
        content = resolveSkillRefs(content, (p, n) => this.skillRef(p, n));
        content = resolveAgentRefs(content, (t, r) => this.agentRef(t, r));
        content = resolveModel(content, this.name);
        content = resolveModelRefs(content, this.name);
        fs.writeFileSync(destPath, content, 'utf8');
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }

  /** Remove natively installed skills (via manifest) before standard cleanup. */
  uninstall(providerDir: string): void {
    const skillsRoot = this._getSkillsRoot(providerDir);
    let n = 0;
    for (const name of readSkillsManifest(providerDir)) {
      const dir = path.join(skillsRoot, name);
      if (fs.existsSync(dir)) { fs.rmSync(dir, { recursive: true, force: true }); n++; }
    }
    if (n) console.log(`    Removed ${n} native skill(s) from .agents/skills/`);
    fs.rmSync(path.join(providerDir, SKILLS_MANIFEST), { force: true });
    super.uninstall(providerDir);
  }

  /**
   * Inject HailyKit rules as a sentinel-managed block inside AGENTS.md —
   * the file Zed reads for always-on instructions (global: `~/.config/zed/`
   * or `%APPDATA%\Zed\`; project: `.zed/`). AGENTS.md may hold the user's own
   * personal instructions, so this never overwrites the file wholesale.
   *
   * Strategy (idempotent, mirrors codex.ts):
   *   - Sentinel block present → replace just that block
   *   - File exists, no sentinel → append the block, preserving user content
   *   - File absent → create it with only the block
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
    const SENTINEL_END = '<!-- hailykit-rules-end -->';
    const block = [
      SENTINEL_START,
      '## HailyKit Workflow Rules',
      '',
      '> Skills are available via `/skill-name` in chat.',
      '> See `.agents/skills/` (project) or `~/.agents/skills/` (global) for full skill instructions.',
      '',
      parts.join('\n\n---\n\n'),
      SENTINEL_END,
    ].join('\n');

    fs.mkdirSync(targetProviderDir, { recursive: true });
    const agentsMd = path.join(targetProviderDir, 'AGENTS.md');

    if (fs.existsSync(agentsMd)) {
      const existing = fs.readFileSync(agentsMd, 'utf8');
      fs.writeFileSync(
        agentsMd,
        existing.includes(SENTINEL_START)
          ? existing.replace(new RegExp(`${SENTINEL_START}[\\s\\S]*?${SENTINEL_END}`), block)
          : existing.trimEnd() + '\n\n' + block + '\n',
        'utf8',
      );
    } else {
      fs.writeFileSync(agentsMd, block + '\n', 'utf8');
    }

    // Migration: drop the pre-sentinel dedicated rules file from earlier installs.
    fs.rmSync(path.join(targetProviderDir, 'hailykit-rules.md'), { force: true });
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
      content = resolveModelRefs(content, this.name);
      content = resolveSkillRefs(content, (p, n) => this.skillRef(p, n));
      content = resolveAgentRefs(content, (t, r) => this.agentRef(t, r));
      fs.writeFileSync(path.join(outDir, f), content, 'utf8');
    }
  }

  // Not used — installSkills is fully overridden above.
  convertSkill(_content: string, _internalName: string): ConvertedSkill | null { return null; }
}
