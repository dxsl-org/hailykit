import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import Module from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { loadTaskModule } from './pi-task-phase3-loader';

const repoMap = path.resolve('kit', 'pi', 'extensions', 'hailykit', 'model-map.json');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'haily-pi-phase4-'));

function patchLoader(agentDir: string): () => void {
  const nodeModule = Module as typeof Module & { _load: Function };
  const originalLoad = nodeModule._load;
  nodeModule._load = function patched(request: string, parent: NodeModule | undefined, isMain: boolean) {
    if (request === '@earendil-works/pi-ai') return { StringEnum: (value: unknown) => value };
    if (request === '@earendil-works/pi-coding-agent') return { CONFIG_DIR_NAME: '.pi', getAgentDir: () => agentDir };
    if (request === 'typebox') return { Type: { Object: (v: unknown) => v, String: () => ({}), Optional: (v: unknown) => v, Array: (v: unknown) => v, Integer: () => ({}) } };
    return originalLoad.call(this, request, parent, isMain);
  };
  return () => { nodeModule._load = originalLoad; };
}

async function runEvent(handlers: Function[] | undefined, event: Record<string, unknown>, ctx: Record<string, unknown>): Promise<Record<string, unknown> | undefined> {
  for (const handler of handlers ?? []) {
    const result = await handler(event, ctx);
    if (result) return result as Record<string, unknown>;
  }
}

test('Phase 4 plan mode persists, resumes, and blocks mutation tools', async () => {
  const root = tmp();
  fs.writeFileSync(path.join(root, 'settings.json'), JSON.stringify({ hailykit: { modules: { task: false, presets: false, diagnostics: false }, plan: { readOnlyTools: ['read'] } } }));
  fs.mkdirSync(path.join(root, 'extensions', 'hailykit'), { recursive: true });
  fs.copyFileSync(repoMap, path.join(root, 'extensions', 'hailykit', 'model-map.json'));
  const restore = patchLoader(root);
  try {
    const mod = await loadTaskModule<{ default(pi: Record<string, Function>): void }>('index.ts');
    const commands = new Map<string, Function>();
    const events = new Map<string, Function[]>();
    const tools: string[][] = [];
    const entries: Array<{ customType: string; data: Record<string, unknown> }> = [];
    mod.default({
      registerTool: () => undefined,
      registerCommand: (name: string, spec: { handler: Function }) => commands.set(name, spec.handler),
      on: (name: string, fn: Function) => events.set(name, [...(events.get(name) ?? []), fn]),
      getActiveTools: () => ['read', 'write'],
      setActiveTools: (next: string[]) => tools.push(next),
      appendEntry: (customType: string, data: Record<string, unknown>) => entries.push({ customType, data }),
      exec: async () => ({ code: 0, stdout: '', stderr: '' }),
    });
    await commands.get('plan')?.('on', { ui: { notify: () => undefined }, sessionManager: { getEntries: () => [] } });
    assert.deepEqual(tools[0], ['read']);
    assert.equal(entries[0].customType, 'hailykit-plan-state');
    const denied = await runEvent(events.get('tool_call'), { toolName: 'write', input: { path: 'x.ts' } }, { cwd: root, isProjectTrusted: () => true, sessionManager: { getEntries: () => [] }, ui: { confirm: async () => true } });
    assert.match(String(denied?.reason), /Plan mode is active/i);
    const resumed: string[][] = [];
    const mod2 = await loadTaskModule<{ default(pi: Record<string, Function>): void }>('index.ts');
    const events2 = new Map<string, Function[]>();
    mod2.default({
      registerTool: () => undefined,
      registerCommand: () => undefined,
      on: (name: string, fn: Function) => events2.set(name, [...(events2.get(name) ?? []), fn]),
      getActiveTools: () => ['read', 'write'],
      setActiveTools: (next: string[]) => resumed.push(next),
      appendEntry: () => undefined,
    });
    await runEvent(events2.get('session_start'), {}, { sessionManager: { getEntries: () => [{ customType: 'hailykit-plan-state', data: { enabled: true, toolsBeforePlanMode: ['read', 'write'] } }] } });
    await runEvent(events2.get('before_agent_start'), {}, { sessionManager: { getEntries: () => [{ customType: 'hailykit-plan-state', data: { enabled: true, toolsBeforePlanMode: ['read', 'write'] } }] } });
    assert.deepEqual(resumed[0], ['read']);
    assert.deepEqual(resumed[1], ['read']);
    await runEvent(events2.get('session_start'), {}, { sessionManager: { getEntries: () => [{ customType: 'hailykit-plan-state', data: { enabled: false, toolsBeforePlanMode: ['read', 'write'] } }] } });
    await runEvent(events2.get('before_agent_start'), {}, { sessionManager: { getEntries: () => [{ customType: 'hailykit-plan-state', data: { enabled: false, toolsBeforePlanMode: ['read', 'write'] } }] } });
    assert.equal(resumed.length, 2);
  } finally {
    restore();
  }
});

