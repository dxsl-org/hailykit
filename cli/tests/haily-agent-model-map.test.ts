import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const modelMap = require(path.resolve(
  __dirname, '..', '..', 'kit', 'hooks', 'haily-lib', 'agent-model-map.cjs',
)) as {
  loadAgentModelMap(hookDir: string, env?: Record<string, string>, cwd?: string): Record<string, string>;
};

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hl-agent-model-map-'));

after(() => fs.rmSync(root, { recursive: true, force: true }));

test('Codex model trace reads generated TOML and never falls back to Claude aliases', () => {
  const codexDir = path.join(root, '.codex');
  const claudeDir = path.join(root, '.claude');
  fs.mkdirSync(path.join(codexDir, 'hooks'), { recursive: true });
  fs.mkdirSync(path.join(codexDir, 'agents'), { recursive: true });
  fs.mkdirSync(path.join(claudeDir, 'agents'), { recursive: true });
  fs.writeFileSync(path.join(codexDir, 'agents', 'haily_refiner.toml'), [
    'name = "haily-refiner"',
    'model = "gpt-5.6-terra"',
  ].join('\n'));
  fs.writeFileSync(path.join(claudeDir, 'agents', 'haily-refiner.md'), '---\nmodel: sonnet\n---\n');

  const actual = modelMap.loadAgentModelMap(path.join(codexDir, 'hooks'), {
    HL_CLAUDE_SETTINGS_DIR: claudeDir,
  });

  assert.deepEqual(actual, { 'haily-refiner': 'gpt-5.6-terra' });
});

test('provider-local project agents override global trace entries', () => {
  const claudeDir = path.join(root, 'precedence', '.claude-global');
  const projectDir = path.join(root, 'precedence', 'project');
  fs.mkdirSync(path.join(claudeDir, 'agents'), { recursive: true });
  fs.mkdirSync(path.join(projectDir, '.claude', 'agents'), { recursive: true });
  fs.writeFileSync(path.join(claudeDir, 'agents', 'haily-refiner.md'), '---\nmodel: sonnet\n---\n');
  fs.writeFileSync(path.join(projectDir, '.claude', 'agents', 'haily-refiner.md'), '---\nmodel: opus\n---\n');

  assert.deepEqual(
    modelMap.loadAgentModelMap(path.join(claudeDir, 'hooks'), {
      HL_CLAUDE_SETTINGS_DIR: claudeDir,
    }, projectDir),
    { 'haily-refiner': 'opus' },
  );
});

test('Codex model trace uses inherit when a TOML agent has no model override', () => {
  const codexDir = path.join(root, 'inherit', '.codex');
  fs.mkdirSync(path.join(codexDir, 'hooks'), { recursive: true });
  fs.mkdirSync(path.join(codexDir, 'agents'), { recursive: true });
  fs.writeFileSync(path.join(codexDir, 'agents', 'haily_planner.toml'), 'name = "haily-planner"\n');

  assert.deepEqual(
    modelMap.loadAgentModelMap(path.join(codexDir, 'hooks'), {}),
    { 'haily-planner': 'inherit' },
  );
});
