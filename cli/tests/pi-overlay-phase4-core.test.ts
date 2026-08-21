import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { loadTaskModule } from './pi-task-phase3-loader';
import { canonicalMap, patchLoader, repoMap, runEvent, tmp } from './pi-phase4-test-helpers';

test('Phase 4 entrypoint honors disabled modules and stays out of native compact/tree flows', async () => {
  const root = tmp();
  fs.writeFileSync(path.join(root, 'settings.json'), JSON.stringify({ hailykit: { modules: { task: false, plan: false, presets: false, safety: false, diagnostics: true } } }));
  fs.mkdirSync(path.join(root, 'extensions', 'hailykit'), { recursive: true });
  fs.copyFileSync(repoMap, path.join(root, 'extensions', 'hailykit', 'model-map.json'));
  const restore = patchLoader(root);
  try {
    const mod = await loadTaskModule<{ default(pi: Record<string, Function>): void }>('index.ts');
    const commands: string[] = [];
    const events: string[] = [];
    mod.default({
      registerTool: () => assert.fail('task disabled'),
      registerCommand: (name: string) => commands.push(name),
      on: (name: string) => events.push(name),
      registerFlag: () => assert.fail('presets disabled'),
      getActiveTools: () => ['read'],
      setActiveTools: () => undefined,
    });
    assert.deepEqual(commands, ['hailykit']);
    assert.deepEqual(events, []);
  } finally {
    restore();
  }
});

test('Phase 4 preset map matches canonical model tiers and diagnostics use real API shapes', async () => {
  assert.equal(fs.readFileSync(repoMap, 'utf8'), fs.readFileSync(canonicalMap, 'utf8'));
  const root = tmp();
  fs.writeFileSync(path.join(root, 'settings.json'), '{bad json');
  fs.mkdirSync(path.join(root, 'extensions', 'hailykit'), { recursive: true });
  fs.copyFileSync(repoMap, path.join(root, 'extensions', 'hailykit', 'model-map.json'));
  const restore = patchLoader(root);
  try {
    const mod = await loadTaskModule<{ default(pi: Record<string, Function>): void }>('index.ts');
    const commands = new Map<string, Function>();
    const events = new Map<string, Function>();
    const notices: string[] = [];
    const models: Array<Record<string, unknown>> = [];
    const thinking: string[] = [];
    const flags = new Map<string, string>([['hailykit-preset', 'review']]);
    mod.default({
      registerTool: () => undefined,
      registerCommand: (name: string, spec: { handler: Function }) => commands.set(name, spec.handler),
      on: (name: string, fn: Function) => events.set(name, fn),
      registerFlag: () => undefined,
      getActiveTools: () => ['read', 'write', 'bash'],
      setActiveTools: () => undefined,
      getFlag: (name: string) => flags.get(name),
      setModel: async (model: Record<string, unknown>) => { models.push(model); return true; },
      setThinkingLevel: (level: string) => thinking.push(level),
    });
    const fullModel = { provider: 'codex', id: 'gpt-5.6-terra', displayName: 'Terra' };
    await commands.get('preset')?.('build', { model: { provider: 'codex', id: 'x' }, scopedModels: [{ model: fullModel }], ui: { notify: (text: string) => notices.push(text) } });
    assert.strictEqual(models[0], fullModel);
    assert.equal(thinking[0], 'medium');
    await events.get('before_agent_start')?.({}, { model: { provider: 'codex', id: 'x' }, scopedModels: [{ model: { provider: 'codex', id: 'gpt-5.6-sol' } }], isProjectTrusted: () => true });
    await commands.get('hailykit')?.('', { isProjectTrusted: () => true, ui: { notify: (text: string) => notices.push(text) } });
    const summary = JSON.parse(notices[1]) as Record<string, unknown>;
    assert.equal(Array.isArray(summary.warnings), true);
    assert.equal(events.has('session_before_tree'), false);
    assert.equal(events.has('session_before_compact'), false);
  } finally {
    restore();
  }
});

test('Phase 4 global defaults stay fail-closed against untrusted project settings', async () => {
  const root = tmp();
  const agentDir = path.join(root, 'agent-home');
  const projectDir = path.join(root, 'repo');
  fs.mkdirSync(agentDir, { recursive: true });
  fs.mkdirSync(path.join(projectDir, '.pi'), { recursive: true });
  fs.mkdirSync(path.join(projectDir, '.test-build'), { recursive: true });
  fs.writeFileSync(path.join(projectDir, '.pi', 'settings.json'), JSON.stringify({
    hailykit: {
      modules: { safety: false, plan: false, task: false, diagnostics: false },
      safety: { requireProjectTrust: false, guardDirtyRepo: false, confirmDestructive: false, protectedPaths: ['project-only'] },
    },
  }));
  fs.mkdirSync(path.join(agentDir, 'extensions', 'hailykit'), { recursive: true });
  fs.copyFileSync(repoMap, path.join(agentDir, 'extensions', 'hailykit', 'model-map.json'));
  const restore = patchLoader(agentDir);
  const previousCwd = process.cwd();
  try {
    process.chdir(projectDir);
    const mod = await loadTaskModule<{ default(pi: Record<string, Function>): void }>('index.ts');
    const events = new Map<string, Function[]>();
    mod.default({
      registerTool: () => undefined,
      registerCommand: () => undefined,
      on: (name: string, fn: Function) => events.set(name, [...(events.get(name) ?? []), fn]),
      registerFlag: () => undefined,
      getActiveTools: () => ['read', 'write'],
      setActiveTools: () => undefined,
      exec: async () => ({ code: 0, stdout: '', stderr: '' }),
    });
    const result = await runEvent(events.get('tool_call'), { toolName: 'write', input: { path: 'project-only/file.txt' } }, { cwd: projectDir, isProjectTrusted: () => false, sessionManager: { getEntries: () => [] } });
    assert.match(String(result?.reason), /Untrusted project/i);
  } finally {
    process.chdir(previousCwd);
    restore();
  }
});

test('Phase 4 global user settings can disable optional modules intentionally', async () => {
  const root = tmp();
  fs.writeFileSync(path.join(root, 'settings.json'), JSON.stringify({ hailykit: { modules: { task: false, plan: false, diagnostics: false } } }));
  fs.mkdirSync(path.join(root, 'extensions', 'hailykit'), { recursive: true });
  fs.copyFileSync(repoMap, path.join(root, 'extensions', 'hailykit', 'model-map.json'));
  const restore = patchLoader(root);
  try {
    const mod = await loadTaskModule<{ default(pi: Record<string, Function>): void }>('index.ts');
    const commands: string[] = [];
    const events: string[] = [];
    mod.default({
      registerTool: () => assert.fail('task disabled'),
      registerCommand: (name: string) => commands.push(name),
      on: (name: string) => events.push(name),
      registerFlag: () => undefined,
      getActiveTools: () => ['read', 'write'],
      setActiveTools: () => undefined,
    });
    assert.deepEqual(commands, ['preset']);
    assert.deepEqual(events, ['before_agent_start', 'tool_call', 'session_before_switch', 'session_before_fork']);
  } finally {
    restore();
  }
});
