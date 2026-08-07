export type HookReplayMode = 'claude-source' | 'codex-installed';
export type HookReplayOutcome = 'emitted' | 'intentional_skip' | 'malformed_input_fail_open' | 'timeout_fail_open' | 'crash_fail_open' | 'unexpected_no_output';

export interface HookFixture {
  id: string;
  mode: HookReplayMode;
  eventName: string;
  scriptRelativePath: string;
  stdin: string;
  env?: Record<string, string>;
  expectsOutput: boolean;
  expectedOutcome?: HookReplayOutcome;
  note?: string;
}

export const HOOK_EVENTS_IN_SETTINGS = [
  'SessionStart',
  'SubagentStart',
  'SubagentStop',
  'UserPromptSubmit',
  'PostToolUse',
  'PreToolUse',
  'Stop',
  'SessionEnd',
] as const;

export function buildCanonicalHookFixtures(): HookFixture[] {
  return [
    sourceFixture('session-start-source', 'SessionStart', 'haily-session.cjs', {
      hook_event_name: 'SessionStart', source: 'startup', session_id: 'sess-bench', model: 'claude-sonnet-4-6',
    }, true),
    sourceFixture('subagent-start-source', 'SubagentStart', 'haily-subagent.cjs', {
      hook_event_name: 'SubagentStart', session_id: 'sess-bench', agent_type: 'haily-researcher', agent_id: 'agent-1',
    }, true),
    sourceFixture('subagent-stop-source', 'SubagentStop', 'haily-state.cjs', {
      hook_event_name: 'SubagentStop', session_id: 'sess-bench',
    }, false, 'intentional_skip'),
    sourceFixture('user-prompt-submit-source', 'UserPromptSubmit', 'haily-usage.cjs', {
      hook_event_name: 'UserPromptSubmit', session_id: 'sess-bench', prompt: 'benchmark prompt',
    }, true),
    sourceFixture('post-tool-use-source', 'PostToolUse', 'haily-audit.cjs', {
      hook_event_name: 'PostToolUse', session_id: 'sess-bench', tool_name: 'Read', tool_input: { file_path: 'docs/engineering-standards.md' },
    }, true),
    sourceFixture('pre-tool-use-source', 'PreToolUse', 'haily-access.cjs', {
      hook_event_name: 'PreToolUse', tool_name: 'Read', tool_input: { file_path: 'docs/engineering-standards.md' },
    }, false, 'intentional_skip'),
    sourceFixture('stop-source', 'Stop', 'haily-state.cjs', {
      hook_event_name: 'Stop', session_id: 'sess-bench',
    }, true),
    sourceFixture('session-end-source', 'SessionEnd', 'haily-audit.cjs', {
      hook_event_name: 'SessionEnd', session_id: 'sess-bench',
    }, false, 'intentional_skip'),
  ];
}

function sourceFixture(
  id: string,
  eventName: string,
  scriptRelativePath: string,
  payload: Record<string, unknown>,
  expectsOutput: boolean,
  expectedOutcome?: HookReplayOutcome,
): HookFixture {
  return {
    id,
    mode: 'claude-source',
    eventName,
    scriptRelativePath,
    stdin: JSON.stringify(payload),
    expectsOutput,
    expectedOutcome,
  };
}
