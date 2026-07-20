import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  parseFrontmatter,
  toCommandName,
  resolveSkillRefs,
  toGeminiToml,
  toCursorMd,
  isProviderAllowed,
  resolveAgentRefs,
  resolveModel,
  resolveModelRefs,
  getModelMap,
  loadModelMapOverrides,
  MODEL_MAP,
  bundleFlatSkill,
} from '../installer/converter';

// ---------------------------------------------------------------------------
// parseFrontmatter
// ---------------------------------------------------------------------------

test('parseFrontmatter splits YAML frontmatter from body', () => {
  const md = '---\nname: hc-plan\ndescription: "Plan things"\n---\n\nBody text here.';
  const { frontmatter, metadata, body } = parseFrontmatter(md);
  assert.equal(frontmatter.name, 'hc-plan');
  assert.equal(frontmatter.description, 'Plan things');
  assert.deepEqual(metadata, {});
  assert.equal(body, 'Body text here.');
});

test('parseFrontmatter returns whole content as body when no frontmatter', () => {
  const { frontmatter, metadata, body } = parseFrontmatter('just a body');
  assert.deepEqual(frontmatter, {});
  assert.deepEqual(metadata, {});
  assert.equal(body, 'just a body');
});

test('parseFrontmatter parses metadata: block into separate object', () => {
  const md = [
    '---',
    'name: hc-debug',
    'description: "Debug things"',
    'metadata:',
    '  category: workflow',
    '  keywords: [debug, test]',
    '---',
    '',
    'Body.',
  ].join('\n');
  const { frontmatter, metadata, body } = parseFrontmatter(md);
  assert.equal(frontmatter.name, 'hc-debug');
  assert.equal(metadata.category, 'workflow');
  assert.equal(metadata.keywords, '[debug, test]');
  assert.equal(body, 'Body.');
});

test('parseFrontmatter keeps metadata fields out of frontmatter', () => {
  const md = [
    '---',
    'name: hc-debug',
    'metadata:',
    '  category: workflow',
    '---',
    '',
    'Body.',
  ].join('\n');
  const { frontmatter, metadata } = parseFrontmatter(md);
  assert.equal(frontmatter.category, undefined);
  assert.equal(metadata.category, 'workflow');
});

// ---------------------------------------------------------------------------
// toCommandName
// ---------------------------------------------------------------------------

test('toCommandName accepts current hyphen format', () => {
  assert.equal(toCommandName({ name: 'hc-cook' }), 'hc-cook');
  assert.equal(toCommandName({ name: 'hl-brainstorm' }), 'hl-brainstorm');
  assert.equal(toCommandName({ name: 'hc-mcp-builder' }), 'hc-mcp-builder');
});

// Regression guard for the hs- security-operations domain prefix.
// A revert of the converter regex edits (SKILL_REF_RE / toCommandName) must fail here.
test('toCommandName preserves hs- prefix (no hl- mangling)', () => {
  assert.equal(toCommandName({ name: 'hs-assess' }), 'hs-assess');
  assert.equal(toCommandName({ name: 'hs-dfir' }), 'hs-dfir');
  assert.equal(toCommandName({ name: 'hs:harden' }), 'hs-harden');
});

test('resolveSkillRefs resolves hs- references', () => {
  const out = resolveSkillRefs('see {skill:hs-dfir} and {skill:hc-fix}', (p, n) => `/${p}-${n}`);
  assert.equal(out, 'see /hs-dfir and /hc-fix');
});

test('toCommandName converts legacy colon format', () => {
  assert.equal(toCommandName({ name: 'hl:plan' }, 'fallback'), 'hl-plan');
  assert.equal(toCommandName({ name: 'hc:cook' }), 'hc-cook');
});

test('toCommandName applies hl- prefix to bare names', () => {
  assert.equal(toCommandName({ name: 'plan' }, 'fallback'), 'hl-plan');
  assert.equal(toCommandName({}, 'scout'), 'hl-scout');
});

test('toCommandName strips path-traversal chars from the slug', () => {
  // The slug becomes a filename; separators and `..` must never survive.
  assert.equal(toCommandName({ name: 'hc-../../../etc/cron.d/x' }), 'hc-etccrondx');
  assert.equal(toCommandName({ name: 'hc:..\\..\\evil' }), 'hc-evil');
  assert.equal(toCommandName({ name: '../../escape' }), 'hl-escape');
  // No output may contain a path separator or dot-dot.
  for (const n of ['hc-../x', 'hl:../../y', 'a/b/c']) {
    const out = toCommandName({ name: n });
    assert.ok(!/[/\\]/.test(out) && !out.includes('..'), `unsafe slug: ${out}`);
  }
});

// ---------------------------------------------------------------------------
// isProviderAllowed
// ---------------------------------------------------------------------------