test('Phase 4 safety guards fail closed in trust -> plan -> protected -> dirty -> destructive order', async () => {
  const root = tmp();
  fs.writeFileSync(path.join(root, 'settings.json'), JSON.stringify({ hailykit: { modules: { task: false, presets: false, diagnostics: false } } }));
  fs.mkdirSync(path.join(root, 'extensions', 'hailykit'), { recursive: true });
  fs.copyFileSync(repoMap, path.join(root, 'extensions', 'hailykit', 'model-map.json'));
  const restore = patchLoader(root);
  try {
    const mod = await loadTaskModule<{ default(pi: Record<string, Function>): void }>('index.ts');
    const commands = new Map<string, Function>();
    const events = new Map<string, Function[]>();
    const eventOrder: string[] = [];
    const execCalls: Array<{ command: string; args: string[] }> = [];
    let gitStdout = '';
    let gitCode = 0;
    let gitStderr = '';
    mod.default({
      registerTool: () => undefined,
      registerCommand: (name: string, spec: { handler: Function }) => commands.set(name, spec.handler),
      on: (name: string, fn: Function) => { eventOrder.push(name); events.set(name, [...(events.get(name) ?? []), fn]); },
      getActiveTools: () => ['read', 'write', 'bash'],
      setActiveTools: () => undefined,
      appendEntry: () => undefined,
      exec: async (command: string, args: string[]) => {
        execCalls.push({ command, args });
        return { code: gitCode, stdout: gitStdout, stderr: gitStderr };
      },
    });
    const toolCallOrder = eventOrder.filter((name) => name === 'tool_call');
    assert.equal(toolCallOrder.length, 2);
    const event = { toolName: 'bash', input: { command: 'rm -rf .env' } };
    const trust = await runEvent(events.get('tool_call'), event, { cwd: root, isProjectTrusted: () => false, sessionManager: { getEntries: () => [] } });
    assert.match(String(trust?.reason), /Untrusted project/i);
    assert.equal(execCalls.length, 0);
    await commands.get('plan')?.('on', { ui: { notify: () => undefined }, sessionManager: { getEntries: () => [] } });
    const plan = await runEvent(events.get('tool_call'), event, { cwd: root, isProjectTrusted: () => true, sessionManager: { getEntries: () => [] } });
    assert.match(String(plan?.reason), /Plan mode is active/i);
    await commands.get('plan')?.('off', { ui: { notify: () => undefined }, sessionManager: { getEntries: () => [] } });
    const protectedPath = await runEvent(events.get('tool_call'), event, { cwd: root, isProjectTrusted: () => true, sessionManager: { getEntries: () => [] } });
    assert.match(String(protectedPath?.reason), /Protected path blocked/i);
    gitStdout = ' M src/app.ts\n';
    const dirty = await runEvent(events.get('tool_call'), { toolName: 'write', input: { path: 'src/app.ts' } }, { cwd: root, isProjectTrusted: () => true, sessionManager: { getEntries: () => [] } });
    assert.match(String(dirty?.reason), /Dirty repository/i);
    gitStdout = '';
    const destructive = await runEvent(events.get('tool_call'), { toolName: 'bash', input: { command: 'rm -rf build' } }, { cwd: root, isProjectTrusted: () => true, ui: { confirm: async () => false }, sessionManager: { getEntries: () => [] } });
    assert.match(String(destructive?.reason), /Destructive command denied/i);
    gitCode = 128;
    gitStderr = 'fatal: not a git repository';
    const nonGit = await runEvent(events.get('session_before_fork'), {}, { cwd: root });
    assert.equal(nonGit, undefined);
    gitCode = 2;
    gitStderr = 'fatal: transport error';
    const session = await runEvent(events.get('session_before_switch'), {}, { cwd: root });
    assert.match(String(session?.reason), /Dirty repository/i);
    assert.equal(session?.cancel, true);
  } finally {
    restore();
  }
});
