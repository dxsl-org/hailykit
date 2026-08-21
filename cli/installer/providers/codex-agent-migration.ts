import * as fs from 'node:fs';
import * as path from 'node:path';
export const AGENTS_MANIFEST = 'hailykit-installed-agents.json';
export const AGENT_OWNERSHIP_MARKER = '.hailykit-codex-agent.json';
const SAFE_AGENT_SLUG_RE = /^[a-z][a-z0-9_]*$/;
export interface AgentTableSpan {
  slug: string;
  startLine: number;
  endLine: number;
  text: string;
  configFile: string | null;
}
export interface ManagedCodexAgentMarker {
  provider: 'codex';
  slug: string;
  name: string;
}
export function agentTomlPath(providerDir: string, slug: string): string {
  return path.join(providerDir, 'agents', `${slug}.toml`);
}
export function agentMarkerPath(providerDir: string, slug: string): string {
  return path.join(providerDir, 'agents', `${slug}${AGENT_OWNERSHIP_MARKER}`);
}
export function readCodexAgentManifest(providerDir: string): string[] {
  try {
    const raw: unknown = JSON.parse(fs.readFileSync(path.join(providerDir, AGENTS_MANIFEST), 'utf8'));
    return Array.isArray(raw)
      ? raw.filter((slug): slug is string => typeof slug === 'string' && SAFE_AGENT_SLUG_RE.test(slug))
      : [];
  } catch {
    return [];
  }
}
export function readManagedCodexAgentSlugs(providerDir: string): string[] {
  const slugs = new Set(readCodexAgentManifest(providerDir));
  const agentsDir = path.join(providerDir, 'agents');
  if (!fs.existsSync(agentsDir)) return [...slugs].sort();
  for (const file of fs.readdirSync(agentsDir)) {
    if (!file.endsWith(AGENT_OWNERSHIP_MARKER)) continue;
    const marker = readAgentOwnershipMarker(path.join(agentsDir, file));
    if (marker) slugs.add(marker.slug);
  }
  return [...slugs].sort();
}
export function writeCodexAgentManifest(providerDir: string, slugs: Iterable<string>): void {
  const ordered = [...new Set([...slugs].filter((slug) => SAFE_AGENT_SLUG_RE.test(slug)))].sort();
  fs.mkdirSync(providerDir, { recursive: true });
  if (ordered.length === 0) {
    fs.rmSync(path.join(providerDir, AGENTS_MANIFEST), { force: true });
    return;
  }
  const manifestPath = path.join(providerDir, AGENTS_MANIFEST);
  const content = JSON.stringify(ordered, null, 2) + '\n';
  if (fs.existsSync(manifestPath) && fs.readFileSync(manifestPath, 'utf8') === content) return;
  atomicWriteFile(manifestPath, content);
}
export function writeAgentOwnershipMarker(providerDir: string, slug: string, name: string): void {
  fs.mkdirSync(path.join(providerDir, 'agents'), { recursive: true });
  atomicWriteFile(
    agentMarkerPath(providerDir, slug),
    JSON.stringify({ provider: 'codex', slug, name } satisfies ManagedCodexAgentMarker, null, 2) + '\n',
  );
}
export function writeManagedCodexAgent(providerDir: string, slug: string, name: string, toml: string): void {
  const tomlPath = agentTomlPath(providerDir, slug);
  const tempPath = `${tomlPath}.hailykit-tmp`;
  fs.mkdirSync(path.dirname(tomlPath), { recursive: true });
  try {
    fs.writeFileSync(tempPath, toml, 'utf8');
    writeAgentOwnershipMarker(providerDir, slug, name);
    fs.renameSync(tempPath, tomlPath);
  } catch (error) {
    try { fs.rmSync(tempPath, { force: true }); } catch { /* best-effort cleanup */ }
    throw error;
  }
}
export function readAgentOwnershipMarker(markerPath: string): ManagedCodexAgentMarker | null {
  try {
    const raw = JSON.parse(fs.readFileSync(markerPath, 'utf8')) as unknown;
    if (typeof raw !== 'object' || raw === null) return null;
    const marker = raw as Partial<ManagedCodexAgentMarker> & Record<string, unknown>;
    if (marker.provider !== 'codex') return null;
    if (typeof marker.slug !== 'string' || !SAFE_AGENT_SLUG_RE.test(marker.slug)) return null;
    if (typeof marker.name !== 'string' || !marker.name.trim()) return null;
    return { provider: 'codex', slug: marker.slug, name: marker.name };
  } catch {
    return null;
  }
}
export function extractAgentTableSpans(content: string): AgentTableSpan[] {
  const lines = content.split(/\r?\n/);
  const spans: AgentTableSpan[] = [];
  const headerRe = /^\s*\[agents\.(?:"([^"]+)"|([^\]\r\n]+))\]\s*$/;
  const anyTableHeaderRe = /^\s*\[\[?[^\]\r\n]+\]\]?\s*$/;
  let i = 0;
  while (i < lines.length) {
    const header = lines[i].match(headerRe);
    if (!header) {
      i++;
      continue;
    }
    const slug = (header[1] || header[2] || '').trim();
    const startLine = i;
    let endLine = lines.length;
    for (let j = i + 1; j < lines.length; j++) {
      if (anyTableHeaderRe.test(lines[j])) {
        endLine = j;
        break;
      }
    }
    const text = lines.slice(startLine, endLine).join('\n');
    spans.push({ slug, startLine, endLine, text, configFile: parseAgentConfigFilePointer(text) });
    i = endLine;
  }
  return spans;
}
export function removeAgentTableSpans(content: string, spans: AgentTableSpan[]): string {
  if (spans.length === 0) return content;
  const lines = content.split(/\r?\n/);
  const remove = new Set<number>();
  for (const span of spans) {
    for (let i = span.startLine; i < span.endLine; i++) remove.add(i);
  }
  const kept = lines.filter((_, i) => !remove.has(i)).join('\n');
  return kept.replace(/\n{3,}/g, '\n\n').trimEnd() ? kept.replace(/\n{3,}/g, '\n\n').trimEnd() + '\n' : '';
}
export function parseAgentConfigFilePointer(tableText: string): string | null {
  const match = tableText.match(/^\s*config_file\s*=\s*"([^"]+)"\s*$/m);
  return match ? match[1] : null;
}
function atomicWriteFile(filePath: string, content: string): void {
  const tempPath = `${filePath}.hailykit-tmp`;
  try {
    fs.writeFileSync(tempPath, content, 'utf8');
    fs.renameSync(tempPath, filePath);
  } catch (error) {
    try { fs.rmSync(tempPath, { force: true }); } catch { /* best-effort cleanup */ }
    throw error;
  }
}
export function isManagedCodexAgent(providerDir: string, slug: string): boolean {
  const marker = readAgentOwnershipMarker(agentMarkerPath(providerDir, slug));
  return marker?.provider === 'codex' && marker.slug === slug;
}
export function removeManagedCodexAgent(providerDir: string, slug: string): boolean {
  if (!isManagedCodexAgent(providerDir, slug)) return false;
  fs.rmSync(agentTomlPath(providerDir, slug), { force: true });
  fs.rmSync(agentMarkerPath(providerDir, slug), { force: true });
  return true;
}
