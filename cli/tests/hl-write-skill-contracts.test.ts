import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { bundleFlatSkill } from '../installer/converter';

const ROOT = process.cwd();
const SKILL_DIR = path.join(ROOT, 'kit', 'skills', 'hl-write');

function read(file: string): string {
  return fs.readFileSync(path.join(SKILL_DIR, file), 'utf8').replace(/\r\n/g, '\n');
}

test('hl-write compression preserves routing, evidence, canon, style, and host contracts', () => {
  const skill = read('SKILL.md');
  assert.ok(skill.startsWith(`---
name: hl-write
description: "Write authored prose — business plan, market report, article, essay, academic paper/thesis/literary criticism, story, book, research proposal, VN administrative văn bản, marketing copy, resume/CV, speech, or tutorial. One pipeline, genre playbooks, persistent Story Bible."
when_to_use: "Invoke when the user wants an authored written deliverable the reader consumes as prose. Not for code/project docs ({skill:hc-docs}) or research with no authored deliverable ({skill:hl-research}). Educational content stays here only if it teaches a transferable skill/concept; otherwise route to {skill:hc-docs}. Long-form work uses a persistent workspace and pauses at the brief Checkpoint before heavy generation."
user-invocable: true
category: workflow
keywords: [writing, author, novel, book, fiction, essay, business-plan, manuscript, story, thesis, criticism, citation, proposal, marketing, resume, speech, tutorial, report]
argument-hint: "\\"<work description>\\" [reference-files...] [--out <dir>] [--style <file|dir>] [--stage <route|recon|draft|build|verify|ship>] [--auto]"
flat_inline: [references/craft-prose-antipatterns.md]
`));
  for (const marker of [
    '**Required — research-before-write:**',
    'If evidence is missing, state unknown and request a source',
    'Never fabricate citations, interviews, testimonials, legal grounds, achievements, or survey data',
    '**Required — canon-first:**',
    'retcons append `supersedes:`',
    '**Required — unit-ledger:**',
    'default cap is 15 units',
    '**Required — style-is-voice-only:**',
    '**Required — stage-contracts:**',
    'legal instruments are out of scope',
    'NĐ30/agency form → vn-administrative',
    'job application → career-documents',
    'Cap 20 files',
    'Narrative nonfiction, tản văn, personal essay, inspirational speech, and memoir',
    'fiction grounds particulars in its brief/world/canon instead',
    'IMPORT follows `references/import-mode.md`',
    '{skill:hl-write} <workspace-or-pack> --stage <route|recon|draft|build|verify|ship> [--out <dir>]',
    '| `--stage <name>` | run only that stage; Route preflight still validates state |',
    'inventory claim coverage, and only delegate uncovered mandatory-evidence gaps',
    'if thesis/angle/structure remains open, develop only those open decisions with `{skill:hl-brainstorm}`',
    'User edits after merge require reconciliation before Verify',
    '.hl-write-state.json',
    'Initialize marker + ledger + `.hl-write-state.json` before brief approval',
    'optional prepared evidence pack or internal gap-fill',
    'reject/retry once',
    'Review Circuit ≤3 rounds',
    'scripts/style-stats.mjs',
    'missing career facts',
    'unconfirmed international grant funder/call',
    'Required — single-agent fallback:',
    'If subagents are unavailable, perform researcher → writer → editor sequentially in separate turns',
  ]) assert.ok(skill.includes(marker), `hl-write lost: ${marker}`);
  assert.ok(skill.indexOf('Required — single-agent fallback:') < skill.indexOf('## Process'));
  for (const reference of [
    'workspace-schema.md', 'stage-control.md', 'import-mode.md', 'context-assembly.md', 'review-passes.md', 'citation-styles.md',
    'playbook-business-report.md', 'playbook-vn-administrative.md', 'playbook-article.md', 'playbook-marketing-copy.md',
    'playbook-speech.md', 'playbook-academic-writing.md', 'playbook-academic-thesis.md', 'playbook-research-proposal.md',
    'playbook-literary-criticism.md', 'playbook-fiction.md', 'craft-fiction-prose.md', 'playbook-career-documents.md',
    'playbook-educational-content.md', 'playbook-nonfiction-book.md',
  ]) assert.ok(skill.includes(reference), `hl-write lost reference: ${reference}`);
});

