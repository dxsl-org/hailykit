import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const FILES = {
  reasoning: 'kit/skills/hl-reasoning/SKILL.md',
  mindmap: 'kit/skills/hl-mindmap/SKILL.md',
  stats: 'kit/skills/hl-stats/SKILL.md',
  git: 'kit/skills/hc-git/SKILL.md',
  lookup: 'kit/skills/hc-lookup/SKILL.md',
} as const;
const BASELINE_BYTES = 29_352;

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
}

function includesAll(label: string, body: string, markers: string[]): void {
  for (const marker of markers) assert.ok(body.includes(marker), `${label} lost: ${marker}`);
}

test('utility skill compression preserves frontmatter and behavior contracts', () => {
  const reasoning = read(FILES.reasoning);
  assert.ok(reasoning.startsWith(`---
name: hl-reasoning
description: "Structured sequential analysis with dynamic thought-count adjustment, hypothesis testing, branching, and revision. Use for complex decomposition, debugging causal chains, adaptive planning, or any problem where scope is unclear or emerging."
when_to_use: "Invoke when step-by-step sequential reasoning or hypothesis revision is needed."
user-invocable: true
argument-hint: "[problem to analyze]"
metadata:
  category: thinking
  keywords: [systematic reasoning, sequential thinking, step-by-step, analysis, problem-solving, stuck, simplify, inversion]
`));
  includesAll('hl-reasoning', reasoning, [
    'Thought 1/5:', '[REVISION of Thought N]', '[BRANCH A from Thought N]',
    '[HYPOTHESIS]', '[VERIFICATION]', '[FINAL]',
    'references/process-when-stuck.md', 'scripts/process-thought.js',
    'references/reasoning-primitives.md',
  ]);

  const mindmap = read(FILES.mindmap);
  assert.ok(mindmap.startsWith(`---
name: hl-mindmap
description: "Build, extend, and visualize domain-agnostic knowledge graphs. Agent researches entities and relationships from topics, web sources, or documents. Stores as JSON, renders as interactive HTML. Supports any domain: events, concepts, people, organizations."
when_to_use: "Invoke when mapping relationships between entities, events, concepts, or people — especially when the agent should discover connections automatically."
user-invocable: true
category: thinking
keywords: [knowledge-graph, mindmap, entities, relationships, research, visualization]
argument-hint: "<topic|doc|url|file.json> [doc|url|query]"
`));
  includesAll('hl-mindmap', mindmap, [
    'ADD_ENTITY', 'FIND_REL', 'EXPLORE', 'DELETE', 'EXTEND_DOC', 'EXTEND_URL',
    'Required — research-before-add:', '{skill:hl-research}',
    'confidence: CONFIRMED | INFERRED | AMBIGUOUS',
    '{skill:hc-docs}', '.agents/mindmaps/{slug}.json',
    '.agents/mindmaps/{slug}.html', 'references/storage-schema.md',
  ]);

  const stats = read(FILES.stats);
  assert.ok(stats.startsWith(`---
name: hl-stats
description: "Project code statistics — file counts, nLOC, complexity hotspots, LLM token estimate, COCOMO cost, test ratio, TODO/FIXME debt markers, oversized files, plus git insights: churn × complexity risk hotspots, bus factor, ownership, stale files, commit velocity, contributors, release cadence."
when_to_use: "Invoke when you need a codebase size snapshot, want to find high-complexity or high-risk (churn × complexity) hotspots, need a token budget before loading files into an LLM context, or want manager-facing metrics (COCOMO cost, bus factor, velocity, release cadence)."
user-invocable: true
argument-hint: "[path] [--json] [--lang <list>] [--top <n>] [--exclude <pattern>] [--since <days>] [--salary <n>] [--no-git]"
metadata:
  category: dev-tools
  keywords: [stats, metrics, loc, ncloc, complexity, hotspots, token, codebase, size, language]
`));
  includesAll('hl-stats', stats, [
    'Task(subagent_type="haily-stats")', 'token_est = ncloc × 18',
    'risk = churn × complexity', 'bus_factor', 'COCOMO 81',
    'tests.test_ncloc_ratio', 'TODO/FIXME/HACK', 'activity.weekly_commits',
    'git: null', '--no-git', 'complexity warning 15, error 25',
  ]);

  const git = read(FILES.git);
  assert.ok(git.startsWith(`---
name: hc-git
description: "Git workflows: commits, PRs, merges, conflict resolution, change impact analysis, sprint retrospectives, and autonomous GitHub issue triage. Auto-splits by scope, scans for secrets."
when_to_use: "Invoke for all git operations: committing, branching, PRs, conflict resolution, change analysis, sprint metrics, or working through GitHub issues autonomously."
user-invocable: true
argument-hint: "cm|cp|pr|merge|analyze|retro|issues [args]"
metadata:
  category: dev-tools
  keywords: [git, commits, staging, PR, merge, impact, analysis, retrospective, technical-debt, risk, issues, triage, github]
`));
  includesAll('hc-git', git, [
    '`cm` never pushes', 'only `cp` or an explicit push request may push',
    'Required — secrets check:', 'never commit it',
    '`analyze` and `retro` are read-only', 'zero Critical/Important findings',
    'never force-push or direct-push protected branches', 'haily-git-manager',
    'references/workflow-commit.md', 'references/workflow-merge-pr.md',
  ]);

  const lookup = read(FILES.lookup);
  assert.ok(lookup.startsWith(`---
name: hc-lookup
description: "Find up-to-date library/framework docs by name, topic, version, or comparison. Auto-discovers via context7 llms.txt. Supports version-specific lookup (react@19), library comparison (hono vs express), and migration guides."
when_to_use: "Invoke when you need API docs, version-specific behavior, library comparisons, or migration/upgrade guides without hunting for URLs manually."
user-invocable: true
argument-hint: "[library[@version]] [topic] | [lib1] vs [lib2] [topic] | [library] migration [from-to]"
metadata:
  category: dev-tools
  keywords: [docs, llms-txt, api, library, context7, versioned, comparison, migration]
`));
  includesAll('hc-lookup', lookup, [
    'Required — source freshness:', 'attribute claims to returned sources',
    'Required — version fidelity:', 'fall back to general docs and disclose',
    'scripts/detect-topic.js', 'scripts/fetch-docs.js',
    'scripts/analyze-llms-txt.js', '/tags/v5.0.0/llms.txt',
    'official migration guides', 'direct source links', 'CONTEXT7_API_KEY',
  ]);
});

test('utility skill batch meets individual and aggregate byte ceilings', () => {
  const sizes = Object.fromEntries(
    Object.entries(FILES).map(([key, rel]) => [key, Buffer.byteLength(read(rel))]),
  ) as Record<string, number>;
  assert.ok(sizes.reasoning <= 3_650, `hl-reasoning ${sizes.reasoning} exceeds 3650`);
  assert.ok(sizes.mindmap <= 3_650, `hl-mindmap ${sizes.mindmap} exceeds 3650`);
  assert.ok(sizes.stats <= 3_500, `hl-stats ${sizes.stats} exceeds 3500`);
  assert.ok(sizes.git <= 4_200, `hc-git ${sizes.git} exceeds 4200`);
  assert.ok(sizes.lookup <= 3_800, `hc-lookup ${sizes.lookup} exceeds 3800`);
  const total = Object.values(sizes).reduce((sum, size) => sum + size, 0);
  assert.ok(total <= 18_500, `batch ${total} exceeds 18500`);
  assert.ok(total < BASELINE_BYTES, 'batch did not improve over main baseline');
});
