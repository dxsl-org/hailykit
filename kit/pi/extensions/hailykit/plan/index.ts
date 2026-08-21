import { type ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { hydratePlanState, persistPlanState } from './state.js';
import { type HailykitRuntime } from '../shared-types.js';

function parseArgLine(argLine: string): string[] {
  return argLine.trim().split(/\s+/).filter(Boolean);
}

function planTools(runtime: HailykitRuntime, pi: ExtensionAPI): string[] {
  const active = (pi as unknown as { getActiveTools(): string[] }).getActiveTools();
  return active.filter((tool) => runtime.settings.plan.readOnlyTools.includes(tool));
}

export function registerPlan(pi: ExtensionAPI, runtime: HailykitRuntime): void {
  const api = pi as unknown as {
    registerCommand?(name: string, spec: Record<string, unknown>): void;
    on?(name: string, fn: Function): void;
    setActiveTools(tools: string[]): void;
    getActiveTools(): string[];
  };
  api.registerCommand?.(runtime.settings.plan.command, {
    description: 'Enter, exit, or inspect HailyKit read-only plan mode.',
    async handler(argLine: string, ctx: unknown) {
      hydratePlanState(runtime, ctx);
      const action = parseArgLine(argLine)[0] ?? 'status';
      if (action === 'status') return (ctx as { ui?: { notify?(text: string): void } }).ui?.notify?.(`Plan mode: ${runtime.planState.enabled ? 'on' : 'off'}`);
      if (action === 'off') {
        runtime.planState.enabled = false;
        if (runtime.planState.toolsBeforePlanMode?.length) api.setActiveTools(runtime.planState.toolsBeforePlanMode);
        persistPlanState(runtime, pi);
        return (ctx as { ui?: { notify?(text: string): void } }).ui?.notify?.('Plan mode disabled.');
      }
      runtime.planState.enabled = true;
      runtime.planState.toolsBeforePlanMode = api.getActiveTools();
      api.setActiveTools(planTools(runtime, pi));
      persistPlanState(runtime, pi);
      return (ctx as { ui?: { notify?(text: string): void } }).ui?.notify?.('Plan mode enabled.');
    },
  });
  const restore = async (_input: unknown, ctx: unknown, force = false) => {
    hydratePlanState(runtime, ctx, force);
    if (runtime.planState.enabled) api.setActiveTools(planTools(runtime, pi));
  };
  api.on?.('session_start', async (input: unknown, ctx: unknown) => restore(input, ctx, true));
  api.on?.('before_agent_start', restore);
  api.on?.('tool_call', async (event: Record<string, unknown>, ctx: unknown) => {
    hydratePlanState(runtime, ctx);
    if (!runtime.planState.enabled) return;
    const toolName = typeof event['toolName'] === 'string' ? event['toolName'] : '';
    if (runtime.settings.plan.readOnlyTools.includes(toolName)) return;
    return { block: true, reason: 'Plan mode is active. Exit plan mode before running mutation tools.' };
  });
}
