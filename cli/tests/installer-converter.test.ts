import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseFrontmatter,
  toCommandName,
  toGeminiToml,
  toCursorMd,
  isProviderAllowed,
  resolveAgentRefs,
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

test('toCommandName converts legacy colon format', () => {
  assert.equal(toCommandName({ name: 'hl:plan' }, 'fallback'), 'hl-plan');
  assert.equal(toCommandName({ name: 'hc:cook' }), 'hc-cook');
});

test('toCommandName applies hl- prefix to bare names', () => {
  assert.equal(toCommandName({ name: 'plan' }, 'fallback'), 'hl-plan');
  assert.equal(toCommandName({}, 'scout'), 'hl-scout');
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