test('isProviderAllowed allows all when providers absent', () => {
  const skill = parseFrontmatter('---\nname: hc-cook\n---\n\nBody.');
  assert.equal(isProviderAllowed(skill, 'gemini'), true);
  assert.equal(isProviderAllowed(skill, 'claude'), true);
});

test('isProviderAllowed reads from metadata.providers', () => {
  const md = '---\nname: hl-design\nmetadata:\n  providers: gemini\n---\n\nBody.';
  const skill = parseFrontmatter(md);
  assert.equal(isProviderAllowed(skill, 'gemini'), true);
  assert.equal(isProviderAllowed(skill, 'claude'), false);
  assert.equal(isProviderAllowed(skill, 'cursor'), false);
});

test('isProviderAllowed falls back to top-level providers field', () => {
  const md = '---\nname: hl-design\nproviders: gemini\n---\n\nBody.';
  const skill = parseFrontmatter(md);
  assert.equal(isProviderAllowed(skill, 'gemini'), true);
  assert.equal(isProviderAllowed(skill, 'claude'), false);
});

test('isProviderAllowed handles comma-separated list', () => {
  const md = '---\nname: hl-design\nmetadata:\n  providers: gemini,cursor\n---\n\nBody.';
  const skill = parseFrontmatter(md);
  assert.equal(isProviderAllowed(skill, 'gemini'), true);
  assert.equal(isProviderAllowed(skill, 'cursor'), true);
  assert.equal(isProviderAllowed(skill, 'claude'), false);
});

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// resolveAgentRefs
// ---------------------------------------------------------------------------

test('resolveAgentRefs resolves single {agent:haily-researcher}', () => {
  const body = 'Do research. {agent:haily-researcher} Analyze findings.';
  const result = resolveAgentRefs(body, (type, roles) => `[${type}:${roles.join(',')}]`);
  assert.equal(result, 'Do research. [agent:haily-researcher] Analyze findings.');
});

test('resolveAgentRefs resolves parallel {agents:haily-researcher,haily-tester}', () => {
  const body = '{agents:haily-researcher,haily-tester}';
  const result = resolveAgentRefs(body, (type, roles) =>
    roles.map((r, i) => `Step ${i + 1}: ${r}`).join('\n'),
  );
  assert.equal(result, 'Step 1: haily-researcher\nStep 2: haily-tester');
});

test('resolveAgentRefs resolves {agent-result:haily-researcher}', () => {
  const body = 'Findings: {agent-result:haily-researcher}';
  const result = resolveAgentRefs(body, (type, roles) =>
    type === 'agent-result' ? `Based on ${roles[0]} output:` : '',
  );
  assert.equal(result, 'Findings: Based on haily-researcher output:');
});

test('resolveAgentRefs resolves hyphenated roles like haily-reviewer', () => {
  const body = '{agent:haily-reviewer} then {agents:haily-project-manager,haily-docs-writer}';
  const result = resolveAgentRefs(body, (type, roles) => `[${type}:${roles.join('+')}]`);
  assert.equal(result, '[agent:haily-reviewer] then [agents:haily-project-manager+haily-docs-writer]');
});

test('resolveAgentRefs warns on unknown role without throwing', () => {
  const warns: string[] = [];
  const orig = console.warn;
  console.warn = (msg: string) => warns.push(msg);
  try {
    resolveAgentRefs('{agent:nonexistent}', () => '');
    assert.ok(warns.some((w) => w.includes('nonexistent')));
  } finally {
    console.warn = orig;
  }
});

// ---------------------------------------------------------------------------
// resolveModel
// ---------------------------------------------------------------------------

test('resolveModel replaces tier with concrete model name for claude', () => {
  const content = '---\nname: haily-planner\nmodel: thinking\n---\n\nBody.';
  const result = resolveModel(content, 'claude');
  assert.ok(result.includes('model: opus'), `expected "model: opus" in: ${result}`);
});

test('resolveModel replaces tier with concrete model name for gemini', () => {
  const content = '---\nname: haily-planner\nmodel: medium\n---\n\nBody.';
  const result = resolveModel(content, 'gemini');
  // Legacy gemini CLI only serves gemini-2.5-pro (no tier differentiation).
  assert.ok(result.includes('model: gemini-2.5-pro'), `expected gemini-2.5-pro in: ${result}`);
});

test('resolveModel strips model line entirely for cursor', () => {
  const content = '---\nname: haily-planner\nmodel: thinking\n---\n\nBody.';
  const result = resolveModel(content, 'cursor');
  assert.ok(!result.includes('model:'), `expected no model: line for cursor, got: ${result}`);
  assert.ok(result.includes('name: haily-planner'), 'other frontmatter fields must be preserved');
  assert.ok(result.includes('Body.'), 'body must be preserved');
});

