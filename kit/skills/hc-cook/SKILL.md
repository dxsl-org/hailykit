---
name: hc-cook
description: "Feature implementation pipeline: Recon → Draft → Build → Verify → Ship. Auto-detects input type (task description, plan path, image, Figma URL). Delegates all Verify and Ship work to specialist agents — never self-implements testing, review, or finalization."
when_to_use: "Invoke when executing an implementation plan or feature task end-to-end."
user-invocable: true
argument-hint: "<task|plan.md|image.png|figma-url> [--quick] [--auto] [--tdd] [--tier fast|medium|thinking] [--strict] | migrate \"<description>\""
metadata:
  category: workflow
  keywords: [implementation, feature, pipeline, plan-execute, layout, coding]
---

# Cook — Feature Implementation Pipeline

Full pipeline from task to committed code. Classifies input automatically, delegates every Verify and Ship stage to specialist agents, and never self-implements testing, code review, or finalization.

## Usage

```
{skill:hc-cook} <task | plan.md | image.png | figma-url> [--quick] [--auto] [--tdd]
```

| Flag | Behavior |
|------|----------|
| *(none)* | Interactive — pauses at each Checkpoint for user approval |
| `--quick` | Skip Recon + Scope Contract. Go straight to Draft → Build → Verify → Ship. Use when you already understand the codebase — small fixes, known refactors, follow-on tasks. |
| `--auto` | Autonomous — resolves Checkpoints without pausing; applies Auto-Resolve Ladder on regressions. Run `{skill:hc-plan} validate` first for a clean run. |
| `--tdd` | Behavioral modifier — write tests before each plan phase, verify after |
| `--tier fast\|medium\|thinking` | Model tier hint — forwarded to Build and Verify agents (see `references/agent-invocations.md` § Tier Routing). Passed automatically by `{skill:hc-goal}` per phase; absent = session model (backward compatible) |
| `--strict` | Require the full test suite to be green (restores original zero-regress behavior; overrides default no-new-failures gate) |
| `migrate "[description]"` | Large-scale codebase migration — scope analysis → compatibility strategy → incremental phased execution → verification → cleanup. See `references/workflow-migration.md`. |

Flags compose freely: `--quick --auto`, `--quick --tdd`, `--auto --tdd`.

```
{skill:hc-cook} "Add JWT refresh token rotation"
{skill:hc-cook} "Add JWT refresh token rotation" --auto
{skill:hc-cook} .agents/260531-feature/plan.md
{skill:hc-cook} "Refactor auth middleware" --tdd
{skill:hc-cook} "Fix typo in README" --quick
{skill:hc-cook} mockup.png
{skill:hc-cook} https://figma.com/file/abc123
{skill:hc-cook} migrate "Moment.js → date-fns"
{skill:hc-cook} migrate "callbacks → async/await in auth module"
```

## Mode×Pipeline Reference

Which stages are active per flag combination:

| Mode | Recon | Scope Contract | Draft gate | Build gate | Verify | Ship |
|------|-------|----------------|-----------|-----------|--------|------|
| *(none)* task | ✅ | ✅ | User approval | User approval | Full | Full |
| *(none)* plan-path | skip | skip | User approval | User approval | Full | Full |
| `--quick` | **skip** | **skip** | User approval | User approval | Full | Full |
| `--auto` | ✅ | skip | Auto | Auto | Auto (artifact-gated) | Full |
| `--quick --auto` | **skip** | **skip** | Auto | Auto | Auto | Full |
| `--tdd` | ✅ | ✅ | User approval | TDD sub-phases | Full | Full |

Ship is **never skipped** in any mode — `haily-project-manager`, `docs-manager`, and `haily-git-manager` always run.

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

> **Required — recon-first:** Before planning or asking questions, scan the codebase — project type, language/framework, relevant modules, docs in `./docs/`, in-flight plans in `./.agents/`, public APIs the task could affect. Report 3–6 bullets. Skip when input is plan-path or layout.

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

1. **Route** — classify first arg via `references/input-detect.md`; select execution path; initialize workspace. Log `✓ Route: [inputType] — mode=[interactive|auto], flags=[list]`

2. **Recon** — spawn `{skill:hc-scout}` or parallel Explore agents; capture 3–6 findings; capture Scope Contract (see § Scope Contract above); spawn `haily-researcher` agents in parallel (reports ≤150 lines). Log `✓ Recon: [N] findings, Scope Contract locked`. [skip: plan-path, layout]

3. **Draft** — spawn `haily-planner`; produce `plan.md` + `phase-XX-*.md`. Build Stage Graph from `blockedBy` fields; identify parallel-eligible phases. Log `✓ Draft: [N] phases, [M] parallel-eligible`. [skip plan.md production when plan-path input]
   - **Checkpoint (Draft exit):** `AskUserQuestion`: Approve / Revise / Validate (`{skill:hc-plan} validate`) / Abort. [skip: `--auto`]

4. **Build** — execute plan phases; parallel when Stage Graph allows + `--auto`. Spawn `haily-designer` for frontend work; activate `{skill:hc-db}` for schema/query/migration work. Run compile check after each file. Run Lean Pass if LOC delta breaches threshold (see `references/process-steps.md` § Lean Pass). Forward `--tier` hint to Build and Verify agents (see `references/agent-invocations.md` § Tier Routing). Log `✓ Build: [N] files changed — [M/M] phases complete`.
   - **Checkpoint (Build exit):** review implementation summary. [skip: `--auto`]

5. **Verify** — spawn `haily-tester` via Task tool; on failures spawn `haily-debugger`; repeat until all pass. Then spawn `haily-reviewer` via Task tool with Scope Contract + Recon context. `--auto`: auto-approve if `references/review-artifacts.md` artifact clears; else apply Auto-Resolve Ladder (see `references/review-gates.md`). Log `✓ Verify: [N/N] tests passed — review [score]/10`.
   - **Checkpoint (Verify exit):** [skip: `--auto`]

6. **Ship** — spawn via Task tool in sequence. **Never skip.** A workflow with zero Task calls is incomplete.
   - `haily-project-manager` → sync plan across all `phase-XX-*.md`; populate Evidence; update `plan.md` status
   - `docs-manager` → update `./docs/` if changes warrant it
   - `TaskUpdate` → mark Claude Tasks complete (fallback: `TodoWrite`)
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

## --ultra Mode

Active only when the turn was started via `{skill:hl-ultra}` (it passes the internal `--ultra` marker) — never self-activated, never suggested. Turn-scoped: every skill in the chain sees it. If the user types `--ultra` directly, redirect to `{skill:hl-ultra}` — a bare flag escalates subagents only while the main loop stays on the session model.

- Task calls to deep-eligible agents (`haily-planner`, `haily-implementor`, `haily-reviewer`, `haily-brainstormer`, `haily-debugger`) pass `model: {model:deep}`.
- All other agents keep their pinned tiers — escalate judgment, not mechanics.
- If the deep model is unavailable, retry once with the thinking tier and tell the user which model ran.

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
