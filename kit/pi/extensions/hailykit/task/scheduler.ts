import { discoverTaskAgents } from './discovery.js';
import { buildPiInvocation, resultFromOutcome } from './invocation.js';
import { assertTaskDepth, assertTrustedScope, prepareTask } from './policy.js';
import { framePreviousOutput } from './previous.js';
import { type InvocationPort, type ParentTaskPolicy, type TaskRequest, type TaskResult } from './types.js';

async function withConcurrency<T>(items: readonly T[], concurrency: number, fn: (item: T, index: number) => Promise<TaskResult>): Promise<TaskResult[]> {
  const results: TaskResult[] = new Array(items.length);
  let next = 0;
  const workers = new Array(Math.min(concurrency, items.length)).fill(null).map(async () => {
    while (true) {
      const index = next++;
      if (index >= items.length) return;
      results[index] = await fn(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

export async function runTaskRequest(
  request: TaskRequest,
  parent: ParentTaskPolicy,
  globalAgentDir: string,
  port: InvocationPort,
  signal?: AbortSignal,
): Promise<{ results: TaskResult[]; projectAgentsDir: string | null }> {
  assertTaskDepth(parent);
  assertTrustedScope(request.scope, parent.trustedProject);
  const discovery = discoverTaskAgents(globalAgentDir, parent.cwd, request.scope);
  const runPrepared = async (index: number, previous?: string): Promise<TaskResult> => {
    const item = request.items[index];
    const prepared = prepareTask(
      { ...item, task: previous ? item.task.replace(/\{previous\}/g, framePreviousOutput(previous)) : item.task },
      index,
      discovery.agents,
      parent,
      request.timeoutMs,
      request.outputCapBytes,
    );
    if ('status' in prepared) return prepared;
    const invocation = buildPiInvocation(prepared);
    return resultFromOutcome(prepared, await port.invoke(invocation, signal));
  };
  const results = request.mode === 'chain'
    ? await request.items.reduce<Promise<TaskResult[]>>(async (promise, _item, index) => {
        const prior = await promise;
        if (index > 0 && prior[index - 1].status !== 'ok') return prior;
        const previous = index > 0 ? prior[index - 1].output : undefined;
        return [...prior, await runPrepared(index, previous)];
      }, Promise.resolve([]))
    : await withConcurrency(request.items, request.concurrency, async (_item, index) => runPrepared(index));
  return { results: results.sort((a, b) => a.index - b.index), projectAgentsDir: discovery.projectAgentsDir };
}
