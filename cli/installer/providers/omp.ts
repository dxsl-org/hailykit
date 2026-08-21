import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { BaseProvider, type ConvertedSkill, type InstallAgentsResult } from './base.js';
import { parseFrontmatter, isProviderAllowed, resolveAgentRefs, resolveModel, resolveModelRefs, resolveSkillRefs } from '../converter.js';
import { installManagedResource, pruneStaleManagedResources, uninstallManagedResources, writeManagedManifest, type ManagedResourcePaths } from './native-resource.js';
import { mapPiAgentCapabilities } from './pi-agent-tools.js';

const RULES_START = '<!-- hailykit-omp-rules-start -->';
const RULES_END = '<!-- hailykit-omp-rules-end -->';
const SKILLS_MANIFEST = 'hailykit-installed-omp-skills.json';
const AGENTS_MANIFEST = 'hailykit-installed-omp-agents.json';
const VERSION_META = '.hailykit-omp-meta.json';

function upsertAppendSystem(targetProviderDir: string, block: string): void {
  fs.mkdirSync(targetProviderDir, { recursive: true });
  const filePath = path.join(targetProviderDir, 'APPEND_SYSTEM.md');
  if (!fs.existsSync(filePath)) return void fs.writeFileSync(filePath, `${block}\n`, 'utf8');
  const existing = fs.readFileSync(filePath, 'utf8');
  const next = existing.includes(RULES_START)
    ? existing.replace(new RegExp(`${RULES_START}[\\s\\S]*?${RULES_END}`), block)
    : `${existing.trimEnd()}\n\n${block}\n`;
  fs.writeFileSync(filePath, next, 'utf8');
}

export class OmpProvider extends BaseProvider {
  get name(): string { return 'omp'; }
  get label(): string { return 'OMP'; }
  globalDir(): string { return process.env['PI_CODING_AGENT_DIR'] ?? path.join(os.homedir(), '.omp', 'agent'); }
  protected _projectDirName(): string { return '.omp'; }
  commandsSubDir(): string { return 'skills'; }
  hooksSupported(): boolean { return false; }
  protected skillRef(prefix: string, name: string): string { return `/skill:${prefix}-${name}`; }

  protected agentRef(type: Parameters<BaseProvider['agentRef']>[0], roles: string[]): string {
    if (type === 'agent-result') return `Using the ${roles[0]} task-agent result above:`;
    if (type === 'agents') {
      return `Use OMP's \`task\` tool to dispatch these agents in parallel: ${roles.join(', ')}. Assign each the matching task below:`;
    }
    return `Use OMP's \`task\` tool with agent \`${roles[0]}\` for the following task:`;
  }

  private _skillsPaths(targetProviderDir: string): ManagedResourcePaths {
    return {
      rootPath: targetProviderDir,
      manifestPath: path.join(targetProviderDir, SKILLS_MANIFEST),
      targetPath: (name) => path.join(targetProviderDir, 'skills', name),
      markerPath: (name) => path.join(targetProviderDir, 'skills', name, '.hailykit-omp-skill.json'),
    };
  }

  private _agentsPaths(targetProviderDir: string): ManagedResourcePaths {
    return {
      rootPath: targetProviderDir,
      manifestPath: path.join(targetProviderDir, AGENTS_MANIFEST),
      targetPath: (name) => path.join(targetProviderDir, 'agents', `${name}.md`),
      markerPath: (name) => path.join(targetProviderDir, 'agents', `${name}.hailykit-omp-agent.json`),
    };
  }

  private _resolveMarkdown(content: string): string {
    return resolveModelRefs(
      resolveModel(
        resolveSkillRefs(resolveAgentRefs(content, (type, roles) => this.agentRef(type, roles)), (p, n) => this.skillRef(p, n)),
        this.name,
      ),
      this.name,
    );
  }

