import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { GeminiProvider } from '../installer/providers/gemini';
import { CodexProvider } from '../installer/providers/codex';
import { CrushProvider } from '../installer/providers/crush';
import { KimiProvider } from '../installer/providers/kimi';
import { OpenCodeProvider } from '../installer/providers/opencode';
import { ZedProvider } from '../installer/providers/zed';
import { AntigravityProvider } from '../installer/providers/antigravity';
import { toCrushMd, toKimiMd } from '../installer/converter';
import {
  escapeTomlMultiline, toCodexSlug, buildAgentConfigEntry, deriveSandboxMode,
  extractUnmanagedAgentSlugs, mergeManagedTomlBlock,
} from '../installer/providers/codex-toml';
import { parseVersion, compareVersions, warnIfCodexHooksUnsupported } from '../installer/providers/codex-version';
import { atomicWriteToml } from '../installer/providers/codex-toml';
import { writeCodexConfigToml } from '../installer/providers/codex-config';
import { generateHookWrapper, buildTimeoutsByPath, buildCodexHooksJson, installHookWrappers } from '../installer/providers/codex-hook-compat';

/** Write an agent .md into a fresh kit/agents/ and return the kit dir. */
function kitWithAgent(name: string, body: string, fm = ''): string {
  const root = tmp();
  const kit = path.join(root, 'kit');
  fs.mkdirSync(path.join(kit, 'agents'), { recursive: true });
  fs.writeFileSync(
    path.join(kit, 'agents', `${name}.md`),
    `---\nname: ${name}\ndescription: d\n${fm}---\n\n${body}`,
  );
  return kit;
}

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
  const native = fs.readFileSync(path.join(target, 'skills', 'hl-plan.md'), 'utf8');
  assert.equal(native, md);
});

test('GeminiProvider native SKILL.md resolves model tier and {model:ultra} placeholders', () => {
  const root = tmp();
  const claude = path.join(root, 'claude');
  const skillDir = path.join(claude, 'skills', 'hl-ultra');
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(
    path.join(skillDir, 'SKILL.md'),
    '---\nname: hl-ultra\ndescription: Ultra\nmodel: ultra\n---\n\nPass `model: {model:ultra}` to Task calls.',
  );

  new GeminiProvider().installSkills(claude, path.join(root, 'out'));

  const native = fs.readFileSync(path.join(root, 'out', 'skills', 'hl-ultra.md'), 'utf8');
  assert.ok(!native.includes('{model:'), `placeholder leaked: ${native}`);
  assert.ok(!native.includes('model: ultra'), `tier line leaked: ${native}`);
  assert.match(native, /model: gemini-3\.1-pro-preview/);
});

test('GeminiProvider.uninstall removes commands, skills, agents subdirectories and rules block', () => {
  const root = tmp();
  const target = path.join(root, 'out');
  fs.mkdirSync(path.join(target, 'commands'), { recursive: true });
  fs.mkdirSync(path.join(target, 'skills'), { recursive: true });
  fs.mkdirSync(path.join(target, 'agents'), { recursive: true });
  fs.writeFileSync(path.join(target, 'GEMINI.md'), 'Notes\n<!-- hailykit-managed-start -->\n@haily-coding.md\n<!-- hailykit-managed-end -->\n');
  fs.writeFileSync(path.join(target, '.hailykit-meta.json'), '{"version":"1.0.0"}');

  new GeminiProvider().uninstall(target);

  assert.ok(!fs.existsSync(path.join(target, 'commands')));
  assert.ok(!fs.existsSync(path.join(target, 'skills')));
  assert.ok(!fs.existsSync(path.join(target, 'agents')));
  const gemini = fs.readFileSync(path.join(target, 'GEMINI.md'), 'utf8');
  assert.ok(!gemini.includes('hailykit-managed-start'));
});

test('AntigravityProvider.installSkills: global vs project installation and manifest handling', () => {
  const root = tmp();
  const claude = path.join(root, 'claude');
  const skillDir = path.join(claude, 'skills', 'hc-test');
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(
    path.join(skillDir, 'SKILL.md'),
    '---\nname: hc-test\ndescription: Test\n---\n\nTest body.',
  );

  const provider = new AntigravityProvider();

  // Mock globalDir() to point to a temporary test directory
  const testGlobalDir = path.join(root, 'global_workflows');
  (provider as any).globalDir = () => testGlobalDir;

  // 1. Global install
  const countGlobal = provider.installSkills(claude, testGlobalDir);
  assert.equal(countGlobal, 1);
  // Expecting: testGlobalDir/hc-test.md (flat markdown files in global_workflows)
  assert.ok(fs.existsSync(path.join(testGlobalDir, 'hc-test.md')));
  const manifestGlobal = JSON.parse(fs.readFileSync(path.join(testGlobalDir, 'hailykit-installed-skills.json'), 'utf8'));
  assert.deepEqual(manifestGlobal, ['hc-test']);

  // 2. Project install
  const testProjectDir = path.join(root, 'project');
  const countProject = provider.installSkills(claude, testProjectDir);
  assert.equal(countProject, 1);
  // Expecting: testProjectDir/skills/hc-test/SKILL.md
  assert.ok(fs.existsSync(path.join(testProjectDir, 'skills', 'hc-test', 'SKILL.md')));
  const manifestProject = JSON.parse(fs.readFileSync(path.join(testProjectDir, 'hailykit-installed-skills.json'), 'utf8'));
  assert.deepEqual(manifestProject, ['hc-test']);

  // 3. Uninstall
  fs.writeFileSync(path.join(testGlobalDir, '.hailykit-meta.json'), '{}');
  fs.writeFileSync(path.join(testProjectDir, '.hailykit-meta.json'), '{}');

  provider.uninstall(testGlobalDir);
  assert.ok(!fs.existsSync(path.join(testGlobalDir, 'hc-test.md')));
  assert.ok(!fs.existsSync(path.join(testGlobalDir, 'hailykit-installed-skills.json')));

  provider.uninstall(testProjectDir);
  assert.ok(!fs.existsSync(path.join(testProjectDir, 'skills', 'hc-test')));
  assert.ok(!fs.existsSync(path.join(testProjectDir, 'hailykit-installed-skills.json')));
});

