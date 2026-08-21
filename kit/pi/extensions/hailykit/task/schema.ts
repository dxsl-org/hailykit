import {
  DEFAULT_OUTPUT_CAP_BYTES,
  DEFAULT_TIMEOUT_MS,
  MAX_CONCURRENCY,
  MAX_TASK_ITEMS,
  type AgentScope,
  type TaskItem,
  type TaskRequest,
} from './types.js';

function asText(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`task.${label} must be a non-empty string.`);
  return value.trim();
}

function asScope(value: unknown): AgentScope {
  if (value === undefined) return 'global';
  if (value === 'global' || value === 'project' || value === 'both') return value;
  throw new Error('task.agentScope must be global, project, or both.');
}

function asPositiveInt(value: unknown, fallback: number, label: string, cap: number): number {
  if (value === undefined) return fallback;
  if (!Number.isInteger(value) || typeof value !== 'number' || value < 1) throw new Error(`task.${label} must be a positive integer.`);
  return Math.min(value, cap);
}

function asItem(value: unknown, label: string): TaskItem {
  const raw = value as Record<string, unknown>;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error(`${label} must be an object.`);
  return {
    agent: asText(raw.agent, `${label}.agent`),
    task: asText(raw.task, `${label}.task`),
    cwd: typeof raw.cwd === 'string' && raw.cwd.trim() ? raw.cwd.trim() : undefined,
  };
}

function asItems(value: unknown, label: 'tasks' | 'chain'): TaskItem[] {
  if (!Array.isArray(value) || value.length === 0) throw new Error(`task.${label} must be a non-empty array.`);
  if (value.length > MAX_TASK_ITEMS) throw new Error(`task.${label} supports at most ${MAX_TASK_ITEMS} items.`);
  return value.map((entry, index) => asItem(entry, `${label}[${index}]`));
}

export function parseTaskRequest(value: unknown): TaskRequest {
  const raw = value as Record<string, unknown>;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('task parameters must be an object.');
  const hasSingle = raw.agent !== undefined || raw.task !== undefined;
  const hasBatch = raw.tasks !== undefined;
  const hasChain = raw.chain !== undefined;
  const modeCount = Number(hasSingle) + Number(hasBatch) + Number(hasChain);
  if (modeCount !== 1) throw new Error('Provide exactly one task mode: {agent, task}, tasks[], or chain[].');
  const scope = asScope(raw.agentScope);
  const timeoutMs = asPositiveInt(raw.timeoutMs, DEFAULT_TIMEOUT_MS, 'timeoutMs', DEFAULT_TIMEOUT_MS);
  const outputCapBytes = asPositiveInt(raw.outputCapBytes, DEFAULT_OUTPUT_CAP_BYTES, 'outputCapBytes', DEFAULT_OUTPUT_CAP_BYTES);
  if (hasSingle) {
    return {
      mode: 'single',
      items: [asItem(raw, 'task')],
      scope,
      concurrency: 1,
      timeoutMs,
      outputCapBytes,
    };
  }
  const items = hasBatch ? asItems(raw.tasks, 'tasks') : asItems(raw.chain, 'chain');
  return {
    mode: hasBatch ? 'batch' : 'chain',
    items,
    scope,
    concurrency: hasBatch ? asPositiveInt(raw.concurrency, MAX_CONCURRENCY, 'concurrency', MAX_CONCURRENCY) : 1,
    timeoutMs,
    outputCapBytes,
  };
}
