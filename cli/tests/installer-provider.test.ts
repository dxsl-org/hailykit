import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { GeminiProvider } from '../installer/providers/gemini';
import { CodexProvider } from '../installer/providers/codex';

function tmp(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'haily-prov-'));
}

test('GeminiProvider.installSkills converts SKILL.md to an hl-*.toml command', () => {
  const root = tmp();
  const claude = path.join(root, 'claude');
  const skillDir = path.join(claude, 'skills', 'hl-plan');
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(
    path.join(skillDir, 'SKILL.md'),
    '---\nname: hl:plan\ndescription: Plan stuff\n---\n\nDo planning.',
  );

  const target = path.join(root, 'out');
  const count = new GeminiProvider().installSkills(claude, target);
  assert.equal(count, 1);

  const toml = fs.readFileSync(path.join(target, 'commands', 'hl-plan.toml'), 'utf8');
  assert.match(toml, /description = "Plan stuff"/);
  assert.match(toml, /Do planning\./);
});

test('GeminiProvider.installSkills installs TOML command AND native SKILL.md', () => {
  const root = tmp();
  const claude = path.join(root, 'claude');
  const skillDir = path.join(claude, 'skills', 'hl-plan');
  fs.mkdirSync(skillDir, { recursive: true });
  const md = '---\nname: hl:plan\ndescription: Plan stuff\n---\n\nDo planning.';
  fs.writeFileSync(path.join(skillDir, 'SKILL.md'), md);

  const target = path.join(root, 'out');
  const count = new GeminiProvider().installSkills(claude, target);

  assert.equal(count, 1);
  assert.ok(fs.existsSync(path.join(target, 'commands', 'hl-plan.toml')));
  const native = fs.readFileSync(path.join(target, 'skills', 'hl-plan', 'SKILL.md'), 'utf8');
  assert.equal(native, md);
});

// ---------------------------------------------------------------------------
// CodexProvider
// ---------------------------------------------------------------------------

test('CodexProvider.agentRef: single agent → NL invocation', () => {
  const p = new CodexProvider();
  assert.equal(
    (p as unknown as Record<string, Function>).agentRef('agent', ['haily-researcher']),
    'Use the haily-researcher agent for this step.',
  );
});

test('CodexProvider.agentRef: parallel agents → NL sequence', () => {
  const p = new CodexProvider();
  assert.equal(
    (p as unknown as Record<string, Function>).agentRef('agents', ['haily-researcher', 'haily-tester']),
    'Use the haily-researcher agent, then the haily-tester agent for this step.',
  );
});

test('CodexProvider.agentRef: agent-result → NL bridge', () => {
  const p = new CodexProvider();
  assert.equal(
    (p as unknown as Record<string, Function>).agentRef('agent-result', ['haily-researcher']),
    'Using the haily-researcher agent output above:',
  );
});

test('CodexProvider.skillRef still returns $prefix-name', () => {
  const p = new CodexProvider();
  assert.equal(
    (p as unknown as Record<string, Function>).skillRef('hc', 'cook'),
    '$hc-cook',
  );
});

test('CodexProvider.installAgents generates TOML from agent MD files', () => {
  const root = tmp();
  const kit = path.join(root, 'kit');
  fs.mkdirSync(path.join(kit, 'agents'), { recursive: true });
  fs.writeFileSync(
    path.join(kit, 'agents', 'haily-researcher.md'),
    '---\nname: haily-researcher\ndescription: Research things\nmodel: medium\n---\n\nDo research.',
  );

  const target = path.join(root, 'out');
  fs.mkdirSync(target, { recursive: true });
  new CodexProvider().installAgents!(kit, target);

  const toml = fs.readFileSync(path.join(target, 'agents', 'haily-researcher.toml'), 'utf8');
  assert.match(toml, /name = "haily-researcher"/);
  assert.match(toml, /description = "Research things"/);
  assert.match(toml, /developer_instructions/);
  assert.match(toml, /Do research\./);
});

// ---------------------------------------------------------------------------
// GeminiProvider — installRules + installAgents
// ---------------------------------------------------------------------------

test('GeminiProvider.installRules copies rule files and writes GEMINI.md managed block', () => {
  const root = tmp();
  const claude = path.join(root, 'claude');
  fs.mkdirSync(path.join(claude, 'rules'), { recursive: true });
  fs.writeFileSync(path.join(claude, 'rules', 'haily-coding.md'), 'Coding rules');
  fs.writeFileSync(path.join(claude, 'rules', 'hailykit.md'), 'Brand rules');

  const target = path.join(root, 'out');
  new GeminiProvider().installRules(claude, target);

  assert.ok(fs.existsSync(path.join(target, 'haily-coding.md')));
  assert.ok(fs.existsSync(path.join(target, 'hailykit.md')));
  const gemini = fs.readFileSync(path.join(target, 'GEMINI.md'), 'utf8');
  assert.match(gemini, /<!-- hailykit-managed-start -->/);
  assert.match(gemini, /@haily-coding\.md/);
  assert.match(gemini, /@hailykit\.md/);
  assert.match(gemini, /<!-- hailykit-managed-end -->/);
});

test('GeminiProvider.installRules upserts GEMINI.md preserving content outside the block', () => {
  const root = tmp();
  const claude = path.join(root, 'claude');
  fs.mkdirSync(path.join(claude, 'rules'), { recursive: true });
  fs.writeFileSync(path.join(claude, 'rules', 'haily-coding.md'), 'Coding rules');

  const target = path.join(root, 'out');
  fs.mkdirSync(target, { recursive: true });
  const pre = 'User notes top\n<!-- hailykit-managed-start -->\n@stale.md\n<!-- hailykit-managed-end -->\nUser notes bottom\n';
  fs.writeFileSync(path.join(target, 'GEMINI.md'), pre);

  new GeminiProvider().installRules(claude, target);

  const gemini = fs.readFileSync(path.join(target, 'GEMINI.md'), 'utf8');
  assert.match(gemini, /User notes top/);
  assert.match(gemini, /User notes bottom/);
  assert.match(gemini, /@haily-coding\.md/);
  assert.doesNotMatch(gemini, /@stale\.md/);
  assert.equal(gemini.match(/hailykit-managed-start/g)?.length, 1);
});

test('GeminiProvider.installAgents copies agent .md files to agents/', () => {
  const root = tmp();
  const claude = path.join(root, 'claude');
  fs.mkdirSync(path.join(claude, 'agents'), { recursive: true });
  fs.writeFileSync(path.join(claude, 'agents', 'haily-researcher.md'), 'Research agent');

  const target = path.join(root, 'out');
  new GeminiProvider().installAgents!(claude, target);

  const copied = fs.readFileSync(path.join(target, 'agents', 'haily-researcher.md'), 'utf8');
  assert.equal(copied, 'Research agent');
});

test('GeminiProvider.installAgents no-ops when agents dir is absent', () => {
  const root = tmp();
  const claude = path.join(root, 'claude');
  fs.mkdirSync(claude, { recursive: true });
  const target = path.join(root, 'out');
  assert.doesNotThrow(() => new GeminiProvider().installAgents!(claude, target));
  assert.equal(fs.existsSync(path.join(target, 'agents')), false);
});
