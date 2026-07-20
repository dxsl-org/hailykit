#!/usr/bin/env node
/**
 * check-skill-cross-refs.js
 *
 * CI gate: verifies that all /hl-*, /hc-* references in kit/ markdown files
 * point to a registered skill name (from SKILL.md frontmatter) and do not
 * collide with Claude Code built-in commands. Also validates that every
 * `references/...` / `scripts/...` path in a SKILL.md's `## References`
 * table resolves to a real file under that skill's own directory.
 *
 * Usage: node scripts/check-skill-cross-refs.js
 * Exit 0 = all references valid (or no references found)
 * Exit 1 = broken references or collisions found
 */

'use strict';

const { readFileSync, readdirSync, lstatSync, existsSync } = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const claudeDir = path.join(repoRoot, 'kit');

// Claude Code built-in commands that must not be used as skill names
const BUILTIN_COMMANDS = new Set([
  'help', 'clear', 'debug', 'plan', 'compact', 'review', 'search',
  'init', 'login', 'logout', 'doctor', 'mcp', 'memory', 'model',
  'permissions', 'status', 'config', 'cost', 'terminal-setup',
  'listen', 'bug', 'ide',
]);

// Skills whose bare name collides with a Claude Code built-in but are safe
// because the full invocation uses the prefix (/hl:help, /hl:review, etc.).
const ALLOWED_BUILTIN_OVERLAPS = new Set(['hl-help']);

// Regex to find skill references in markdown — both forms:
//   {skill:hc-cook}  — provider-neutral canonical form (kit/ source)
//   /hc-cook         — slash form (post-install / docs examples)
// Capture group 1 = {skill:} form full name; group 2 = slash form full name.
// NOTE: negative lookbehind (?<![a-zA-Z0-9_.]) excludes file paths like
// `.claude/skills/hc-mcp/scripts/...` where the slash is preceded by a path char.
const HL_REF_RE = /\{skill:((?:hl|hc|hd|hs)-[a-z][a-z0-9-]*)\}|(?<![a-zA-Z0-9_.])\/((?:hl|hc|hd|hs)-[a-z][a-z0-9-]*)/g;

/**
 * Recursively collect all files matching a predicate under a directory.
 */
function findFiles(dir, predicate) {
  const results = [];
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return results;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry);
    let stat;
    try {
      stat = lstatSync(full);
    } catch {
      continue;
    }
    // Skip symlinks to prevent traversal outside the repo
    if (stat.isSymbolicLink()) continue;
    if (stat.isDirectory()) {
      results.push(...findFiles(full, predicate));
    } else if (predicate(entry, full)) {
      results.push(full);
    }
  }
  return results;
}

/**
 * Parses YAML frontmatter from a SKILL.md file and extracts the `name:` field.
 * Returns null if not found.
 */
function extractSkillName(content) {
  // Match YAML frontmatter block: --- ... ---
  const fmMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!fmMatch) return null;

  const frontmatter = fmMatch[1];
  // Extract name: value (unquoted or single/double quoted)
  const nameMatch = frontmatter.match(/^name:\s*['"]?([^\s'"]+)['"]?\s*$/m);
  if (!nameMatch) return null;

  return nameMatch[1].trim();
}

/**
 * Builds the canonical skill registry from all claude/skills/<skillname>/SKILL.md files.
 * Returns { registry: Set<string>, collisions: Array<{name, file}> }
 */
