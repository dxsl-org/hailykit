import type { BenchmarkProviderResponse } from './provider-contract';
import type { WorkflowTrialRequest } from './workflow-runner';
import { createCodexAppServerTelemetry } from './codex-app-server-events';
import { spawnOwnedCodexAppServerClient, type CodexAppServerClient, type CodexAppServerEnvelope } from './codex-app-server-client';

export interface CodexAppServerBackendDeps {
  createClient?: (cwd: string) => CodexAppServerClient;
  nowMs?: () => number;
  timeoutGraceMs?: number;
}

export async function runCodexAppServerBackend(request: WorkflowTrialRequest, deps: CodexAppServerBackendDeps = {}): Promise<BenchmarkProviderResponse> {
  if (!request.prompt) throw new Error('codex app-server backend requires a prompt');
  const createClient = deps.createClient ?? spawnOwnedCodexAppServerClient;
  const nowMs = deps.nowMs ?? (() => Date.now());
  const graceMs = deps.timeoutGraceMs ?? 1_000;
  const startedAt = nowMs();
  const client = createClient(request.cwd);
  let threadId = '';
  let turnId = '';
  try {
    const init = await client.initialize();
    validateInitialize(init);
    const thread = await client.startThread({ approvalPolicy: 'never', cwd: request.cwd, config: {}, ephemeral: true, experimentalRawEvents: false, model: request.manifest.requestedModel, sandbox: 'read-only', serviceName: 'hailykit-benchmark', threadSource: 'benchmark' });
    validateThread(thread);
    threadId = requireString(thread.thread?.id, 'thread/start response.thread.id');
    let actualModel = requireString(thread.model, 'thread/start response.model');
    const modelProvider = requireString(thread.modelProvider, 'thread/start response.modelProvider');
    const turn = await client.startTurn({ approvalPolicy: 'never', cwd: request.cwd, input: [{ type: 'text', text: request.prompt }], model: request.manifest.requestedModel, threadId });
    turnId = requireString(turn.turn?.id, 'turn/start response.turn.id');
    const telemetry = createCodexAppServerTelemetry(threadId, turnId);
    const deadline = startedAt + Math.max(1, Math.floor(request.remainingBudget.wallMs));
    while (!telemetry.state.completed) {
      const envelope = await nextRelevantEnvelope(client, deadline, threadId, turnId);
      const rerouted = reroutedModel(envelope, threadId, turnId);
      if (rerouted) actualModel = rerouted;
      telemetry.observe(envelope, nowMs());
      const outputBytes = telemetry.state.outputBytes ?? 0;
      if (outputBytes > request.remainingBudget.outputBytes) throw new Error('live budget maxOutputBytes exceeded by app-server response');
    }
    const ttftMs = telemetry.state.firstTokenAtMs === null ? null : Math.max(0, telemetry.state.firstTokenAtMs - startedAt);
    const totalTokens = telemetry.state.tokens.totalTokens;
    const window = telemetry.state.tokens.modelContextWindow;
    const rerouted = telemetry.state.reroutedModel !== null;
    return {
      provider: 'codex',
      backend: 'codex_app_server',
      surface: 'app_server',
      actualModel,
      modelSatisfied: actualModel === request.manifest.requestedModel,
      modelVerified: !rerouted && actualModel === request.manifest.requestedModel,
      modelVerificationSource: !rerouted && actualModel === request.manifest.requestedModel ? 'thread_start_exact' : 'unknown',
      policy: 'read_only',
      policySatisfied: request.manifest.policy === 'read_only',
      rawOutput: telemetry.state.finalAnswer,
      note: null,
      metrics: {
        wallMs: Math.max(0, nowMs() - startedAt),
        ttftMs,
        outputBytes: telemetry.state.outputBytes ?? 0,
        tokens: { inputTokens: telemetry.state.tokens.inputTokens, outputTokens: telemetry.state.tokens.outputTokens, totalTokens, costUsd: null, cacheReadTokens: telemetry.state.tokens.cacheReadTokens, cacheWriteTokens: null, reasoningTokens: telemetry.state.tokens.reasoningTokens, costSource: 'unknown' },
        contextOccupancy: totalTokens !== null && window && window > 0 ? totalTokens / window : null,
        contextCompactionBytes: telemetry.state.contextCompactions ? null : null,
        toolCalls: telemetry.state.toolCalls, toolErrors: telemetry.state.toolErrors, toolRetries: null,
        approvals: telemetry.state.approvals, subagentCount: null, subagentDepth: null, hookCalls: null, hookLatencyMs: null, hookContextBytes: null,
      },
      providerExtensions: {
        appServer: { modelProvider, protocol: 'v2', contextCompactions: telemetry.state.contextCompactions },
        workflow: { projectedSpendReserveUsd: projectedSpendReserve(request) },
      },
    };
  } catch (error) {
    if (threadId && turnId) await interruptThenClose(client, threadId, turnId, graceMs, nowMs);
    else await client.close();
    throw error;
  } finally {
    await client.close().catch(() => undefined);
  }
}

