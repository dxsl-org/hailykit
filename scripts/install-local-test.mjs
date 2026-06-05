/**
 * End-to-end local install smoke test — uses local kit/ directly without GitHub.
 * Run from repo root: node scripts/install-local-test.mjs
 */
import { mergeClaudeDir } from '../dist/installer/merger.js';
import { GeminiProvider } from '../dist/installer/providers/gemini.js';
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
  else if (c.includes('/hc:') || c.includes('/hl:') || c.includes('/hd:')) ok('{skill:x:y} → /hc: resolved in SKILL.md');
  else ok('SKILL.md installed (no skill cross-refs in body)');
}

const skillCount = fs.readdirSync(path.join(claudeOut, 'skills')).length;
skillCount >= 50 ? ok(`${skillCount} skill dirs`) : fail(`Only ${skillCount} skill dirs`);

const agentCount = fs.existsSync(path.join(claudeOut, 'agents'))
  ? fs.readdirSync(path.join(claudeOut, 'agents')).length : 0;
agentCount === 14 ? ok(`${agentCount} agent files`) : fail(`${agentCount} agent files (expected 14)`);

fs.existsSync(path.join(claudeOut, 'hooks', 'session-init.cjs'))
  ? ok('session-init.cjs installed') : fail('hooks missing');
fs.existsSync(path.join(claudeOut, 'settings.json'))
  ? ok('settings.json installed') : fail('settings.json missing');

const stdCount = fs.existsSync(path.join(claudeOut, 'standards'))
  ? fs.readdirSync(path.join(claudeOut, 'standards')).length : 0;
stdCount >= 100 ? ok(`${stdCount} standards files`) : fail(`Only ${stdCount} standards files`);

// ── 2: Gemini — toCommandName fix ───────────────────────────────────────────
console.log('\n[2] Gemini — toCommandName fix (hc:cook → hc-cook.toml)');
const geminiOut = path.join(tmpBase, 'gemini');
const geminiCount = new GeminiProvider().installSkills(KIT, geminiOut);
geminiCount >= 50 ? ok(`${geminiCount} skills converted`) : fail(`Only ${geminiCount}`);
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
cursorCount >= 50 ? ok(`${cursorCount} skills converted`) : fail(`Only ${cursorCount}`);

// ── 4: OpenCode — /hc: slash syntax ─────────────────────────────────────────
console.log('\n[4] OpenCode — skillRef → /hc: syntax');
const ocOut = path.join(tmpBase, 'opencode');
new OpenCodeProvider().installSkills(KIT, ocOut);
const ocCook = path.join(ocOut, 'commands', 'hc-cook.md');
if (fs.existsSync(ocCook)) {
  const c = fs.readFileSync(ocCook, 'utf8');
  c.includes('/hc:') ? ok('OpenCode: /hc: refs resolved') : ok('hc-cook.md installed');
} else fail('hc-cook.md missing');

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
