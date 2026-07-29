/**
 * End-to-end local install smoke test — uses local kit/ directly without GitHub.
 * Run from repo root: node scripts/install-local-test.mjs
 */
import { mergeClaudeDir } from '../dist/installer/merger.js';
import { isProviderAllowed, parseFrontmatter } from '../dist/installer/converter.js';
import { GeminiProvider } from '../dist/installer/providers/gemini.js';
import { CodexProvider } from '../dist/installer/providers/codex.js';
import { CursorProvider } from '../dist/installer/providers/cursor.js';
import { OpenCodeProvider } from '../dist/installer/providers/opencode.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..');
const KIT = path.join(REPO, 'kit');
const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), 'hailykit-test-'));
const expectedSkillCount = fs.readdirSync(path.join(KIT, 'skills'), { withFileTypes: true })
  .filter((entry) => entry.isDirectory()).length;
const expectedAgentCount = fs.readdirSync(path.join(KIT, 'agents'))
  .filter((entry) => entry.endsWith('.md')).length;
const expectedCodexCount = fs.readdirSync(path.join(KIT, 'skills'), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .filter((entry) => {
    const skillMd = path.join(KIT, 'skills', entry.name, 'SKILL.md');
    return fs.existsSync(skillMd) &&
      isProviderAllowed(parseFrontmatter(fs.readFileSync(skillMd, 'utf8')), 'codex');
  }).length;

const errors = [];
const ok   = (msg) => console.log('  ✓', msg);
const fail = (msg) => { console.error('  ✗', msg); errors.push(msg); };

// ── 1: Claude merge ─────────────────────────────────────────────────────────
console.log('\n[1] Claude — mergeClaudeDir + resolveSkillRefs');
const claudeOut = path.join(tmpBase, 'claude');
mergeClaudeDir(REPO, claudeOut, { isUpgrade: false });

const cookMd = path.join(claudeOut, 'skills', 'hc-cook', 'SKILL.md');
if (!fs.existsSync(cookMd)) {
  fail('hc-cook/SKILL.md missing');
} else {
  const c = fs.readFileSync(cookMd, 'utf8');
  if (c.includes('{skill:')) fail('SKILL.md still has {skill:} — resolver not applied');
  else if (/\/(?:hc|hl|hd|hs):/.test(c)) fail('SKILL.md contains retired colon-form skill refs');
  else ok('SKILL.md installed (no skill cross-refs in body)');
}

const skillCount = fs.readdirSync(path.join(claudeOut, 'skills')).length;
skillCount === expectedSkillCount
  ? ok(`${skillCount} skill dirs`)
  : fail(`${skillCount} skill dirs (expected ${expectedSkillCount})`);

const agentCount = fs.existsSync(path.join(claudeOut, 'agents'))
  ? fs.readdirSync(path.join(claudeOut, 'agents')).length : 0;
agentCount === expectedAgentCount
  ? ok(`${agentCount} agent files`)
  : fail(`${agentCount} agent files (expected ${expectedAgentCount})`);

fs.existsSync(path.join(claudeOut, 'hooks', 'haily-session.cjs'))
  ? ok('haily-session.cjs installed') : fail('hooks missing');
fs.existsSync(path.join(claudeOut, 'settings.json'))
  ? ok('settings.json installed') : fail('settings.json missing');

const stdCount = fs.existsSync(path.join(claudeOut, 'standards'))
  ? fs.readdirSync(path.join(claudeOut, 'standards')).length : 0;
stdCount >= 100 ? ok(`${stdCount} standards files`) : fail(`Only ${stdCount} standards files`);

// ── 2: Gemini — toCommandName fix ───────────────────────────────────────────
console.log('\n[2] Gemini — canonical command naming');
const geminiOut = path.join(tmpBase, 'gemini');
const geminiCount = new GeminiProvider().installSkills(KIT, geminiOut);
geminiCount > 0 ? ok(`${geminiCount} skills converted`) : fail('No Gemini skills converted');
const geminiCook = path.join(geminiOut, 'commands', 'hc-cook.toml');
if (fs.existsSync(geminiCook)) ok('hc-cook.toml exists (no colon in filename)');
else {
  const found = fs.readdirSync(path.join(geminiOut, 'commands')).filter(f => f.includes('cook'));
  fail(`hc-cook.toml missing — found: ${found.join(', ')}`);
}

// ── 3: Cursor ────────────────────────────────────────────────────────────────
console.log('\n[3] Cursor');
const cursorOut = path.join(tmpBase, 'cursor');
const cursorCount = new CursorProvider().installSkills(KIT, cursorOut);
cursorCount > 0 ? ok(`${cursorCount} skills converted`) : fail('No Cursor skills converted');

// ── 4: OpenCode — slash syntax ──────────────────────────────────────────────
console.log('\n[4] OpenCode — canonical skillRef syntax');
const ocOut = path.join(tmpBase, 'opencode');
new OpenCodeProvider().installSkills(KIT, ocOut);
const ocCook = path.join(ocOut, 'commands', 'hc-cook.md');
if (fs.existsSync(ocCook)) {
  const c = fs.readFileSync(ocCook, 'utf8');
  /\/(?:hc|hl|hd|hs):/.test(c)
    ? fail('OpenCode artifact contains retired colon-form skill refs')
    : ok('hc-cook.md installed');
} else fail('hc-cook.md missing');

// ── 5: Codex — scoped native skills + canonical output ──────────────────────
console.log('\n[5] Codex — scoped native skills');
const codexRoot = path.join(tmpBase, 'codex-project');
const codexOut = path.join(codexRoot, '.codex');
const codexProvider = new CodexProvider();
const codexCount = codexProvider.installSkills(KIT, codexOut);
codexProvider.installRules(KIT, codexOut);
const codexSkills = path.join(codexRoot, '.agents', 'skills');
codexCount === expectedCodexCount
  ? ok(`${codexCount} project skills installed`)
  : fail(`${codexCount} Codex skills (expected ${expectedCodexCount})`);

const colonRef = /(?:hc|hl|hd|hs):[a-z][a-z0-9-]*/;
const pending = [codexSkills];
const leaked = [];
while (pending.length > 0) {
  const dir = pending.pop();
  if (!dir || !fs.existsSync(dir)) continue;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) pending.push(full);
    else if (colonRef.test(fs.readFileSync(full, 'utf8'))) leaked.push(full);
  }
}
leaked.length === 0
  ? ok('Codex artifacts contain only canonical skill names')
  : fail(`Codex artifacts contain retired refs: ${leaked.join(', ')}`);

const codexAgents = fs.readFileSync(path.join(codexOut, 'AGENTS.md'), 'utf8');
codexAgents.includes('~/.agents/skills/') && !codexAgents.includes('~/.codex/skills/')
  ? ok('Codex AGENTS.md points to the canonical skills root')
  : fail('Codex AGENTS.md advertises a stale skills root');

// ── Summary ──────────────────────────────────────────────────────────────────
console.log('\n' + '─'.repeat(50));
fs.rmSync(tmpBase, { recursive: true, force: true });
if (errors.length === 0) {
  console.log('✓ All tests passed');
  process.exit(0);
} else {
  console.error(`✗ ${errors.length} failure(s):\n` + errors.map(e => '  - ' + e).join('\n'));
  process.exit(1);
}