export async function assertCodexAppServerPreflight(repoRoot: string): Promise<void> {
  const client = spawnOwnedCodexAppServerClient(repoRoot);
  try {
    const init = await client.initialize();
    validateInitialize(init);
  } finally {
    await client.close().catch(() => undefined);
  }
}

async function nextRelevantEnvelope(client: CodexAppServerClient, deadlineMs: number, threadId: string, turnId: string): Promise<CodexAppServerEnvelope> {
  const envelope = await client.nextEnvelope(Math.max(1, deadlineMs - Date.now()));
  if (envelope.id !== undefined && typeof envelope.method === 'string') throw new Error(`codex app-server requested unsafe client action: ${envelope.method}`);
  if (!envelope.method) return envelope;
  const params = asObject(envelope.params);
  if (params.threadId !== threadId) return envelope;
  if (params.turnId && params.turnId !== turnId) return envelope;
  const turn = asObject(params.turn);
  if (turn.id && turn.id !== turnId) return envelope;
  return envelope;
}

async function interruptThenClose(client: CodexAppServerClient, threadId: string, turnId: string, graceMs: number, nowMs: () => number): Promise<void> {
  await client.interruptTurn(threadId, turnId).catch(() => undefined);
  const until = nowMs() + Math.max(1, graceMs);
  while (nowMs() < until) {
    const envelope = await client.nextEnvelope(Math.max(1, until - nowMs())).catch(() => null);
    if (envelope?.method === 'turn/completed') break;
  }
  await client.close();
}

function validateInitialize(value: { codexHome: string; platformFamily: string; platformOs: string; userAgent: string }): void {
  requireString(value.codexHome, 'initialize response.codexHome');
  requireString(value.platformFamily, 'initialize response.platformFamily');
  requireString(value.platformOs, 'initialize response.platformOs');
  requireString(value.userAgent, 'initialize response.userAgent');
}
function validateThread(value: { approvalPolicy: unknown; sandbox: unknown }): void {
  if (value.approvalPolicy !== 'never') throw new Error('codex app-server thread/start approvalPolicy must remain never');
  const sandbox = asObject(value.sandbox);
  if (sandbox.type !== 'readOnly') throw new Error('codex app-server thread/start sandbox must remain readOnly');
}
function reroutedModel(envelope: CodexAppServerEnvelope, threadId: string, turnId: string): string | null {
  if (envelope.method !== 'model/rerouted') return null;
  const params = asObject(envelope.params);
  if (params.threadId !== threadId || params.turnId !== turnId) return null;
  return typeof params.toModel === 'string' && params.toModel.trim() ? params.toModel.trim() : null;
}
function projectedSpendReserve(request: WorkflowTrialRequest): number | null {
  const spend = request.manifest.budget.projectedSpendUsd;
  return spend === null ? null : spend / request.manifest.budget.projectedCalls;
}
function requireString(value: unknown, label: string): string { if (typeof value !== 'string' || !value.trim()) throw new Error(`codex app-server missing ${label}`); return value.trim(); }
function asObject(value: unknown): Record<string, unknown> { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
