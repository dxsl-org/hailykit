import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runCodexAppServerBackend } from '../lib/benchmark/codex-app-server-backend';
import { createMockCodexAppServerClient } from './benchmark-codex-app-server-fixtures';
import type { WorkflowTrialRequest } from '../lib/benchmark/workflow-runner';

function request(): WorkflowTrialRequest {
  return {
    backend: 'codex_app_server',
    manifest: {
      provider: 'codex',
      requestedModel: 'gpt-5.4-mini',
      policy: 'read_only',
      budget: { projectedCalls: 2, projectedSpendUsd: 1, maxCalls: 2, maxSpendUsd: 2, maxWallMs: 5_000, maxOutputBytes: 10_000 },
    },
    fixture: { fixtureId: 'fixture', fixtureClass: 'workflow', fixtureHash: 'fh', promptHash: 'ph', prompt: 'prompt' },
    arm: 'base',
    pairId: 'pair',
    blockId: 'block',
    cwd: 'D:/hailykit',
    prompt: 'prompt',
    treatment: { bytes: 1, digest: 'digest', files: ['treatment.md'] },
    remainingBudget: { calls: 1, spendUsd: 1, wallMs: 5_000, outputBytes: 10_000 },
  } as WorkflowTrialRequest;
}

test('codex app-server backend aggregates token usage, TTFT, context occupancy, and tool errors', async () => {
  let now = 0;
  const { client } = createMockCodexAppServerClient({
    envelopes: [
      { method: 'item/agentMessage/delta', params: { threadId: 'thread-1', turnId: 'turn-1', itemId: 'm1', delta: 'hello' } },
      { method: 'item/reasoning/textDelta', params: { threadId: 'thread-1', turnId: 'turn-1', itemId: 'r1', contentIndex: 0, delta: 'reasoning' } },
      { method: 'thread/tokenUsage/updated', params: { threadId: 'thread-1', turnId: 'turn-1', tokenUsage: { total: { inputTokens: 20, outputTokens: 8, totalTokens: 28, cachedInputTokens: 4, reasoningOutputTokens: 3 }, last: { inputTokens: 20, outputTokens: 8, totalTokens: 28, cachedInputTokens: 4, reasoningOutputTokens: 3 }, modelContextWindow: 100 } } },
      { method: 'item/started', params: { threadId: 'thread-1', turnId: 'turn-1', startedAtMs: 1, item: { id: 'tool-1', type: 'commandExecution', status: 'inProgress' } } },
      { method: 'item/completed', params: { threadId: 'thread-1', turnId: 'turn-1', completedAtMs: 2, item: { id: 'tool-1', type: 'commandExecution', status: 'failed' } } },
      { method: 'item/started', params: { threadId: 'thread-1', turnId: 'turn-1', startedAtMs: 3, item: { id: 'compact-1', type: 'contextCompaction' } } },
      { method: 'item/completed', params: { threadId: 'thread-1', turnId: 'turn-1', completedAtMs: 4, item: { id: 'compact-1', type: 'contextCompaction' } } },
      { method: 'turn/completed', params: { threadId: 'thread-1', turn: { id: 'turn-1', status: 'completed' } } },
    ],
  });
  const response = await runCodexAppServerBackend(request(), { createClient: () => client, nowMs: () => (now += 10) });
  assert.equal(response.surface, 'app_server');
  assert.equal(response.backend, 'codex_app_server');
  assert.equal(response.modelVerified, true);
  assert.equal(response.metrics.ttftMs, 10);
  assert.equal(response.metrics.tokens.totalTokens, 28);
  assert.equal(response.metrics.tokens.cacheReadTokens, 4);
  assert.equal(response.metrics.tokens.reasoningTokens, 3);
  assert.equal(response.metrics.contextOccupancy, 0.28);
  assert.equal(response.metrics.toolCalls, 1);
  assert.equal(response.metrics.toolErrors, 1);
  assert.equal(response.metrics.outputBytes, 5);
  assert.equal(response.rawOutput, 'hello');
  assert.equal(((response.providerExtensions ?? {}).appServer as Record<string, unknown>).contextCompactions, 1);
});

test('codex app-server backend fails closed on server approval requests', async () => {
  const { client } = createMockCodexAppServerClient({ envelopes: [{ id: 7, method: 'item/commandExecution/requestApproval', params: { threadId: 'thread-1', turnId: 'turn-1' } }] });
  await assert.rejects(() => runCodexAppServerBackend(request(), { createClient: () => client, timeoutGraceMs: 1 }), /unsafe client action/);
});

