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
import { PiProvider } from '../installer/providers/pi';
import { OmpProvider } from '../installer/providers/omp';
import { mapPiAgentCapabilities } from '../installer/providers/pi-agent-tools';
import { getProvider, resolveProviders } from '../installer/providers/index';
import { toCrushMd, toKimiMd } from '../installer/converter';
import {
  installManagedResource,
  pruneStaleManagedResources,
  uninstallManagedResources,
  writeManagedManifest,
  type ManagedResourcePaths,
} from '../installer/providers/native-resource';
import {
  escapeTomlMultiline, toCodexSlug, buildAgentConfigEntry, deriveSandboxMode,
  extractUnmanagedAgentSlugs, mergeManagedTomlBlock,
} from '../installer/providers/codex-toml';
import {
  agentMarkerPath,
  agentTomlPath,
  extractAgentTableSpans,
  removeAgentTableSpans,
  readAgentOwnershipMarker,
  readCodexAgentManifest,
  readManagedCodexAgentSlugs,
} from '../installer/providers/codex-agent-migration';
import { isGeneratedCodexAgentToml } from '../installer/providers/codex-agent-legacy';
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

function writeKitSkill(kit: string, name: string, body: string, fm = ''): void {
  const skillDir = path.join(kit, 'skills', name);
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(path.join(skillDir, 'SKILL.md'), `---\nname: ${name}\ndescription: ${name}\n${fm}---\n\n${body}`);
}

function writeKitRule(kit: string, name: string, body: string): void {
  fs.mkdirSync(path.join(kit, 'rules'), { recursive: true });
  fs.writeFileSync(path.join(kit, 'rules', `${name}.md`), body);
}

function writeKitAgent(kit: string, name: string, body: string, fm = ''): void {
  fs.mkdirSync(path.join(kit, 'agents'), { recursive: true });
  fs.writeFileSync(path.join(kit, 'agents', `${name}.md`), `---\nname: ${name}\ndescription: ${name}\n${fm}---\n\n${body}`);
}

