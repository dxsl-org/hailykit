import { runTool, type ToolResult } from '../../spawn';
import type { ToolPolicyName } from '../types';
import { asRecord, emptyUsage, extractAnswer, numberField, safeJson } from './answer-json';
import type { ParsedOutput, ProviderAdapter, ProviderExecution } from './index';

/**
 * The gemini CLI confines file tools to its workspace directories. Probed 2026-07-27 from an
 * empty temp cwd, a read of a repo path was refused with "File path must be within one of the
 * workspace directories", so rooting the run at an empty directory genuinely yields no repo
 * access. `--approval-mode default` additionally requires confirmation for every tool call,
 * which a non-interactive run can never grant.
 */
function enforcedPolicy(requested: ToolPolicyName): ToolPolicyName {
  return requested === 'none' ? 'none' : 'read_only';
}

function run(req: ProviderExecution): ToolResult {
  return runTool('gemini', ['-m', req.requestedModel, '--approval-mode', 'default', '-o', 'json'], {
    cwd: req.workspaceCwd,
    denyRoot: req.cwd,
    allowEnv: ['GEMINI_API_KEY', 'GOOGLE_API_KEY'],
    input: req.prompt,
    timeoutMs: req.timeoutMs,
  });
}

/**
 * `-o json` emits one object: `response` holds the model text, `stats.models` is keyed by the
 * model that actually served the request — which is what the row's model check compares against.
 */
function parse(stdout: string): ParsedOutput {
  const root = asRecord(safeJson(stripPreamble(stdout)));
  const response = typeof root?.response === 'string' ? root.response : '';
  const models = asRecord(asRecord(root?.stats)?.models);
  const modelId = models ? Object.keys(models)[0] ?? null : null;
  const tokens = asRecord(asRecord(modelId ? models?.[modelId] : undefined)?.tokens);
  return {
    answer: response ? extractAnswer(response) : null,
    modelId,
    usage: tokens
      ? {
        inputTokens: numberField(tokens, ['prompt']),
        outputTokens: numberField(tokens, ['candidates']),
        totalTokens: numberField(tokens, ['total']),
        costUsd: null,
      }
      : emptyUsage(),
  };
}

/** The CLI prints credential/notice lines before the JSON body. */
function stripPreamble(stdout: string): string {
  const start = stdout.indexOf('{');
  return start === -1 ? stdout : stdout.slice(start);
}

export const geminiAdapter: ProviderAdapter = { id: 'gemini', enforcedPolicy, run, parse };