function buildSkillRegistry() {
  const skillsDir = path.join(claudeDir, 'skills');
  const skillFiles = findFiles(skillsDir, (entry) => entry === 'SKILL.md');

  const registry = new Set();
  const collisions = [];

  for (const filePath of skillFiles) {
    let content;
    try {
      content = readFileSync(filePath, 'utf8');
    } catch (err) {
      console.error(`[!] Could not read ${filePath}: ${err.message}`);
      continue;
    }

    const rawName = extractSkillName(content);
    if (!rawName) {
      // No name in frontmatter — skip silently (not our concern here)
      continue;
    }

    // Store the full prefixed name (e.g. "hl-journal", "hc-context-engineering")
    const name = rawName;

    // Check builtin collision only for hl- skills (they share user-facing namespace)
    const dirName = path.basename(path.dirname(filePath));
    const bareName = rawName.startsWith('hl-') ? rawName.slice(3) : null;
    if (bareName && BUILTIN_COMMANDS.has(bareName) && !ALLOWED_BUILTIN_OVERLAPS.has(dirName)) {
      collisions.push({ name: bareName, file: path.relative(repoRoot, filePath) });
    }

    registry.add(name);
  }

  return { registry, collisions };
}

/**
 * Scans all .md files under claude/ and collects /hl: references.
 * Returns Array<{ ref: string, file: string, line: number }>
 */
function collectCkReferences() {
  const mdFiles = findFiles(claudeDir, (entry) => entry.endsWith('.md'));
  const refs = [];

  for (const filePath of mdFiles) {
    let content;
    try {
      content = readFileSync(filePath, 'utf8');
    } catch (err) {
      console.error(`[!] Could not read ${filePath}: ${err.message}`);
      continue;
    }

    const lines = content.split('\n');
    lines.forEach((line, idx) => {
      let match;
      // Reset lastIndex for global regex reuse
      HL_REF_RE.lastIndex = 0;
      while ((match = HL_REF_RE.exec(line)) !== null) {
        // Skip references used as negative examples in documentation (e.g. "→ no match, CI fails")
        const after = line.slice(match.index + match[0].length);
        if (/→\s*\*?\*?no match/.test(after)) continue;

        // {skill:} form → group 1; slash form → group 2.
        const ref = match[1] ?? match[2];

        refs.push({
          ref,
          file: path.relative(repoRoot, filePath),
          line: idx + 1,
        });
      }
    });
  }

  return refs;
}

