import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const { parseFrontmatter } = require(path.join(ROOT, '.test-build', 'installer', 'converter.js')) as {
  parseFrontmatter(content: string): { body: string };
};

type SkillContract = {
  path: string;
  frontmatter: string;
  argumentHint: string;
  workflowPosition: string[];
  references: string[];
  requiredCallouts: string[];
  safetyMarkers: string[];
};

const CONTRACTS: SkillContract[] = [
  {
    path: 'kit/skills/hc-plan/SKILL.md',
    frontmatter: [
      '---',
      'name: hc-plan',
      'description: "Turns a task into a structured, phased plan through research, codebase analysis, and adversarial review. Auto-detects research depth. Use --deep for architecture decisions requiring maximum scrutiny."',
      'when_to_use: "Invoke when planning a new feature or complex task before implementation."',
      'user-invocable: true',
      'argument-hint: "<task> [--quick] [--deep] [--auto] [--tdd] [--resume] [--cross] | red-team [plan-path] | validate [plan-path]"',
      'metadata:',
      '  category: workflow',
      '  keywords: [planning, architecture, phases, roadmap, research, design]',
      '---',
    ].join('\n'),
    argumentHint: '<task> [--quick] [--deep] [--auto] [--tdd] [--resume] [--cross] | red-team [plan-path] | validate [plan-path]',
    workflowPosition: [
      '**Follows:** `{skill:hl-brainstorm}` — after exploring approach options',
      '**Follows:** `{skill:hc-scout}` — after codebase discovery',
      '**Precedes:** `{skill:hc-cook}` — hands off plan path for implementation',
      '**Related:** `{skill:hl-brainstorm}`, `{skill:hc-cook}`, `{skill:hc-scout}`',
    ],
    references: [
      'references/scope-check.md',
      'references/research-phase.md',
      'references/codebase-analysis.md',
      'references/solution-design.md',
      'references/plan-structure.md',
      'references/plan-quality.md',
      '{skill:hl-reasoning}` `references/reasoning-primitives.md',
      'references/phase-template.md',
      'references/red-team-workflow.md',
      'references/validate-workflow.md',
      'references/task-management.md',
      'references/plan-dependencies.md',
      'references/memory-bridge.md',
      'references/cross-review.md',
    ],
    requiredCallouts: [
      '> **Required — YAGNI/KISS/DRY:**',
      '> **Required — plan before code:**',
    ],
    safetyMarkers: [
      'Never writes implementation code',
      'keep PRIOR claims PRIOR until verified',
      'record unverified claims in `## Assumptions`',
      'ensure each phase\'s `## Risk Assessment` names how the phase is undone and which part cannot be',
      'Cook Handoff must invoke `{skill:hc-mcp-builder}` instead of `{skill:hc-cook}`',
    ],
  },
  {
    path: 'kit/skills/hc-cook/SKILL.md',
    frontmatter: [
      '---',
      'name: hc-cook',
      'description: "Feature implementation pipeline: Recon → Draft → Build → Verify → Ship. Auto-detects input type (task description, plan path, image, Figma URL). Delegates all Verify and Ship work to specialist agents — never self-implements testing, review, or finalization."',
      'when_to_use: "Invoke when executing an implementation plan or feature task end-to-end."',
      'user-invocable: true',
      'argument-hint: "<task|plan.md|image.png|figma-url> [--quick] [--deep] [--auto] [--tdd] [--spec] [--cross] [--tier fast|medium|thinking] [--strict] | migrate \\"<description>\\""',
      'metadata:',
      '  category: workflow',
      '  keywords: [implementation, feature, pipeline, plan-execute, layout, coding]',
      '---',
    ].join('\n'),
    argumentHint: '<task|plan.md|image.png|figma-url> [--quick] [--deep] [--auto] [--tdd] [--spec] [--cross] [--tier fast|medium|thinking] [--strict] | migrate "<description>"',
    workflowPosition: [
      '**Follows:** `{skill:hc-plan}` — execute an approved plan',
      '**Follows:** `{skill:hl-brainstorm}` — implement an agreed solution',
      '**Precedes:** `{skill:hc-review}`, `{skill:hc-test}`',
      '**Related:** `{skill:hc-fix}`',
    ],
    references: [
      'references/input-detect.md',
      'references/process-steps.md',
      'references/review-gates.md',
      'references/agent-invocations.md',
      'references/review-artifacts.md',
      'references/layout/',
      'references/workflow-migration.md',
    ],
    requiredCallouts: [
      '> **Required — plan-first:**',
      '> **Required — recon-first:**',
      '> **Required — zero-regress:**',
    ],
    safetyMarkers: [
      'public contracts are untouched unless explicitly flagged',
      'apply Auto-Resolve Ladder',
      'Run Verify-by-Execution',
      'Ship is **never skipped**',
      'A workflow with zero Task calls is incomplete',
      'The visual artifact IS the spec',
    ],
  },
  {
    path: 'kit/skills/hc-review/SKILL.md',
    frontmatter: [
      '---',
      'name: hc-review',
      'description: "Adversarial code review pipeline: Spec gate → Quality (haily-reviewer) ∥ Stress Probe in parallel → Simplification Scan (rides the Quality pass). Supports PR, commit, pending, codebase, and UI/UX targets. Post findings inline with --comment, apply to working tree with --fix."',
      'when_to_use: "Invoke when reviewing code changes, a PR, a commit, or the full codebase."',
      'user-invocable: true',
      'argument-hint: "[#PR | COMMIT | --pending | codebase] [--quick] [--deep] [--comment] [--fix] [--ui [pattern]] [--batch <\\"#N,#M,...\\">] [--agentic] [--cross] [--quiz]"',
      'metadata:',
      '  category: workflow',
      '  keywords: [review, quality, adversarial, red-team, code-quality, security]',
      '---',
    ].join('\n'),
    argumentHint: '[#PR | COMMIT | --pending | codebase] [--quick] [--deep] [--comment] [--fix] [--ui [pattern]] [--batch <"#N,#M,...">] [--agentic] [--cross] [--quiz]',
    workflowPosition: [
      '**Follows:** `{skill:hc-cook}` — review after implementation',
      '**Follows:** `{skill:hc-fix}` — review after bug fix',
      '**Precedes:** `{skill:hc-ship}` — ship after review passes',
      '**Related:** `{skill:hc-scout}`, `{skill:hc-test}`, `{skill:hc-security}`',
    ],
    references: [
      'references/input-routing.md',
      'references/review-spec.md',
      'references/review-adversarial.md',
      'references/flow-codebase.md',
      'references/flow-parallel.md',
      'references/flow-ui-ux.md',
      'references/flow-checklist.md',
      'references/quality-verification.md',
      '{skill:hl-reasoning}` `references/reasoning-primitives.md',
      'references/process-task-pipeline.md',
      'references/process-reception.md',
      'references/process-edge-cases.md',
      'references/process-requesting.md',
      'references/checks.md',
      'references/flow-batch.md',
      'references/checklists/agentic.md',
      'references/checklists/base.md',
      'references/checklists/api.md',
      'references/checklists/web-app.md',
      'references/checklists/database.md',
      'references/checklists/observability.md',
      'references/flow-simplification.md',
      'references/flow-cross.md',
      'references/flywheel-distillation.md',
      'references/flow-quiz.md',
    ],
    requiredCallouts: [
      '> **Required — recon-first, reuse-first:**',
      '> **Required — evidence-before-claims:**',
      '> **Required — rollback named for Critical and High:**',
    ],
    safetyMarkers: [
      'A finding cites what was OBSERVED at `file:line`',
      'never becomes OBSERVED by being restated',
      'Every Critical or High finding states how the change is undone and which part cannot be',
      'for every ACCEPTED finding',
      'playbook-id',
      'Cross-Model Review',
    ],
  },
  {
    path: 'kit/skills/hc-fix/SKILL.md',
    frontmatter: [
      '---',
      'name: hc-fix',
      'description: "Root-cause-first bug resolution for any symptom: runtime errors, test failures, type errors, lint violations, CI failures, and dependency vulnerabilities. Auto-routes by input type. --quick for active production incidents (renamed from the old hotfix flag). --deep for architectural failures. deps for dependency audits and upgrades."',
      'when_to_use: "Invoke when there is a concrete bug, error, CI failure, or dependency vulnerability to fix."',
      'user-invocable: true',
      'argument-hint: "[issue] [--auto] [--quick] [--deep] | deps [scope]"',
      'metadata:',
      '  category: workflow',
      '  keywords: [bugfix, error, test-failure, CI, lint, debug]',
      '---',
    ].join('\n'),
    argumentHint: '[issue] [--auto] [--quick] [--deep] | deps [scope]',
    workflowPosition: [
      '**Follows:** `{skill:hc-debug}` — complex investigation before fixing',
      '**Follows:** `{skill:hc-scout}` — locate affected code first',
      '**Precedes:** `{skill:hc-test}`, `{skill:hc-review}`',
      '**Related:** `{skill:hc-debug}`, `{skill:hc-cook}`',
    ],
    references: [
      'references/anti-rationalization.md',
      'references/diagnosis-protocol.md',
      'references/prevention-gate.md',
      'references/mode-selection.md',
      'references/complexity-assessment.md',
      'references/task-orchestration.md',
      'references/skill-activation-matrix.md',
      'references/parallel-exploration.md',
      'references/workflow-artifacts.md',
      'references/workflow-simple.md',
      'references/workflow-standard.md',
      'references/workflow-deep.md',
      'references/review-cycle.md',
      'references/workflow-ci.md',
      'references/workflow-logs.md',
      'references/workflow-test.md',
      'references/workflow-types.md',
      'references/workflow-ui.md',
      'references/workflow-quick.md',
      'references/workflow-deps.md',
    ],
    requiredCallouts: [
      '> **Required — root cause before fix:**',
      '> **Required — scout first:**',
      '> **Required — exact diagnosis:**',
      '> **Required — no side effects:**',
    ],
    safetyMarkers: [
      'A hypothesis is not a root cause',
      'root cause with `file:line` citation',
      'Public API contracts unchanged',
      'add or update at least one regression test',
      'After 3 failures, stop and discuss architecture',
      'append one line to `.agents/failure-history.jsonl`',
    ],
  },
  {
    path: 'kit/skills/hc-scout/SKILL.md',
    frontmatter: [
      '---',
      'name: hc-scout',
      'description: "Parallel codebase discovery before implementation. Splits the repo into segments and spawns one Explore subagent per segment. Reports project type, relevant modules, patterns, in-flight plans, and public APIs. Supports ext (broad parallel scouting), --pack (repomix dump), and --graph (knowledge graph)."',
      'when_to_use: "Invoke when locating code, mapping dependencies, or discovering relevant files before making changes."',
      'user-invocable: true',
      'argument-hint: "[target] [ext] [--quick] [--contracts] [--pack] [--graph] [--deps <module> [--owner <org>]]"',
      'metadata:',
      '  category: project',
      '  keywords: [codebase, scouting, file-discovery, parallel, repomix, knowledge-graph]',
      '---',
    ].join('\n'),
    argumentHint: '[target] [ext] [--quick] [--contracts] [--pack] [--graph] [--deps <module> [--owner <org>]]',
    workflowPosition: [
      '**Precedes:** `{skill:hc-plan}`, `{skill:hc-cook}`, `{skill:hc-debug}`',
      '**Auto-invoked by:** `{skill:hc-fix}` (Recon stage), `{skill:hc-debug}` (Recon stage)',
      '**Related:** `{skill:hc-git}` — scout for codebase context; `hc-git analyze` for change impact',
    ],
    references: [
      'references/process-internal-agents.md',
      'references/process-external-tools.md',
      'references/process-task-tracking.md',
      'references/tech-repomix-config.md',
      'references/tech-repomix-patterns.md',
      'references/protocol-contract-extraction.md',
      'references/flow-deps.md',
    ],
    requiredCallouts: [
      '> **Required — recon-first:**',
      '> **Required — 3-minute cap:**',
      '> **Required — no directory overlap:**',
      '> **Required — sequential below threshold:**',
    ],
    safetyMarkers: [
      'Partition assignments must be mutually exclusive',
      'never to a segment',
      'Never overwrite a plan-authored `scout-report.md`',
      'replacing any previous addendum rather than stacking a new one',
      'it is not an orientation map and would poison downstream reuse',
      'Always classify the architectural pattern',
    ],
  },
];

