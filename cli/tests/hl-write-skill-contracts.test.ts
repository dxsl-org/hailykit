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
description: "Write any authored document — business plan, market research report, article, essay, academic paper/thesis/literary criticism, short story, novel, or book, research proposal (đề cương), VN administrative văn bản (công văn/báo cáo hành chính), marketing copy, resume/CV, speech (diễn văn), or giáo trình/tutorial. One pipeline, genre-specific playbooks, persistent Story Bible for long-form fiction so characters/setting/canon never drift across chapters."
when_to_use: "Invoke when the user asks for an authored written deliverable — a document, article, essay, paper, story, or book, including proposals, VN administrative văn bản, marketing copy, resumes/cover letters, speeches, or educational/tutorial content. Not for code/project docs ({skill:hc-docs}) or a research report with no authored deliverable ({skill:hl-research}). Educational content stays here only if it teaches a transferable skill/concept — remove the reference to this specific repo/API and check whether the content is still valid and useful; if it collapses without that codebase in front of the reader, route to {skill:hc-docs} instead. Long-form work initializes a persistent workspace — confirm the brief Checkpoint before heavy generation begins."
user-invocable: true
category: workflow
keywords: [writing, author, novel, book, fiction, essay, business-plan, manuscript, story, thesis, criticism, citation, proposal, marketing, resume, speech, tutorial, report]
argument-hint: "\\"<work description>\\" [reference-files...] [--out <dir>] [--style <file|dir>] [--auto]"
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
    'legal instruments are out of scope',
    'NĐ30/agency form → vn-administrative',
    'job application → career-documents',
    'Cap 20 files',
    'Narrative nonfiction, tản văn, personal essay, inspirational speech, and memoir',
    'fiction grounds particulars in its brief/world/canon instead',
    'IMPORT follows `references/import-mode.md`',
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
    'workspace-schema.md', 'import-mode.md', 'context-assembly.md', 'review-passes.md', 'citation-styles.md',
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