test('GeminiProvider.installSkills converts SKILL.md to an hl-*.toml command', () => {
  const root = tmp();
  const claude = path.join(root, 'claude');
  const skillDir = path.join(claude, 'skills', 'hl-plan');
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(
    path.join(skillDir, 'SKILL.md'),
    '---\nname: hl-plan\ndescription: Plan stuff\n---\n\nDo planning.',
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
  const md = '---\nname: hl-plan\ndescription: Plan stuff\n---\n\nDo planning.';
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
  assert.match(native, /model: gemini-2\.5-pro/);
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
  const refDir = path.join(skillDir, 'references');
  fs.mkdirSync(refDir, { recursive: true });
  fs.writeFileSync(
    path.join(skillDir, 'SKILL.md'),
    '---\nname: hc-test\ndescription: Test\n---\n\nTest body. See references/detail.md.',
  );
  fs.writeFileSync(
    path.join(refDir, 'detail.md'),
    'Detailed reference documentation.',
  );

  const provider = new AntigravityProvider();

  // Mock globalDir() to point to a temporary test directory
  const testGlobalDir = path.join(root, 'global_workflows');
  (provider as any).globalDir = () => testGlobalDir;

  // 1. Global install
  const countGlobal = provider.installSkills(claude, testGlobalDir);
  assert.equal(countGlobal, 1);
  // Expecting: testGlobalDir/hc-test.md (flat markdown files in global_workflows)
  const globalMdPath = path.join(testGlobalDir, 'hc-test.md');
  assert.ok(fs.existsSync(globalMdPath));
  const globalContent = fs.readFileSync(globalMdPath, 'utf8');
  assert.ok(globalContent.includes('# Reference: references/detail.md'));
  assert.ok(globalContent.includes('view_file'));
  const manifestGlobal = JSON.parse(fs.readFileSync(path.join(testGlobalDir, 'hailykit-installed-skills.json'), 'utf8'));
  assert.deepEqual(manifestGlobal, ['hc-test']);

  // 2. Project install
  const testProjectDir = path.join(root, 'project');
  const countProject = provider.installSkills(claude, testProjectDir);
  assert.equal(countProject, 1);
  // Expecting: testProjectDir/skills/hc-test.md
  assert.ok(fs.existsSync(path.join(testProjectDir, 'skills', 'hc-test.md')));
  const manifestProject = JSON.parse(fs.readFileSync(path.join(testProjectDir, 'hailykit-installed-skills.json'), 'utf8'));
  assert.deepEqual(manifestProject, ['hc-test']);

  // 3. Uninstall
  fs.writeFileSync(path.join(testGlobalDir, '.hailykit-meta.json'), '{}');
  fs.writeFileSync(path.join(testProjectDir, '.hailykit-meta.json'), '{}');

  provider.uninstall(testGlobalDir);
  assert.ok(!fs.existsSync(path.join(testGlobalDir, 'hc-test.md')));
  assert.ok(!fs.existsSync(path.join(testGlobalDir, 'hailykit-installed-skills.json')));

  provider.uninstall(testProjectDir);
  assert.ok(!fs.existsSync(path.join(testProjectDir, 'skills', 'hc-test.md')));
  assert.ok(!fs.existsSync(path.join(testProjectDir, 'hailykit-installed-skills.json')));
});

test('CodexProvider skill copy resolves {model:ultra} placeholders', () => {
  const root = tmp();
  const claude = path.join(root, 'claude');
  const probeName = 'hc-hktest-modelref-probe';
  const skillDir = path.join(claude, 'skills', probeName);
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(
    path.join(skillDir, 'SKILL.md'),
    `---\nname: ${probeName}\ndescription: Plan\n---\n\nUnder ultra pass model: {model:ultra}.`,
  );
  const target = path.join(root, '.codex');
  new CodexProvider().installSkills(claude, target);

  const destProbe = path.join(root, '.agents', 'skills', probeName, 'SKILL.md');
  const installed = fs.readFileSync(destProbe, 'utf8');
  assert.ok(!installed.includes('{model:'), `placeholder leaked: ${installed}`);
  assert.match(installed, /model: gpt-5\.6-sol/);
  assert.deepEqual(
    JSON.parse(fs.readFileSync(path.join(target, 'hailykit-installed-skills.json'), 'utf8')),
    [probeName],
  );

  const staleAsset = path.join(root, '.agents', 'skills', probeName, 'references', 'removed.md');
  fs.mkdirSync(path.dirname(staleAsset), { recursive: true });
  fs.writeFileSync(staleAsset, 'stale');
  new CodexProvider().installSkills(claude, target);
  assert.ok(!fs.existsSync(staleAsset), 'managed skill dirs must be replaced on upgrade');
});

test('CodexProvider install removes only HailyKit-owned legacy skills', () => {
  const root = tmp();
  const source = path.join(root, 'kit');
  const current = path.join(source, 'skills', 'hc-plan');
  fs.mkdirSync(current, { recursive: true });
  fs.writeFileSync(
    path.join(current, 'SKILL.md'),
    '---\nname: hc-plan\ndescription: Plan\nmetadata:\n  author: HailyKit\n---\n\nBody.',
  );

  const target = path.join(root, '.codex');
  const ownedLegacy = path.join(target, 'skills', 'hc-plan');
  const userLegacy = path.join(target, 'skills', 'hc-personal');
  fs.mkdirSync(ownedLegacy, { recursive: true });
  fs.mkdirSync(userLegacy, { recursive: true });
  const separator = String.fromCharCode(58);
  fs.writeFileSync(
    path.join(ownedLegacy, 'SKILL.md'),
    `---\nname: hc${separator}plan\n---\n\nOld.`,
  );
  fs.writeFileSync(
    path.join(userLegacy, 'SKILL.md'),
    '---\nname: hc-personal\nmetadata:\n  author: User\n---\n\nKeep.',
  );

  new CodexProvider().installSkills(source, target);

  assert.ok(!fs.existsSync(ownedLegacy));
  assert.ok(fs.existsSync(userLegacy));
  assert.ok(fs.existsSync(path.join(root, '.agents', 'skills', 'hc-plan', 'SKILL.md')));
});

test('CodexProvider install removes colon-named legacy skills with no canonical counterpart', () => {
  const root = tmp();
  const source = path.join(root, 'kit');
  fs.mkdirSync(path.join(source, 'skills'), { recursive: true });

  const target = path.join(root, '.codex');
  const separator = String.fromCharCode(58);
  // Ported skill: third-party author, colon name, canonical name gone from the kit.
  const portedLegacy = path.join(target, 'skills', 'hc-graphify');
  fs.mkdirSync(portedLegacy, { recursive: true });
  fs.writeFileSync(
    path.join(portedLegacy, 'SKILL.md'),
    `---\nname: hc${separator}graphify\nmetadata:\n  author: safishamsi\n---\n\nOld.`,
  );
  // Removed-prefix skill: no author metadata at all.
  const removedPrefixLegacy = path.join(target, 'skills', 'hd-excalidraw');
  fs.mkdirSync(removedPrefixLegacy, { recursive: true });
  fs.writeFileSync(
    path.join(removedPrefixLegacy, 'SKILL.md'),
    `---\nname: hd${separator}excalidraw\n---\n\nOld.`,
  );
  // Non-HailyKit colon names must survive — the historical-prefix test scopes the removal.
  const foreignColon = path.join(target, 'skills', 'acme-tool');
  fs.mkdirSync(foreignColon, { recursive: true });
  fs.writeFileSync(
    path.join(foreignColon, 'SKILL.md'),
    `---\nname: acme${separator}tool\n---\n\nKeep.`,
  );
  const foreignHPrefix = path.join(target, 'skills', 'hx-tool');
  fs.mkdirSync(foreignHPrefix, { recursive: true });
  fs.writeFileSync(
    path.join(foreignHPrefix, 'SKILL.md'),
    `---\nname: hx${separator}tool\n---\n\nKeep.`,
  );

  new CodexProvider().installSkills(source, target);

  assert.ok(!fs.existsSync(portedLegacy), 'third-party-authored colon skill must be removed');
  assert.ok(!fs.existsSync(removedPrefixLegacy), 'authorless colon skill must be removed');
  assert.ok(fs.existsSync(foreignColon), 'non-HailyKit colon name must be preserved');
  assert.ok(fs.existsSync(foreignHPrefix), 'h-prefix outside the historical set must be preserved');
});

test('CodexProvider install removes pre-full-dir generated digest files', () => {
  const root = tmp();
  const source = path.join(root, 'kit');
  fs.mkdirSync(path.join(source, 'skills'), { recursive: true });

  const target = path.join(root, '.codex');
  fs.mkdirSync(target, { recursive: true });
  fs.writeFileSync(path.join(target, 'hailykit-skills.md'), 'stale colon list');
  fs.writeFileSync(path.join(target, 'hailykit-rules.md'), 'stale rules');

  new CodexProvider().installSkills(source, target);

  assert.ok(!fs.existsSync(path.join(target, 'hailykit-skills.md')));
  assert.ok(!fs.existsSync(path.join(target, 'hailykit-rules.md')));
});

test('CodexProvider installRules rewrites the stale skills-location scaffold comment', () => {
  const root = tmp();
  const source = path.join(root, 'kit');
  fs.mkdirSync(path.join(source, 'rules'), { recursive: true });
  fs.writeFileSync(path.join(source, 'rules', 'coding.md'), '# Rules\n\nBody.');

  const target = path.join(root, '.codex');
  fs.mkdirSync(target, { recursive: true });
  const staleComment = '<!-- Skills are in ~/.codex/skills/*/SKILL.md and regenerated on every upgrade. -->';
  fs.writeFileSync(
    path.join(target, 'AGENTS.md'),
    [
      '# Agent Instructions',
      '',
      staleComment,
      '',
      '<!-- hailykit-rules-start -->',
      'old block',
      '<!-- hailykit-rules-end -->',
      '',
    ].join('\n'),
  );

  new CodexProvider().installRules(source, target);

  const updated = fs.readFileSync(path.join(target, 'AGENTS.md'), 'utf8');
  assert.ok(!updated.includes(staleComment), 'stale pointer must be rewritten');
  assert.ok(updated.includes('~/.agents/skills/'), 'new pointer must name the real location');
  assert.ok(updated.includes('# Rules'), 'sentinel block must carry the new rules');
});

test('CodexProvider installRules heals the stale pointer on the append (no-sentinel) branch', () => {
  const root = tmp();
  const source = path.join(root, 'kit');
  fs.mkdirSync(path.join(source, 'rules'), { recursive: true });
  fs.writeFileSync(path.join(source, 'rules', 'coding.md'), '# Rules\n\nBody.');

  const target = path.join(root, '.codex');
  fs.mkdirSync(target, { recursive: true });
  const staleComment = '<!-- Skills are in ~/.codex/skills/*/SKILL.md and regenerated on every upgrade. -->';
  fs.writeFileSync(
    path.join(target, 'AGENTS.md'),
    `# My Instructions\n\n${staleComment}\n\nUser content, no sentinel block.\n`,
  );

  new CodexProvider().installRules(source, target);

  const updated = fs.readFileSync(path.join(target, 'AGENTS.md'), 'utf8');
  assert.ok(!updated.includes(staleComment), 'stale pointer must be rewritten on append too');
  assert.ok(updated.includes('User content, no sentinel block.'), 'user content must be preserved');
  assert.ok(updated.includes('hailykit-rules-start'), 'rules block must be appended');
});

test('CodexProvider uninstall removes legacy digest files even without install meta', () => {
  const root = tmp();
  const target = path.join(root, '.codex');
  fs.mkdirSync(target, { recursive: true });
  fs.writeFileSync(path.join(target, 'hailykit-skills.md'), 'stale colon list');
  fs.writeFileSync(path.join(target, 'hailykit-rules.md'), 'stale rules');

  new CodexProvider().uninstall(target);

  assert.ok(!fs.existsSync(path.join(target, 'hailykit-skills.md')));
  assert.ok(!fs.existsSync(path.join(target, 'hailykit-rules.md')));
});

test('CodexProvider uninstall is scope-aware and preserves user-owned prefixed skills', () => {
  const root = tmp();
  const source = path.join(root, 'kit');
  const current = path.join(source, 'skills', 'hc-plan');
  fs.mkdirSync(current, { recursive: true });
  fs.writeFileSync(
    path.join(current, 'SKILL.md'),
    '---\nname: hc-plan\ndescription: Plan\nmetadata:\n  author: HailyKit\n---\n\nBody.',
  );

  const target = path.join(root, '.codex');
  const provider = new CodexProvider();
  provider.installSkills(source, target);
  fs.writeFileSync(path.join(target, '.hailykit-meta.json'), '{"version":"1.0.0"}');

  const personal = path.join(root, '.agents', 'skills', 'hc-personal');
  fs.mkdirSync(personal, { recursive: true });
  fs.writeFileSync(
    path.join(personal, 'SKILL.md'),
    '---\nname: hc-personal\nmetadata:\n  author: HailyKit\n---\n\nKeep.',
  );

  provider.uninstall(target);

  assert.ok(!fs.existsSync(path.join(root, '.agents', 'skills', 'hc-plan')));
  assert.ok(fs.existsSync(personal));
  assert.ok(!fs.existsSync(path.join(target, 'hailykit-installed-skills.json')));
});

test('CodexProvider rules advertise canonical project and global skill roots', () => {
  const root = tmp();
  const source = path.join(root, 'kit');
  fs.mkdirSync(path.join(source, 'rules'), { recursive: true });
  fs.writeFileSync(path.join(source, 'rules', 'base.md'), 'Use {skill:hc-plan}.');
  const target = path.join(root, '.codex');

  new CodexProvider().installRules(source, target);

  const agents = fs.readFileSync(path.join(target, 'AGENTS.md'), 'utf8');
  assert.match(agents, /\.agents\/skills\//);
  assert.doesNotMatch(agents, /\.codex[\\/]skills/);
  assert.match(agents, /\$hc-plan/);
});

test('CodexProvider install never overwrites an unowned same-name skill', () => {
  const root = tmp();
  const sourceSkill = path.join(root, 'kit', 'skills', 'hc-plan');
  fs.mkdirSync(sourceSkill, { recursive: true });
  fs.writeFileSync(
    path.join(sourceSkill, 'SKILL.md'),
    '---\nname: hc-plan\ndescription: HailyKit\n---\n\nManaged body.',
  );

  const existingSkill = path.join(root, '.agents', 'skills', 'hc-plan');
  fs.mkdirSync(existingSkill, { recursive: true });
  const userContent = '---\nname: hc-plan\ndescription: Personal\n---\n\nUser body.';
  fs.writeFileSync(path.join(existingSkill, 'SKILL.md'), userContent);

  const count = new CodexProvider().installSkills(
    path.join(root, 'kit'),
    path.join(root, '.codex'),
  );

  assert.equal(count, 0);
  assert.equal(fs.readFileSync(path.join(existingSkill, 'SKILL.md'), 'utf8'), userContent);
  assert.ok(!fs.existsSync(path.join(existingSkill, '.hailykit-codex-skill.json')));
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

test('ZedProvider.installRules writes AGENTS.md instruction file', () => {
  const root = tmp();
  const claude = path.join(root, 'claude');
  const rulesDir = path.join(claude, 'rules');
  fs.mkdirSync(rulesDir, { recursive: true });
  fs.writeFileSync(path.join(rulesDir, '01-base.md'), 'Rule 1: Use {skill:hc-test}.');

  const target = path.join(root, '.zed');
  new ZedProvider().installRules(claude, target);

  const agentsMd = fs.readFileSync(path.join(target, 'AGENTS.md'), 'utf8');
  assert.match(agentsMd, /Rule 1: Use \/hc-test\./);
  assert.ok(!fs.existsSync(path.join(target, 'hailykit-rules.md')));
});

test('ZedProvider.installRules upserts AGENTS.md preserving content outside the sentinel block', () => {
  const root = tmp();
  const claude = path.join(root, 'claude');
  const rulesDir = path.join(claude, 'rules');
  fs.mkdirSync(rulesDir, { recursive: true });
  fs.writeFileSync(path.join(rulesDir, '01-base.md'), 'Rule 1: fresh content.');

  const target = path.join(root, '.zed');
  fs.mkdirSync(target, { recursive: true });
  const pre = 'My personal Zed notes\n<!-- hailykit-rules-start -->\nstale block\n<!-- hailykit-rules-end -->\nMore personal notes\n';
  fs.writeFileSync(path.join(target, 'AGENTS.md'), pre);

  new ZedProvider().installRules(claude, target);

  const agentsMd = fs.readFileSync(path.join(target, 'AGENTS.md'), 'utf8');
  assert.match(agentsMd, /My personal Zed notes/);
  assert.match(agentsMd, /More personal notes/);
  assert.match(agentsMd, /Rule 1: fresh content\./);
  assert.doesNotMatch(agentsMd, /stale block/);
  assert.equal(agentsMd.match(/hailykit-rules-start/g)?.length, 1);
});

test('ZedProvider.installRules appends the sentinel block to a user-created AGENTS.md with no prior HailyKit content', () => {
  const root = tmp();
  const claude = path.join(root, 'claude');
  const rulesDir = path.join(claude, 'rules');
  fs.mkdirSync(rulesDir, { recursive: true });
  fs.writeFileSync(path.join(rulesDir, '01-base.md'), 'Rule 1: fresh content.');

  const target = path.join(root, '.zed');
  fs.mkdirSync(target, { recursive: true });
  fs.writeFileSync(path.join(target, 'AGENTS.md'), 'My own instructions, never touched by HailyKit.\n');

  new ZedProvider().installRules(claude, target);

  const agentsMd = fs.readFileSync(path.join(target, 'AGENTS.md'), 'utf8');
  assert.match(agentsMd, /My own instructions, never touched by HailyKit\./);
  assert.match(agentsMd, /Rule 1: fresh content\./);
  assert.equal(agentsMd.match(/hailykit-rules-start/g)?.length, 1);
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

test('extractAgentTableSpans: returns exact unmanaged agent table spans', () => {
  const content = '[agents.one]\nx = 1\n\n[features]\nhooks = true\n\n[agents.two]\ny = 2\n';
  const spans = extractAgentTableSpans(content);
  assert.deepEqual(spans.map((span) => span.slug), ['one', 'two']);
  assert.match(spans[0].text, /\[agents\.one\]/);
  assert.ok(!spans[0].text.includes('[features]'), 'agent span must end at the next TOML table');
  assert.match(spans[1].text, /y = 2/);
  assert.match(removeAgentTableSpans(content, [spans[0]]), /\[features\]\nhooks = true/);
});

test('readCodexAgentManifest and readAgentOwnershipMarker: malformed files fail closed', () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'hailykit-installed-agents.json'), '["good","../bad",1]');
  fs.mkdirSync(path.join(dir, 'agents'), { recursive: true });
  const marker = agentMarkerPath(dir, 'good');
  fs.writeFileSync(marker, '{"provider":"codex","slug":7}');
  assert.deepEqual(readCodexAgentManifest(dir), ['good']);
  assert.equal(readAgentOwnershipMarker(marker), null);
});

test('isGeneratedCodexAgentToml: requires generated keys and exact developer instructions body', () => {
  const toml = [
    'name = "haily-researcher"',
    'description = "d"',
    'model = "gpt-5.6-terra"',
    'developer_instructions = """',
    '## Report Contract',
    '',
    'docs/engineering-standards.md',
    '"""',
    '',
  ].join('\n');
  assert.equal(isGeneratedCodexAgentToml(toml, {
    name: 'haily-researcher',
    legacyFingerprints: ['## Report Contract', 'docs/engineering-standards.md'],
  }), true);
  assert.equal(isGeneratedCodexAgentToml(`${toml}command = "custom"\n`, {
    name: 'haily-researcher',
    legacyFingerprints: ['## Report Contract', 'docs/engineering-standards.md'],
  }), false);
  assert.equal(isGeneratedCodexAgentToml(`${toml}[custom]\nenabled = "yes"\n`, {
    name: 'haily-researcher',
    legacyFingerprints: ['## Report Contract', 'docs/engineering-standards.md'],
  }), false);
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

  const result = new CodexProvider().installAgents!(kit, target);

  const cfg = fs.readFileSync(path.join(target, 'config.toml'), 'utf8');
  assert.deepEqual(result, { installed: 0, updated: 0, migrated: 0, skippedUser: 1, skippedDuplicate: 0 });
  assert.match(cfg, /description = "user"/); // user entry preserved
  assert.ok(!cfg.includes('hailykit-agents-start'), 'colliding kit agent must be skipped, no managed block');
  assert.ok(!fs.existsSync(path.join(target, 'agents', 'mybot.toml')), 'collision must skip .toml write');
});

test('CodexProvider.installAgents: adopts legacy generated agents into the managed block', () => {
  const kit = kitWithAgent(
    'haily-researcher',
    'Current body.\n\n## Report Contract\n\nSee docs/engineering-standards.md for more.',
  );
  const target = path.join(path.dirname(kit), 'out');
  fs.mkdirSync(path.join(target, 'agents'), { recursive: true });
  fs.writeFileSync(path.join(target, 'config.toml'), [
    '[agents.haily_researcher]',
    'description = "legacy config description"',
    'config_file = "agents/haily_researcher.toml"',
    '',
  ].join('\n'));
  fs.writeFileSync(path.join(target, 'agents', 'haily_researcher.toml'), [
    'name = "haily-researcher"',
    'description = "legacy TOML description"',
    'model = "legacy-model-id"',
    'developer_instructions = """',
    'Legacy body kept old wording.',
    '',
    '## Report Contract',
    '',
    'See docs/engineering-standards.md for more.',
    '"""',
    '',
  ].join('\n'));

  const result = new CodexProvider().installAgents!(kit, target);

  const cfg = fs.readFileSync(path.join(target, 'config.toml'), 'utf8');
  assert.deepEqual(result, { installed: 0, updated: 0, migrated: 1, skippedUser: 0, skippedDuplicate: 0 });
  assert.equal((cfg.match(/\[agents\.haily_researcher\]/g) ?? []).length, 1, 'legacy table migrated without duplication');
  assert.match(cfg, /# --- hailykit-agents-start ---/);
  assert.deepEqual(readCodexAgentManifest(target), ['haily_researcher']);
  assert.ok(readAgentOwnershipMarker(agentMarkerPath(target, 'haily_researcher')));
});

test('CodexProvider.installAgents: same-slug custom TOML with generated keys but no HailyKit fingerprints still skips', () => {
  const kit = kitWithAgent(
    'haily-researcher',
    'Current body.\n\n## Report Contract\n\nSee docs/engineering-standards.md for more.',
  );
  const target = path.join(path.dirname(kit), 'out');
  fs.mkdirSync(path.join(target, 'agents'), { recursive: true });
  fs.writeFileSync(path.join(target, 'config.toml'), [
    '[agents.haily_researcher]',
    'description = "custom"',
    'config_file = "agents/haily_researcher.toml"',
    '',
  ].join('\n'));
  fs.writeFileSync(path.join(target, 'agents', 'haily_researcher.toml'), [
    'name = "haily-researcher"',
    'description = "custom"',
    'model = "legacy-model-id"',
    'developer_instructions = """',
    'Custom body without stable HailyKit markers.',
    '"""',
    '',
  ].join('\n'));

  const result = new CodexProvider().installAgents!(kit, target);

  assert.deepEqual(result, { installed: 0, updated: 0, migrated: 0, skippedUser: 1, skippedDuplicate: 0 });
  assert.ok(!fs.existsSync(path.join(target, 'hailykit-installed-agents.json')));
});

test('CodexProvider.installAgents: duplicate unmanaged tables block legacy adoption', () => {
  const kit = kitWithAgent(
    'haily-researcher',
    'Current body.\n\n## Report Contract\n\nSee docs/engineering-standards.md for more.',
  );
  const target = path.join(path.dirname(kit), 'out');
  fs.mkdirSync(path.join(target, 'agents'), { recursive: true });
  const table = [
    '[agents.haily_researcher]',
    'description = "legacy"',
    'config_file = "agents/haily_researcher.toml"',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(target, 'config.toml'), table + table);
  fs.writeFileSync(agentTomlPath(target, 'haily_researcher'), [
    'name = "haily-researcher"',
    'description = "legacy"',
    'model = "legacy-model-id"',
    'developer_instructions = """',
    '## Report Contract',
    'docs/engineering-standards.md',
    '"""',
    '',
  ].join('\n'));

  const result = new CodexProvider().installAgents!(kit, target);

  assert.deepEqual(result, { installed: 0, updated: 0, migrated: 0, skippedUser: 1, skippedDuplicate: 0 });
  assert.equal((fs.readFileSync(path.join(target, 'config.toml'), 'utf8').match(/\[agents\.haily_researcher\]/g) ?? []).length, 2);
});

test('CodexProvider.installAgents: running twice yields exactly one managed block', () => {
  const kit = kitWithAgent('haily-researcher', 'Body.');
  const target = path.join(path.dirname(kit), 'out');
  fs.mkdirSync(target, { recursive: true });
  const prov = new CodexProvider();
  const first = prov.installAgents!(kit, target);
  const second = prov.installAgents!(kit, target);
  const cfg = fs.readFileSync(path.join(target, 'config.toml'), 'utf8');
  assert.deepEqual(first, { installed: 1, updated: 0, migrated: 0, skippedUser: 0, skippedDuplicate: 0 });
  assert.deepEqual(second, { installed: 0, updated: 0, migrated: 0, skippedUser: 0, skippedDuplicate: 0 });
  assert.equal((cfg.match(/hailykit-agents-start/g) || []).length, 1);
});

test('CodexProvider.installAgents: changed managed prompt is reported as updated', () => {
  const firstKit = kitWithAgent('haily-researcher', 'Old body.');
  const target = path.join(path.dirname(firstKit), 'out');
  fs.mkdirSync(target, { recursive: true });
  const provider = new CodexProvider();
  provider.installAgents!(firstKit, target);
  const secondKit = kitWithAgent('haily-researcher', 'New body.');

  const result = provider.installAgents!(secondKit, target);

  assert.deepEqual(result, { installed: 0, updated: 1, migrated: 0, skippedUser: 0, skippedDuplicate: 0 });
  assert.match(fs.readFileSync(agentTomlPath(target, 'haily_researcher'), 'utf8'), /New body\./);
});

test('CodexProvider.installAgents: malformed legacy ownership metadata is ignored, no crash', () => {
  const kit = kitWithAgent('haily-researcher', 'Body.');
  const target = path.join(path.dirname(kit), 'out');
  fs.mkdirSync(path.join(target, 'agents'), { recursive: true });
  fs.writeFileSync(path.join(target, 'hailykit-installed-agents.json'), '{"bad":true}');
  fs.writeFileSync(agentMarkerPath(target, 'haily_researcher'), '{"provider":"codex","slug":7}');
  assert.doesNotThrow(() => new CodexProvider().installAgents!(kit, target));
});

test('CodexProvider.installAgents: manifest without marker cannot authorize overwrite', () => {
  const kit = kitWithAgent('haily-researcher', 'Body.');
  const target = path.join(path.dirname(kit), 'out');
  fs.mkdirSync(path.join(target, 'agents'), { recursive: true });
  fs.writeFileSync(path.join(target, 'hailykit-installed-agents.json'), '["haily_researcher"]\n');
  fs.writeFileSync(path.join(target, 'config.toml'), [
    '[agents.haily_researcher]',
    'description = "custom"',
    'config_file = "agents/haily_researcher.toml"',
    '',
  ].join('\n'));
  fs.writeFileSync(agentTomlPath(target, 'haily_researcher'), 'name = "custom"\n');

  const result = new CodexProvider().installAgents!(kit, target);

  assert.deepEqual(result, { installed: 0, updated: 0, migrated: 0, skippedUser: 1, skippedDuplicate: 0 });
  assert.equal(fs.readFileSync(agentTomlPath(target, 'haily_researcher'), 'utf8'), 'name = "custom"\n');
});

test('CodexProvider.installAgents: unregistered same-slug TOML cannot be overwritten', () => {
  const kit = kitWithAgent('haily-researcher', 'Body.');
  const target = path.join(path.dirname(kit), 'out');
  fs.mkdirSync(path.join(target, 'agents'), { recursive: true });
  fs.writeFileSync(agentTomlPath(target, 'haily_researcher'), 'name = "user-file"\n');

  const result = new CodexProvider().installAgents!(kit, target);

  assert.deepEqual(result, { installed: 0, updated: 0, migrated: 0, skippedUser: 1, skippedDuplicate: 0 });
  assert.equal(fs.readFileSync(agentTomlPath(target, 'haily_researcher'), 'utf8'), 'name = "user-file"\n');
});

test('CodexProvider.installAgents: sidecar cannot authorize a customized unmanaged registry entry', () => {
  const kit = kitWithAgent('haily-researcher', 'Body.');
  const target = path.join(path.dirname(kit), 'out');
  fs.mkdirSync(target, { recursive: true });
  const provider = new CodexProvider();
  provider.installAgents!(kit, target);
  const before = fs.readFileSync(agentTomlPath(target, 'haily_researcher'), 'utf8');
  fs.writeFileSync(path.join(target, 'config.toml'), [
    '[agents.haily_researcher]',
    'description = "user-customized"',
    'config_file = "agents/haily_researcher.toml"',
    '',
  ].join('\n'));

  const result = provider.installAgents!(kit, target);

  assert.deepEqual(result, { installed: 0, updated: 0, migrated: 0, skippedUser: 1, skippedDuplicate: 0 });
  assert.equal(fs.readFileSync(agentTomlPath(target, 'haily_researcher'), 'utf8'), before);
  assert.match(fs.readFileSync(path.join(target, 'config.toml'), 'utf8'), /description = "user-customized"/);
});

test('CodexProvider.installAgents: stale managed agent TOML is cleaned up when the kit changes', () => {
  const first = kitWithAgent('haily-researcher', 'Body.');
  const target = path.join(path.dirname(first), 'out');
  fs.mkdirSync(target, { recursive: true });
  const provider = new CodexProvider();
  provider.installAgents!(first, target);

  const secondRoot = tmp();
  const secondKit = path.join(secondRoot, 'kit');
  fs.mkdirSync(path.join(secondKit, 'agents'), { recursive: true });
  fs.writeFileSync(
    path.join(secondKit, 'agents', 'haily-writer.md'),
    '---\nname: haily-writer\ndescription: d\n---\n\nBody.',
  );

  provider.installAgents!(secondKit, target);

  assert.ok(!fs.existsSync(agentTomlPath(target, 'haily_researcher')));
  assert.ok(!fs.existsSync(agentMarkerPath(target, 'haily_researcher')));
  assert.ok(fs.existsSync(agentTomlPath(target, 'haily_writer')));
  assert.deepEqual(readCodexAgentManifest(target), ['haily_writer']);
});

test('CodexProvider.uninstall: strips agents block, preserves user [agents.X] and user TOML', () => {
  const kit = kitWithAgent('haily-researcher', 'Body.');
  const target = path.join(path.dirname(kit), 'out');
  fs.mkdirSync(path.join(target, 'agents'), { recursive: true });
  fs.writeFileSync(path.join(target, 'config.toml'), '[agents.mybot]\ndescription = "user"\n');
  fs.writeFileSync(path.join(target, 'agents', 'custom.toml'), 'name = "custom"\n');
  const prov = new CodexProvider();
  prov.installAgents!(kit, target);
  prov.writeVersion(target, '1.0.0'); // uninstall needs the meta file present

  prov.uninstall(target);

  const cfg = fs.readFileSync(path.join(target, 'config.toml'), 'utf8');
  assert.ok(!cfg.includes('hailykit-agents-start'), 'managed block removed');
  assert.match(cfg, /\[agents\.mybot\]/); // user entry survives
  assert.ok(fs.existsSync(path.join(target, 'agents', 'custom.toml')), 'user TOML survives uninstall');
  assert.ok(!fs.existsSync(agentTomlPath(target, 'haily_researcher')));
  assert.ok(!fs.existsSync(path.join(target, 'hailykit-installed-agents.json')));
});

test('CodexProvider.uninstall: valid sidecar remains sufficient when the manifest is missing', () => {
  const kit = kitWithAgent('haily-researcher', 'Body.');
  const target = path.join(path.dirname(kit), 'out');
  fs.mkdirSync(target, { recursive: true });
  const provider = new CodexProvider();
  provider.installAgents!(kit, target);
  provider.writeVersion(target, '1.0.0');
  fs.rmSync(path.join(target, 'hailykit-installed-agents.json'));
  assert.deepEqual(readManagedCodexAgentSlugs(target), ['haily_researcher']);

  provider.uninstall(target);

  assert.ok(!fs.existsSync(agentTomlPath(target, 'haily_researcher')));
  assert.ok(!fs.existsSync(agentMarkerPath(target, 'haily_researcher')));
});

test('CodexProvider.uninstall: manifest alone cannot authorize deleting an agent TOML', () => {
  const root = tmp();
  const target = path.join(root, 'out');
  fs.mkdirSync(path.join(target, 'agents'), { recursive: true });
  fs.writeFileSync(path.join(target, 'hailykit-installed-agents.json'), '["haily_researcher"]\n');
  fs.writeFileSync(agentTomlPath(target, 'haily_researcher'), 'name = "user-file"\n');
  const provider = new CodexProvider();
  provider.writeVersion(target, '1.0.0');

  provider.uninstall(target);

  assert.equal(fs.readFileSync(agentTomlPath(target, 'haily_researcher'), 'utf8'), 'name = "user-file"\n');
});

test('CodexProvider.uninstall: cleans explicitly owned agents after an install interrupted before metadata', () => {
  const kit = kitWithAgent('haily-researcher', 'Body.');
  const target = path.join(path.dirname(kit), 'out');
  fs.mkdirSync(target, { recursive: true });
  const provider = new CodexProvider();
  provider.installAgents!(kit, target);

  provider.uninstall(target);

  assert.ok(!fs.existsSync(agentTomlPath(target, 'haily_researcher')));
  assert.ok(!fs.existsSync(agentMarkerPath(target, 'haily_researcher')));
  assert.ok(!fs.readFileSync(path.join(target, 'config.toml'), 'utf8').includes('hailykit-agents-start'));
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
  assert.match(toml, /model = "gpt-5\.6-terra"/); // medium tier resolved
  assert.match(toml, /model_reasoning_effort = "medium"/);
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

test('buildCodexHooksJson: emits the native nested schema and resolves shipped runner commands', () => {
  const cmd = `bash -c 'h=.claude/hooks/haily-node.sh; s=.claude/hooks/haily-session.cjs; bash "$h" "$s"'`;
  const wrapperMap = new Map<string, string>([[path.join('/dest', 'haily-session.cjs'), '/dest/compat-x.cjs']]);
  const config = buildCodexHooksJson({
    SessionStart: [{ matcher: 'startup', hooks: [{ type: 'command', command: cmd, timeout: 8000 }] }],
    SubagentStart: [{ hooks: [{ type: 'command', command: cmd }] }],
    SessionEnd: [{ hooks: [{ type: 'command', command: cmd }] }],
  }, '/dest', wrapperMap);
  assert.deepEqual(Object.keys(config), ['hooks']);
  assert.deepEqual(Object.keys(config.hooks), ['SessionStart', 'SubagentStart', 'SessionEnd']);
  assert.equal(config.hooks.SessionStart[0].matcher, 'startup');
  assert.deepEqual(config.hooks.SessionStart[0].hooks[0], {
    type: 'command',
    command: 'node "/dest/compat-x.cjs"',
    timeout: 8,
  });
});

test('CodexProvider.installAgents: ultra tier resolves to the Codex top model', () => {
  const kit = kitWithAgent('haily-advisor', 'Body.', 'model: ultra\nmodel_max: ultra\n');
  const target = path.join(path.dirname(kit), 'out');
  fs.mkdirSync(target, { recursive: true });
  new CodexProvider().installAgents!(kit, target);
  const toml = fs.readFileSync(path.join(target, 'agents', 'haily_advisor.toml'), 'utf8');
  assert.match(toml, /model = "gpt-5\.6-sol"/);
  assert.match(toml, /model_reasoning_effort = "xhigh"/);
  assert.ok(!toml.includes('# model = "ultra"'));
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
  assert.deepEqual(Object.keys(hooksJson), ['hooks']);
  const handler = hooksJson.hooks.SessionStart[0].hooks[0];
  assert.equal(hooksJson.hooks.SessionStart[0].matcher, 'startup');
  assert.equal(handler.type, 'command');
  assert.match(handler.command, /^node "/);
  assert.ok(!handler.command.includes('\\'), 'wrapper path uses forward slashes');
  assert.equal(handler.timeout, 8);

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

test('toCrushMd produces Agent Skills frontmatter without user-invocable when false', () => {
  const md = toCrushMd('hc-plan', 'Plan things', false, 'Do planning.');
  assert.match(md, /^---\n/);
  assert.match(md, /name: hc-plan/);
  assert.match(md, /description: "Plan things"/);
  assert.ok(!md.includes('user-invocable'), 'user-invocable is not part of the Agent Skills spec');
  assert.match(md, /Do planning\./);
});

test('toCrushMd emits user-invocable: true when requested', () => {
  const md = toCrushMd('hc-plan', 'Plan things', true, 'Do planning.');
  assert.match(md, /^---\n/);
  assert.match(md, /name: hc-plan/);
  assert.match(md, /description: "Plan things"/);
  assert.match(md, /user-invocable: true/);
  assert.match(md, /Do planning\./);
});

test('CrushProvider.installSkills converts SKILL.md to Agent Skills format', () => {
  const root = tmp();
  const kit = path.join(root, 'kit');
  const skillDir = path.join(kit, 'skills', 'hc-plan');
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(
    path.join(skillDir, 'SKILL.md'),
    '---\nname: hc-plan\ndescription: Plan stuff\nuser-invocable: true\n---\n\nDo planning.',
  );

  const target = path.join(root, 'out');
  const count = new CrushProvider().installSkills(kit, target);
  assert.equal(count, 1);

  const md = fs.readFileSync(path.join(target, 'skills', 'hc-plan', 'SKILL.md'), 'utf8');
  assert.match(md, /name: hc-plan/);
  assert.match(md, /user-invocable: true/);
  assert.match(md, /Do planning\./);
});

test('CrushProvider.installSkills copies references/ and scripts/ into skill directory', () => {
  const root = tmp();
  const kit = path.join(root, 'kit');
  const skillDir = path.join(kit, 'skills', 'hc-plan');
  const refDir = path.join(skillDir, 'references');
  const scriptsDir = path.join(skillDir, 'scripts');
  fs.mkdirSync(refDir, { recursive: true });
  fs.mkdirSync(scriptsDir, { recursive: true });
  fs.writeFileSync(
    path.join(skillDir, 'SKILL.md'),
    '---\nname: hc-plan\ndescription: Plan stuff\n---\n\nDo planning.',
  );
  fs.writeFileSync(path.join(refDir, 'detail.md'), 'Detailed reference.');
  fs.mkdirSync(path.join(refDir, 'nested'), { recursive: true });
  fs.writeFileSync(path.join(refDir, 'nested', 'more.md'), 'Nested reference.');
  fs.writeFileSync(path.join(refDir, 'notes.txt'), 'Non-markdown asset.');
  fs.writeFileSync(path.join(scriptsDir, 'run.py'), 'print("ok")');
  fs.mkdirSync(path.join(scriptsDir, 'lib'), { recursive: true });
  fs.writeFileSync(path.join(scriptsDir, 'lib', 'util.py'), 'def util(): pass');

  const target = path.join(root, 'out');
  const count = new CrushProvider().installSkills(kit, target);
  assert.equal(count, 1);

  assert.ok(fs.existsSync(path.join(target, 'skills', 'hc-plan', 'references', 'detail.md')));
  assert.equal(
    fs.readFileSync(path.join(target, 'skills', 'hc-plan', 'references', 'detail.md'), 'utf8'),
    'Detailed reference.',
  );
  assert.ok(fs.existsSync(path.join(target, 'skills', 'hc-plan', 'references', 'nested', 'more.md')));
  assert.ok(
    !fs.existsSync(path.join(target, 'skills', 'hc-plan', 'references', 'notes.txt')),
    'non-markdown reference assets should not be copied',
  );

  assert.ok(fs.existsSync(path.join(target, 'skills', 'hc-plan', 'scripts', 'run.py')));
  assert.equal(
    fs.readFileSync(path.join(target, 'skills', 'hc-plan', 'scripts', 'run.py'), 'utf8'),
    'print("ok")',
  );
  assert.ok(fs.existsSync(path.join(target, 'skills', 'hc-plan', 'scripts', 'lib', 'util.py')));
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

// ---------------------------------------------------------------------------
// Native resource ownership helper
// ---------------------------------------------------------------------------

test('native-resource installs, prunes stale managed entries, and preserves unowned collisions', () => {
  const root = tmp();
  const src = path.join(root, 'src');
  const out = path.join(root, 'out');
  fs.mkdirSync(src, { recursive: true });
  fs.writeFileSync(path.join(src, 'note.md'), 'hello');
  const paths: ManagedResourcePaths = {
    rootPath: root,
    manifestPath: path.join(root, 'manifest.json'),
    targetPath: (name) => path.join(out, name),
    markerPath: (name) => path.join(out, name, '.marker.json'),
  };

  assert.equal(installManagedResource({
    name: 'hc-plan',
    provider: 'pi',
    kind: 'skill',
    sourcePath: src,
    targetPath: paths.targetPath('hc-plan'),
    markerPath: paths.markerPath('hc-plan'),
    rootPath: root,
  }), 'installed');

  fs.mkdirSync(paths.targetPath('hc-cook'), { recursive: true });
  fs.writeFileSync(path.join(paths.targetPath('hc-cook'), 'note.md'), 'user');
  assert.equal(installManagedResource({
    name: 'hc-cook',
    provider: 'pi',
    kind: 'skill',
    sourcePath: src,
    targetPath: paths.targetPath('hc-cook'),
    markerPath: paths.markerPath('hc-cook'),
    rootPath: root,
  }), 'skipped-user');

  writeManagedManifest(paths.manifestPath, ['hc-plan', 'hc-old']);
  fs.mkdirSync(paths.targetPath('hc-old'), { recursive: true });
  fs.writeFileSync(paths.markerPath('hc-old'), '{"provider":"pi","kind":"skill","name":"hc-old"}\n');
  fs.mkdirSync(paths.targetPath('hc-other'), { recursive: true });
  fs.writeFileSync(paths.markerPath('hc-other'), '{"provider":"omp","kind":"skill","name":"hc-other"}\n');
  assert.equal(pruneStaleManagedResources('pi', 'skill', new Set(['hc-plan']), paths), 1);
  assert.ok(!fs.existsSync(paths.targetPath('hc-old')));
  assert.ok(fs.existsSync(paths.targetPath('hc-other')));

  writeManagedManifest(paths.manifestPath, ['hc-plan', 'hc-other']);
  assert.equal(uninstallManagedResources('pi', 'skill', paths), 1);
  assert.ok(!fs.existsSync(paths.targetPath('hc-plan')));
  assert.ok(fs.existsSync(paths.targetPath('hc-other')));
});

test('native-resource rejects unsafe names', () => {
  const root = tmp();
  fs.mkdirSync(path.join(root, 'src'), { recursive: true });
  assert.throws(() => installManagedResource({
    name: '../escape',
    provider: 'pi',
    kind: 'skill',
    sourcePath: path.join(root, 'src'),
    targetPath: path.join(root, 'out'),
    markerPath: path.join(root, 'marker.json'),
    rootPath: root,
  }), /Unsafe managed resource name/);

  assert.throws(() => installManagedResource({
    name: 'hc-plan',
    provider: 'pi',
    kind: 'skill',
    sourcePath: path.join(root, 'src'),
    targetPath: path.join(root, '..', 'escaped'),
    markerPath: path.join(root, 'marker.json'),
    rootPath: root,
  }), /escapes provider root/);
});

// ---------------------------------------------------------------------------
// Pi / OMP providers
// ---------------------------------------------------------------------------

test('PiProvider installs native skills, additive rules, and optional-extension agents', () => {
  const root = tmp();
  const kit = path.join(root, 'kit');
  writeKitSkill(kit, 'hc-plan', 'Use {skill:hc-cook}. model: {model:ultra}', 'model: thinking\n');
  writeKitRule(kit, 'haily-coding', 'Always use {skill:hc-plan}.');
  writeKitAgent(kit, 'haily-planner', 'Delegate with {agent:haily-reviewer}.', 'tools: Glob, Grep, Read, Bash\n');

  const target = path.join(root, '.pi');
  const provider = new PiProvider();
  assert.equal(provider.installSkills(kit, target), 1);
  provider.installRules(kit, target);
  const agents = provider.installAgents!(kit, target);
  assert.equal(agents.installed, 1);

  const skill = fs.readFileSync(path.join(target, 'skills', 'hc-plan', 'SKILL.md'), 'utf8');
  assert.match(skill, /\/skill:hc-cook/);
  assert.ok(!skill.includes('{skill:'));
  assert.ok(!skill.includes('{model:'));
  assert.ok(!/^model:\s*(thinking|medium|fast|ultra)$/m.test(skill));

  const append = fs.readFileSync(path.join(target, 'APPEND_SYSTEM.md'), 'utf8');
  assert.match(append, /Always use \/skill:hc-plan/);
  assert.match(append, /hailykit-pi-rules-start/);

  const agent = fs.readFileSync(path.join(target, 'agents', 'haily-planner.md'), 'utf8');
  assert.match(agent, /HailyKit's `task` tool runs these agents in isolated conversation context/i);
  assert.match(agent, /tools: find, grep, read, bash/);
  assert.ok(!agent.includes('{agent:'));
});

test('PiProvider accepts the shipped uppercase Explore agent name', () => {
  const root = tmp();
  const kit = path.join(root, 'kit');
  writeKitAgent(kit, 'Explore', 'Read only.', 'tools: Glob, Grep, Read, Bash\n');
  const result = new PiProvider().installAgents!(kit, path.join(root, '.pi'));
  assert.equal(result.installed, 1);
  assert.ok(fs.existsSync(path.join(root, '.pi', 'agents', 'Explore.md')));
});

test('PiProvider uses PI_CODING_AGENT_DIR for global installs and preserves unowned collisions', () => {
  const root = tmp();
  const previous = process.env['PI_CODING_AGENT_DIR'];
  process.env['PI_CODING_AGENT_DIR'] = path.join(root, 'shared-agent-dir');
  try {
    const provider = new PiProvider();
    assert.equal(provider.globalDir(), path.join(root, 'shared-agent-dir'));

    const kit = path.join(root, 'kit');
    writeKitSkill(kit, 'hc-plan', 'Managed body.');
    writeKitRule(kit, 'haily-coding', 'Always use {skill:hc-plan}.');
    writeKitAgent(kit, 'haily-planner', 'Managed agent.');

    const target = provider.globalDir();
    fs.mkdirSync(path.join(target, 'skills', 'hc-plan'), { recursive: true });
    fs.writeFileSync(path.join(target, 'skills', 'hc-plan', 'SKILL.md'), 'user');
    fs.mkdirSync(path.join(target, 'agents'), { recursive: true });
    fs.writeFileSync(path.join(target, 'agents', 'haily-planner.md'), 'user');

    assert.equal(provider.installSkills(kit, target), 0);
    const agents = provider.installAgents!(kit, target);
    assert.equal(agents.skippedUser, 1);
    assert.equal(fs.readFileSync(path.join(target, 'skills', 'hc-plan', 'SKILL.md'), 'utf8'), 'user');
    assert.equal(fs.readFileSync(path.join(target, 'agents', 'haily-planner.md'), 'utf8'), 'user');
  } finally {
    if (previous === undefined) delete process.env['PI_CODING_AGENT_DIR'];
    else process.env['PI_CODING_AGENT_DIR'] = previous;
  }
});

test('PiProvider reinstall updates owned skills and prunes catalog removals', () => {
  const root = tmp();
  const kit = path.join(root, 'kit');
  const target = path.join(root, '.pi');
  const provider = new PiProvider();
  writeKitSkill(kit, 'hc-plan', 'First body.');

  assert.equal(provider.installSkills(kit, target), 1);
  writeKitSkill(kit, 'hc-plan', 'Second body.');
  assert.equal(provider.installSkills(kit, target), 1);
  assert.match(fs.readFileSync(path.join(target, 'skills', 'hc-plan', 'SKILL.md'), 'utf8'), /Second body/);

  fs.rmSync(path.join(kit, 'skills', 'hc-plan'), { recursive: true });
  assert.equal(provider.installSkills(kit, target), 0);
  assert.ok(!fs.existsSync(path.join(target, 'skills', 'hc-plan')));
});

test('OMP installs native agents without provider-neutral model tiers or Claude tool syntax', () => {
  const root = tmp();
  const kit = path.join(root, 'kit');
  writeKitSkill(kit, 'hc-plan', 'Run {skill:hc-cook}. model: {model:ultra}', 'model: thinking\n');
  writeKitRule(kit, 'haily-coding', 'Always use {skill:hc-plan}.');
  writeKitAgent(kit, 'haily-planner', 'Delegate with {agent:haily-reviewer}.', 'model: thinking\nmodel_max: ultra\ntools: Bash, Read, Task(Explore)\n');

  const target = path.join(root, '.omp');
  const provider = new OmpProvider();
  assert.equal(provider.installSkills(kit, target), 1);
  provider.installRules(kit, target);
  const agents = provider.installAgents!(kit, target);
  assert.equal(agents.installed, 1);

  const agent = fs.readFileSync(path.join(target, 'agents', 'haily-planner.md'), 'utf8');
  assert.match(agent, /^---\nname: haily-planner\n/);
  assert.match(agent, /description: "haily-planner"/);
  assert.ok(!agent.includes('{skill:'));
  assert.ok(!agent.includes('{agent:'));
  assert.ok(!agent.includes('{model:'));
  assert.ok(!/model:\s*(thinking|medium|fast|ultra)/.test(agent));
  assert.ok(!agent.includes('tools: Bash'));
  assert.match(agent, /tools: bash, read, task/);
  assert.match(agent, /spawns: Explore/);
  assert.match(agent, /OMP's `task` tool/);
});

test('OMP tool mapping preserves shipped read-only and write-capable agent boundaries', () => {
  const cases = [
    ['haily-advisor', 'Glob, Grep, Read', ['glob', 'grep', 'read']],
    ['haily-reviewer', 'Glob, Grep, Read, Bash, WebFetch, WebSearch', ['glob', 'grep', 'read', 'bash', 'web_search']],
    ['haily-implementor', 'Glob, Grep, Read, Edit, MultiEdit, Write, NotebookEdit, Bash, WebFetch, WebSearch, Task(Explore)', ['glob', 'grep', 'read', 'edit', 'write', 'bash', 'web_search', 'task']],
    ['haily-git-manager', 'Glob, Grep, Read, Bash', ['glob', 'grep', 'read', 'bash']],
  ] as const;

  for (const [name, source, expected] of cases) {
    assert.deepEqual(mapPiAgentCapabilities(source, 'omp').tools, expected, name);
  }
});

test('Pi and OMP convert every shipped agent without widening Claude policies', () => {
  const kit = path.resolve('kit');
  const expected = fs.readdirSync(path.join(kit, 'agents')).filter((file) => file.endsWith('.md')).length;
  const root = tmp();

  const pi = new PiProvider().installAgents!(kit, path.join(root, '.pi'));
  const omp = new OmpProvider().installAgents!(kit, path.join(root, '.omp'));
  assert.equal(pi.installed, expected);
  assert.equal(omp.installed, expected);

  for (const providerDir of [path.join(root, '.pi'), path.join(root, '.omp')]) {
    for (const file of fs.readdirSync(path.join(providerDir, 'agents')).filter((name) => name.endsWith('.md'))) {
      const content = fs.readFileSync(path.join(providerDir, 'agents', file), 'utf8');
      assert.match(content, /^tools: [a-z_, -]+$/m, file);
      assert.ok(!content.includes('tools: Glob'), file);
      assert.ok(!content.includes('model_max:'), file);
    }
  }
});

test('Pi and OMP sharing PI_CODING_AGENT_DIR do not delete each other on cleanup', () => {
  const root = tmp();
  const previous = process.env['PI_CODING_AGENT_DIR'];
  process.env['PI_CODING_AGENT_DIR'] = path.join(root, 'shared-agent-dir');
  try {
    const kit = path.join(root, 'kit');
    writeKitSkill(kit, 'hc-plan', 'Managed body.');
    writeKitRule(kit, 'haily-coding', 'Always use {skill:hc-plan}.');
    writeKitAgent(kit, 'haily-planner', 'Managed agent.');

    const pi = new PiProvider();
    const omp = new OmpProvider();
    const target = pi.globalDir();
    assert.equal(target, omp.globalDir());

    assert.equal(pi.installSkills(kit, target), 1);
    const piAgents = pi.installAgents!(kit, target);
    assert.equal(piAgents.installed, 1);

    const ompSkills = omp.installSkills(kit, target);
    const ompAgents = omp.installAgents!(kit, target);
    assert.equal(ompSkills, 0);
    assert.equal(ompAgents.skippedUser, 1);

    pi.installRules(kit, target);
    omp.installRules(kit, target);
    pi.writeVersion(target, '1.0.0');
    omp.writeVersion(target, '2.0.0');
    assert.equal(pi.readVersion(target), '1.0.0');
    assert.equal(omp.readVersion(target), '2.0.0');
    assert.match(pi.readInstalledAt(target) ?? '', /^\d{4}-\d{2}-\d{2}T/);
    assert.match(omp.readInstalledAt(target) ?? '', /^\d{4}-\d{2}-\d{2}T/);

    omp.uninstall(target);
    assert.ok(fs.existsSync(path.join(target, 'skills', 'hc-plan', 'SKILL.md')));
    assert.ok(fs.existsSync(path.join(target, 'agents', 'haily-planner.md')));
    assert.match(fs.readFileSync(path.join(target, 'APPEND_SYSTEM.md'), 'utf8'), /hailykit-pi-rules-start/);
    assert.ok(!fs.readFileSync(path.join(target, 'APPEND_SYSTEM.md'), 'utf8').includes('hailykit-omp-rules-start'));
    assert.equal(pi.readVersion(target), '1.0.0');
    assert.equal(omp.readVersion(target), null);

    pi.uninstall(target);
    assert.ok(!fs.existsSync(path.join(target, 'skills', 'hc-plan')));
    assert.ok(!fs.existsSync(path.join(target, 'agents', 'haily-planner.md')));
    assert.ok(!fs.readFileSync(path.join(target, 'APPEND_SYSTEM.md'), 'utf8').includes('hailykit-pi-rules-start'));
  } finally {
    if (previous === undefined) delete process.env['PI_CODING_AGENT_DIR'];
    else process.env['PI_CODING_AGENT_DIR'] = previous;
  }
});

test('provider registry includes pi and omp without an oh-my-pi alias', () => {
  assert.equal(getProvider('pi').label, 'Pi');
  assert.equal(getProvider('omp').label, 'OMP');
  assert.ok(resolveProviders('all').some((provider) => provider.name === 'pi'));
  assert.ok(resolveProviders('all').some((provider) => provider.name === 'omp'));
  assert.throws(() => getProvider('oh-my-pi'), /Unknown provider/);
});
