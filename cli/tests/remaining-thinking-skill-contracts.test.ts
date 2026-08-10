import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const FILES = {
  brainstorm: 'kit/skills/hl-brainstorm/SKILL.md',
  goal: 'kit/skills/hc-goal/SKILL.md',
  visualize: 'kit/skills/hl-visualize/SKILL.md',
  research: 'kit/skills/hl-research/SKILL.md',
} as const;
const BASELINE_BYTES = 47_803;

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
}

test('thinking/productivity skill compression preserves frontmatter and core contracts', () => {
  const brainstorm = read(FILES.brainstorm);
  assert.ok(brainstorm.startsWith(`---
name: hl-brainstorm
description: "Brainstorm solutions with structured trade-off analysis. Default mode auto-selects persona and edge dimensions from the problem context. Explicit persona flags for targeted consultation. --debate for adversarial multi-persona review. --edges for 12-dimension edge case analysis. --deep is an alias for --debate --edges."
when_to_use: "Invoke before choosing among unclear technical options, or to get an expert lens on a specific question."
user-invocable: true
argument-hint: "[topic] [--architect|--scientist|--social-scientist|--philosopher|--economist|--strategist|--creative-director|--manager|--devil] [--debate] [--edges] [--deep]"
metadata:
  attribution: "Multi-persona debate pattern adapted from autoresearch by Udit Goenka (MIT)"
  category: thinking
  keywords: [ideation, tradeoffs, debate, decisions, personas, scenario, edge-cases]
`));
  for (const marker of [
    'Persona consultation (`--[persona]`): answer immediately through that lens',
    'Scope range rule:',
    'Required — recon-first, reuse-first (full mode only):',
    'Required — no implementation:',
    '--deep` | Alias for `--debate --edges`',
    'all 9 personas analyze independently',
    'STOP triggers:',
    'haily-judge',
    '⚠ apex judge unavailable — verdict by session model',
    '**For a single top-tier ruling:**',
    '{skill:hl-advisor}',
    '{skill:hl-context-engineering}',
  ]) assert.ok(brainstorm.includes(marker), `hl-brainstorm lost: ${marker}`);

  const goal = read(FILES.goal);
  assert.ok(goal.startsWith(`---
name: hc-goal
description: "Autonomous development loop: give it a goal, it plans, implements, reviews, and commits each phase until done. Bounded by a proxy budget and baseline-relative regression gate. Longer than hc-cook (many phases), cheaper than native goal (structured ledger bounds context). Delegates to hc-plan, hc-cook, and haily-git-manager."
when_to_use: "Invoke only when the user explicitly types /hc-goal. Do not auto-trigger from natural language — autonomous scope makes accidental activation harmful."
user-invocable: true
argument-hint: "\\"<goal>\\" [--deep] [--auto] [--tdd] [--retry N] [--budget N] [--budget Xtool] [--strict]"
metadata:
  category: workflow
  keywords: [autonomous, goal, loop, orchestrate, automate, pipeline, long-running]
`));
  for (const marker of [
    '`--budget N`',
    '`--budget Xtool`',
    '`--retry N`',
    '`--strict`',
    'Required — no-new-failures:',
    'references/regression-gate.md',
    'Required — ledger-compaction:',
    'references/run-ledger.md',
    'Required — phase-commit:',
    'Required — delegate-only:',
    'export HL_LOOP_GUARD_ACTIVE=1',
    'SECONDARY loop-guard tripwire',
    'PRIMARY guard remains the regression gate shrinkage check',
    '{skill:hc-plan} --auto "<goal>"',
    'Checkpoint (Plan exit):',
    'Approve / Revise / Abort',
    '{skill:hc-cook} <phase-NN.md> --tier <phase.tier>',
    'export HL_LOOP_GUARD_ACTIVE=0',
    'haily-project-manager',
    'haily-git-manager',
    'haily-advisor',
    '⚠ advisor unavailable — advice by session model',
    '.agents/failure-history.jsonl',
  ]) assert.ok(goal.includes(marker), `hc-goal lost: ${marker}`);
  const orderedGoalStages = ['1. **Route**', '2. **Recon**', '3. **Plan**', '4. **Execute**', '5. **Close**'];
  let previousGoalStage = -1;
  for (const stage of orderedGoalStages) {
    const index = goal.indexOf(stage);
    assert.ok(index > previousGoalStage, `hc-goal stage missing or out of order: ${stage}`);
    previousGoalStage = index;
  }
  assert.ok(goal.indexOf('Checkpoint (Plan exit):') < goal.indexOf('4. **Execute**'));

  const visualize = read(FILES.visualize);
  assert.ok(visualize.startsWith(`---
name: hl-visualize
description: "Present data and insights as diagrams, slides, HTML pages, Excel reports, or PDF documents."
when_to_use: "Invoke when generating visual explanations, diagrams, slides, ASCII art, Excel reports, or PDFs for any topic or dataset."
user-invocable: true
argument-hint: "[path|topic] [--explain|--slides|--diagram|--ascii|--html|--diff [ref]|--plan-review [plan]|--recap [timeframe]|--mermaid [type|desc]|--excel [data]|--pdf [topic|form.pdf data.json]|--stop]"
metadata:
  category: workflow
  keywords: [visualize, diagram, chart, slides, presentation, html, ascii, mermaid, excel, pdf]
`));
  for (const marker of [
    'AskUserQuestion',
    'Visualize Operation',
    'Required — HTML theme toggle:',
    'data-theme',
    'Required — inline HTML:',
    'Required — visual self-review:',
    'npx mmdc -i diagram.mmd -o check.svg',
    '{plan_dir}/visuals/{slug}.html',
    '--diff [ref]',
    '--plan-review [plan-file]',
    '--recap [timeframe]',
    '{skill:hl-design}',
    'weasyprint',
    'wkhtmltopdf',
    'pdftk fill_form',
    'references/generation-checklist.md',
    'references/output-excel.md',
    'references/output-pdf.md',
  ]) assert.ok(visualize.includes(marker), `hl-visualize lost: ${marker}`);

  const research = read(FILES.research);
  assert.ok(research.startsWith(`---
name: hl-research
description: "Deep technical, academic, and market research — technology evaluation, security review, migration planning, architecture decisions, literature review, market/competitor analysis. Supports --quick (5 min sanity check) and --deep (20 min production-grade evaluation)."
when_to_use: "Invoke when researching a technical topic, library, or best practice before deciding, or when the ask is a scholarly literature review or market/competitive research (\\"nghiên cứu thị trường\\"). Use --quick for fast validation, --deep for architecture decisions."
user-invocable: true
argument-hint: "<topic> [--quick | --deep] [--type eval|security|migration|arch|academic|market]"
metadata:
  category: thinking
  keywords: [research, evaluation, analysis, solutions, security, migration, architecture, academic, scholarly, literature-review, market, competitor]
`));
  for (const marker of [
    'Required — parallel searches:',
    'Required — recency first:',
    'recent CVEs and advisories',
    'Required — source credibility weighting:',
    'Required — read by tier (token discipline):',
    'Tier 1–2',
    'Required — sufficiency gate:',
    'inversion pass',
    'bounded inversion pass (2–3 reverse queries)',
    'active refutation',
    'VERIFIED',
    'UNVERIFIED',
    'CONTESTED',
    'Never fabricate evidence, dates, citations, or support levels',
    'Query Fan-Out',
    '{skill:hc-browser}',
    '{skill:hc-lookup}',
    'Comparison Matrix',
    'Competitor Matrix',
    'Evidence Strength per Claim',
    'Citations',
  ]) assert.ok(research.includes(marker), `hl-research lost: ${marker}`);

  for (const body of [brainstorm, goal, visualize, research]) {
    assert.ok(!body.includes('> [!IMPORTANT]\n> **Required —'), 'required guard uses non-canonical wrapper');
  }
});

test('thinking/productivity skill batch stays under byte ceilings', () => {
  const sizes = Object.fromEntries(
    Object.entries(FILES).map(([key, rel]) => [key, Buffer.byteLength(read(rel))]),
  ) as Record<string, number>;
  assert.ok(sizes.brainstorm <= 8_100, `hl-brainstorm ${sizes.brainstorm} exceeds 8100`);
  assert.ok(sizes.goal <= 7_300, `hc-goal ${sizes.goal} exceeds 7300`);
  assert.ok(sizes.visualize <= 7_200, `hl-visualize ${sizes.visualize} exceeds 7200`);
  assert.ok(sizes.research <= 6_700, `hl-research ${sizes.research} exceeds 6700`);
  const total = sizes.brainstorm + sizes.goal + sizes.visualize + sizes.research;
  assert.ok(total <= 28_700, `batch ${total} exceeds 28700`);
  assert.ok(total < BASELINE_BYTES, 'batch did not improve over main baseline');
});