test('CodexProvider skill copy resolves {model:ultra} placeholders', () => {
  const root = tmp();
  const claude = path.join(root, 'claude');
  // Codex always installs to the real ~/.agents/skills/ — use a probe name no
  // real catalog will ever contain, so the test can never touch a user install.
  const probeName = 'hc-hktest-modelref-probe';
  const skillDir = path.join(claude, 'skills', probeName);
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(
    path.join(skillDir, 'SKILL.md'),
    `---\nname: ${probeName}\ndescription: Plan\n---\n\nUnder ultra pass model: {model:ultra}.`,
  );
  const destProbe = path.join(os.homedir(), '.agents', 'skills', probeName);
  try {
    new CodexProvider().installSkills(claude, path.join(root, 'out'));
    const installed = fs.readFileSync(path.join(destProbe, 'SKILL.md'), 'utf8');
    assert.ok(!installed.includes('{model:'), `placeholder leaked: ${installed}`);
    assert.match(installed, /model: gpt-5\.5/);
  } finally {
    fs.rmSync(destProbe, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// ZedProvider
// ---------------------------------------------------------------------------

test('ZedProvider.installSkills writes native SKILL.md beside .zed and records a manifest', () => {
  const root = tmp();
  const claude = path.join(root, 'claude');
  const skillDir = path.join(claude, 'skills', 'hc-plan');
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(
    path.join(skillDir, 'SKILL.md'),
    '---\nname: hc-plan\ndescription: Plan stuff\n---\n\nUse {skill:hc-cook} next.',
  );
  fs.mkdirSync(path.join(skillDir, 'references'), { recursive: true });
  fs.writeFileSync(path.join(skillDir, 'references', 'notes.txt'), 'raw asset');

  const target = path.join(root, '.zed');
  const count = new ZedProvider().installSkills(claude, target);
  assert.equal(count, 1);

  // Native skill lands at <parent-of-.zed>/.agents/skills/<name>/SKILL.md
  const installedMd = fs.readFileSync(
    path.join(root, '.agents', 'skills', 'hc-plan', 'SKILL.md'), 'utf8');
  assert.match(installedMd, /\/hc-cook/);
  assert.ok(!installedMd.includes('{skill:'), 'skill refs must be resolved');
  assert.ok(fs.existsSync(path.join(root, '.agents', 'skills', 'hc-plan', 'references', 'notes.txt')));

  const manifest = JSON.parse(
    fs.readFileSync(path.join(target, 'hailykit-installed-skills.json'), 'utf8'));
  assert.deepEqual(manifest, ['hc-plan']);
});

test('ZedProvider.installSkills skips skills whose providers frontmatter excludes zed', () => {
  const root = tmp();
  const claude = path.join(root, 'claude');
  const skillDir = path.join(claude, 'skills', 'hc-claude-only');
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(
    path.join(skillDir, 'SKILL.md'),
    '---\nname: hc-claude-only\ndescription: X\nproviders: claude\n---\n\nBody.',
  );

  const count = new ZedProvider().installSkills(claude, path.join(root, '.zed'));
  assert.equal(count, 0);
  assert.ok(!fs.existsSync(path.join(root, '.agents', 'skills', 'hc-claude-only')));
});

test('ZedProvider.installSkills removes skills dropped from the catalog on upgrade', () => {
  const root = tmp();
  const mkCatalog = (names: string[]): string => {
    const claude = path.join(root, 'claude-' + names.join('_'));
    for (const n of names) {
      const d = path.join(claude, 'skills', n);
      fs.mkdirSync(d, { recursive: true });
      fs.writeFileSync(path.join(d, 'SKILL.md'), `---\nname: ${n}\ndescription: X\n---\n\nBody.`);
    }
    return claude;
  };

  const target = path.join(root, '.zed');
  const p = new ZedProvider();
  p.installSkills(mkCatalog(['hc-plan', 'hc-old']), target);
  assert.ok(fs.existsSync(path.join(root, '.agents', 'skills', 'hc-old')));

  // New release no longer ships hc-old.
  p.installSkills(mkCatalog(['hc-plan']), target);
  assert.ok(!fs.existsSync(path.join(root, '.agents', 'skills', 'hc-old')), 'dropped skill must be cleaned up');
  assert.ok(fs.existsSync(path.join(root, '.agents', 'skills', 'hc-plan')));
  const manifest = JSON.parse(
    fs.readFileSync(path.join(target, 'hailykit-installed-skills.json'), 'utf8'));
  assert.deepEqual(manifest, ['hc-plan']);
});

test('ZedProvider.uninstall removes manifest-listed native skills', () => {
  const root = tmp();
  const claude = path.join(root, 'claude');
  const skillDir = path.join(claude, 'skills', 'hc-plan');
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(path.join(skillDir, 'SKILL.md'), '---\nname: hc-plan\ndescription: X\n---\n\nBody.');

  const target = path.join(root, '.zed');
  const p = new ZedProvider();
  p.installSkills(claude, target);
  // uninstall requires the provider meta marker
  fs.writeFileSync(path.join(target, '.hailykit-meta.json'), '{"version":"1.0.0"}');

  p.uninstall(target);
  assert.ok(!fs.existsSync(path.join(root, '.agents', 'skills', 'hc-plan')));
  assert.ok(!fs.existsSync(path.join(target, 'hailykit-installed-skills.json')));
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

  // Filename uses the snake_case slug (matches the config_file registry path).
  const toml = fs.readFileSync(path.join(target, 'agents', 'haily_researcher.toml'), 'utf8');
  assert.match(toml, /name = "haily-researcher"/);
  assert.match(toml, /description = "Research things"/);
  assert.match(toml, /developer_instructions/);
  assert.match(toml, /Do research\./);

  // Agent is registered in config.toml so Codex can discover it.
  const cfg = fs.readFileSync(path.join(target, 'config.toml'), 'utf8');
  assert.match(cfg, /\[agents\.haily_researcher\]/);
  assert.match(cfg, /config_file = "agents\/haily_researcher\.toml"/);
  assert.match(cfg, /# --- hailykit-agents-start ---/);
});

// ---------------------------------------------------------------------------
// codex-toml helpers
// ---------------------------------------------------------------------------

test('escapeTomlMultiline: breaks triple-quote runs, escapes backslash, pads trailing quote', () => {
  assert.equal(escapeTomlMultiline('a """ b'), 'a ""\\" b');
  assert.equal(escapeTomlMultiline('c:\\d'), 'c:\\\\d');
  assert.equal(escapeTomlMultiline('ends"'), 'ends"\n');
});

test('escapeTomlMultiline: escaped body keeps the closing delimiter intact', () => {
  const body = 'See """ x """ block';
  const toml = `developer_instructions = """\n${escapeTomlMultiline(body)}\n"""`;
  // No raw triple-quote run survives between the open and close delimiters.
  const inner = toml.slice(toml.indexOf('\n') + 1, toml.lastIndexOf('\n'));
  assert.ok(!inner.includes('"""'), 'inner body must not contain a raw """');
});

test('toCodexSlug: kebab → snake, lowercases, strips unsafe chars (no path traversal)', () => {
  assert.equal(toCodexSlug('haily-researcher'), 'haily_researcher');
  assert.equal(toCodexSlug('A B/../c'), 'a_b_c');
  assert.match(toCodexSlug('***'), /^agent_[0-9a-f]{8}$/); // empty-normalize → hash fallback
});

test('buildAgentConfigEntry: 3-line table with config_file pointer', () => {
  assert.equal(
    buildAgentConfigEntry('haily_researcher', 'Research things'),
    '[agents.haily_researcher]\ndescription = "Research things"\nconfig_file = "agents/haily_researcher.toml"',
  );
});

test('extractUnmanagedAgentSlugs: finds user [agents.X] tables', () => {
  const slugs = extractUnmanagedAgentSlugs('[agents.mybot]\nx = 1\n[other]\n[agents.two]\n');
  assert.deepEqual([...slugs].sort(), ['mybot', 'two']);
});

test('mergeManagedTomlBlock: idempotent single block, preserves user content, empty removes', () => {
  const S = '# --- hailykit-agents-start ---', E = '# --- hailykit-agents-end ---';
  const user = '[agents.mybot]\nx = 1\n';
  const once = mergeManagedTomlBlock(user, '[agents.a]', S, E);
  assert.match(once, /\[agents\.mybot\]/);
  assert.equal((once.match(/hailykit-agents-start/g) || []).length, 1);
  const twice = mergeManagedTomlBlock(once, '[agents.a]', S, E);
  assert.equal((twice.match(/hailykit-agents-start/g) || []).length, 1);
  assert.match(twice, /\[agents\.mybot\]/);
  const removed = mergeManagedTomlBlock(twice, '', S, E);
  assert.ok(!removed.includes('hailykit-agents-start'));
  assert.match(removed, /\[agents\.mybot\]/);
});

// ---------------------------------------------------------------------------
// CodexProvider.installAgents — registry, collision, idempotency, uninstall
// ---------------------------------------------------------------------------

test('CodexProvider.installAgents: preserves user [agents.X], skips slug collision', () => {
  const kit = kitWithAgent('mybot', 'Body.'); // normalizes to slug "mybot"
  const target = path.join(path.dirname(kit), 'out');
  fs.mkdirSync(target, { recursive: true });
  fs.writeFileSync(path.join(target, 'config.toml'), '[agents.mybot]\ndescription = "user"\n');

  new CodexProvider().installAgents!(kit, target);

  const cfg = fs.readFileSync(path.join(target, 'config.toml'), 'utf8');
  assert.match(cfg, /description = "user"/); // user entry preserved
  assert.ok(!cfg.includes('hailykit-agents-start'), 'colliding kit agent must be skipped, no managed block');
  assert.ok(!fs.existsSync(path.join(target, 'agents', 'mybot.toml')), 'collision must skip .toml write');
});

test('CodexProvider.installAgents: running twice yields exactly one managed block', () => {
  const kit = kitWithAgent('haily-researcher', 'Body.');
  const target = path.join(path.dirname(kit), 'out');
  fs.mkdirSync(target, { recursive: true });
  const prov = new CodexProvider();
  prov.installAgents!(kit, target);
  prov.installAgents!(kit, target);
  const cfg = fs.readFileSync(path.join(target, 'config.toml'), 'utf8');
  assert.equal((cfg.match(/hailykit-agents-start/g) || []).length, 1);
});

test('CodexProvider.uninstall: strips agents block, leaves user [agents.X]', () => {
  const kit = kitWithAgent('haily-researcher', 'Body.');
  const target = path.join(path.dirname(kit), 'out');
  fs.mkdirSync(target, { recursive: true });
  fs.writeFileSync(path.join(target, 'config.toml'), '[agents.mybot]\ndescription = "user"\n');
  const prov = new CodexProvider();
  prov.installAgents!(kit, target);
  prov.writeVersion(target, '1.0.0'); // uninstall needs the meta file present

  prov.uninstall(target);

  const cfg = fs.readFileSync(path.join(target, 'config.toml'), 'utf8');
  assert.ok(!cfg.includes('hailykit-agents-start'), 'managed block removed');
  assert.match(cfg, /\[agents\.mybot\]/); // user entry survives
});

test('CodexProvider.installAgents: body with triple-quotes produces parseable .toml', () => {
  const kit = kitWithAgent('haily-researcher', 'See """ x """ block');
  const target = path.join(path.dirname(kit), 'out');
  fs.mkdirSync(target, { recursive: true });
  new CodexProvider().installAgents!(kit, target);
  const toml = fs.readFileSync(path.join(target, 'agents', 'haily_researcher.toml'), 'utf8');
  const inner = toml.slice(toml.indexOf('"""') + 3, toml.lastIndexOf('"""'));
  assert.ok(!inner.includes('"""'), 'no raw triple-quote run inside developer_instructions');
});

// ---------------------------------------------------------------------------
// P3 — deriveSandboxMode + model/effort line assembly
// ---------------------------------------------------------------------------

test('deriveSandboxMode: write tool → workspace-write, read-only → read-only, none → null', () => {
  assert.equal(deriveSandboxMode('Bash, Read'), 'workspace-write');
  assert.equal(deriveSandboxMode('Glob, Grep, Read'), 'read-only');
  assert.equal(deriveSandboxMode('Task(Explore)'), 'workspace-write'); // task counts as write; parens stripped
  assert.equal(deriveSandboxMode(undefined), null);
  assert.equal(deriveSandboxMode(''), null);
  assert.equal(deriveSandboxMode('WebFetch'), null); // no known read/write tool
});

test('CodexProvider.installAgents: emits sandbox_mode from tools frontmatter', () => {
  const kit = kitWithAgent('haily-writer', 'Body.', 'model: medium\ntools: Bash, Read\n');
  const target = path.join(path.dirname(kit), 'out');
  fs.mkdirSync(target, { recursive: true });
  new CodexProvider().installAgents!(kit, target);
  const toml = fs.readFileSync(path.join(target, 'agents', 'haily_writer.toml'), 'utf8');
  assert.match(toml, /sandbox_mode = "workspace-write"/);
  assert.match(toml, /model = "gpt-5\.4"/); // medium tier resolved
  assert.ok(!toml.includes('model_reasoning_effort'), 'no effort data today → no effort line');
});

test('CodexProvider.installAgents: read-only tools → read-only; no tools → no sandbox line', () => {
  const ro = kitWithAgent('haily-reader', 'Body.', 'tools: Glob, Grep, Read\n');
  const t1 = path.join(path.dirname(ro), 'out');
  fs.mkdirSync(t1, { recursive: true });
  new CodexProvider().installAgents!(ro, t1);
  assert.match(fs.readFileSync(path.join(t1, 'agents', 'haily_reader.toml'), 'utf8'), /sandbox_mode = "read-only"/);

  const none = kitWithAgent('haily-plain', 'Body.'); // no tools field
  const t2 = path.join(path.dirname(none), 'out');
  fs.mkdirSync(t2, { recursive: true });
  new CodexProvider().installAgents!(none, t2);
  assert.ok(!fs.readFileSync(path.join(t2, 'agents', 'haily_plain.toml'), 'utf8').includes('sandbox_mode'));
});

test('CodexProvider.installAgents: unknown concrete model preserved as comment (no model = undefined)', () => {
  const kit = kitWithAgent('haily-x', 'Body.', 'model: some-raw-id\n');
  const target = path.join(path.dirname(kit), 'out');
  fs.mkdirSync(target, { recursive: true });
  new CodexProvider().installAgents!(kit, target);
  const toml = fs.readFileSync(path.join(target, 'agents', 'haily_x.toml'), 'utf8');
  assert.match(toml, /# model = "some-raw-id"/);
  assert.ok(!toml.includes('model = undefined'), 'must never emit model = undefined');
});

// ---------------------------------------------------------------------------
// codex-version — parse / compare / warn-only
// ---------------------------------------------------------------------------

test('parseVersion: tolerates prefixes, prerelease, missing patch; garbage → null', () => {
  assert.deepEqual(parseVersion('codex 0.130.0'), { major: 0, minor: 130, patch: 0, prerelease: '' });
  assert.deepEqual(parseVersion('v0.124.0-alpha.3'), { major: 0, minor: 124, patch: 0, prerelease: 'alpha.3' });
  assert.deepEqual(parseVersion('0.130'), { major: 0, minor: 130, patch: 0, prerelease: '' });
  assert.equal(parseVersion('nope'), null);
});

test('compareVersions: numeric precedence + prerelease < release + null lowest', () => {
  assert.equal(compareVersions('0.131.0', '0.130.0'), 1);
  assert.equal(compareVersions('0.124.0', '0.130.0'), -1);
  assert.equal(compareVersions('0.130.0', '0.130.0'), 0);
  assert.equal(compareVersions('0.130.0-alpha', '0.130.0'), -1);
  assert.equal(compareVersions('garbage', '0.130.0'), -1);
});

test('warnIfCodexHooksUnsupported: warns on null and on old version, silent on current', () => {
  const calls: string[] = [];
  const orig = console.warn;
  console.warn = (m?: unknown) => { calls.push(String(m)); };
  try {
    warnIfCodexHooksUnsupported(() => null);
    warnIfCodexHooksUnsupported(() => '0.124.0');
    warnIfCodexHooksUnsupported(() => '0.131.0');
  } finally { console.warn = orig; }
  assert.equal(calls.length, 2);
  assert.match(calls[0], /could not detect/);
  assert.match(calls[1], /older than the recommended/);
});

// ---------------------------------------------------------------------------
// codex-hook-compat — per-hook timeout + allowlist nested additionalContext strip
// ---------------------------------------------------------------------------

test('generateHookWrapper: bakes per-hook timeout (default 30000) + supported-events set', () => {
  assert.match(generateHookWrapper('/h/x.cjs', 15000), /timeout: 15000/);
  assert.match(generateHookWrapper('/h/x.cjs'), /timeout: 30000/);
  const src = generateHookWrapper('/h/x.cjs');
  for (const ev of ['SessionStart', 'SubagentStart', 'PreToolUse', 'PostToolUse', 'UserPromptSubmit']) {
    assert.ok(src.includes(`"${ev}"`), `supported set must list ${ev}`);
  }
});

test('buildTimeoutsByPath: maps resolved hook path → timeout, skips entries without timeout', () => {
  const hooks = {
    SessionStart: [{ hooks: [
      { type: 'command', command: 'node .claude/hooks/a.cjs', timeout: 12000 },
      { type: 'command', command: 'node .claude/hooks/b.cjs' },
    ] }],
  };
  const map = buildTimeoutsByPath(hooks, '/dest');
  assert.equal(map.get(path.join('/dest', 'a.cjs')), 12000);
  assert.equal(map.has(path.join('/dest', 'b.cjs')), false);
});

test('buildTimeoutsByPath: extracts .cjs from the shipped bash -c runner command shape', () => {
  // The real kit/settings.json uses this runner form, not `node .claude/hooks/x.cjs`.
  const cmd = `bash -c 'h=.claude/hooks/haily-node.sh; s=.claude/hooks/haily-session.cjs; [ -f "$h" ] || { h="$HOME/$h"; s="$HOME/$s"; }; bash "$h" "$s"'`;
  const map = buildTimeoutsByPath({ SessionStart: [{ hooks: [{ type: 'command', command: cmd, timeout: 9000 }] }] }, '/dest');
  // Picks the .cjs (haily-session.cjs), never the .sh runner.
  assert.equal(map.get(path.join('/dest', 'haily-session.cjs')), 9000);
});

test('buildCodexHooksJson: resolves wrapper for the shipped bash -c runner command shape', () => {
  const cmd = `bash -c 'h=.claude/hooks/haily-node.sh; s=.claude/hooks/haily-session.cjs; bash "$h" "$s"'`;
  const wrapperMap = new Map<string, string>([[path.join('/dest', 'haily-session.cjs'), '/dest/compat-x.cjs']]);
  const entries = buildCodexHooksJson({ SessionStart: [{ hooks: [{ type: 'command', command: cmd }] }] }, '/dest', wrapperMap);
  assert.equal(entries.length, 1);
  assert.match(entries[0].command.script, /compat-x\.cjs/);
});

// Runtime behavior of the generated wrapper: spawn it through node and inspect stdout.
// Verifies the verified-spec fix (nested field, allowlist, default-keep) end to end.
function runWrapper(wrapperPath: string, stdin: string): Record<string, unknown> {
  const out = execFileSync(process.execPath, [wrapperPath], { input: stdin, encoding: 'utf8' });
  return JSON.parse(out);
}

function stubHook(dir: string, emit: object): string {
  const p = path.join(dir, 'h.cjs');
  fs.writeFileSync(p, `process.stdout.write(${JSON.stringify(JSON.stringify(emit))});`);
  return p;
}

test('wrapper: KEEPS additionalContext for all 5 allowlist events (nested)', () => {
  const dir = tmp();
  const hook = stubHook(dir, { hookSpecificOutput: { additionalContext: 'x' } });
  const wrapper = path.join(dir, 'w.cjs');
  fs.writeFileSync(wrapper, generateHookWrapper(hook));
  for (const ev of ['SessionStart', 'SubagentStart', 'PreToolUse', 'PostToolUse', 'UserPromptSubmit']) {
    const out = runWrapper(wrapper, JSON.stringify({ hook_event_name: ev }));
    assert.equal((out.hookSpecificOutput as Record<string, unknown>).additionalContext, 'x', `kept for ${ev}`);
  }
});

test('wrapper: STRIPS additionalContext (nested + top-level) for non-allowlist events', () => {
  const dir = tmp();
  const hook = stubHook(dir, { hookSpecificOutput: { additionalContext: 'x', other: 1 }, additionalContext: 'y' });
  const wrapper = path.join(dir, 'w.cjs');
  fs.writeFileSync(wrapper, generateHookWrapper(hook));
  for (const ev of ['PermissionRequest', 'Stop', 'PreCompact', 'PostCompact', 'SubagentStop']) {
    const out = runWrapper(wrapper, JSON.stringify({ hook_event_name: ev }));
    assert.equal((out.hookSpecificOutput as Record<string, unknown>).additionalContext, undefined, `nested stripped for ${ev}`);
    assert.equal((out.hookSpecificOutput as Record<string, unknown>).other, 1, 'sibling field retained');
    assert.equal(out.additionalContext, undefined, `top-level stripped for ${ev}`);
  }
});

test('wrapper: nested-only emit removed on non-allowlist, kept on allowlist (proves nested targeting)', () => {
  const dir = tmp();
  const hook = stubHook(dir, { hookSpecificOutput: { additionalContext: 'x' } });
  const wrapper = path.join(dir, 'w.cjs');
  fs.writeFileSync(wrapper, generateHookWrapper(hook));
  const stripped = runWrapper(wrapper, JSON.stringify({ hook_event_name: 'Stop' }));
  assert.equal((stripped.hookSpecificOutput as Record<string, unknown>).additionalContext, undefined);
  const kept = runWrapper(wrapper, JSON.stringify({ hook_event_name: 'PreToolUse' }));
  assert.equal((kept.hookSpecificOutput as Record<string, unknown>).additionalContext, 'x');
});

test('wrapper: no hookSpecificOutput on non-allowlist event does not throw (null-check)', () => {
  const dir = tmp();
  const hook = stubHook(dir, { additionalContext: 'y', keep: 1 });
  const wrapper = path.join(dir, 'w.cjs');
  fs.writeFileSync(wrapper, generateHookWrapper(hook));
  const out = runWrapper(wrapper, JSON.stringify({ hook_event_name: 'Stop' }));
  assert.equal(out.additionalContext, undefined);
  assert.equal(out.keep, 1);
});

test('wrapper: default-keep when event undetectable (non-JSON / missing hook_event_name)', () => {
  const dir = tmp();
  const hook = stubHook(dir, { hookSpecificOutput: { additionalContext: 'x' } });
  const wrapper = path.join(dir, 'w.cjs');
  fs.writeFileSync(wrapper, generateHookWrapper(hook));
  const noEvent = runWrapper(wrapper, JSON.stringify({ foo: 1 }));
  assert.equal((noEvent.hookSpecificOutput as Record<string, unknown>).additionalContext, 'x');
  const nonJson = runWrapper(wrapper, 'not json');
  assert.equal((nonJson.hookSpecificOutput as Record<string, unknown>).additionalContext, 'x');
});

// ---------------------------------------------------------------------------
// P5 — config.toml robustness: feature-flag self-heal + atomic write
// ---------------------------------------------------------------------------

/** Write a config.toml into a fresh provider dir, run writeCodexConfigToml, return content. */
function runFeatureFlag(initial: string | null): string {
  const dir = tmp();
  if (initial !== null) fs.writeFileSync(path.join(dir, 'config.toml'), initial);
  writeCodexConfigToml(dir);
  return fs.readFileSync(path.join(dir, 'config.toml'), 'utf8');
}

test('writeCodexConfigToml: merges hooks=true into existing [features], no second header', () => {
  const out = runFeatureFlag('[features]\nunified_exec = true\n');
  assert.match(out, /hooks = true/);
  assert.match(out, /unified_exec = true/);
  assert.equal((out.match(/^\[features\]$/gm) || []).length, 1, 'exactly one [features] header');
});

test('writeCodexConfigToml: flips hooks = false → true', () => {
  const out = runFeatureFlag('[features]\nhooks = false\n');
  assert.match(out, /hooks = true/);
  assert.ok(!/hooks = false/.test(out));
});

test('writeCodexConfigToml: removes legacy codex_hooks, ensures hooks = true', () => {
  const out = runFeatureFlag('[features]\ncodex_hooks = true\n');
  assert.ok(!out.includes('codex_hooks'), 'legacy flag removed');
  assert.match(out, /hooks = true/);
});

test('writeCodexConfigToml: no [features] → appends one managed block; idempotent', () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'config.toml'), '[model]\nname = "x"\n');
  writeCodexConfigToml(dir);
  writeCodexConfigToml(dir); // second run must not duplicate
  const out = fs.readFileSync(path.join(dir, 'config.toml'), 'utf8');
  assert.match(out, /name = "x"/); // user content preserved
  assert.equal((out.match(/hailykit-hooks-start/g) || []).length, 1, 'one managed block');
  assert.match(out, /\[features\]\nhooks = true/);
});

test('writeCodexConfigToml: idempotent on an existing [features] section (no rewrite churn)', () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'config.toml'), '[features]\nunified_exec = true\n');
  writeCodexConfigToml(dir);
  const first = fs.readFileSync(path.join(dir, 'config.toml'), 'utf8');
  writeCodexConfigToml(dir);
  assert.equal(fs.readFileSync(path.join(dir, 'config.toml'), 'utf8'), first);
});

