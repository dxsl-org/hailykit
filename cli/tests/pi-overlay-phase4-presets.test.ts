import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { loadTaskModule } from './pi-task-phase3-loader';
import { patchLoader, repoMap, tmp } from './pi-phase4-test-helpers';

test('Phase 4 presets resolve provider aliases and stay transactional on rejected model', async () => {
  const root = tmp();
  fs.mkdirSync(path.join(root, 'extensions', 'hailykit'), { recursive: true });
  fs.copyFileSync(repoMap, path.join(root, 'extensions', 'hailykit', 'model-map.json'));
  const restore = patchLoader(root);
  try {
    const mod = await loadTaskModule<{ default(pi: Record<string, Function>): void }>('index.ts');
    const commands = new Map<string, Function>();
    const tools: string[][] = [];
    const thinking: string[] = [];
    const models: Record<string, unknown>[] = [];
    mod.default({
      registerTool: () => undefined,
      registerCommand: (name: string, spec: { handler: Function }) => commands.set(name, spec.handler),
      on: () => undefined,
      registerFlag: () => undefined,
      getActiveTools: () => ['read', 'write'],
      setActiveTools: (value: string[]) => tools.push(value),
      setModel: async (model: Record<string, unknown>) => { models.push(model); return models.length > 1; },
      setThinkingLevel: (level: string) => thinking.push(level),
    });
    const anthropicModel = { provider: 'anthropic', id: 'opus', label: 'Opus' };
    const codexModel = { provider: 'openai-codex', id: 'gpt-5.6-sol', label: 'Sol' };
    await commands.get('preset')?.('review', { model: { provider: 'anthropic', id: 'x' }, scopedModels: [{ model: anthropicModel }], ui: { notify: () => undefined } });
    assert.strictEqual(models[0], anthropicModel);
    assert.deepEqual(tools, []);
    assert.deepEqual(thinking, []);
    await commands.get('preset')?.('review', { model: { provider: 'openai-codex', id: 'x' }, scopedModels: [{ model: codexModel }], ui: { notify: () => undefined } });
    assert.strictEqual(models[1], codexModel);
    assert.deepEqual(tools[0], ['read', 'grep', 'find', 'ls', 'bash']);
    assert.deepEqual(thinking, ['medium']);
  } finally {
    restore();
  }
});

test('Phase 4 presets accept official Pi thinking levels and reject invalid values', async () => {
  const root = tmp();
  fs.writeFileSync(path.join(root, 'settings.json'), JSON.stringify({
    hailykit: { presets: { definitions: {
      turbo: { tier: 'thinking', thinkingLevel: 'xhigh', tools: ['read'] },
      maxed: { tier: 'thinking', thinkingLevel: 'max', tools: ['read'] },
      bad: { tier: 'thinking', thinkingLevel: 'turbo', tools: ['read'] },
    } } },
  }));
  fs.mkdirSync(path.join(root, 'extensions', 'hailykit'), { recursive: true });
  fs.copyFileSync(repoMap, path.join(root, 'extensions', 'hailykit', 'model-map.json'));
  const restore = patchLoader(root);
  try {
    const mod = await loadTaskModule<{ default(pi: Record<string, Function>): void }>('index.ts');
    const commands = new Map<string, Function>();
    const thinking: string[] = [];
    const notices: string[] = [];
    mod.default({
      registerTool: () => undefined,
      registerCommand: (name: string, spec: { handler: Function }) => commands.set(name, spec.handler),
      on: () => undefined,
      registerFlag: () => undefined,
      getActiveTools: () => ['read'],
      setActiveTools: () => undefined,
      setThinkingLevel: (level: string) => thinking.push(level),
    });
    await commands.get('preset')?.('turbo', { model: { provider: 'codex', id: 'x' }, scopedModels: [], ui: { notify: (text: string) => notices.push(text) } });
    await commands.get('preset')?.('maxed', { model: { provider: 'codex', id: 'x' }, scopedModels: [], ui: { notify: (text: string) => notices.push(text) } });
    await commands.get('preset')?.('bad', { model: { provider: 'codex', id: 'x' }, scopedModels: [], ui: { notify: (text: string) => notices.push(text) } });
    assert.deepEqual(thinking, ['xhigh', 'max']);
    assert.match(notices[2] ?? '', /invalid thinking level/i);
  } finally {
    restore();
  }
});