// Malformed skill refs from the pre-2026-06 colon convention. HL_REF_RE requires a
// hyphen after the prefix, so both shapes would otherwise pass the registry check
// silently as dead pointers:
//   {skill:hd:ai-generation}  — colon name inside the canonical wrapper
//   hc:scout / `hl:design`    — bare colon token in headers, frontmatter, prose, JSON examples
// The bare pattern requires a non-word/non-path char (or line start) before the prefix so
// file paths and hyphenated names (haily-x:) never match; ha/hm/hi are removed prefixes.
const MALFORMED_SKILL_REF_RE = /\{skill:[a-z]+:[a-z0-9-]+\}/g;
const LEGACY_COLON_REF_RE = /(?:^|[^a-zA-Z0-9_/{:-])((?:hl|hc|hd|hs|ha|hm|hi):[a-z][a-z0-9-]*)/g;

/**
 * Scans all .md files under kit/ for colon-form skill refs — the {skill:xx:yy}
 * wrapper shape and bare legacy tokens. Lines using the documented bad-example
 * convention ("→ no match") are skipped, same as HL_REF_RE handling.
 * Returns Array<{ ref, file, line }>.
 */
function collectMalformedSkillRefs() {
  const mdFiles = findFiles(claudeDir, (entry) => entry.endsWith('.md'));
  const malformed = [];

  for (const filePath of mdFiles) {
    let content;
    try {
      content = readFileSync(filePath, 'utf8');
    } catch {
      continue;
    }
    content.split('\n').forEach((line, idx) => {
      if (/→\s*\*?\*?no match/.test(line)) return;
      const file = path.relative(repoRoot, filePath);
      for (const re of [MALFORMED_SKILL_REF_RE, LEGACY_COLON_REF_RE]) {
        re.lastIndex = 0;
        let match;
        while ((match = re.exec(line)) !== null) {
          malformed.push({ ref: match[1] ?? match[0], file, line: idx + 1 });
        }
      }
    });
  }

  return malformed;
}

// Valid provider-neutral model tiers for kit/agents/*.md frontmatter (model: and model_max:).
// A typo here passes silently through the installer (the resolve regex only
// matches valid tiers), so the bad value would ship verbatim to user machines.
// Ordered low→high: fast < medium < thinking < ultra.
const VALID_MODEL_TIERS = new Set(['fast', 'medium', 'thinking', 'ultra']);

// Tiers allowed in kit/model-map.json — same set as agent tiers.
const VALID_MAP_TIERS = VALID_MODEL_TIERS;

/**
 * Validates that every kit/agents/*.md declares `model:` with a valid tier.
 * Returns Array<{ file, problem }>.
 */
function checkAgentModelTiers() {
  const agentsDir = path.join(claudeDir, 'agents');
  const problems = [];

  for (const filePath of findFiles(agentsDir, (entry) => entry.endsWith('.md'))) {
    let content;
    try {
      content = readFileSync(filePath, 'utf8');
    } catch (err) {
      problems.push({ file: path.relative(repoRoot, filePath), problem: `unreadable: ${err.message}` });
      continue;
    }

    const fmMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
    const modelMatch = fmMatch && fmMatch[1].match(/^model:\s*['"]?([^\s'"]+)['"]?\s*$/m);
    const modelMaxMatch = fmMatch && fmMatch[1].match(/^model_max:\s*['"]?([^\s'"]+)['"]?\s*$/m);
    const rel = path.relative(repoRoot, filePath);
    const TIER_ORDER = ['fast', 'medium', 'thinking', 'ultra'];

    if (!modelMatch) {
      problems.push({ file: rel, problem: 'missing `model:` tier in frontmatter' });
    } else if (!VALID_MODEL_TIERS.has(modelMatch[1])) {
      problems.push({
        file: rel,
        problem: `invalid model tier "${modelMatch[1]}" (expected: ${[...VALID_MODEL_TIERS].join(' | ')})`,
      });
    }

    if (modelMaxMatch) {
      if (!VALID_MODEL_TIERS.has(modelMaxMatch[1])) {
        problems.push({
          file: rel,
          problem: `invalid model_max tier "${modelMaxMatch[1]}" (expected: ${[...VALID_MODEL_TIERS].join(' | ')})`,
        });
      } else if (modelMatch && VALID_MODEL_TIERS.has(modelMatch[1])) {
        const floorIdx = TIER_ORDER.indexOf(modelMatch[1]);
        const ceilIdx = TIER_ORDER.indexOf(modelMaxMatch[1]);
        if (ceilIdx < floorIdx) {
          problems.push({
            file: rel,
            problem: `model_max "${modelMaxMatch[1]}" is below model floor "${modelMatch[1]}"`,
          });
        }
      }
    }
  }
  return problems;
}

/**
 * Validates kit/model-map.json shape: { provider: { tier: non-empty string } }.
 * The installer tolerates a malformed file at runtime (falls back to built-ins),
 * so CI is the only place a broken catalog map gets caught before release.
 */
function checkModelMapJson() {
  const mapPath = path.join(claudeDir, 'model-map.json');
  const rel = path.relative(repoRoot, mapPath);
  let raw;
  try {
    raw = JSON.parse(readFileSync(mapPath, 'utf8'));
  } catch (err) {
    return [{ file: rel, problem: `missing or invalid JSON: ${err.message}` }];
  }

  const problems = [];
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return [{ file: rel, problem: 'top level must be an object of providers' }];
  }
  for (const [provider, tiers] of Object.entries(raw)) {
    if (typeof tiers !== 'object' || tiers === null || Array.isArray(tiers)) {
      problems.push({ file: rel, problem: `provider "${provider}" must map to an object of tiers` });
      continue;
    }
    for (const [tier, model] of Object.entries(tiers)) {
      if (!VALID_MAP_TIERS.has(tier)) {
        problems.push({ file: rel, problem: `provider "${provider}" has unknown tier "${tier}"` });
      } else if (typeof model !== 'string' || !model.trim()) {
        problems.push({ file: rel, problem: `provider "${provider}" tier "${tier}" must be a non-empty string` });
      }
    }
  }
  return problems;
}

