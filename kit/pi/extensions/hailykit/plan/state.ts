import { type HailykitRuntime } from '../shared-types.js';

type Entry = { customType?: string; data?: Record<string, unknown> };

function lastPlanEntry(entries: Entry[]): Entry | undefined {
  return [...entries].reverse().find((entry) => entry.customType === 'hailykit-plan-state');
}

export function hydratePlanState(runtime: HailykitRuntime, ctx: unknown, force = false): void {
  if (runtime.planState.restored && !force) return;
  const entries = ((ctx as { sessionManager?: { getEntries(): Entry[] } }).sessionManager?.getEntries?.() ?? []);
  const data = lastPlanEntry(entries)?.data;
  runtime.planState = {
    enabled: data?.['enabled'] === true,
    toolsBeforePlanMode: Array.isArray(data?.['toolsBeforePlanMode']) ? data['toolsBeforePlanMode'].filter((v): v is string => typeof v === 'string') : undefined,
    restored: true,
  };
}

export function persistPlanState(runtime: HailykitRuntime, pi: unknown): void {
  (pi as { appendEntry?: (customType: string, data: Record<string, unknown>) => void }).appendEntry?.(
    'hailykit-plan-state',
    { enabled: runtime.planState.enabled, toolsBeforePlanMode: runtime.planState.toolsBeforePlanMode ?? [] },
  );
}
