import { type ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { hydratePlanState } from '../plan/state.js';
import { destructiveHit, dirtyRepo, isMutatingTool, protectedPathHit } from './guards.js';
import { type HailykitRuntime } from '../shared-types.js';

function deny(reason: string): { block: true; reason: string } {
  return { block: true, reason };
}

function cancel(reason: string): { cancel: true; reason: string } {
  return { cancel: true, reason };
}

export function registerSafety(pi: ExtensionAPI, runtime: HailykitRuntime): void {
  const api = pi as unknown as { on?(name: string, fn: Function): void; exec?: Function };
  api.on?.('tool_call', async (event: Record<string, unknown>, ctx: unknown) => {
    hydratePlanState(runtime, ctx);
    const toolName = typeof event['toolName'] === 'string' ? event['toolName'] : '';
    const input = (event['input'] as Record<string, unknown> | undefined) ?? {};
    if (!isMutatingTool(toolName, input)) return;
    if (runtime.settings.safety.requireProjectTrust && !(ctx as { isProjectTrusted?(): boolean }).isProjectTrusted?.()) {
      return deny('Untrusted project: mutation tools are disabled until trust is granted.');
    }
    if (runtime.planState.enabled) return deny('Plan mode is active. Exit plan mode before running mutation tools.');
    const protectedHit = protectedPathHit((ctx as { cwd?: string }).cwd ?? process.cwd(), runtime, input);
    if (protectedHit) return deny(`Protected path blocked: ${protectedHit}`);
    if (runtime.settings.safety.guardDirtyRepo && await dirtyRepo(api, (ctx as { cwd?: string }).cwd ?? process.cwd())) {
      return deny('Dirty repository: mutation tools are blocked until the repo is clean.');
    }
    const destructive = destructiveHit(input);
    if (!destructive) return;
    if (!runtime.settings.safety.confirmDestructive) return;
    const approved = await (ctx as { ui?: { confirm?(title: string, message: string): Promise<boolean> } }).ui?.confirm?.('Confirm destructive command', destructive);
    if (approved !== true) return deny('Destructive command denied.');
  });
  const sessionGate = async (_event: Record<string, unknown>, ctx: unknown) => {
    if (!runtime.settings.safety.guardDirtyRepo) return;
    if (await dirtyRepo(api, (ctx as { cwd?: string }).cwd ?? process.cwd())) return cancel('Dirty repository: session change denied.');
  };
  api.on?.('session_before_switch', sessionGate);
  api.on?.('session_before_fork', sessionGate);
}
