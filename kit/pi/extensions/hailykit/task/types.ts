export const MAX_TASK_ITEMS = 8;
export const MAX_CONCURRENCY = 4;
export const DEFAULT_TIMEOUT_MS = 300_000;
export const DEFAULT_OUTPUT_CAP_BYTES = 50 * 1024;

export type AgentScope = 'global' | 'project' | 'both';
export type TaskMode = 'single' | 'batch' | 'chain';
export type TaskStatus = 'ok' | 'error' | 'timeout' | 'aborted' | 'crash';
export type AgentSource = 'global' | 'project';

export interface TaskItem {
  agent: string;
  task: string;
  cwd?: string;
}

export interface TaskRequest {
  mode: TaskMode;
  items: TaskItem[];
  scope: AgentScope;
  concurrency: number;
  timeoutMs: number;
  outputCapBytes: number;
}

export interface TaskAgent {
  name: string;
  description: string;
  systemPrompt: string;
  tools: string[];
  spawns: string[];
  model?: string;
  source: AgentSource;
  filePath: string;
}

export interface ParentTaskPolicy {
  cwd: string;
  depth: number;
  trustedProject: boolean;
  activeModel?: string;
  activeThinking?: string;
  allowedModels?: string[];
  availableTools?: string[];
}

export interface PreparedTask {
  index: number;
  item: TaskItem;
  agent: TaskAgent;
  cwd: string;
  toolNames: string[];
  allowedAgents: string[];
  model?: string;
  thinking?: string;
  timeoutMs: number;
  outputCapBytes: number;
  depth: number;
}

export interface TaskResult {
  index: number;
  agent: string;
  source?: AgentSource;
  status: TaskStatus;
  output: string;
  stderr: string;
  model?: string;
  toolNames: string[];
  allowedAgents: string[];
  help?: string;
}

export interface PiInvocation {
  command: string;
  args: string[];
  cwd: string;
  env: Record<string, string>;
  systemPrompt?: string;
  timeoutMs: number;
  outputCapBytes: number;
}

export interface InvocationOutcome {
  exitCode: number;
  stdout: string;
  stderr: string;
  timedOut?: boolean;
  aborted?: boolean;
  crashReason?: string;
}

export interface InvocationPort {
  invoke(call: PiInvocation, signal?: AbortSignal): Promise<InvocationOutcome>;
}
