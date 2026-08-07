import fs from 'node:fs';
import path from 'node:path';

export type StaticComponentClass =
  | 'rule'
  | 'standard'
  | 'skill-description'
  | 'skill-body'
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

export function listStaticInventory(repoRoot: string): StaticInventoryItem[] {
  const root = path.resolve(repoRoot);
  return [
    ...flatFiles(root, 'kit/rules', '.md', 'rule'),
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
  if (normalized.includes('/hooks/')) return 'generated-wrapper';
  if (normalized.includes('/rules/')) return 'provider-rules';
  if (normalized.includes('/agents/')) return 'agent';
  if (normalized.endsWith('/skill.md')) return 'skill-body';
  return 'harness-docs';
}

function flatFiles(
  repoRoot: string,
  relativeDir: string,
  extension: string,
  componentClass: Exclude<StaticComponentClass, 'skill-description' | 'skill-body' | 'generated-wrapper' | 'provider-rules' | 'harness-docs'>,
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
      ];
    });
}

function extractDescription(content: string): string {
  const match = /^description:\s*"([^"]*(?:\\.[^"]*)*)"/m.exec(content);
  return match ? match[1] : '';
}

function joinRelative(...parts: string[]): string {
  return path.posix.join(...parts.map((part) => part.replace(/\\/g, '/')));
}