function read(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8').replace(/\r\n/g, '\n');
}

function bodyBytes(relativePath: string): number {
  return Buffer.byteLength(parseFrontmatter(read(relativePath)).body, 'utf8');
}

test('core skill prompt contracts keep frontmatter and argument hints byte-identical', () => {
  for (const contract of CONTRACTS) {
    const skill = read(contract.path);
    const expected = `${contract.frontmatter}\n`;

    assert.ok(
      skill.startsWith(expected),
      `${contract.path} frontmatter block changed`,
    );
  }
});

test('core skill prompt contracts keep required callouts, workflow position, and reference paths', () => {
  for (const contract of CONTRACTS) {
    const skill = read(contract.path);

    for (const marker of contract.requiredCallouts) {
      assert.ok(skill.includes(marker), `${contract.path} must retain ${marker}`);
    }
    for (const line of contract.workflowPosition) {
      assert.ok(skill.includes(line), `${contract.path} must retain workflow line: ${line}`);
    }
    for (const ref of contract.references) {
      assert.ok(skill.includes(ref), `${contract.path} must retain reference path: ${ref}`);
    }
  }
});

test('core skill prompt contracts keep safety, evidence, rollback, and public-contract constraints', () => {
  for (const contract of CONTRACTS) {
    const skill = read(contract.path);
    for (const marker of contract.safetyMarkers) {
      assert.ok(skill.includes(marker), `${contract.path} must retain safety marker: ${marker}`);
    }
  }
});

test('core skill batch baseline covers only the owned five skill files', () => {
  const summary = CONTRACTS.map((contract) => ({
    path: contract.path,
    bodyBytes: bodyBytes(contract.path),
  }));

  assert.deepEqual(
    summary.map((entry) => entry.path),
    CONTRACTS.map((contract) => contract.path),
  );
  const ceilings = new Map([
    ['kit/skills/hc-plan/SKILL.md', 8897],
    ['kit/skills/hc-cook/SKILL.md', 11791],
    ['kit/skills/hc-review/SKILL.md', 16272],
    ['kit/skills/hc-fix/SKILL.md', 11447],
    ['kit/skills/hc-scout/SKILL.md', 12630],
  ]);
  for (const entry of summary) {
    assert.ok(entry.bodyBytes <= ceilings.get(entry.path)!, `${entry.path} exceeded its optimized body-byte ceiling`);
  }
});
