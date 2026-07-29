import { runTool, type ToolResult } from '../../spawn';
import type { EvalUsage, ToolPolicyName } from '../types';
import { emptyUsage, extractAnswer, isAnswer, numberField, safeJson, walkable } from './answer-json';
import type { ParsedOutput, ProviderAdapter, ProviderExecution } from './index';

/**
 * Codex has no no-tool sandbox mode — `-s` accepts only read-only, workspace-write,
 * and danger-full-access. A `none` row is therefore enforced by rooting the read-only
 * sandbox at an empty directory outside the repo.
 *
 * NOTE: the equivalent claim was probed directly on the gemini CLI (a read of a repo path came
 * back denied) but never on codex, so codex `none` rows rest on the sandbox flag behaving as
 * documented rather than on an observation.
 */
function enforcedPolicy(requested: ToolPolicyName): ToolPolicyName {
  return requested === 'none' ? 'none' : 'read_only';
}

/**
 * `--ignore-user-config` / `--ignore-rules` keep a developer's `config.toml` (model,
 * sandbox, hooks, execpolicy) out of the measurement; `--skip-git-repo-check` is required
 * because a `none` row's workspace is an empty non-git directory; `--ephemeral` leaves no
 * session files behind. `codex exec` is already non-interactive and rejects
 * `-a/--ask-for-approval` as an unknown argument — approval defaults to never.
 */
function run(req: ProviderExecution): ToolResult {
  return runTool('codex', ['exec', '-m', req.requestedModel, '--json', '-s', 'read-only',
    '--ignore-user-config', '--ignore-rules', '--skip-git-repo-check', '--ephemeral', '-'], {
    cwd: req.workspaceCwd,
    denyRoot: req.cwd,
    allowEnv: ['OPENAI_API_KEY'],
    input: req.prompt,
    timeoutMs: req.timeoutMs,
  });
}

/** Parse `--json` NDJSON events. The last event carrying each field wins. */
function parse(stdout: string): ParsedOutput {
  const events = stdout.split('\n').map((line) => line.trim()).filter((line) => line.startsWith('{'))
    .flatMap((line) => { const parsed = safeJson(line); return parsed ? [parsed] : []; })
    .reverse();
  return {
    answer: firstOf(events, findAnswer),
    modelId: firstOf(events, findModel),
    usage: firstOf(events, findUsage) ?? emptyUsage(),
  };
}

function firstOf<T>(events: unknown[], pick: (value: unknown) => T | null): T | null {
  for (const event of events) { const found = pick(event); if (found) return found; }
  return null;
}

function findAnswer(value: unknown): string | null {
  if (isAnswer(value)) return JSON.stringify(value);
  if (typeof value === 'string') return extractAnswer(value);
  const record = walkable(value);
  if (!record) return null;
  for (const child of Object.values(record)) { const found = findAnswer(child); if (found) return found; }
  return null;
}

function findModel(value: unknown): string | null {
  const record = walkable(value);
  if (!record) return null;
  if (typeof record.model === 'string' && record.model.trim()) return record.model.trim();
  for (const child of Object.values(record)) { const found = findModel(child); if (found) return found; }
  return null;
}

function findUsage(value: unknown): EvalUsage | null {
  const record = walkable(value);
  if (!record) return null;
  const usage: EvalUsage = {
    inputTokens: numberField(record, ['input_tokens', 'inputTokens']),
    outputTokens: numberField(record, ['output_tokens', 'outputTokens']),
    totalTokens: numberField(record, ['total_tokens', 'totalTokens']),
    costUsd: numberField(record, ['cost_usd', 'costUsd']),
  };
  if (usage.totalTokens !== null || usage.costUsd !== null) return usage;
  for (const child of Object.values(record)) { const found = findUsage(child); if (found) return found; }
  return null;
}

export const codexAdapter: ProviderAdapter = { id: 'codex', enforcedPolicy, run, parse };