test('atomicWriteToml: writes content and leaves no .hailykit-tmp', () => {
  const dir = tmp();
  const p = path.join(dir, 'config.toml');
  atomicWriteToml(p, 'hello = 1\n');
  assert.equal(fs.readFileSync(p, 'utf8'), 'hello = 1\n');
  assert.ok(!fs.existsSync(`${p}.hailykit-tmp`), 'temp file cleaned up after rename');
});

test('CodexProvider.installHooks: runs cross-platform (incl. Windows) — writes wrappers, hooks.json, feature flag', () => {
  const root = tmp();
  const kit = path.join(root, 'kit');
  fs.mkdirSync(path.join(kit, 'hooks'), { recursive: true });
  fs.writeFileSync(path.join(kit, 'hooks', 'haily-session.cjs'), '// hook');
  const cmd = `bash -c 'h=.claude/hooks/haily-node.sh; s=.claude/hooks/haily-session.cjs; bash "$h" "$s"'`;
  fs.writeFileSync(
    path.join(kit, 'settings.json'),
    JSON.stringify({ hooks: { SessionStart: [{ matcher: 'startup', hooks: [{ type: 'command', command: cmd, timeout: 8000 }] }] } }),
  );

  const target = path.join(root, 'out');
  fs.mkdirSync(target, { recursive: true });
  new CodexProvider().installHooks(kit, target); // no win32 early-return anymore

  // hooks.json present with a forward-slash `node "..."` wrapper command
  const hooksJson = JSON.parse(fs.readFileSync(path.join(target, 'hooks.json'), 'utf8'));
  assert.equal(hooksJson.length, 1);
  assert.match(hooksJson[0].command.script, /^node "/);
  assert.ok(!hooksJson[0].command.script.includes('\\'), 'wrapper path uses forward slashes');
  assert.equal(hooksJson[0].command.timeout_sec, 8000);

  // a compat wrapper was generated for the .cjs
  const wrappers = fs.readdirSync(path.join(target, 'hooks')).filter((f) => f.startsWith('compat-'));
  assert.equal(wrappers.length, 1);

  // feature flag enabled
  assert.match(fs.readFileSync(path.join(target, 'config.toml'), 'utf8'), /\[features\]\nhooks = true/);
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

// ---------------------------------------------------------------------------
// CrushProvider
// ---------------------------------------------------------------------------

test('toCrushMd produces Agent Skills frontmatter without user-invocable', () => {
  const md = toCrushMd('hc-plan', 'Plan things', 'Do planning.');
  assert.match(md, /^---\n/);
  assert.match(md, /name: hc-plan/);
  assert.match(md, /description: "Plan things"/);
  assert.ok(!md.includes('user-invocable'), 'user-invocable is not part of the Agent Skills spec');
  assert.match(md, /Do planning\./);
});

test('CrushProvider.installSkills converts SKILL.md to Agent Skills format', () => {
  const root = tmp();
  const kit = path.join(root, 'kit');
  const skillDir = path.join(kit, 'skills', 'hc-plan');
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(
    path.join(skillDir, 'SKILL.md'),
    '---\nname: hc-plan\ndescription: Plan stuff\n---\n\nDo planning.',
  );

  const target = path.join(root, 'out');
  const count = new CrushProvider().installSkills(kit, target);
  assert.equal(count, 1);

  const md = fs.readFileSync(path.join(target, 'skills', 'hc-plan', 'SKILL.md'), 'utf8');
  assert.match(md, /name: hc-plan/);
  assert.ok(!md.includes('user-invocable'), 'user-invocable must not appear in Agent Skills output');
  assert.match(md, /Do planning\./);
});

test('CrushProvider.installRules writes CRUSH.md context file', () => {
  const root = tmp();
  const kit = path.join(root, 'kit');
  fs.mkdirSync(path.join(kit, 'rules'), { recursive: true });
  fs.writeFileSync(path.join(kit, 'rules', 'coding.md'), 'Coding rules');
  fs.writeFileSync(path.join(kit, 'rules', 'workflow.md'), 'Workflow rules');

  const target = path.join(root, 'out');
  new CrushProvider().installRules(kit, target);

  const crush = fs.readFileSync(path.join(target, 'CRUSH.md'), 'utf8');
  assert.match(crush, /Coding rules/);
  assert.match(crush, /Workflow rules/);
});

test('CrushProvider.installAgents strips model tier and copies to agents/', () => {
  const root = tmp();
  const kit = path.join(root, 'kit');
  fs.mkdirSync(path.join(kit, 'agents'), { recursive: true });
  fs.writeFileSync(
    path.join(kit, 'agents', 'haily-researcher.md'),
    '---\nname: haily-researcher\nmodel: medium\n---\n\nDo research.',
  );

  const target = path.join(root, 'out');
  new CrushProvider().installAgents!(kit, target);

  const content = fs.readFileSync(path.join(target, 'agents', 'haily-researcher.md'), 'utf8');
  assert.ok(!content.includes('model:'), 'model: line must be stripped for crush');
  assert.match(content, /Do research\./);
});

test('CrushProvider.skillRef uses /prefix-name slash syntax', () => {
  const p = new CrushProvider();
  assert.equal(
    (p as unknown as Record<string, Function>).skillRef('hc', 'cook'),
    '/hc-cook',
  );
});

// ---------------------------------------------------------------------------
// OpenCodeProvider — globalDir path fixes
// ---------------------------------------------------------------------------

test('OpenCodeProvider.globalDir returns XDG config path on Linux', () => {
  if (process.platform !== 'linux') return;
  const dir = new OpenCodeProvider().globalDir();
  assert.ok(dir.includes('opencode'), `expected opencode in path: ${dir}`);
  assert.ok(!dir.includes('Library'), 'should not use macOS Library path on Linux');
});

test('OpenCodeProvider strips model tier for agents', () => {
  const root = tmp();
  const kit = path.join(root, 'kit');
  fs.mkdirSync(path.join(kit, 'agents'), { recursive: true });
  fs.writeFileSync(
    path.join(kit, 'agents', 'haily-planner.md'),
    '---\nname: haily-planner\nmodel: thinking\n---\n\nPlan stuff.',
  );

  const target = path.join(root, 'out');
  new OpenCodeProvider().installAgents!(kit, target);

  const content = fs.readFileSync(path.join(target, 'agents', 'haily-planner.md'), 'utf8');
  assert.ok(!content.includes('model:'), 'model: tier must be stripped for opencode');
  assert.match(content, /Plan stuff\./);
});

// ---------------------------------------------------------------------------
// KimiProvider
// ---------------------------------------------------------------------------

test('toKimiMd produces Agent Skills frontmatter without user-invocable', () => {
  const md = toKimiMd('hc-plan', 'Plan things', 'Do planning.');
  assert.match(md, /name: hc-plan/);
  assert.match(md, /description: "Plan things"/);
  assert.ok(!md.includes('user-invocable'), 'Kimi does not need user-invocable field');
  assert.match(md, /Do planning\./);
});

test('KimiProvider.installSkills converts SKILL.md to Agent Skills format', () => {
  const root = tmp();
  const kit = path.join(root, 'kit');
  const skillDir = path.join(kit, 'skills', 'hc-plan');
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(
    path.join(skillDir, 'SKILL.md'),
    '---\nname: hc-plan\ndescription: Plan stuff\n---\n\nDo planning.',
  );

  const target = path.join(root, 'out');
  const count = new KimiProvider().installSkills(kit, target);
  assert.equal(count, 1);

  const md = fs.readFileSync(path.join(target, 'skills', 'hc-plan.md'), 'utf8');
  assert.match(md, /name: hc-plan/);
  assert.match(md, /Do planning\./);
});

test('KimiProvider.installRules writes AGENTS.md context file', () => {
  const root = tmp();
  const kit = path.join(root, 'kit');
  fs.mkdirSync(path.join(kit, 'rules'), { recursive: true });
  fs.writeFileSync(path.join(kit, 'rules', 'coding.md'), 'Coding rules');

  const target = path.join(root, 'out');
  new KimiProvider().installRules(kit, target);

  const agents = fs.readFileSync(path.join(target, 'AGENTS.md'), 'utf8');
  assert.match(agents, /Coding rules/);
});

test('KimiProvider.installAgents strips model tier and copies to agents/', () => {
  const root = tmp();
  const kit = path.join(root, 'kit');
  fs.mkdirSync(path.join(kit, 'agents'), { recursive: true });
  fs.writeFileSync(
    path.join(kit, 'agents', 'haily-researcher.md'),
    '---\nname: haily-researcher\nmodel: fast\n---\n\nDo research.',
  );

  const target = path.join(root, 'out');
  new KimiProvider().installAgents!(kit, target);

  const content = fs.readFileSync(path.join(target, 'agents', 'haily-researcher.md'), 'utf8');
  assert.ok(!content.includes('model:'), 'model: line must be stripped for kimi');
  assert.match(content, /Do research\./);
});

test('KimiProvider.installHooks writes TOML [[hooks]] block to config.toml', () => {
  const root = tmp();
  const kit = path.join(root, 'kit');
  fs.mkdirSync(path.join(kit, 'hooks'), { recursive: true });
  fs.writeFileSync(path.join(kit, 'hooks', 'test.cjs'), '// hook');

  const settings = {
    hooks: {
      PostToolUse: [{
        hooks: [{
          type: 'command',
          command: 'node .claude/hooks/test.cjs',
          timeout: 15000,
        }],
      }],
    },
  };
  fs.writeFileSync(path.join(kit, 'settings.json'), JSON.stringify(settings));

  const target = path.join(root, 'out');
  new KimiProvider().installHooks(kit, target);

  const toml = fs.readFileSync(path.join(target, 'config.toml'), 'utf8');
  assert.match(toml, /\[\[hooks\]\]/);
  assert.match(toml, /event = "PostToolUse"/);
  assert.match(toml, /timeout = 15/);
  assert.match(toml, /# hailykit-managed-start/);
  assert.match(toml, /# hailykit-managed-end/);
});

test('KimiProvider.installHooks handles the shipped bash -c runner command shape', () => {
  const root = tmp();
  const kit = path.join(root, 'kit');
  fs.mkdirSync(path.join(kit, 'hooks'), { recursive: true });
  fs.writeFileSync(path.join(kit, 'hooks', 'haily-prompt.cjs'), '// hook');

  const cmd = `bash -c 'h=.claude/hooks/haily-node.sh; s=.claude/hooks/haily-prompt.cjs; bash "$h" "$s"'`;
  const settings = { hooks: { UserPromptSubmit: [{ hooks: [{ type: 'command', command: cmd, timeout: 9000 }] }] } };
  fs.writeFileSync(path.join(kit, 'settings.json'), JSON.stringify(settings));

  const target = path.join(root, 'out');
  new KimiProvider().installHooks(kit, target);

  const toml = fs.readFileSync(path.join(target, 'config.toml'), 'utf8');
  assert.match(toml, /\[\[hooks\]\]/);
  assert.match(toml, /haily-prompt\.cjs/); // resolved the .cjs, not the .sh runner
  assert.ok(!toml.includes('haily-node.sh'), 'must not point at the .sh runner');
});

test('KimiProvider.installHooks upserts managed block in existing config.toml', () => {
  const root = tmp();
  const kit = path.join(root, 'kit');
  fs.mkdirSync(path.join(kit, 'hooks'), { recursive: true });
  fs.writeFileSync(path.join(kit, 'hooks', 'test.cjs'), '// hook');

  const settings = {
    hooks: {
      Stop: [{ hooks: [{ type: 'command', command: 'node .claude/hooks/test.cjs', timeout: 5000 }] }],
    },
  };
  fs.writeFileSync(path.join(kit, 'settings.json'), JSON.stringify(settings));

  const target = path.join(root, 'out');
  fs.mkdirSync(target, { recursive: true });
  fs.writeFileSync(path.join(target, 'config.toml'), '[model]\nname = "kimi"\n# hailykit-managed-start\nold\n# hailykit-managed-end\n');

  new KimiProvider().installHooks(kit, target);

  const toml = fs.readFileSync(path.join(target, 'config.toml'), 'utf8');
  assert.match(toml, /\[model\]/);
  assert.match(toml, /event = "Stop"/);
  assert.ok(!toml.includes('\nold\n'), 'stale block must be replaced');
  assert.equal((toml.match(/hailykit-managed-start/g) ?? []).length, 1, 'only one managed block');
});

test('KimiProvider.skillRef uses /skill:prefix-name format', () => {
  const p = new KimiProvider();
  assert.equal(
    (p as unknown as Record<string, Function>).skillRef('hc', 'cook'),
    '/skill:hc-cook',
  );
});
