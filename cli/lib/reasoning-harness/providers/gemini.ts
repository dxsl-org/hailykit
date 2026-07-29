import fs from 'node:fs';
import path from 'node:path';
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

const MAX_REPORT_BYTES = 256 * 1024;

/**
 * Recover the real failure text. On error the CLI emits `"message": "[object Object]"` and prints
 * `Full report available at: <path>.json`, with the actual cause only inside that file — which is
 * how an exhausted quota reached an artifact as an unexplained non-zero exit.
 *
 * Only an absolute `.json` path is followed, only up to a size cap, and only the first useful
 * `message` string is returned. The caller passes whatever comes back through the same secret
 * scan as any other persisted note.
 */
function diagnose(res: ToolResult): string | null {
  const match = /Full report available at:\s*(\S+\.json)/i.exec(`${res.stderr}\n${res.stdout}`);
  const file = match?.[1];
  if (!file || !path.isAbsolute(file)) return null;
  try {
    if (fs.statSync(file).size > MAX_REPORT_BYTES) return null;
    const raw = fs.readFileSync(file, 'utf8');
    for (const hit of raw.match(/"message"\s*:\s*"([^"]{1,300})"/g) ?? []) {
      const text = /"message"\s*:\s*"([^"]{1,300})"/.exec(hit)?.[1];
      if (text && text !== '[object Object]') return text;
    }
  } catch { /* the report is a courtesy, not a contract */ }
  return null;
}

export const geminiAdapter: ProviderAdapter = { id: 'gemini', enforcedPolicy, run, parse, diagnose };
