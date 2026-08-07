import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runLiveWorkflowProvider } from '../lib/benchmark/workflow-provider';
import type { WorkflowTrialRequest } from '../lib/benchmark/workflow-runner';
import { claudeAdapter } from '../lib/reasoning-harness/providers/claude';

test('runLiveWorkflowProvider preserves Claude cache and reasoning breakdowns', async () => {
  const originalRun = claudeAdapter.run;
  claudeAdapter.run = () => ({
    ok: true,
    status: 0,
    stdout: JSON.stringify({
      result: '{"verdict":"pass","summary":"ok","evidence":{"key":"value"},"escalation":{"requested":false,"justification":null},"rollback":{"required":false,"scope":[]}}',
      usage: {
        input_tokens: 10,
        cache_read_input_tokens: 4,
        cache_creation_input_tokens: 2,
        output_tokens: 6,
        reasoning_tokens: 3,
      },
      total_cost_usd: 0.12,
    }),
    stderr: '',
  });
  try {
    const response = await runLiveWorkflowProvider({
      manifest: { provider: 'claude', requestedModel: 'claude-sonnet-4-20250514' },
      fixture: { fixtureId: 'fixture', fixtureClass: 'workflow', fixtureHash: 'fixture-hash', promptHash: 'prompt-hash', prompt: 'prompt' },
      arm: 'base',
      pairId: 'pair',
      blockId: 'block',
      cwd: process.cwd(),
      prompt: 'prompt',
      treatment: { bytes: 1, digest: 'digest', files: ['treatment.md'] },
      remainingBudget: { calls: 1, spendUsd: 1, wallMs: 10_000, outputBytes: 10_000 },
    } as WorkflowTrialRequest);
    assert.equal(response.metrics.tokens.cacheReadTokens, 4);
    assert.equal(response.metrics.tokens.cacheWriteTokens, 2);
    assert.equal(response.metrics.tokens.reasoningTokens, 3);
    assert.equal(response.metrics.tokens.costSource, 'provider');
  } finally {
    claudeAdapter.run = originalRun;
  }
});
