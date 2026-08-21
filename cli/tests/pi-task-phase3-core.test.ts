import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import Module from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { loadTaskModule } from './pi-task-phase3-loader';

const FIXTURES = path.resolve('cli', 'tests', 'fixtures', 'pi-overlay', 'task');
const tmp = (): string => fs.mkdtempSync(path.join(os.tmpdir(), 'haily-pi-task-core-'));

test('Phase 3 schema parses single, batch, and chain requests', async () => {
  const mod = await loadTaskModule<{ parseTaskRequest(value: unknown): { mode: string; concurrency: number } }>('schema.ts');
  assert.equal(mod.parseTaskRequest({ agent: 'a', task: 't' }).mode, 'single');
  assert.equal(mod.parseTaskRequest({ tasks: [{ agent: 'a', task: 't' }], concurrency: 99 }).concurrency, 4);
  assert.equal(mod.parseTaskRequest({ chain: [{ agent: 'a', task: 't' }] }).mode, 'chain');
  assert.throws(() => mod.parseTaskRequest({}), /exactly one task mode/i);
});

test('Phase 3 discovery is fresh and project agents override globals deterministically', async () => {
  const mod = await loadTaskModule<{ discoverTaskAgents(globalDir: string, cwd: string, scope: string): { agents: Array<{ name: string; source: string; systemPrompt: string }> } }>('discovery.ts');
  const root = tmp();
  const globalDir = path.join(root, 'global', 'agents');
  const projectDir = path.join(root, 'repo', '.pi', 'agents');
  fs.mkdirSync(globalDir, { recursive: true });
  fs.mkdirSync(projectDir, { recursive: true });
  fs.cpSync(path.join(FIXTURES, 'global'), globalDir, { recursive: true });
  fs.cpSync(path.join(FIXTURES, 'project'), projectDir, { recursive: true });
  const first = mod.discoverTaskAgents(globalDir, path.join(root, 'repo'), 'both').agents;
  assert.equal(first.find((agent) => agent.name === 'haily-researcher')?.source, 'project');
  fs.writeFileSync(path.join(projectDir, 'haily-researcher.md'), fs.readFileSync(path.join(projectDir, 'haily-researcher.md'), 'utf8').replace('Project researcher', 'Fresh project researcher'));
  const second = mod.discoverTaskAgents(globalDir, path.join(root, 'repo'), 'both').agents;
  assert.match(second.find((agent) => agent.name === 'haily-researcher')?.systemPrompt ?? '', /Fresh project researcher/);
});

test('Phase 3 policy gates trust, parent tools, and unknown agents', async () => {
  const discovery = await loadTaskModule<{ discoverTaskAgents(globalDir: string, cwd: string, scope: string): { agents: Array<{ name: string; toolNames?: string[] }> } }>('discovery.ts');
  const policy = await loadTaskModule<{
    assertTrustedScope(scope: string, trustedProject: boolean): void;
    assertTaskDepth(parent: Record<string, unknown>): void;
    prepareTask(item: Record<string, unknown>, index: number, agents: unknown[], parent: Record<string, unknown>, timeoutMs: number, outputCapBytes: number): Record<string, unknown>;
  }>('policy.ts');
  const invocation = await loadTaskModule<{ buildPiInvocation(task: Record<string, unknown>): { command: string; args: string[] } }>('invocation.ts');
  const root = tmp();
  const globalDir = path.join(root, 'global', 'agents');
  fs.mkdirSync(globalDir, { recursive: true });
  fs.cpSync(path.join(FIXTURES, 'global'), globalDir, { recursive: true });
  const agents = discovery.discoverTaskAgents(globalDir, root, 'global').agents;
  policy.assertTrustedScope('global', false);
  assert.throws(() => policy.assertTrustedScope('project', false), /trusted project/i);
  const prepared = policy.prepareTask({ agent: 'haily-reviewer', task: 'review' }, 0, agents, { cwd: root, depth: 0, trustedProject: false, availableTools: ['read'], activeModel: 'pi/active' }, 10, 50);
  assert.deepEqual('status' in prepared ? prepared.toolNames : prepared.toolNames, ['read']);
  const taskHelpers = invocation as unknown as {
    buildPiInvocation(task: Record<string, unknown>, promptPath?: string, runtime?: { execPath: string; argv: string[] }): { command: string; args: string[] };
  };
  const taskCall = taskHelpers.buildPiInvocation(prepared, undefined, { execPath: '/usr/local/bin/pi', argv: ['/usr/local/bin/pi'] });
  assert.equal(taskCall.command, '/usr/local/bin/pi');
  const runnerPath = path.join(root, 'pi-runner.js');
  fs.writeFileSync(runnerPath, 'console.log("pi");');
  const wrapped = taskHelpers.buildPiInvocation(prepared, undefined, { execPath: '/usr/bin/node', argv: ['/usr/bin/node', runnerPath] });
  assert.equal(wrapped.command, `/usr/bin/node\u0000${runnerPath}`);
  assert.deepEqual(taskCall.args.slice(0, 4), ['--mode', 'json', '-p', '--no-session']);
  const unknown = policy.prepareTask({ agent: 'missing', task: 'review' }, 0, agents, { cwd: root, depth: 0, trustedProject: false, availableTools: ['read'] }, 10, 50);
  assert.equal('status' in unknown && unknown.status, 'error');
  assert.match(String('status' in unknown ? unknown.help ?? '' : ''), /Unknown agent/);
  const modeledAgents = agents.map((agent) => agent.name === 'haily-reviewer' ? { ...agent, model: 'pi/reviewer' } : agent);
  assert.throws(() => policy.prepareTask({ agent: 'haily-reviewer', task: 'review' }, 0, modeledAgents, { cwd: root, depth: 0, trustedProject: false, availableTools: ['read'], allowedModels: ['pi/locked'], activeModel: 'pi/active' }, 10, 50), /disallowed model/i);
  assert.throws(() => policy.assertTaskDepth({ cwd: root, depth: 1, trustedProject: false }), /Nested task depth is denied/);
});

