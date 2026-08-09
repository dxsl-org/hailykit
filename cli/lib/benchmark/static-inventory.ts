import fs from 'node:fs';
import path from 'node:path';

export type StaticComponentClass =
  | 'rule'
  | 'contextual-rule'
  | 'standard'
  | 'skill-description'
  | 'skill-body'
  | 'skill-reference-hot'
  | 'skill-reference-cold'
  | 'agent'
  | 'hook-source'
  | 'generated-wrapper'
  | 'provider-rules'
  | 'harness-docs';

export interface StaticInventoryItem {
  relativePath: string;
  componentClass: StaticComponentClass;
  contentMode: 'full' | 'skill-description';
}

const DOC_PATHS = [
  'docs/provider-support-matrix.md',
  'docs/system-architecture.md',
  'docs/token-overhead.md',
  'scripts/measure-kit-overhead.mjs',
] as const;

const HOT_REFERENCE_SKILLS = new Set(['hc-plan', 'hc-cook', 'hc-review', 'hc-fix', 'hc-scout']);

export function listStaticInventory(repoRoot: string): StaticInventoryItem[] {
  const root = path.resolve(repoRoot);
  return [
    ...flatFiles(root, 'kit/rules', '.md', 'rule'),
    ...flatFiles(root, 'kit/contextual', '.md', 'contextual-rule'),
    ...flatFiles(root, 'kit/standards', '.md', 'standard'),
    ...flatFiles(root, 'kit/agents', '.md', 'agent'),
    ...flatFiles(root, 'kit/hooks', '.cjs', 'hook-source'),
    ...skillFiles(root),
    ...DOC_PATHS.filter((relativePath) => fs.existsSync(path.join(root, relativePath)))
      .map((relativePath) => ({ relativePath, componentClass: 'harness-docs' as const, contentMode: 'full' as const })),
  ].sort((a, b) => a.relativePath.localeCompare(b.relativePath) || a.componentClass.localeCompare(b.componentClass));
}

export function normalizeStaticContent(content: string, mode: StaticInventoryItem['contentMode']): string {
  return selectStaticContent(content.replace(/\r\n/g, '\n'), mode);
}

export function selectStaticContent(content: string, mode: StaticInventoryItem['contentMode']): string {
  return mode === 'skill-description' ? extractDescription(content) : content;
}

export function classifyInstalledArtifact(relativePath: string): StaticComponentClass {
  const normalized = relativePath.replace(/\\/g, '/').toLowerCase();
  const parts = normalized.split('/');
  if (parts.includes('hooks')) return 'generated-wrapper';
  if (parts.includes('contextual')) return 'contextual-rule';
  if (parts.includes('rules')) return 'provider-rules';
  if (parts.includes('agents')) return 'agent';
  const skillName = skillNameFromInstalledPath(parts);
  if (skillName && parts.includes('references')) {
    return HOT_REFERENCE_SKILLS.has(skillName) ? 'skill-reference-hot' : 'skill-reference-cold';
  }
  if (normalized.endsWith('/skill.md')) return 'skill-body';
  return 'harness-docs';
}

function skillNameFromInstalledPath(parts: string[]): string | null {
  const skillsIndex = parts.lastIndexOf('skills');
  return skillsIndex >= 0 && parts[skillsIndex + 1] ? parts[skillsIndex + 1] : null;
}

function flatFiles(
  repoRoot: string,
  relativeDir: string,
  extension: string,
  componentClass: Exclude<StaticComponentClass, 'skill-description' | 'skill-body' | 'skill-reference-hot' | 'skill-reference-cold' | 'generated-wrapper' | 'provider-rules' | 'harness-docs'>,
): StaticInventoryItem[] {
  const fullDir = path.join(repoRoot, relativeDir);
  if (!fs.existsSync(fullDir)) return [];
  return fs.readdirSync(fullDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(extension))
    .map((entry) => ({
      relativePath: joinRelative(relativeDir, entry.name),
      componentClass,
      contentMode: 'full' as const,
    }));
}

function skillFiles(repoRoot: string): StaticInventoryItem[] {
  const skillsDir = path.join(repoRoot, 'kit/skills');
  if (!fs.existsSync(skillsDir)) return [];
  return fs.readdirSync(skillsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => {
      const relativePath = joinRelative('kit/skills', entry.name, 'SKILL.md');
      const fullPath = path.join(repoRoot, relativePath);
      if (!fs.existsSync(fullPath)) return [];
      return [
        { relativePath, componentClass: 'skill-description' as const, contentMode: 'skill-description' as const },
        { relativePath, componentClass: 'skill-body' as const, contentMode: 'full' as const },
        ...skillReferenceFiles(repoRoot, entry.name),
      ];
    });
}

function skillReferenceFiles(repoRoot: string, skillName: string): StaticInventoryItem[] {
  const refsDir = path.join(repoRoot, 'kit', 'skills', skillName, 'references');
  if (!fs.existsSync(refsDir)) return [];
  const componentClass = HOT_REFERENCE_SKILLS.has(skillName) ? 'skill-reference-hot' : 'skill-reference-cold';
  return walkMarkdownFiles(refsDir).map((fullPath) => ({
    relativePath: joinRelative(path.relative(repoRoot, fullPath)),
    componentClass,
    contentMode: 'full' as const,
  }));
}

function walkMarkdownFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return walkMarkdownFiles(fullPath);
    return entry.isFile() && entry.name.endsWith('.md') ? [fullPath] : [];
  });
}

function extractDescription(content: string): string {
  const match = /^description:\s*"([^"]*(?:\\.[^"]*)*)"/m.exec(content);
  return match ? match[1] : '';
}

function joinRelative(...parts: string[]): string {
  return path.posix.join(...parts.map((part) => part.replace(/\\/g, '/')));
}
