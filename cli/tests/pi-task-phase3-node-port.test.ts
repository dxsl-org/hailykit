import { test } from 'node:test';
import assert from 'node:assert/strict';
import Module from 'node:module';
import { EventEmitter } from 'node:events';
import { loadTaskModule } from './pi-task-phase3-loader';

class FakeChild extends EventEmitter {
  stdout = new EventEmitter();
  stderr = new EventEmitter();
  kills: string[] = [];
  kill(signal: string): boolean {
    this.kills.push(signal);
    return true;
  }
}

test('Phase 3 node port waits for close after timeout and forwards wrapped pi argv', async () => {
  const nodeModule = Module as typeof Module & { _load: Function };
  const originalLoad = nodeModule._load;
  const child = new FakeChild();
  const calls: Array<{ command: string; args: string[] }> = [];
  nodeModule._load = function patched(request: string, parent: NodeModule | undefined, isMain: boolean) {
    if (request === 'node:child_process') {
      return { spawn: (command: string, args: string[]) => { calls.push({ command, args }); return child; } };
    }
    return originalLoad.call(this, request, parent, isMain);
  };
  try {
    const mod = await loadTaskModule<{ createNodeInvocationPort(): { invoke(call: Record<string, unknown>, signal?: AbortSignal): Promise<Record<string, unknown>> } }>('node-port.ts');
    const port = mod.createNodeInvocationPort();
    let settled = false;
    const pending = port.invoke({
      command: '/usr/bin/node\u0000/opt/pi/dist/cli.js',
      args: ['--mode', 'json', '-p', '--no-session', 'Task: slow'],
      cwd: process.cwd(),
      env: { HAILYKIT_PI_TASK_AGENT: 'reviewer' },
      timeoutMs: 15,
      outputCapBytes: 32,
    }).then((result) => { settled = true; return result; });
    await new Promise((resolve) => setTimeout(resolve, 30));
    assert.equal(settled, false);
    assert.deepEqual(calls[0], {
      command: '/usr/bin/node',
      args: ['/opt/pi/dist/cli.js', '--mode', 'json', '-p', '--no-session', 'Task: slow'],
    });
    assert.deepEqual(child.kills, ['SIGTERM']);
    child.emit('close', 143);
    const result = await pending;
    assert.equal(result.timedOut, true);
  } finally {
    nodeModule._load = originalLoad;
  }
});

test('Phase 3 node port bounds stdout and stderr incrementally', async () => {
  const nodeModule = Module as typeof Module & { _load: Function };
  const originalLoad = nodeModule._load;
  const child = new FakeChild();
  nodeModule._load = function patched(request: string, parent: NodeModule | undefined, isMain: boolean) {
    if (request === 'node:child_process') return { spawn: () => child };
    return originalLoad.call(this, request, parent, isMain);
  };
  try {
    const mod = await loadTaskModule<{ createNodeInvocationPort(): { invoke(call: Record<string, unknown>): Promise<Record<string, unknown>> } }>('node-port.ts');
    const pending = mod.createNodeInvocationPort().invoke({
      command: 'pi',
      args: ['Task: cap'],
      cwd: process.cwd(),
      env: { HAILYKIT_PI_TASK_AGENT: 'reviewer' },
      timeoutMs: 100,
      outputCapBytes: 16,
    });
    child.stdout.emit('data', 'abcdefghijklmnopq');
    child.stderr.emit('data', 'qrstuvwxyz0123456');
    child.emit('close', 1);
    const result = await pending;
    assert.equal(result.crashReason, 'Pi task output exceeded capture cap.');
    assert.equal(Buffer.byteLength(String(result.stdout), 'utf8') <= 16, true);
    assert.equal(Buffer.byteLength(String(result.stderr), 'utf8') <= 16, true);
    assert.deepEqual(child.kills, ['SIGTERM']);
  } finally {
    nodeModule._load = originalLoad;
  }
});