/**
 * Non-standard flag synonyms → their canonical form. HailyKit skills express
 * review depth with `--quick`/`--deep` and autonomous execution with `--auto`
 * (interactive is the default, never a flag). A skill that reinvents these under
 * another name fractures the vocabulary, so CI rejects the synonym. Only the
 * `argument-hint:` line is scanned — the authoritative declaration of a skill's
 * own flags — so external tool flags in prose/standards never false-positive.
 */
const BANNED_FLAG_SYNONYMS = {
  '--fast': '--quick', '--shallow': '--quick', '--lite': '--quick', '--simple': '--quick',
  '--thorough': '--deep', '--exhaustive': '--deep', '--deep-dive': '--deep',
  '--yolo': '--auto', '--yes': '--auto', '--noninteractive': '--auto',
  '--non-interactive': '--auto', '--unattended': '--auto',
  '--interactive': '(interactive is the default — do not add a flag)',
};

/**
 * Enforces the standard flag vocabulary across skill `argument-hint:` lines.
 * Returns Array<{ file, problem }>.
 */
function checkFlagVocabulary() {
  const skillsDir = path.join(claudeDir, 'skills');
  const problems = [];
  for (const filePath of findFiles(skillsDir, (entry) => entry === 'SKILL.md')) {
    let content;
    try {
      content = readFileSync(filePath, 'utf8');
    } catch {
      continue; // unreadable files are reported by the registry pass
    }
    const hint = content.match(/^argument-hint:\s*(.+)$/m);
    if (!hint) continue;
    const rel = path.relative(repoRoot, filePath);
    for (const [banned, canonical] of Object.entries(BANNED_FLAG_SYNONYMS)) {
      const re = new RegExp(`(^|[^\\w-])${banned}([^\\w-]|$)`);
      if (re.test(hint[1])) {
        problems.push({ file: rel, problem: `argument-hint uses "${banned}" — use "${canonical}"` });
      }
    }
  }
  return problems;
}

/**
 * Validates that every relative path referenced inside a SKILL.md's `## References`
 * table (or inline `references/...` / `scripts/...` mentions in that section) resolves
 * to a real file under the skill's own directory. Scope is intentionally narrow: only
 * the References section, only `references/` and `scripts/` paths, only fs.existsSync —
 * URLs and `{skill:...}` refs are already covered by collectCkReferences().
 * Returns Array<{ file, problem }>.
 */
