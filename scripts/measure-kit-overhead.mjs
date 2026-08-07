#!/usr/bin/env node
/**
 * measure-kit-overhead.mjs — prints the real per-session token cost of kit
 * content, split by cost class, and the before/after delta from the current
 * compression pass (before = last commit, after = working tree). Read-only;
 * no build required.
 *
 * Usage: node scripts/measure-kit-overhead.mjs
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const REPO_ROOT = process.cwd();
const BYTES_PER_TOKEN_EST = 4;

function fromHead(relPath) {
  try {
    return execFileSync('git', ['show', `HEAD:${relPath.replace(/\\/g, '/')}`], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    });
  } catch {
    return null; // file didn't exist at HEAD (new in working tree)
  }
}

function listMarkdown(dir) {
  const abs = join(REPO_ROOT, dir);
  if (!existsSync(abs)) return [];
  return readdirSync(abs).filter((f) => f.endsWith('.md')).map((f) => join(dir, f));
}

function sumBytes(paths, reader) {
  let total = 0;
  for (const p of paths) {
    const content = reader(p);
    // Normalize line endings before counting. `git show` always yields LF while a
    // Windows working tree may hold CRLF, which otherwise reports a phantom delta of
    // one byte per line on files nobody touched.
    if (content !== null) total += Buffer.byteLength(content.replace(/\r\n/g, '\n'), 'utf8');
  }
  return total;
}

function est(bytes) {
  return Math.round(bytes / BYTES_PER_TOKEN_EST);
}

/** Signed percent change, before -> after. Positive = grew, negative = shrank. */
function pct(before, after) {
  if (before === 0) return '0%';
  const change = Math.round((1 - after / before) * -100);
  return change > 0 ? `+${change}%` : `${change}%`;
}

// --- Rules: one-time cacheable prompt prefix ---
const rulesPaths = listMarkdown('kit/rules');
const rulesBefore = sumBytes(rulesPaths, (p) => fromHead(p));
const rulesAfter = sumBytes(rulesPaths, (p) => readFileSync(join(REPO_ROOT, p), 'utf8'));

// --- Standards: recurring per session, claude provider only ---
const standardsPaths = listMarkdown('kit/standards');
const standardsBefore = sumBytes(standardsPaths, (p) => fromHead(p));
const standardsAfter = sumBytes(standardsPaths, (p) => readFileSync(join(REPO_ROOT, p), 'utf8'));
const avgStandardAfter = standardsPaths.length ? standardsAfter / standardsPaths.length : 0;

// --- Skill descriptions: recurring per session, all providers ---
// Assumes double-quoted YAML values (the kit convention). An unquoted or
// single-quoted description: line would undercount here — measurement-only,
// no functional effect, but the totals below are only as complete as this regex.
const descRe = /^description:\s*"([^"]*(?:\\.[^"]*)*)"/m;
function extractDescription(content) {
  const m = descRe.exec(content);
  return m ? m[1] : '';
}
const skillDirs = existsSync(join(REPO_ROOT, 'kit/skills'))
  ? readdirSync(join(REPO_ROOT, 'kit/skills'), { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => join('kit/skills', e.name, 'SKILL.md'))
  : [];
const descBefore = sumBytes(skillDirs, (p) => {
  const c = fromHead(p);
  return c === null ? null : extractDescription(c);
});
const descAfter = sumBytes(skillDirs, (p) => {
  const full = join(REPO_ROOT, p);
  if (!existsSync(full)) return null;
  return extractDescription(readFileSync(full, 'utf8'));
});

// --- Ref-expansion check for kit/rules (claude install-time resolution) ---
const SKILL_REF_RE = /\{skill:((?:hc|hd|hl|hs)-[a-z][a-z0-9-]*)\}/g;
const AGENT_REF_RE = /\{(agents?(?:-result)?):([a-z][a-z0-9,-]*)\}/g;
let rulesSkillRefs = 0;
let rulesAgentRefs = 0;
for (const p of rulesPaths) {
  const content = readFileSync(join(REPO_ROOT, p), 'utf8');
  rulesSkillRefs += (content.match(SKILL_REF_RE) || []).length;
  rulesAgentRefs += (content.match(AGENT_REF_RE) || []).length;
}
// {skill:hc-x} -> /hc-x for claude: shrinks by len('{skill:') + len('}') - len('/') = 7.
const rulesRefShrink = rulesSkillRefs * 7;

console.log(`# Kit overhead measurement — ${new Date().toISOString().slice(0, 10)}\n`);
console.log('| Cost class | Before (bytes / est. tokens) | After (bytes / est. tokens) | Delta |');
console.log('|---|---|---|---|');
console.log(
  `| Rules (one-time cacheable prefix) | ${rulesBefore} / ${est(rulesBefore)} | ${rulesAfter} / ${est(rulesAfter)} | ${pct(rulesBefore, rulesAfter)} |`,
);
console.log(
  `| Standards (recurring, claude only) | ${standardsBefore} / ${est(standardsBefore)} | ${standardsAfter} / ${est(standardsAfter)} | ${pct(standardsBefore, standardsAfter)} |`,
);
console.log(
  `| Skill descriptions (recurring, all providers) | ${descBefore} / ${est(descBefore)} | ${descAfter} / ${est(descAfter)} | ${pct(descBefore, descAfter)} |`,
);
console.log('');
console.log(`Standards: ${standardsPaths.length} files, avg ${Math.round(avgStandardAfter)} bytes/file after compression.`);
console.log(`A realistic session injects 1-3 files (~${est(avgStandardAfter)}-${est(avgStandardAfter * 3)} tokens est.), not the full catalog.`);
console.log('');
console.log(`kit/rules contains ${rulesSkillRefs} {skill:...} ref(s) and ${rulesAgentRefs} {agent:...} ref(s).`);
console.log(`Claude install resolves {skill:hc-x} -> /hc-x, shrinking installed rules by ~${rulesRefShrink} more bytes (est., not included in the After column above, which measures source bytes).`);
console.log(`{agent:...} refs (which expand, not shrink, on install) do not occur in kit/rules — they appear in skill reference docs instead, outside this measurement's scope.`);

if (process.argv.includes('--inventory')) {
  const agents = listMarkdown('kit/agents');
  const hooks = existsSync(join(REPO_ROOT, 'kit/hooks'))
    ? readdirSync(join(REPO_ROOT, 'kit/hooks')).filter((f) => f.endsWith('.cjs')).map((f) => join('kit/hooks', f))
    : [];
  console.log('');
  console.log(JSON.stringify({
    rules: rulesPaths,
    standards: standardsPaths,
    skills: skillDirs,
    agents,
    hooks,
  }, null, 2));
}
