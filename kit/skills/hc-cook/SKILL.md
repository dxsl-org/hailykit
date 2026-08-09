---
name: hc-cook
description: "Feature implementation pipeline: Recon → Draft → Build → Verify → Ship. Auto-detects input type (task description, plan path, image, Figma URL). Delegates all Verify and Ship work to specialist agents — never self-implements testing, review, or finalization."
when_to_use: "Invoke when executing an implementation plan or feature task end-to-end."
user-invocable: true
argument-hint: "<task|plan.md|image.png|figma-url> [--quick] [--deep] [--auto] [--tdd] [--spec] [--cross] [--tier fast|medium|thinking] [--strict] | migrate \"<description>\""
metadata:
  category: workflow
  keywords: [implementation, feature, pipeline, plan-execute, layout, coding]
---

# Cook — Feature Implementation Pipeline

Full pipeline from task to committed code. It auto-classifies input and delegates Verify and Ship instead of self-implementing them.

## Usage

```
{skill:hc-cook} <task | plan.md | image.png | figma-url> [--quick] [--deep] [--auto] [--tdd]
```

| Flag | Behavior |
|------|----------|
| *(none)* | Interactive; pause at Checkpoints |
| `--quick` | Skip Recon + Scope Contract; use when codebase and approach are already known |
| `--deep` | Force `{skill:hc-review}` `--deep` semantics and always run the domain-risk second-pass reviewer. Cross-model review still needs `--cross` or `crossReview.auto`; `deep.auto` may default this on, but explicit `--quick` wins. |
| `--auto` | Resolve checkpoints autonomously and apply Auto-Resolve Ladder on regressions. Run `{skill:hc-plan} validate` first for the cleanest path. |
| `--tdd` | Use Red-Green for new behavior or Snapshot for refactor/legacy; see `references/process-steps.md` |
| `--spec` | Insert a spec checkpoint via `{skill:hc-spec}` before Build; auto-approved under `--auto` |
| `--tier fast\|medium\|thinking` | Forward a model-tier hint to Build and Verify agents; absent = session model |
| `--strict` | Require the full test suite to be green (restores original zero-regress behavior; overrides default no-new-failures gate) |
| `--cross` | Forwarded to the Verify stage's review as `{skill:hc-review} --cross` (cross-model second opinion on the diff). Never auto-activates — pass it explicitly or set `haily.json crossReview.auto`. |
| `migrate "[description]"` | Large-scale codebase migration — scope analysis → compatibility strategy → incremental phased execution → verification → cleanup. See `references/workflow-migration.md`. |

Flags compose freely: `--quick --auto`, `--quick --tdd`, `--auto --tdd`, `--deep --auto`, `--deep --tdd`. `--deep` and `--quick` do not compose — `--deep` wins if both given.

## Mode×Pipeline Reference

Stage effects by mode:
- Default task input: full pipeline with Recon, Scope Contract, Verify-by-Execution, and Ship.
- Plan-path input: skip Recon + Scope Contract, then run Draft checkpoint, Build, Verify, and Ship.
- `--quick`: skip Recon + Scope Contract and skip Verify-by-Execution, but still run Verify and Ship.
- `--deep`: full pipeline plus reviewer refuter votes and unconditional domain-risk second pass.
- `--spec`: insert a spec checkpoint before Build.
- `--auto`: keep Recon, skip Scope Contract, and auto-resolve Draft/Build/Verify checkpoints.
- `--tdd`: Build uses Red-Green or Snapshot sub-phases.

Ship is **never skipped** in any mode — `haily-project-manager`, `haily-docs-writer`, and `haily-git-manager` always run.

**Input Detection** (priority order, full logic in `references/input-detect.md`):

| First argument | Detected type |
|---|---|
| `*.png` / `*.jpg` / `*.webp` | Layout — screenshot |
| `*.mp4` / `*.webm` | Layout — video |
| `https://figma.com/*` | Layout — Figma |
| `https://framer.com/*` | Layout — Framer |
| `*.md` path (exists on disk) | Plan-execute |
| Anything else | Task description |

Override: if first arg is image/video AND task text contains "fix" / "debug" / "reference" → task mode.

## Constraints

