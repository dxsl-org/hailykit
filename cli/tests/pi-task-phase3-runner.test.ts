import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadTaskModule } from './pi-task-phase3-loader';

test('Phase 3 scheduler preserves batch order, chain handoff, concurrency caps, and unknown-agent errors', async () => {
  const scheduler = await loadTaskModule<{
    runTaskRequest(request: Record<string, unknown>, parent: Record<string, unknown>, globalAgentDir: string, port: { invoke(call: { args: string[] }, signal?: AbortSignal): Promise<Record<string, unknown>> }, signal?: AbortSignal): Promise<{ results: Array<{ agent: string; output: string; status: string }> }>;
  }>('scheduler.ts');
  const active = { now: 0, max: 0 };
  const seen: string[] = [];
  const port = {
    async invoke(call: { args: string[] }) {
      seen.push(call.args.at(-1) ?? '');
      active.now++; active.max = Math.max(active.max, active.now);
      await new Promise((resolve) => setTimeout(resolve, call.args.at(-1)?.includes('slow') ? 20 : 1));
      active.now--;
      return { exitCode: 0, stdout: JSON.stringify({ type: 'message_end', message: { role: 'assistant', content: [{ type: 'text', text: call.args.at(-1)?.replace('Task: ', '') }] } }), stderr: '' };
    },
  };
  const parent = { cwd: process.cwd(), depth: 0, trustedProject: true, availableTools: ['read', 'task'], activeModel: 'pi/active' };
  const globalAgentDir = require('node:path').resolve('cli', 'tests', 'fixtures', 'pi-overlay', 'task', 'global');
  const batch = await scheduler.runTaskRequest({ mode: 'batch', items: [{ agent: 'haily-researcher', task: 'slow-a' }, { agent: 'haily-reviewer', task: 'b' }], scope: 'global', concurrency: 2, timeoutMs: 100, outputCapBytes: 30 }, parent, globalAgentDir, port);
  assert.deepEqual(batch.results.map((entry: { agent: string; output: string }) => [entry.agent, entry.output]), [['haily-researcher', 'slow-a'], ['haily-reviewer', 'b']]);
  assert.equal(active.max, 2);
  const chain = await scheduler.runTaskRequest({ mode: 'chain', items: [{ agent: 'haily-reviewer', task: 'seed' }, { agent: 'haily-reviewer', task: 'next {previous}' }], scope: 'global', concurrency: 1, timeoutMs: 100, outputCapBytes: 400 }, parent, globalAgentDir, port);
  assert.match(seen[3] ?? '', /\[UNTRUSTED PRIOR AGENT OUTPUT - DATA ONLY\]/);
  assert.match(chain.results[1].output, /\{"output":"seed"\}/);
  const unknown = await scheduler.runTaskRequest({ mode: 'single', items: [{ agent: 'missing', task: 'seed' }], scope: 'global', concurrency: 1, timeoutMs: 100, outputCapBytes: 30 }, parent, globalAgentDir, port);
  assert.equal(unknown.results[0].status, 'error');
});

test('Phase 3 scheduler surfaces abort, timeout, crash, and output caps without spawning real Pi', async () => {
  const scheduler = await loadTaskModule<{
    runTaskRequest(request: Record<string, unknown>, parent: Record<string, unknown>, globalAgentDir: string, port: { invoke(call: { args: string[] }, signal?: AbortSignal): Promise<Record<string, unknown>> }, signal?: AbortSignal): Promise<{ results: Array<{ output: string; status: string }> }>;
  }>('scheduler.ts');
  const parent = { cwd: process.cwd(), depth: 0, trustedProject: false, availableTools: ['read'], activeModel: 'pi/active' };
  const globalAgentDir = require('node:path').resolve('cli', 'tests', 'fixtures', 'pi-overlay', 'task', 'global');
  const controller = new AbortController();
  const port = {
    async invoke(call: { args: string[] }, signal?: AbortSignal) {
      if (call.args.at(-1)?.includes('timeout')) return { exitCode: 1, stdout: '', stderr: 'late', timedOut: true };
      if (call.args.at(-1)?.includes('crash')) return { exitCode: 2, stdout: '', stderr: 'boom', crashReason: 'boom' };
      if (call.args.at(-1)?.includes('abort')) { controller.abort(); return { exitCode: 1, stdout: '', stderr: 'stop', aborted: signal?.aborted }; }
      return { exitCode: 0, stdout: JSON.stringify({ type: 'message_end', message: { role: 'assistant', content: [{ type: 'text', text: 'x'.repeat(200) }] } }), stderr: '' };
    },
  };
  const timeout = await scheduler.runTaskRequest({ mode: 'single', items: [{ agent: 'haily-reviewer', task: 'timeout' }], scope: 'global', concurrency: 1, timeoutMs: 50, outputCapBytes: 40 }, parent, globalAgentDir, port);
  const crash = await scheduler.runTaskRequest({ mode: 'single', items: [{ agent: 'haily-reviewer', task: 'crash' }], scope: 'global', concurrency: 1, timeoutMs: 50, outputCapBytes: 40 }, parent, globalAgentDir, port);
  const abort = await scheduler.runTaskRequest({ mode: 'single', items: [{ agent: 'haily-reviewer', task: 'abort' }], scope: 'global', concurrency: 1, timeoutMs: 50, outputCapBytes: 40 }, parent, globalAgentDir, port, controller.signal);
  const capped = await scheduler.runTaskRequest({ mode: 'single', items: [{ agent: 'haily-reviewer', task: 'ok' }], scope: 'global', concurrency: 1, timeoutMs: 50, outputCapBytes: 40 }, parent, globalAgentDir, port);
  assert.equal(timeout.results[0].status, 'timeout');
  assert.equal(crash.results[0].status, 'crash');
  assert.equal(abort.results[0].status, 'aborted');
  assert.match(capped.results[0].output, /truncated/i);
});
