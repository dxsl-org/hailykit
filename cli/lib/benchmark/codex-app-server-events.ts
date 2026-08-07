import type { CodexAppServerEnvelope } from './codex-app-server-client';

export interface CodexAppServerTelemetry {
  completed: boolean;
  approvals: number;
  firstTokenAtMs: number | null;
  contextCompactions: number;
  outputBytes: number | null;
  finalAnswer: string | null;
  reroutedModel: string | null;
  tokens: { inputTokens: number | null; outputTokens: number | null; totalTokens: number | null; cacheReadTokens: number | null; reasoningTokens: number | null; modelContextWindow: number | null; };
  toolCalls: number | null;
  toolErrors: number | null;
}

export function createCodexAppServerTelemetry(threadId: string, turnId: string) {
  const toolIds = new Set<string>();
  const errorIds = new Set<string>();
  const compactionIds = new Set<string>();
  const state: CodexAppServerTelemetry = {
    completed: false, approvals: 0, firstTokenAtMs: null, contextCompactions: 0, outputBytes: null,
    finalAnswer: null, reroutedModel: null,
    tokens: { inputTokens: null, outputTokens: null, totalTokens: null, cacheReadTokens: null, reasoningTokens: null, modelContextWindow: null },
    toolCalls: null, toolErrors: null,
  };
  return {
    state,
    observe(envelope: CodexAppServerEnvelope, nowMs: number): void {
      if (isServerRequest(envelope)) { state.approvals += 1; return; }
      if (!matches(envelope.params, threadId, turnId)) return;
      if (envelope.method === 'item/agentMessage/delta') {
        if (state.firstTokenAtMs === null) state.firstTokenAtMs = nowMs;
        const delta = String((envelope.params as Record<string, unknown>).delta ?? '');
        state.outputBytes = (state.outputBytes ?? 0) + Buffer.byteLength(delta, 'utf8');
        state.finalAnswer = `${state.finalAnswer ?? ''}${delta}`;
      }
      if (envelope.method === 'thread/tokenUsage/updated') {
        const usage = asObject((asObject(envelope.params).tokenUsage));
        const total = asObject(usage.total);
        state.tokens = {
          inputTokens: asNumber(total.inputTokens),
          outputTokens: asNumber(total.outputTokens),
          totalTokens: asNumber(total.totalTokens),
          cacheReadTokens: asNumber(total.cachedInputTokens),
          reasoningTokens: asNumber(total.reasoningOutputTokens),
          modelContextWindow: asNumber(usage.modelContextWindow),
        };
      }
      if (envelope.method === 'model/rerouted') {
        const toModel = asObject(envelope.params).toModel;
        state.reroutedModel = typeof toModel === 'string' && toModel.trim() ? toModel.trim() : null;
      }
      if (envelope.method === 'item/started' || envelope.method === 'item/completed') {
        trackItem(asObject(asObject(envelope.params).item), toolIds, errorIds, compactionIds);
        state.contextCompactions = compactionIds.size;
      }
      if (envelope.method === 'turn/completed') state.completed = true;
      state.toolCalls = toolIds.size || 0;
      state.toolErrors = errorIds.size || 0;
    },
  };
}

function matches(value: unknown, threadId: string, turnId: string): boolean {
  const record = asObject(value);
  if (record.threadId !== threadId) return false;
  if (record.turnId === turnId) return true;
  const turn = asObject(record.turn);
  return turn.id === turnId;
}
function isServerRequest(envelope: CodexAppServerEnvelope): boolean { return envelope.id !== undefined && typeof envelope.method === 'string'; }
function trackItem(item: Record<string, unknown>, toolIds: Set<string>, errorIds: Set<string>, compactionIds: Set<string>): void {
  const type = typeof item.type === 'string' ? item.type : '';
  const id = typeof item.id === 'string' ? item.id : '';
  if (!id) return;
  if (type === 'contextCompaction') { compactionIds.add(id); return; }
  if (/(toolCall|commandExecution|fileChange|webSearch)/i.test(type)) toolIds.add(id);
  if (/(failed|error|denied|rejected)/i.test(String(item.status ?? ''))) errorIds.add(id);
}
function asObject(value: unknown): Record<string, unknown> { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function asNumber(value: unknown): number | null { return typeof value === 'number' && Number.isFinite(value) ? value : null; }