> **Required — plan-first:** No implementation code until a plan exists and has been reviewed. Skip when input is a plan path. User override: "just code it" overrides this guardrail.

> **Required — recon-first:** Before planning or asking questions, scan the codebase — project type, language/framework, relevant modules, docs in `./docs/`, in-flight plans in `./.agents/`, public APIs the task could affect. Also mine git history for precedent commits (`git log --grep` → `git show --stat`) whose file footprint reveals files the task may need to touch; cite each precedent's commit hash. Report 3–6 bullets. Skip when input is plan-path or layout.

> **Required — zero-regress:** Implementation is incomplete until every acceptance criterion is proven, **no new test failures** are introduced vs a baseline captured before implementation begins (pre-existing failures are not blocking), lint/type/build remain clean, and public contracts are untouched unless explicitly flagged. Capture the baseline at Build entry: run the test suite, record failing test names, then diff after each phase (see `{skill:hc-goal}` `references/regression-gate.md` for runner detection and diff protocol). Use `--strict` to require the full suite green instead.
> **Interactive:** on regression, halt and surface options — roll back the offending change / propagate the new contract / insert a compatibility adapter / acknowledge as intentional. User decides.
> **`--auto`:** on regression, apply Auto-Resolve Ladder: select lowest-risk resolution (default: undo affected slice + write incident report to `.agents/reports/cook-incident-*.md`); terminate if unresolvable.

## Scope Contract

Before the Draft stage, capture three sections via `AskUserQuestion` grounded in Recon findings. Skip when input is plan-path or layout.

- **Deliverables** — concrete output artifacts: file paths, endpoints, or screens the user will see when done
- **Boundaries** — done-when list (input→output behaviors that must work) + what is explicitly excluded this round + invariants that must not change
- **Blast Radius** — which existing modules get touched and which public contracts must hold

Stored in `context-snippets.json`: task, acceptanceCriteria, touchpoints, blastRadius, publicContracts.

## Process

1. **Route** — classify first arg via `references/input-detect.md`; select execution path; initialize workspace. **Parity hint (downward):** when `HL_MODEL_TIER` ranks below `ultra` and the task touches a high-risk domain (`references/agent-invocations.md` § Domain-Risk Review), print one line suggesting `--deep` in this Route log line and proceed at the requested depth — advisory only. See `docs/engineering-standards.md` § Depth Tiers → Parity hint. Log `✓ Route: [inputType] — mode=[interactive|auto], flags=[list]`

2. **Recon** — reuse first from session context, caller recon, or active-plan scout artifacts. Otherwise route one scoped request through `{skill:hc-scout}`; prefer `--quick` when module boundaries are already known and use full mode only when unknown modules truly span the task. Capture 3–6 findings, precedent commits with cited hashes, the Scope Contract, and any focused `haily-researcher` output. Log `✓ Recon: [N] findings, Scope Contract locked`. [skip: plan-path, layout]

3. **Draft** — spawn `haily-planner`; produce `plan.md` + `phase-XX-*.md`. Build Stage Graph from `blockedBy` fields; identify parallel-eligible phases. Log `✓ Draft: [N] phases, [M] parallel-eligible`. [skip plan.md production when plan-path input]
   - **Checkpoint (Draft exit):** `AskUserQuestion`: Approve / Revise / Validate (`{skill:hc-plan} validate`) / Abort. [skip: `--auto`]
   - **Spec Checkpoint (`--spec` only):** invoke `{skill:hc-spec}` with plan context; pause for user approval. In `--auto` mode the spec is drafted and auto-approved. Build does not begin until the spec is approved.

4. **Build** — execute plan phases; parallelize only when Stage Graph and `--auto` allow it. Spawn `haily-designer` for frontend work, activate `{skill:hc-db}` for schema/query/migration work, run compile checks after each file, honor each phase file's `deviation-log` rule, and run Lean Pass when LOC delta crosses threshold. Forward `--tier` to Build and Verify agents. Log `✓ Build: [N] files changed — [M/M] phases complete`.
   - **Checkpoint (Build exit):** review implementation summary. [skip: `--auto`]