  installSkills(extractedClaudeDir: string, targetProviderDir: string): number {
    const srcSkillsDir = path.join(extractedClaudeDir, 'skills');
    if (!fs.existsSync(srcSkillsDir)) return 0;
    const installed = new Set<string>();
    for (const entry of fs.readdirSync(srcSkillsDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const skillMd = path.join(srcSkillsDir, entry.name, 'SKILL.md');
      if (!fs.existsSync(skillMd) || !isProviderAllowed(parseFrontmatter(fs.readFileSync(skillMd, 'utf8')), this.name)) continue;
      if (installManagedResource({
        name: entry.name,
        provider: this.name,
        kind: 'skill',
        sourcePath: path.join(srcSkillsDir, entry.name),
        targetPath: this._skillsPaths(targetProviderDir).targetPath(entry.name),
        markerPath: this._skillsPaths(targetProviderDir).markerPath(entry.name),
        rootPath: targetProviderDir,
        transformMarkdown: (content) => this._resolveMarkdown(content),
      }) !== 'skipped-user') installed.add(entry.name);
    }
    pruneStaleManagedResources(this.name, 'skill', installed, this._skillsPaths(targetProviderDir));
    writeManagedManifest(this._skillsPaths(targetProviderDir).manifestPath, [...installed]);
    return installed.size;
  }

  installRules(extractedClaudeDir: string, targetProviderDir: string): void {
    const rulesDir = path.join(extractedClaudeDir, 'rules');
    if (!fs.existsSync(rulesDir)) return;
    const parts: string[] = [];
    for (const file of fs.readdirSync(rulesDir).sort()) {
      if (!file.endsWith('.md')) continue;
      parts.push(resolveSkillRefs(fs.readFileSync(path.join(rulesDir, file), 'utf8').trim(), (p, n) => this.skillRef(p, n)));
    }
    if (!parts.length) return;
    const block = [RULES_START, '## HailyKit Rules', '', '> Skills are invoked as `/skill:<name>`.', '', parts.join('\n\n---\n\n'), RULES_END].join('\n');
    upsertAppendSystem(targetProviderDir, block);
  }

  readVersion(providerDir: string): string | null {
    try {
      const parsed = JSON.parse(fs.readFileSync(path.join(providerDir, VERSION_META), 'utf8')) as Record<string, unknown>;
      return typeof parsed.version === 'string' ? parsed.version : null;
    } catch { return null; }
  }

  readInstalledAt(providerDir: string): string | null {
    try {
      const parsed = JSON.parse(fs.readFileSync(path.join(providerDir, VERSION_META), 'utf8')) as Record<string, unknown>;
      return typeof parsed.installedAt === 'string' ? parsed.installedAt : null;
    } catch { return null; }
  }

  writeVersion(providerDir: string, version: string): void {
    fs.mkdirSync(providerDir, { recursive: true });
    fs.writeFileSync(path.join(providerDir, VERSION_META), `${JSON.stringify({ version, installedAt: new Date().toISOString() }, null, 2)}\n`, 'utf8');
  }

  installAgents(extractedClaudeDir: string, targetProviderDir: string): InstallAgentsResult {
    const agentsDir = path.join(extractedClaudeDir, 'agents');
    const result: InstallAgentsResult = { installed: 0, updated: 0, migrated: 0, skippedUser: 0, skippedDuplicate: 0 };
    if (!fs.existsSync(agentsDir)) return result;
    const installed = new Set<string>();
    for (const file of fs.readdirSync(agentsDir).sort()) {
      if (!file.endsWith('.md')) continue;
      const sourcePath = path.join(agentsDir, file);
      const { frontmatter, body } = parseFrontmatter(fs.readFileSync(sourcePath, 'utf8'));
      const name = frontmatter.name || path.basename(file, '.md');
      const capabilities = mapPiAgentCapabilities(frontmatter.tools, 'omp');
      const capabilityLines = [
        capabilities.tools.length ? `tools: ${capabilities.tools.join(', ')}` : '',
        capabilities.spawns.length ? `spawns: ${capabilities.spawns.join(', ')}` : '',
      ].filter(Boolean).join('\n');
      const content = `---\nname: ${name}\ndescription: ${JSON.stringify(frontmatter.description || '')}\n${capabilityLines ? `${capabilityLines}\n` : ''}---\n\n${this._resolveMarkdown(body)}\n`;
      const state = installManagedResource({
        name,
        provider: this.name,
        kind: 'agent',
        sourcePath,
        targetPath: this._agentsPaths(targetProviderDir).targetPath(name),
        markerPath: this._agentsPaths(targetProviderDir).markerPath(name),
        rootPath: targetProviderDir,
        transformMarkdown: () => content,
      });
      if (state === 'skipped-user') result.skippedUser++;
      else { installed.add(name); result[state === 'installed' ? 'installed' : 'updated']++; }
    }
    pruneStaleManagedResources(this.name, 'agent', installed, this._agentsPaths(targetProviderDir));
    writeManagedManifest(this._agentsPaths(targetProviderDir).manifestPath, [...installed]);
    return result;
  }

  uninstall(providerDir: string): void {
    const meta = path.join(providerDir, VERSION_META);
    const removedSkills = uninstallManagedResources(this.name, 'skill', this._skillsPaths(providerDir));
    const removedAgents = uninstallManagedResources(this.name, 'agent', this._agentsPaths(providerDir));
    this._removeSentinelBlock(path.join(providerDir, 'APPEND_SYSTEM.md'), RULES_START, RULES_END);
    if (!fs.existsSync(meta)) return void console.log('    Not installed (no .hailykit-meta.json found)');
    fs.rmSync(meta, { force: true });
    if (removedSkills > 0) console.log(`    Removed ${removedSkills} OMP skill(s)`);
    if (removedAgents > 0) console.log(`    Removed ${removedAgents} OMP agent(s)`);
    console.log('    ✓ Uninstalled');
  }

  convertSkill(_content: string, _internalName: string): ConvertedSkill | null { return null; }
}