function checkReferencesTablePaths() {
  const skillsDir = path.join(claudeDir, 'skills');
  const problems = [];

  for (const filePath of findFiles(skillsDir, (entry) => entry === 'SKILL.md')) {
    let content;
    try {
      content = readFileSync(filePath, 'utf8');
    } catch {
      continue; // unreadable files are reported by the registry pass
    }

    // Line-based section extraction — a lazy [\s\S]*? lookahead for end-of-string
    // combined with the /m flag matches end-of-line instead, truncating after one line.
    const lines = content.split('\n');
    // `^## Reference` also matches heading variants like `## Reference Map` (hl-context-engineering)
    const startIdx = lines.findIndex((line) => /^## Reference/.test(line));
    if (startIdx === -1) continue; // no References section — nothing to validate
    let endIdx = lines.findIndex((line, idx) => idx > startIdx && /^## /.test(line));
    if (endIdx === -1) endIdx = lines.length;
    const sectionText = lines.slice(startIdx + 1, endIdx).join('\n');

    const skillDir = path.dirname(filePath);
    const rel = path.relative(repoRoot, filePath);
    const pathRe = /`((?:references|scripts)\/[^`\s]+)`/g;
    const seen = new Set();
    let match;
    while ((match = pathRe.exec(sectionText)) !== null) {
      const refPath = match[1];
      if (seen.has(refPath)) continue;
      seen.add(refPath);
      const resolved = path.join(skillDir, refPath);
      if (!existsSync(resolved)) {
        problems.push({ file: rel, problem: `References table path does not resolve: ${refPath}` });
      }
    }

    // `flat_inline:` frontmatter paths must also resolve — a typo silently
    // degrades the flat bundle back to a stub the model never follows.
    const flatInline = content.match(/^flat_inline:\s*\[([^\]]*)\]/m);
    if (flatInline) {
      for (const entry of flatInline[1].split(',')) {
        const inlinePath = entry.trim().replace(/^["']|["']$/g, '');
        if (!inlinePath) continue;
        if (!existsSync(path.join(skillDir, inlinePath))) {
          problems.push({ file: rel, problem: `flat_inline path does not resolve: ${inlinePath}` });
        }
      }
    }
  }

  return problems;
}

function main() {
  const { registry, collisions } = buildSkillRegistry();
  const allRefs = collectCkReferences();

  let hasErrors = false;

  // Report name collisions with built-ins
  if (collisions.length > 0) {
    hasErrors = true;
    console.error('[X] Skill name collision(s) with Claude Code built-in commands:');
    for (const { name, file } of collisions) {
      console.error(`  - /hl:${name}  (defined in ${file})`);
    }
    console.error('');
  }

  // Check each reference against registry
  const broken = allRefs.filter(({ ref }) => !registry.has(ref));

  if (broken.length > 0) {
    hasErrors = true;
    console.error('[X] Broken skill references (not registered in any SKILL.md):');
    for (const { ref, file, line } of broken) {
      console.error(`  - /${ref}  at ${file}:${line}`);
    }
    console.error('');
    console.error('Registered skills:', [...registry].sort().join(', ') || '(none)');
  }

  const malformedRefs = collectMalformedSkillRefs();
  if (malformedRefs.length > 0) {
    hasErrors = true;
    console.error('[X] Malformed skill reference(s) — colon-form names are dead pointers; use {skill:prefix-name}:');
    for (const { ref, file, line } of malformedRefs) {
      console.error(`  - ${ref}  at ${file}:${line}`);
    }
    console.error('');
  }

  const tierProblems = checkAgentModelTiers();
  if (tierProblems.length > 0) {
    hasErrors = true;
    console.error('[X] Agent model tier problem(s):');
    for (const { file, problem } of tierProblems) {
      console.error(`  - ${file}: ${problem}`);
    }
    console.error('');
  }

  const mapProblems = checkModelMapJson();
  if (mapProblems.length > 0) {
    hasErrors = true;
    console.error('[X] kit/model-map.json problem(s):');
    for (const { file, problem } of mapProblems) {
      console.error(`  - ${file}: ${problem}`);
    }
    console.error('');
  }

  const flagProblems = checkFlagVocabulary();
  if (flagProblems.length > 0) {
    hasErrors = true;
    console.error('[X] Non-standard flag vocabulary:');
    for (const { file, problem } of flagProblems) {
      console.error(`  - ${file}: ${problem}`);
    }
    console.error('');
  }

  const refPathProblems = checkReferencesTablePaths();
  if (refPathProblems.length > 0) {
    hasErrors = true;
    console.error('[X] Broken References-table path(s):');
    for (const { file, problem } of refPathProblems) {
      console.error(`  - ${file}: ${problem}`);
    }
    console.error('');
  }

  if (!hasErrors) {
    const refCount = allRefs.length;
    const skillCount = registry.size;
    console.log(`[OK] skill-cross-refs: ${skillCount} skill(s) registered, ${refCount} reference(s) checked (prefixes: hl/hc/hs) — all valid. Agent model tiers + model-map.json + flag vocabulary + References-table paths valid.`);
    process.exit(0);
  }

  process.exit(1);
}

main();
