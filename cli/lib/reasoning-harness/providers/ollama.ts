import type { ToolResult } from '../../spawn';
import type { ToolPolicyName } from '../types';
import { asRecord, emptyUsage, extractAnswer, numberField, safeJson } from './answer-json';
import type { ParsedOutput, ProviderAdapter, ProviderExecution } from './index';

const DEFAULT_HOST = 'http://127.0.0.1:11434';

/**
 * `/api/generate` has no tool-call loop at all: the request carries no tools and the
 * response is plain text, so the model cannot reach the filesystem by construction. That
 * holds for every requested policy — a `read_only` row simply gets less capability than
 * it was allowed, which the row's policy check treats as safe.
 */
function enforcedPolicy(_requested: ToolPolicyName): ToolPolicyName {
  return 'none';
}

/**
 * Local inference over HTTP, so nothing leaves the machine. A refused connection surfaces as
 * `tool_not_found` (ollama is not running) rather than a hard throw, matching the CLI adapters.
 * @throws never — transport failures are returned as a ToolResult error.
 */
async function run(req: ProviderExecution): Promise<ToolResult> {
  const host = (process.env.OLLAMA_HOST ?? DEFAULT_HOST).replace(/\/+$/, '');
  const url = /^https?:\/\//.test(host) ? host : `http://${host}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), req.timeoutMs);
  try {
    const res = await fetch(`${url}/api/generate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: req.requestedModel, prompt: req.prompt, stream: false, options: { temperature: 0 } }),
      signal: controller.signal,
    });
    const body = await res.text();
    return { ok: res.ok, status: res.ok ? 0 : res.status, stdout: body, stderr: res.ok ? '' : `ollama HTTP ${res.status}` };
  } catch (error) {
    const message = String((error as Error).message);
    const unreachable = /ECONNREFUSED|fetch failed|ENOTFOUND/i.test(message);
    return { ok: false, status: null, stdout: '', stderr: message, error: unreachable ? 'tool_not_found' : 'spawn_failed' };
  } finally {
    clearTimeout(timer);
  }
}

function parse(stdout: string): ParsedOutput {
  const root = asRecord(safeJson(stdout));
  const response = typeof root?.response === 'string' ? root.response : '';
  const inputTokens = numberField(root, ['prompt_eval_count']);
  const outputTokens = numberField(root, ['eval_count']);
  return {
    answer: response ? extractAnswer(response) : null,
    modelId: typeof root?.model === 'string' ? root.model : null,
    usage: inputTokens === null && outputTokens === null
      ? emptyUsage()
      : { inputTokens, outputTokens, totalTokens: (inputTokens ?? 0) + (outputTokens ?? 0), costUsd: 0 },
  };
}

export const ollamaAdapter: ProviderAdapter = { id: 'ollama', enforcedPolicy, run, parse };