test('flat-inline prose rubric preserves multi-genre anti-fabrication and voice contracts', () => {
  const rubric = read('references/craft-prose-antipatterns.md');
  for (const marker of [
    'every prose genre', 'Uniform paragraph length/rhythm', 'Repeated “not X, but Y”', 'Speakers sound interchangeable',
    'Vietnamese-specific', 'Sáo ngữ', 'Machine/fuel for family care', 'Abstract elevation ending',
    '≤1 per ~300 words', 'Every narrative, reflective, or inspirational unit', 'Anti-fabrication genres',
    'invented surveys, dates, quotations, achievements, or citations never are', 'Style seeding output contract',
    '(register reference, not a checklist)',
  ]) assert.ok(rubric.includes(marker), `prose rubric lost: ${marker}`);
});

test('hl-write installed hot prompt stays within measured byte ceilings', () => {
  const skill = read('SKILL.md');
  const rubric = read('references/craft-prose-antipatterns.md');
  const bundled = bundleFlatSkill(SKILL_DIR, (raw) => raw.replace(/\r\n/g, '\n'));
  assert.ok(Buffer.byteLength(skill) <= 12_000, 'hl-write SKILL.md exceeds 12000 bytes');
  assert.ok(Buffer.byteLength(rubric) <= 6_200, 'flat-inline rubric exceeds 6200 bytes');
  assert.ok(Buffer.byteLength(skill) + Buffer.byteLength(rubric) <= 18_000, 'hot source pair exceeds 18000 bytes');
  assert.match(bundled, /# Reference: references\/craft-prose-antipatterns\.md[\s\S]*Prose Anti-Patterns/);
  assert.match(bundled, /# Reference: references\/workspace-schema\.md\n> \[!IMPORTANT\]/);
  assert.doesNotMatch(bundled, /Workspace marker specification/);
  assert.ok(Buffer.byteLength(bundled) <= 26_000, `installed flat prompt is ${Buffer.byteLength(bundled)} bytes`);
});

test('hl-write stage-control and workspace references preserve direct-stage and reconciliation contracts', () => {
  const stageControl = read('references/stage-control.md');
  const workspace = read('references/workspace-schema.md');
  const review = read('references/review-passes.md');

  for (const marker of [
    'pipeline stays `Route → Recon → Draft → Build → Verify → Ship`',
    'research=satisfied',
    'research=partial',
    'concept=locked',
    'concept=partial',
    '**Build pack**',
    'source: external',
    'returns `NOT_READY`',
    'Absolute-resolve and echo both source and destination before copy',
    'Reject traversal, symlinks',
    'Hash each recognized file\'s bytes',
    'Stale artifacts remain on disk for comparison',
    'NOT_READY: Draft requires',
    'valid workspace; no direct Ship pack exists',
  ]) assert.ok(stageControl.includes(marker), `stage-control lost: ${marker}`);

  for (const marker of [
    '.hl-write-state.json',
    '"checkpoint": "awaiting-user"',
    '"research": "partial"',
    'modified (pending-review)',
    'Route preflight scaffolds `.hl-write-state.json`',
    'marker + `ledger.md` + `.hl-write-state.json`',
    'sorted recognized relative paths plus per-file byte hashes',
    'detect content-hash drift',
    'Imported prose never enters this reconciliation path',
    'Verify never trusts a manually edited unit on file presence alone',
  ]) assert.ok(workspace.includes(marker), `workspace schema lost: ${marker}`);

  for (const marker of [
    '## Reconciliation pass for user-edited units',
    'compare prior canon/facts impact with the new prose',
    'return the ledger row to `complete` only after summary + canon/facts state are fresh again',
    'Imported source prose is excluded from this pass',
  ]) assert.ok(review.includes(marker), `review passes lost: ${marker}`);
});
