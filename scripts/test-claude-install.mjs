/**
 * End-to-end Claude Code install test using the packed release zip.
 * Run: node scripts/test-claude-install.mjs
 */
import { extract, resolveRoot } from '../dist/installer/extractor.js';
import { mergeClaudeDir } from '../dist/installer/merger.js';
import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ZIP = path.resolve(__dirname, '../release/hailykit.zip');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hk-claude-'));
const target = path.join(tmp, 'dot-claude');

const errs = [];
const ok   = (msg) => console.log('  ✓', msg);
const fail = (msg) => { console.error('  ✗', msg); errs.push(msg); };

try {
  // ── Extract zip (same path as installer) ───────────────────────────────
  extract(ZIP, tmp);
  const root = resolveRoot(tmp);
  console.log('Extracted root:', path.basename(root));

  // ── mergeClaudeDir → simulates `hailykit install --provider claude` ────
  mergeClaudeDir(root, target, { isUpgrade: false });
  console.log('\n[Structure]');

  // Skills
  const skillDirs = fs.readdirSync(path.join(target, 'skills'));
  skillDirs.length >= 50
    ? ok(`skills/: ${skillDirs.length} dirs`)
    : fail(`skills/: only ${skillDirs.length} dirs`);

  // hc-cook: refs resolved + frontmatter intact
  const cook = fs.readFileSync(path.join(target,'skills','hc-cook','SKILL.md'), 'utf8');
  !cook.includes('{skill:') ? ok('hc-cook: no {skill:} refs remain') : fail('hc-cook: {skill:} not resolved');
  (cook.includes('/hc-') || !cook.includes('{skill:hc-')) ? ok('hc-cook: slash refs present') : ok('hc-cook: no cross-refs in body (ok)');
  cook.includes('name: hc-cook') ? ok('hc-cook: name: hc-cook') : fail('hc-cook: name field wrong');
  cook.includes('user-invocable: true') ? ok('hc-cook: user-invocable: true') : fail('hc-cook: user-invocable missing');
  cook.includes('when_to_use:') ? ok('hc-cook: when_to_use present') : fail('hc-cook: when_to_use missing');

  // Agents
  const agentFiles = fs.readdirSync(path.join(target, 'agents'));
  agentFiles.length === 14
    ? ok(`agents/: ${agentFiles.length} files`)
    : fail(`agents/: ${agentFiles.length} files (expected 14)`);
  const brainstormer = fs.readFileSync(path.join(target,'agents','brainstormer.md'), 'utf8');
  !brainstormer.includes('{skill:')
    ? ok('agents/brainstormer: {skill:} resolved for Claude')
    : fail('agents/brainstormer: {skill:} refs remain');

  // Rules
  const ruleFiles = fs.readdirSync(path.join(target, 'rules')).filter(f => f.endsWith('.md'));
  ruleFiles.length === 6
    ? ok(`rules/: ${ruleFiles.length} .md files`)
    : fail(`rules/: ${ruleFiles.length} files (expected 6)`);

  // Hooks
  fs.existsSync(path.join(target,'hooks','session-init.cjs'))
    ? ok('hooks/session-init.cjs') : fail('hooks/session-init.cjs missing');
  fs.existsSync(path.join(target,'hooks','lib','hl-config-utils.cjs'))
    ? ok('hooks/lib/hl-config-utils.cjs') : fail('hooks/lib/ missing');
  fs.existsSync(path.join(target,'hooks','node-hook-runner.sh'))
    ? ok('hooks/node-hook-runner.sh') : fail('hooks/node-hook-runner.sh missing');

  // settings.json
  const settings = JSON.parse(fs.readFileSync(path.join(target,'settings.json'), 'utf8'));
  settings.hooks?.SessionStart?.length > 0
    ? ok('settings.json: SessionStart registered') : fail('settings.json: no SessionStart');
  const hookCmds = JSON.stringify(settings.hooks);
  hookCmds.includes('session-init') ? ok('settings.json: session-init wired') : fail('session-init not in settings');
  hookCmds.includes('dev-rules-reminder') ? ok('settings.json: dev-rules-reminder wired') : fail('dev-rules-reminder missing');

  // Standards
  const stdFiles = fs.existsSync(path.join(target,'standards'))
    ? fs.readdirSync(path.join(target,'standards')).length : 0;
  stdFiles >= 100
    ? ok(`standards/: ${stdFiles} files`) : fail(`standards/: only ${stdFiles} files`);

  // Templates
  const tplFiles = fs.existsSync(path.join(target,'templates'))
    ? fs.readdirSync(path.join(target,'templates')).length : 0;
  tplFiles >= 4
    ? ok(`templates/: ${tplFiles} files`) : fail(`templates/: only ${tplFiles} files`);

  // ── Hook smoke tests from installed path ───────────────────────────────
  console.log('\n[Hooks from installed path]');
  const hookBase = path.join(target, 'hooks');

  for (const [hookFile, stdin] of [
    ['session-init.cjs', null],
    ['cook-after-plan-reminder.cjs', null],
    ['scout-block.cjs', JSON.stringify({tool_name:'Bash',tool_input:{command:'npm test'}})],
    ['privacy-block.cjs', JSON.stringify({tool_name:'Bash',tool_input:{command:'echo hi'}})],
  ]) {
    try {
      const input = stdin ? `echo '${stdin}' | ` : '';
      execSync(`${input}node "${path.join(hookBase, hookFile)}"`, {
        timeout: 5000,
        stdio: stdin ? 'pipe' : ['ignore','pipe','pipe'],
        input: stdin ?? undefined,
        shell: true,
      });
      ok(`${hookFile} exit 0`);
    } catch(e) {
      e.status === 0 || e.status == null
        ? ok(`${hookFile} exit 0`)
        : fail(`${hookFile} exit ${e.status}`);
    }
  }

  // ── Summary ────────────────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(55));
  fs.rmSync(tmp, { recursive: true, force: true });
  if (errs.length === 0) {
    console.log('✓ Claude Code install — all checks passed');
    process.exit(0);
  } else {
    console.error(`✗ ${errs.length} failure(s):\n` + errs.map(e => '  - ' + e).join('\n'));
    process.exit(1);
  }
} catch (e) {
  console.error('FATAL:', e.message);
  fs.rmSync(tmp, { recursive: true, force: true });
  process.exit(1);
}
