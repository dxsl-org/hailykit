import * as fs from 'node:fs';
import * as path from 'node:path';
import { type AgentScope, type TaskAgent } from './types.js';

const FRONTMATTER_RE = /^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/;

function parseList(value: string | undefined): string[] {
  if (!value) return [];
  return value.split(',').map((entry) => entry.trim()).filter(Boolean);
}

function parseAgentFile(filePath: string, source: 'global' | 'project'): TaskAgent | null {
  const content = fs.readFileSync(filePath, 'utf8');
  const match = content.replace(/\r\n/g, '\n').match(FRONTMATTER_RE);
  if (!match) return null;
  const meta: Record<string, string> = {};
  for (const line of match[1].split('\n')) {
    const parsed = line.match(/^([A-Za-z][A-Za-z0-9_-]*):\s*(.+)$/);
    if (parsed) meta[parsed[1]] = parsed[2].trim().replace(/^["']|["']$/g, '');
  }
  if (!meta['name'] || !meta['description']) return null;
  return {
    name: meta['name'],
    description: meta['description'],
    systemPrompt: match[2].trim(),
    tools: parseList(meta['tools']),
    spawns: parseList(meta['spawns']),
    model: meta['model'] || undefined,
    source,
    filePath,
  };
}

function isDir(dirPath: string): boolean {
  try { return fs.statSync(dirPath).isDirectory(); } catch { return false; }
}

function nearestProjectAgentsDir(cwd: string): string | null {
  let current = path.resolve(cwd);
  while (true) {
    const candidate = path.join(current, '.pi', 'agents');
    if (isDir(candidate)) return candidate;
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

function loadAgents(dirPath: string, source: 'global' | 'project'): TaskAgent[] {
  if (!isDir(dirPath)) return [];
  return fs.readdirSync(dirPath)
    .filter((entry) => entry.endsWith('.md'))
    .sort((a, b) => a.localeCompare(b))
    .map((entry) => parseAgentFile(path.join(dirPath, entry), source))
    .filter((entry): entry is TaskAgent => Boolean(entry));
}

export function discoverTaskAgents(globalAgentDir: string, cwd: string, scope: AgentScope): { agents: TaskAgent[]; projectAgentsDir: string | null } {
  const projectAgentsDir = nearestProjectAgentsDir(cwd);
  const globalAgents = scope === 'project' ? [] : loadAgents(globalAgentDir, 'global');
  const projectAgents = scope === 'global' || !projectAgentsDir ? [] : loadAgents(projectAgentsDir, 'project');
  const merged = new Map<string, TaskAgent>();
  for (const agent of globalAgents) merged.set(agent.name, agent);
  for (const agent of projectAgents) merged.set(agent.name, agent);
  return {
    agents: [...merged.values()].sort((a, b) => a.name.localeCompare(b.name)),
    projectAgentsDir,
  };
}

export function formatUnknownAgentHelp(agentName: string, agents: readonly TaskAgent[]): string {
  const available = agents.map((agent) => `${agent.name} (${agent.source})`).join(', ') || 'none';
  return `Unknown agent "${agentName}". Available agents: ${available}.`;
}