test('codex app-server backend interrupts then closes on timeout', async () => {
  let interrupted = '';
  let closed = 0;
  const { client } = createMockCodexAppServerClient({
    envelopes: [],
    onInterrupt: (threadId, turnId) => { interrupted = `${threadId}:${turnId}`; },
    onClose: () => { closed += 1; },
  });
  await assert.rejects(() => runCodexAppServerBackend({ ...request(), remainingBudget: { calls: 1, spendUsd: 1, wallMs: 1, outputBytes: 10_000 } }, { createClient: () => client, timeoutGraceMs: 1 }), /timed out/);
  assert.equal(interrupted, 'thread-1:turn-1');
  assert.ok(closed >= 1);
});

test('codex app-server backend rejects malformed initialize responses and preserves unknown metrics when absent', async () => {
  const bad = createMockCodexAppServerClient({ initialize: { userAgent: '' } });
  await assert.rejects(() => runCodexAppServerBackend(request(), { createClient: () => bad.client }), /initialize response.userAgent/);
  const badThread = createMockCodexAppServerClient({ thread: { approvalPolicy: 'on-request' } });
  await assert.rejects(() => runCodexAppServerBackend(request(), { createClient: () => badThread.client }), /approvalPolicy must remain never/);
  const badSandbox = createMockCodexAppServerClient({ thread: { sandbox: { type: 'workspaceWrite' } } });
  await assert.rejects(() => runCodexAppServerBackend(request(), { createClient: () => badSandbox.client }), /sandbox must remain readOnly/);
  const good = createMockCodexAppServerClient({ envelopes: [{ method: 'turn/completed', params: { threadId: 'thread-1', turn: { id: 'turn-1', status: 'completed' } } }] });
  const response = await runCodexAppServerBackend(request(), { createClient: () => good.client });
  assert.equal(response.metrics.ttftMs, null);
  assert.equal(response.metrics.tokens.totalTokens, null);
  assert.equal(response.metrics.contextOccupancy, null);
});

test('reasoning-only deltas do not set TTFT, output bytes, or final answer', async () => {
  const { client } = createMockCodexAppServerClient({
    envelopes: [
      { method: 'item/reasoning/textDelta', params: { threadId: 'thread-1', turnId: 'turn-1', itemId: 'r1', contentIndex: 0, delta: 'reasoning' } },
      { method: 'turn/completed', params: { threadId: 'thread-1', turn: { id: 'turn-1', status: 'completed' } } },
    ],
  });
  const response = await runCodexAppServerBackend(request(), { createClient: () => client, nowMs: () => 100 });
  assert.equal(response.metrics.ttftMs, null);
  assert.equal(response.metrics.outputBytes, 0);
  assert.equal(response.rawOutput, null);
});

test('codex app-server backend marks rerouted models as unverified', async () => {
  const { client } = createMockCodexAppServerClient({
    envelopes: [
      { method: 'model/rerouted', params: { threadId: 'thread-1', turnId: 'turn-1', toModel: 'gpt-5.6' } },
      { method: 'turn/completed', params: { threadId: 'thread-1', turn: { id: 'turn-1', status: 'completed' } } },
    ],
  });
  const response = await runCodexAppServerBackend(request(), { createClient: () => client });
  assert.equal(response.actualModel, 'gpt-5.6');
  assert.equal(response.modelSatisfied, false);
  assert.equal(response.modelVerified, false);
  assert.equal(response.modelVerificationSource, 'unknown');
});

test('codex app-server backend interrupts when streamed output exceeds budget', async () => {
  let interrupted = '';
  const { client } = createMockCodexAppServerClient({
    envelopes: [{ method: 'item/agentMessage/delta', params: { threadId: 'thread-1', turnId: 'turn-1', itemId: 'm1', delta: 'hello' } }],
    onInterrupt: (threadId, turnId) => { interrupted = `${threadId}:${turnId}`; },
  });
  await assert.rejects(() => runCodexAppServerBackend({
    ...request(),
    remainingBudget: { calls: 1, spendUsd: 1, wallMs: 5_000, outputBytes: 4 },
  }, { createClient: () => client, timeoutGraceMs: 1 }), /maxOutputBytes exceeded/);
  assert.equal(interrupted, 'thread-1:turn-1');
});
