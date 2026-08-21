const SAFE_AGENT_NAME_RE = /^[A-Za-z][A-Za-z0-9-]*$/;

const OMP_TOOLS: Readonly<Record<string, string>> = {
  Glob: 'glob',
  Grep: 'grep',
  Read: 'read',
  Bash: 'bash',
  Edit: 'edit',
  MultiEdit: 'edit',
  NotebookEdit: 'edit',
  Write: 'write',
  WebSearch: 'web_search',
};

const PI_TOOLS: Readonly<Record<string, string>> = {
  Glob: 'find',
  Grep: 'grep',
  Read: 'read',
  Bash: 'bash',
  Edit: 'edit',
  MultiEdit: 'edit',
  NotebookEdit: 'edit',
  Write: 'write',
  WebSearch: 'web_search',
};

export type PiAgentProvider = 'pi' | 'omp';

export interface NativeAgentCapabilities {
  tools: string[];
  spawns: string[];
}

/**
 * Map Claude agent capabilities to the explicit Pi-family allowlists.
 * Unsupported tools are omitted; an all-unsupported policy fails closed.
 *
 * @param rawTools - Comma-separated `tools:` frontmatter from a kit agent.
 * @param provider - Native target schema.
 * @returns Provider-native tool ids and OMP spawn allowlist.
 * @throws When a declared policy has no safe target capability.
 */
export function mapPiAgentCapabilities(
  rawTools: string | undefined,
  provider: PiAgentProvider,
): NativeAgentCapabilities {
  if (!rawTools) return { tools: [], spawns: [] };
  const mapping = provider === 'omp' ? OMP_TOOLS : PI_TOOLS;
  const tools = new Set<string>();
  const spawns = new Set<string>();

  for (const token of rawTools.split(',').map((value) => value.trim()).filter(Boolean)) {
    const task = token.match(/^Task\(([^)]+)\)$/);
    if (task) {
      const agentName = task[1].trim();
      if (!SAFE_AGENT_NAME_RE.test(agentName)) throw new Error(`Unsafe spawned agent name: ${agentName}`);
      tools.add('task');
      spawns.add(agentName);
      continue;
    }
    const mapped = mapping[token];
    if (mapped) tools.add(mapped);
  }

  if (tools.size === 0) {
    throw new Error(`No safe ${provider.toUpperCase()} tool mapping for declared agent policy: ${rawTools}`);
  }
  return { tools: [...tools], spawns: [...spawns] };
}
