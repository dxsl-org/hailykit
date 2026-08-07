import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCodexJsonOutput } from '../lib/reasoning-harness/providers/codex-json';

test('parses current turn.completed usage and derives total without double-counting subsets', () => {
  const stdout = [
    JSON.stringify({ type: 'response.created', response: { model: 'gpt-5.4-mini' } }),
    JSON.stringify({ type: 'agent_message.delta', delta: '{"verdict":"fail","summary":"retry failure is evidenced","evidence":{"snippet_line":"if (attempt < 3) return chargeAgain();","root_cause":"retry loop hides the payment failure"},"escalation":{"requested":false,"justification":null},"rollback":{"required":false,"scope":[]}}' }),
    JSON.stringify({ type: 'turn.completed', usage: { input_tokens: 12, cached_input_tokens: 5, output_tokens: 7, reasoning_output_tokens: 3 } }),
  ].join('\n');
  const parsed = parseCodexJsonOutput(stdout);
  assert.equal(parsed.modelId, 'gpt-5.4-mini');
  assert.equal(parsed.answer?.includes('"verdict":"fail"'), true);
  assert.deepEqual(parsed.usage, { inputTokens: 12, outputTokens: 7, totalTokens: 19, costUsd: null });
  assert.equal(parsed.cacheReadTokens, 5);
  assert.equal(parsed.reasoningTokens, 3);
  assert.equal(parsed.hasProviderCost, false);
});

test('preserves legacy response.completed totals and explicit cost', () => {
  const stdout = JSON.stringify({
    type: 'response.completed',
    response: { model: 'legacy-model' },
    output: [{ content: [{ text: '{"verdict":"pass","summary":"ok","evidence":{"key":"value"},"escalation":{"requested":false,"justification":null},"rollback":{"required":false,"scope":[]}}' }] }],
    usage: { input_tokens: 12, output_tokens: 7, total_tokens: 25, cost_usd: 0.04 },
  });
  const parsed = parseCodexJsonOutput(stdout);
  assert.equal(parsed.modelId, 'legacy-model');
  assert.deepEqual(parsed.usage, { inputTokens: 12, outputTokens: 7, totalTokens: 25, costUsd: 0.04 });
  assert.equal(parsed.hasProviderCost, true);
});

test('keeps model and cost null when the provider did not emit them', () => {
  const stdout = JSON.stringify({ type: 'turn.completed', usage: { input_tokens: 9, output_tokens: 4 } });
  const parsed = parseCodexJsonOutput(stdout);
  assert.equal(parsed.modelId, null);
  assert.deepEqual(parsed.usage, { inputTokens: 9, outputTokens: 4, totalTokens: 13, costUsd: null });
  assert.equal(parsed.hasProviderCost, false);
});
