import { formatUnknownAgentHelp } from './discovery.js';
import { resolveTaskCwd } from './cwd.js';
import { type ParentTaskPolicy, type PreparedTask, type TaskAgent, type TaskItem } from './types.js';

function intersect(left: readonly string[], right: readonly string[] | undefined): string[] {
  return right ? left.filter((entry) => right.includes(entry)) : [...left];
}

function resolveTools(agent: TaskAgent, parent: ParentTaskPolicy): string[] {
  const parentTools = parent.availableTools?.map((tool) => tool.trim()).filter(Boolean);
  const candidateTools = agent.tools.length > 0 ? agent.tools : (parentTools ?? []);
  if (!candidateTools.length) throw new Error(`Agent "${agent.name}" has no trusted tool allowlist.`);
  const filtered = intersect(candidateTools, parentTools).filter((tool) => tool !== 'task' || agent.spawns.length > 0);
  if (!filtered.length) throw new Error(`Agent "${agent.name}" has no tools after parent-policy intersection.`);
  return [...new Set(filtered)];
}

function resolveModel(agent: TaskAgent, parent: ParentTaskPolicy): { model?: string; thinking?: string } {
  if (agent.model && parent.allowedModels && !parent.allowedModels.includes(agent.model)) {
    throw new Error(`Agent "${agent.name}" requested disallowed model "${agent.model}".`);
  }
  return { model: agent.model ?? parent.activeModel, thinking: agent.model ? undefined : parent.activeThinking };
}

export function prepareTask(
  item: TaskItem,
  index: number,
  agents: readonly TaskAgent[],
  parent: ParentTaskPolicy,
  timeoutMs: number,
  outputCapBytes: number,
): PreparedTask | { index: number; agent: string; status: 'error'; output: string; stderr: string; toolNames: string[]; allowedAgents: string[]; help: string } {
  const agent = agents.find((entry) => entry.name === item.agent);
  if (!agent) {
    const help = formatUnknownAgentHelp(item.agent, agents);
    return { index, agent: item.agent, status: 'error', output: help, stderr: help, toolNames: [], allowedAgents: [], help };
  }
  const toolNames = resolveTools(agent, parent);
  const model = resolveModel(agent, parent);
  return {
    index,
    item,
    agent,
    cwd: resolveTaskCwd(parent.cwd, item.cwd),
    toolNames,
    allowedAgents: [...agent.spawns],
    model: model.model,
    thinking: model.thinking,
    timeoutMs,
    outputCapBytes,
    depth: parent.depth + 1,
  };
}

export function assertTaskDepth(parent: ParentTaskPolicy): void {
  if (parent.depth > 0) throw new Error('Nested task depth is denied. Subprocess context isolation is not an OS sandbox.');
}

export function assertTrustedScope(scope: 'global' | 'project' | 'both', trustedProject: boolean): void {
  if ((scope === 'project' || scope === 'both') && !trustedProject) {
    throw new Error('Project-local Pi agents require a trusted project.');
  }
}