test('Phase 3 entrypoint derives parent policy from active tools and scoped models', async () => {
  const root = tmp();
  const globalDir = path.join(root, 'global');
  fs.mkdirSync(path.join(globalDir, 'agents'), { recursive: true });
  fs.cpSync(path.join(FIXTURES, 'global'), path.join(globalDir, 'agents'), { recursive: true });
  const nodeModule = Module as typeof Module & { _load: Function };
  const originalLoad = nodeModule._load;
  let captured: Record<string, unknown> | undefined;
  let registered: Record<string, unknown> | undefined;
  nodeModule._load = function patched(request: string, parent: NodeModule | undefined, isMain: boolean) {
    if (request === '@earendil-works/pi-ai') return { StringEnum: (values: unknown) => values };
    if (request === '@earendil-works/pi-coding-agent') return { CONFIG_DIR_NAME: '.pi', getAgentDir: () => globalDir };
    if (request === 'typebox') return { Type: { Object: (value: unknown) => value, String: () => ({}), Optional: (value: unknown) => value, Array: (value: unknown) => value, Integer: () => ({}) } };
    if (request === './node-port.js') return { createNodeInvocationPort: () => ({ invoke: async () => ({ exitCode: 0, stdout: '', stderr: '' }) }) };
    if (request === './scheduler.js') return {
      runTaskRequest: async (_request: unknown, parentPolicy: unknown) => {
        captured = parentPolicy as Record<string, unknown>;
        return { results: [{ index: 0, agent: 'haily-reviewer', status: 'ok', output: 'done', stderr: '', toolNames: ['read'], allowedAgents: [] }] };
      },
    };
    return originalLoad.call(this, request, parent, isMain);
  };
  try {
    const mod = await loadTaskModule<{ default(pi: { getActiveTools(): string[]; registerTool(tool: Record<string, unknown>): void }): void }>('index.ts');
    mod.default({
      getActiveTools: () => [' read ', 'task'],
      registerTool: (tool) => { registered = tool; },
    });
    const execute = registered?.['execute'] as Function;
    const result = await execute('call', { agent: 'haily-reviewer', task: 'review' }, undefined, undefined, {
      cwd: root,
      model: { provider: 'pi', id: 'active' },
      scopedModels: [{ model: { provider: 'pi', id: 'active' } }, { model: { provider: 'pi', id: 'reviewer' } }],
      thinkingLevel: 'medium',
      isProjectTrusted: () => true,
    });
    assert.equal(result.isError, undefined);
    assert.deepEqual(captured, {
      cwd: root,
      depth: 0,
      trustedProject: true,
      activeModel: 'pi/active',
      activeThinking: 'medium',
      allowedModels: ['pi/active', 'pi/reviewer'],
      availableTools: ['read', 'task'],
    });
  } finally {
    nodeModule._load = originalLoad;
  }
});

test('Phase 3 entrypoint leaves model allowlist open when scopedModels is empty', async () => {
  const root = tmp();
  const globalDir = path.join(root, 'global');
  fs.mkdirSync(path.join(globalDir, 'agents'), { recursive: true });
  fs.cpSync(path.join(FIXTURES, 'global'), path.join(globalDir, 'agents'), { recursive: true });
  const nodeModule = Module as typeof Module & { _load: Function };
  const originalLoad = nodeModule._load;
  let captured: Record<string, unknown> | undefined;
  let registered: Record<string, unknown> | undefined;
  nodeModule._load = function patched(request: string, parent: NodeModule | undefined, isMain: boolean) {
    if (request === '@earendil-works/pi-ai') return { StringEnum: (values: unknown) => values };
    if (request === '@earendil-works/pi-coding-agent') return { CONFIG_DIR_NAME: '.pi', getAgentDir: () => globalDir };
    if (request === 'typebox') return { Type: { Object: (value: unknown) => value, String: () => ({}), Optional: (value: unknown) => value, Array: (value: unknown) => value, Integer: () => ({}) } };
    if (request === './node-port.js') return { createNodeInvocationPort: () => ({ invoke: async () => ({ exitCode: 0, stdout: '', stderr: '' }) }) };
    if (request === './scheduler.js') return {
      runTaskRequest: async (_request: unknown, parentPolicy: unknown) => {
        captured = parentPolicy as Record<string, unknown>;
        return { results: [{ index: 0, agent: 'haily-reviewer', status: 'ok', output: 'done', stderr: '', toolNames: ['read'], allowedAgents: [] }] };
      },
    };
    return originalLoad.call(this, request, parent, isMain);
  };
  try {
    const mod = await loadTaskModule<{ default(pi: { getActiveTools(): string[]; registerTool(tool: Record<string, unknown>): void }): void }>('index.ts');
    mod.default({
      getActiveTools: () => ['read'],
      registerTool: (tool) => { registered = tool; },
    });
    const execute = registered?.['execute'] as Function;
    const result = await execute('call', { agent: 'haily-reviewer', task: 'review' }, undefined, undefined, {
      cwd: root,
      model: { provider: 'pi', id: 'active' },
      scopedModels: [],
      thinkingLevel: 'medium',
      isProjectTrusted: () => true,
    });
    assert.equal(result.isError, undefined);
    assert.equal(captured?.allowedModels, undefined);
  } finally {
    nodeModule._load = originalLoad;
  }
});