5. **Verify** — spawn `haily-tester`; if failures remain, spawn `haily-debugger` and loop until green. Run Verify-by-Execution except on `--quick`. Then spawn `haily-reviewer` with Scope Contract + Recon context; forward `--deep` when enabled so reviewer refuter votes and the unconditional domain-risk second pass run. Run `{skill:hc-review} --cross` only when `--cross` or `crossReview.auto` authorizes it; `--deep` only upgrades the weight of those findings. Under `--auto`, auto-approve only if the `references/review-artifacts.md` artifact clears; otherwise apply Auto-Resolve Ladder from `references/review-gates.md`. Log `✓ Verify: [N/N] tests passed — review [score]/10 — evidence [N/N] criteria`.
   - **Checkpoint (Verify exit):** [skip: `--auto`]

6. **Ship** — spawn via Task tool in sequence. **Never skip.** A workflow with zero Task calls is incomplete.
   - `haily-project-manager` → sync plan across all `phase-XX-*.md`; populate Evidence; update `plan.md` status
   - `haily-docs-writer` → update `./docs/` if changes warrant it
   - `TaskUpdate` → mark Claude Tasks complete (fallback: `TodoWrite`)
   - When the run used `--auto` (the developer reviewed little of the diff) or `haily.json` has `quiz.auto: true`, offer the comprehension quiz before the commit question — protocol in `{skill:hc-review}` `references/flow-quiz.md`; record the outcome in the plan
   - `AskUserQuestion` to commit → spawn `haily-git-manager` if yes
   - `{skill:hl-log}` for journal entry
   - Log `✓ Ship: plan synced — [N] agents invoked, committed as [type(scope)]`

## Layout Mode

Auto-activated when first argument is an image, video, or Figma/Framer URL. The visual artifact IS the spec — replaces the Scope Contract capture. All other stages (Verify, Ship) still apply.

Setup: run `{skill:hl-design}` `scripts/ui-ux/search.py --design-system` for design token intelligence. For static images: Read the mockup file directly to extract design tokens.

Load workflow from `references/layout/` by detected type:

| Detected type | Workflow file |
|---|---|
| `.png` / `.jpg` / `.webp` | `flow-screenshot.md` |
| `.mp4` / `.webm` | `flow-video.md` |
| Figma / live URL / description | `flow-figma.md` |
| 3D / WebGL / Three.js | `flow-3d.md` |
| Quick focused task | `flow-quick.md` |
| Award-quality / immersive | `flow-immersive.md` |
| Existing design upgrade | `redesign-audit-checklist.md` |

Apply `references/layout/quality-anti-slop.md` throughout.

## Session Model

Judgment agents (`haily-planner`, `haily-implementor`, `haily-reviewer`, `haily-brainstormer`, `haily-debugger`) inherit the session model — running on `{model:ultra}` passes that model to these agents automatically. Mechanical agents (`haily-tester`, `haily-git-manager`, `haily-stats`, etc.) are capped at their `model_max` tier and never escalate. Depth tiers use the canonical vocabulary (`fast|medium|thinking|ultra`, compared by ordinal rank — never the literal string) and are surfaced to every subagent via `HL_MODEL_TIER`; see `docs/engineering-standards.md` → Depth Tiers.

## Workflow Position

**Follows:** `{skill:hc-plan}` — execute an approved plan
**Follows:** `{skill:hl-brainstorm}` — implement an agreed solution
**Precedes:** `{skill:hc-review}`, `{skill:hc-test}`
**Related:** `{skill:hc-fix}`

## References

| File | Content |
|------|---------|
| `references/input-detect.md` | Input Detection algorithm, Routing Precedence, Stage Graph analysis |
| `references/process-steps.md` | Stage-level step definitions, Lean Pass protocol, Ship sequence |
| `references/review-gates.md` | Review Circuit, Auto-Resolve Ladder, Checkpoint behavior |
| `references/agent-invocations.md` | Task tool delegation patterns for all specialist agents |
| `references/review-artifacts.md` | Artifact schemas and auto-approval validator contract |
| `references/layout/` | Layout Mode workflows (screenshot, video, Figma, 3D, quick, immersive) |
| `references/workflow-migration.md` | Large-scale migration workflow (scope analysis, adapter pattern, phased execution, cleanup) |