test('resolveModel strips model line entirely for zed', () => {
  const content = '---\nname: haily-researcher\nmodel: fast\n---\n\nBody.';
  const result = resolveModel(content, 'zed');
  assert.ok(!result.includes('model:'), `expected no model: line for zed, got: ${result}`);
});

test('resolveModel strips model line entirely for windsurf', () => {
  const content = '---\nname: haily-planner\nmodel: medium\n---\n\nBody.';
  const result = resolveModel(content, 'windsurf');
  assert.ok(!result.includes('model:'), `expected no model: line for windsurf, got: ${result}`);
});

test('resolveModel is a no-op when content has no tier line', () => {
  const content = '---\nname: haily-planner\n---\n\nBody.';
  assert.equal(resolveModel(content, 'claude'), content);
  assert.equal(resolveModel(content, 'cursor'), content);
});

test('resolveModel leaves a concrete model name untouched', () => {
  const content = '---\nname: haily-planner\nmodel: claude-opus-4-8\n---\n\nBody.';
  assert.equal(resolveModel(content, 'cursor'), content);
});

test('resolveModel resolves the ultra tier frontmatter', () => {
  const content = '---\nname: hl-ultra\nmodel: ultra\n---\n\nBody.';
  const result = resolveModel(content, 'claude');
  assert.ok(result.includes('model: fable-5'), `expected ultra→fable-5 in: ${result}`);
  // User-configured providers strip the ultra line like any other tier.
  assert.ok(!resolveModel(content, 'zed').includes('model:'));
});

// ---------------------------------------------------------------------------
// resolveModelRefs
// ---------------------------------------------------------------------------

test('resolveModelRefs replaces {model:ultra} with the provider model', () => {
  const body = 'Pass `model: {model:ultra}` to Task calls; fallback {model:thinking}.';
  const result = resolveModelRefs(body, 'claude');
  assert.equal(result, 'Pass `model: fable-5` to Task calls; fallback opus.');
});

