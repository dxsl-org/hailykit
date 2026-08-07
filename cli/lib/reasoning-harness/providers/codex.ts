import { runTool, type ToolResult } from '../../spawn';
import type { ToolPolicyName } from '../types';
import { parseCodexJsonOutput } from './codex-json';
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
  const parsed = parseCodexJsonOutput(stdout);
  return {
    answer: parsed.answer,
    modelId: parsed.modelId,
    usage: parsed.usage,
  };
}

export const codexAdapter: ProviderAdapter = { id: 'codex', enforcedPolicy, run, parse };
