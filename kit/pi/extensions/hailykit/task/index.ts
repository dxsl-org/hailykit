import * as path from 'node:path';
import { StringEnum } from '@earendil-works/pi-ai';
import { CONFIG_DIR_NAME, getAgentDir, type ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import { createNodeInvocationPort } from './node-port.js';
import { runTaskRequest } from './scheduler.js';
import { parseTaskRequest } from './schema.js';
import { DEFAULT_OUTPUT_CAP_BYTES, DEFAULT_TIMEOUT_MS, MAX_CONCURRENCY, type ParentTaskPolicy } from './types.js';

const Item = Type.Object({
  agent: Type.String(),
  task: Type.String(),
  cwd: Type.Optional(Type.String()),
});

const Params = Type.Object({
  agent: Type.Optional(Type.String()),
  task: Type.Optional(Type.String()),
  cwd: Type.Optional(Type.String()),
  tasks: Type.Optional(Type.Array(Item)),
  chain: Type.Optional(Type.Array(Item)),
  agentScope: Type.Optional(StringEnum(['global', 'project', 'both'] as const)),
  concurrency: Type.Optional(Type.Integer({ minimum: 1, maximum: MAX_CONCURRENCY })),
  timeoutMs: Type.Optional(Type.Integer({ minimum: 1, maximum: DEFAULT_TIMEOUT_MS })),
  outputCapBytes: Type.Optional(Type.Integer({ minimum: 1, maximum: DEFAULT_OUTPUT_CAP_BYTES })),
});

function modelName(model: unknown): string | undefined {
  const value = model as { provider?: string; id?: string } | undefined;
  return value?.provider && value?.id ? `${value.provider}/${value.id}` : undefined;
}

function parentPolicy(pi: Pick<ExtensionAPI, 'getActiveTools'>, ctx: unknown): ParentTaskPolicy {
  const value = ctx as Record<string, unknown>;
  const scopedModels = Array.isArray(value['scopedModels']) ? value['scopedModels'] : [];
  const allowedModels = scopedModels.map((entry) => modelName((entry as { model?: unknown }).model)).filter((name): name is string => Boolean(name));
  return {
    cwd: typeof value['cwd'] === 'string' ? value['cwd'] : process.cwd(),
    depth: Number(process.env['HAILYKIT_PI_TASK_DEPTH'] ?? '0') || 0,
    trustedProject: typeof value['isProjectTrusted'] === 'function' ? Boolean((value['isProjectTrusted'] as () => boolean)()) : false,
    activeModel: modelName(value['model']),
    activeThinking: typeof value['thinkingLevel'] === 'string' ? value['thinkingLevel'] : undefined,
    allowedModels: allowedModels.length > 0 ? allowedModels : undefined,
    availableTools: pi.getActiveTools().map((tool) => tool.trim()).filter(Boolean),
  };
}

export default function register(pi: ExtensionAPI): void {
  pi.registerTool({
    name: 'task',
    label: 'Task',
    description: `Run trusted Pi agents in single, batch, or chain mode with isolated conversation context. Project agents from ${CONFIG_DIR_NAME}/agents require a trusted project. Context isolation is not an OS sandbox.`,
    parameters: Params,
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      try {
        const request = parseTaskRequest(params);
        const policy = parentPolicy(pi, ctx);
        const port = createNodeInvocationPort();
        const globalAgentDir = path.join(getAgentDir(), 'agents');
        const outcome = await runTaskRequest(request, policy, globalAgentDir, port, signal);
        const lines = outcome.results.map((result) => `${result.status.toUpperCase()} ${result.agent}: ${result.output}`);
        return { content: [{ type: 'text', text: lines.join('\n\n') || '(no output)' }], details: outcome };
      } catch (error) {
        return { content: [{ type: 'text', text: error instanceof Error ? error.message : 'Pi task failed.' }], isError: true };
      }
    },
  });
}
