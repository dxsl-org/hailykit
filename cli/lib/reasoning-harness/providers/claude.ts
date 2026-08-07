import { runTool, type ToolResult } from '../../spawn';
import type { ToolPolicyName } from '../types';
import { asRecord, emptyUsage, extractAnswer, numberField, safeJson } from './answer-json';
import type { ParsedOutput, ProviderAdapter, ProviderExecution } from './index';

/** Tools whose absence makes a `none` row real. Named explicitly so a new tool does not
 *  silently widen the policy — an unrecognised tool would still be allowed, so this list is
 *  the enforcement boundary and must be reviewed when the CLI gains capabilities. */
const DENIED_TOOLS = ['Bash', 'Read', 'Write', 'Edit', 'NotebookEdit', 'Glob', 'Grep',
  'WebFetch', 'WebSearch', 'Task'];
const READ_ONLY_DENIED_TOOLS = ['Bash', 'Write', 'Edit', 'NotebookEdit', 'WebFetch', 'WebSearch', 'Task'];

/**
 * Claude Code confines file tools to its working directory, so a `none` row is enforced by the
 * empty throwaway workspace plus an explicit deny list. Probed 2026-07-29 from an empty cwd: a
 * request to read a repo path came back "TOOL_DENIED: Read tool not available in current session
 * context." An earlier draft listed `MultiEdit`, which the CLI rejected as matching no known tool
 * and printed as a warning on stdout ahead of the JSON body — every name here must be one the CLI
 * recognises, or the deny silently covers nothing.
 */
function enforcedPolicy(requested: ToolPolicyName): ToolPolicyName {
  return requested === 'none' ? 'none' : 'read_only';
}

/**
 * `--settings '{}'` is the load-bearing flag. Without it the CLI injects the user's rules and
 * standards — 62k tokens measured, including a directive that prepends a trace line to every
 * reply. That is the very content this eval varies, so leaving it in would put the treatment in
 * both arms and corrupt the comparison. `--strict-mcp-config` keeps connected servers out.
 */
function run(req: ProviderExecution): ToolResult {
  const args = ['-p', '--model', req.requestedModel, '--output-format', 'json',
    '--settings', '{}', '--strict-mcp-config'];
  args.push('--disallowedTools', ...(req.policy === 'none' ? DENIED_TOOLS : READ_ONLY_DENIED_TOOLS));
  return runTool('claude', args, {
    cwd: req.workspaceCwd,
    denyRoot: req.cwd,
    allowEnv: ['ANTHROPIC_API_KEY', 'CLAUDE_CODE_OAUTH_TOKEN'],
    input: req.prompt,
    timeoutMs: req.timeoutMs,
  });
}

/**
 * `--output-format json` wraps the reply in a result envelope carrying usage and real cost.
 *
 * NOTE: the envelope reports no model id, so `modelId` is null and the row's model check cannot
 * confirm which model answered — unlike codex and gemini, where the served model is echoed. A
 * `--model` mismatch would go unnoticed here.
 */
function parse(stdout: string): ParsedOutput {
  const root = asRecord(safeJson(stripPreamble(stdout)));
  const text = typeof root?.result === 'string' ? root.result : '';
  const usage = asRecord(root?.usage);
  const input = (numberField(usage, ['input_tokens']) ?? 0)
    + (numberField(usage, ['cache_creation_input_tokens']) ?? 0)
    + (numberField(usage, ['cache_read_input_tokens']) ?? 0);
  const output = numberField(usage, ['output_tokens']);
  return {
    answer: text ? extractAnswer(text) : null,
    modelId: null,
    usage: usage
      ? {
        inputTokens: input || null,
        outputTokens: output,
        totalTokens: input || output !== null ? input + (output ?? 0) : null,
        costUsd: numberField(root, ['total_cost_usd']),
      }
      : emptyUsage(),
  };
}

/** The CLI can print notices before the JSON body. */
function stripPreamble(stdout: string): string {
  const start = stdout.indexOf('{');
  return start === -1 ? stdout : stdout.slice(start);
}

/** An error envelope keeps the cause in `result`, which the generic classifier does not read. */
function diagnose(res: ToolResult): string | null {
  const root = asRecord(safeJson(stripPreamble(res.stdout)));
  if (root?.is_error !== true) return null;
  const status = typeof root.api_error_status === 'string' ? root.api_error_status : '';
  const text = typeof root.result === 'string' ? root.result : '';
  return [status, text].filter(Boolean).join(': ') || null;
}

export const claudeAdapter: ProviderAdapter = { id: 'claude', enforcedPolicy, run, parse, diagnose };
