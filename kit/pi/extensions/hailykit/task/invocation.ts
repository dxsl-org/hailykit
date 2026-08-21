import * as fs from 'node:fs';
import { type InvocationOutcome, type PiInvocation, type PreparedTask, type TaskResult } from './types.js';

function truncateUtf8(text: string, capBytes: number): string {
  if (Buffer.byteLength(text, 'utf8') <= capBytes) return text;
  let next = text.slice(0, capBytes);
  while (Buffer.byteLength(next, 'utf8') > capBytes) next = next.slice(0, -1);
  return `${next}\n\n[HailyKit task output truncated to ${capBytes} bytes.]`;
}

function finalAssistantText(stdout: string): { output: string; model?: string } {
  let output = '';
  let model: string | undefined;
  for (const line of stdout.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const event = JSON.parse(line) as Record<string, unknown>;
      const message = event['message'] as Record<string, unknown> | undefined;
      if (event['type'] !== 'message_end' || !message || message['role'] !== 'assistant') continue;
      const content = Array.isArray(message['content']) ? message['content'] as Array<Record<string, unknown>> : [];
      for (const part of content) if (part['type'] === 'text' && typeof part['text'] === 'string') output = part['text'];
      if (typeof message['model'] === 'string') model = message['model'];
    } catch {}
  }
  return { output, model };
}

function resolvePiCommand(runtime = { execPath: process.execPath, argv: process.argv }): string {
  const runner = runtime.argv[1];
  if (runner && !runner.startsWith('bun:') && fs.existsSync(runner)) {
    return `${runtime.execPath}\0${runner}`;
  }
  if (!/[/\\](node|bun|tsx|ts-node)(?:\.exe)?$/i.test(runtime.execPath)) return runtime.execPath;
  return 'pi';
}

export function buildPiInvocation(task: PreparedTask, promptPath?: string, runtime?: { execPath: string; argv: string[] }): PiInvocation {
  const args = ['--mode', 'json', '-p', '--no-session'];
  if (task.model) args.push('--model', task.model);
  if (task.thinking) args.push('--thinking', task.thinking);
  if (task.toolNames.length) args.push('--tools', task.toolNames.join(','));
  if (promptPath) args.push('--append-system-prompt', promptPath);
  args.push(`Task: ${task.item.task}`);
  return {
    command: resolvePiCommand(runtime),
    args,
    cwd: task.cwd,
    env: {
      HAILYKIT_PI_TASK_DEPTH: String(task.depth),
      HAILYKIT_PI_TASK_ALLOWED_AGENTS: task.allowedAgents.join(','),
      HAILYKIT_PI_TASK_AGENT: task.agent.name,
    },
    systemPrompt: task.agent.systemPrompt,
    timeoutMs: task.timeoutMs,
    outputCapBytes: task.outputCapBytes,
  };
}

export function resultFromOutcome(task: PreparedTask, outcome: InvocationOutcome): TaskResult {
  const parsed = finalAssistantText(outcome.stdout);
  const status = outcome.aborted ? 'aborted'
    : outcome.timedOut ? 'timeout'
    : outcome.crashReason ? 'crash'
    : outcome.exitCode === 0 ? 'ok'
    : 'error';
  const output = truncateUtf8(parsed.output || outcome.stderr || '(no output)', task.outputCapBytes);
  return {
    index: task.index,
    agent: task.agent.name,
    source: task.agent.source,
    status,
    output,
    stderr: outcome.stderr,
    model: parsed.model ?? task.model,
    toolNames: task.toolNames,
    allowedAgents: task.allowedAgents,
  };
}
