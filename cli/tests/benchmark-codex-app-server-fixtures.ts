import type { CodexAppServerClient, CodexAppServerEnvelope, CodexAppServerInitializeResponse, CodexAppServerThreadStartResponse, CodexAppServerTurnStartResponse } from '../lib/benchmark/codex-app-server-client';

export function createMockCodexAppServerClient(script: { initialize?: Partial<CodexAppServerInitializeResponse>; thread?: Partial<CodexAppServerThreadStartResponse>; turn?: Partial<CodexAppServerTurnStartResponse>; envelopes?: CodexAppServerEnvelope[]; onInterrupt?: (threadId: string, turnId: string) => void; onClose?: () => void; }) {
  const envelopes = [...(script.envelopes ?? [])];
  return {
    client: {
      async initialize() { return { codexHome: 'C:/Users/Admin/.codex', platformFamily: 'windows', platformOs: 'windows', userAgent: 'codex-cli/0.142.5', ...script.initialize }; },
      async startThread() { return { approvalPolicy: 'never', cwd: 'D:/hailykit', model: 'gpt-5.4-mini', modelProvider: 'openai', sandbox: { type: 'readOnly' }, thread: { id: 'thread-1' }, ...script.thread }; },
      async startTurn() { return { turn: { id: 'turn-1', status: 'running' }, ...script.turn }; },
      async interruptTurn(threadId: string, turnId: string) { script.onInterrupt?.(threadId, turnId); },
      async nextEnvelope() { if (!envelopes.length) throw new Error('codex app-server event timed out'); return envelopes.shift()!; },
      async close() { script.onClose?.(); },
    } as CodexAppServerClient,
  };
}