test('resolveModelRefs honors a user ultra-tier pin', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hk-ultra-'));
  try {
    fs.writeFileSync(path.join(tmp, 'model-map.json'),
      JSON.stringify({ claude: { ultra: 'claude-mythos-1' } }), 'utf8');
    loadModelMapOverrides(tmp);
    assert.equal(resolveModelRefs('{model:ultra}', 'claude'), 'claude-mythos-1');
    // Non-ultra tiers stay on built-ins.
    assert.equal(resolveModelRefs('{model:fast}', 'claude'), 'haiku');
  } finally {
    loadModelMapOverrides();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('resolveModelRefs falls back to the claude map for unknown providers', () => {
  assert.equal(resolveModelRefs('{model:ultra}', 'cursor'), MODEL_MAP.claude.ultra);
});

// ---------------------------------------------------------------------------
// getModelMap / loadModelMapOverrides
// ---------------------------------------------------------------------------

// Isolate tests from any real ~/.hailykit/model-map.json on the dev machine.
// npm test runs ALL test files in one process — restore env + temp dir after.
const emptyHome = fs.mkdtempSync(path.join(os.tmpdir(), 'hk-home-'));
const prevHailykitHome = process.env.HAILYKIT_HOME;
before(() => { process.env.HAILYKIT_HOME = emptyHome; });
after(() => {
  if (prevHailykitHome === undefined) delete process.env.HAILYKIT_HOME;
  else process.env.HAILYKIT_HOME = prevHailykitHome;
  loadModelMapOverrides();
  fs.rmSync(emptyHome, { recursive: true, force: true });
});

test('getModelMap returns built-in defaults when no overrides are loaded', () => {
  loadModelMapOverrides(); // reset
  assert.equal(getModelMap('claude').thinking, 'opus');
  assert.equal(getModelMap('unknown-provider').medium, MODEL_MAP.claude.medium);
});

test('user model-map.json (HAILYKIT_HOME) takes precedence over the kit map', () => {
  const kitTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hk-kit-'));
  const homeTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hk-userhome-'));
  const prevHome = process.env.HAILYKIT_HOME;
  try {
    fs.writeFileSync(path.join(kitTmp, 'model-map.json'),
      JSON.stringify({ claude: { fast: 'kit-fast' } }), 'utf8');
    fs.writeFileSync(path.join(homeTmp, 'model-map.json'),
      JSON.stringify({ claude: { fast: 'user-fast' } }), 'utf8');
    process.env.HAILYKIT_HOME = homeTmp;

    loadModelMapOverrides(kitTmp);
    assert.equal(getModelMap('claude').fast, 'user-fast');
  } finally {
    process.env.HAILYKIT_HOME = prevHome;
    loadModelMapOverrides();
    fs.rmSync(kitTmp, { recursive: true, force: true });
    fs.rmSync(homeTmp, { recursive: true, force: true });
  }
});

test('loadModelMapOverrides merges kit model-map.json over built-ins', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hk-modelmap-'));
  try {
    fs.writeFileSync(path.join(tmp, 'model-map.json'), JSON.stringify({
      gemini: { thinking: 'gemini-9-pro' },
      newprovider: { fast: 'np-mini' },
    }), 'utf8');

    loadModelMapOverrides(tmp);

    // Overridden tier wins; untouched tiers keep built-in values.
    assert.equal(getModelMap('gemini').thinking, 'gemini-9-pro');
    assert.equal(getModelMap('gemini').fast, MODEL_MAP.gemini.fast);
    // Unknown provider falls back to claude base, with its override applied.
    assert.equal(getModelMap('newprovider').fast, 'np-mini');
    assert.equal(getModelMap('newprovider').thinking, MODEL_MAP.claude.thinking);
    // resolveModel consults the merged map.
    const result = resolveModel('---\nmodel: thinking\n---\nBody.', 'gemini');
    assert.ok(result.includes('model: gemini-9-pro'), `expected override in: ${result}`);
  } finally {
    loadModelMapOverrides(); // reset for other tests
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('loadModelMapOverrides ignores malformed map files and invalid tiers', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hk-modelmap-bad-'));
  try {
    fs.writeFileSync(path.join(tmp, 'model-map.json'), '{not json', 'utf8');
    loadModelMapOverrides(tmp);
    assert.equal(getModelMap('claude').thinking, 'opus');

    fs.writeFileSync(path.join(tmp, 'model-map.json'), JSON.stringify({
      claude: { bogusTier: 'x', medium: 42, fast: '  ' },
    }), 'utf8');
    loadModelMapOverrides(tmp);
    // Invalid tier names, non-string and blank values are all dropped.
    assert.deepEqual(getModelMap('claude'), MODEL_MAP.claude);
  } finally {
    loadModelMapOverrides();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// toGeminiToml / toCursorMd (unchanged behaviour)
// ---------------------------------------------------------------------------

test('toGeminiToml escapes the description and wraps the body', () => {
  const toml = toGeminiToml('a "quoted" desc', 'prompt body');
  assert.match(toml, /description = "a \\"quoted\\" desc"/);
  assert.match(toml, /prompt = """/);
  assert.match(toml, /prompt body/);
});

test('toCursorMd appends a trailing newline', () => {
  assert.equal(toCursorMd('hello'), 'hello\n');
});

// ---------------------------------------------------------------------------
// bundleFlatSkill — flat_inline frontmatter
// ---------------------------------------------------------------------------

/** Builds a temp skill dir with SKILL.md + two references; returns its path. */
function makeFlatSkillFixture(frontmatterExtra: string) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hk-flat-'));
  fs.mkdirSync(path.join(dir, 'references'));
  fs.writeFileSync(
    path.join(dir, 'SKILL.md'),
    `---\nname: hl-fixture\ndescription: "x"\n${frontmatterExtra}---\n\nSkill body.\n`,
    'utf8',
  );
  fs.writeFileSync(path.join(dir, 'references', 'inline-me.md'), 'FULL RUBRIC CONTENT\n', 'utf8');
  fs.writeFileSync(path.join(dir, 'references', 'stub-me.md'), 'STUB TARGET CONTENT\n', 'utf8');
  return dir;
}

test('bundleFlatSkill inlines flat_inline references in full and stubs the rest', () => {
  const dir = makeFlatSkillFixture('flat_inline: [references/inline-me.md]\n');
  try {
    const bundled = bundleFlatSkill(dir, (raw) => raw);
    assert.match(bundled, /# Reference: references\/inline-me\.md\n\nFULL RUBRIC CONTENT/);
    assert.match(bundled, /# Reference: references\/stub-me\.md\n> \[!IMPORTANT\]/);
    assert.doesNotMatch(bundled, /STUB TARGET CONTENT/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('bundleFlatSkill without flat_inline stubs every reference (prior behaviour)', () => {
  const dir = makeFlatSkillFixture('');
  try {
    const bundled = bundleFlatSkill(dir, (raw) => raw);
    assert.doesNotMatch(bundled, /FULL RUBRIC CONTENT/);
    assert.match(bundled, /# Reference: references\/inline-me\.md\n> \[!IMPORTANT\]/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('bundleFlatSkill runs resolveContent on inlined reference content', () => {
  const dir = makeFlatSkillFixture('flat_inline: [references/inline-me.md]\n');
  try {
    const bundled = bundleFlatSkill(dir, (raw) => raw.replace(/RUBRIC/g, 'RESOLVED'));
    assert.match(bundled, /FULL RESOLVED CONTENT/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
