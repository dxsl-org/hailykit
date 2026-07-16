---
name: hc-cook
description: "Feature implementation pipeline: Recon → Draft → Build → Verify → Ship. Auto-detects input type (task description, plan path, image, Figma URL). Delegates all Verify and Ship work to specialist agents — never self-implements testing, review, or finalization."
when_to_use: "Invoke when executing an implementation plan or feature task end-to-end."
user-invocable: true
argument-hint: "<task|plan.md|image.png|figma-url> [--quick] [--deep] [--auto] [--tdd] [--tier fast|medium|thinking] [--strict] | migrate \"<description>\""
metadata:
  category: workflow
  keywords: [implementation, feature, pipeline, plan-execute, layout, coding]
---

# Cook — Feature Implementation Pipeline

Full pipeline from task to committed code. Classifies input automatically, delegates every Verify and Ship stage to specialist agents, and never self-implements testing, code review, or finalization.

## Usage

```
{skill:hc-cook} <task | plan.md | image.png | figma-url> [--quick] [--deep] [--auto] [--tdd]
```

| Flag | Behavior |
|------|----------|
| *(none)* | Interactive — pauses at each Checkpoint for user approval |
| `--quick` | Skip Recon + Scope Contract. Go straight to Draft → Build → Verify → Ship. Use when you already understand the codebase — small fixes, known refactors, follow-on tasks. |
| `--deep` | Verify review runs `{skill:hc-review}` `--deep` semantics (refuter votes on Critical findings) and always spawns the domain-risk second-pass reviewer, not just when a risk domain is touched. The cross-model leg never auto-activates from `--deep` alone — still requires `--cross` or `haily.json crossReview.auto`; when it does run, `--deep` upgrades its findings from advisory to confidence-raising. Mutually exclusive with `--quick` — `--deep` wins if both given. Repo opt-in: `haily.json` `deep.auto` (see `docs/engineering-standards.md` § Depth Tiers); an explicit `--quick` always overrides it. |
| `--auto` | Autonomous — resolves Checkpoints without pausing; applies Auto-Resolve Ladder on regressions. Run `{skill:hc-plan} validate` first for a clean run. |
| `--tdd` | Behavioral modifier — write tests before each plan phase, verify after |
| `--spec` | Insert a Spec checkpoint between Draft and Build: draft EARS-notation acceptance criteria via `{skill:hc-spec}` and pause for user approval before implementation begins. In `--auto` mode the spec is drafted and auto-approved. |
| `--tier fast\|medium\|thinking` | Model tier hint — forwarded to Build and Verify agents (see `references/agent-invocations.md` § Tier Routing). Passed automatically by `{skill:hc-goal}` per phase; absent = session model (backward compatible) |
| `--strict` | Require the full test suite to be green (restores original zero-regress behavior; overrides default no-new-failures gate) |
| `--cross` | Forwarded to the Verify stage's review as `{skill:hc-review} --cross` (cross-model second opinion on the diff). Never auto-activates — pass it explicitly or set `haily.json crossReview.auto`. |
| `migrate "[description]"` | Large-scale codebase migration — scope analysis → compatibility strategy → incremental phased execution → verification → cleanup. See `references/workflow-migration.md`. |

Flags compose freely: `--quick --auto`, `--quick --tdd`, `--auto --tdd`, `--deep --auto`, `--deep --tdd`. `--deep` and `--quick` do not compose — `--deep` wins if both given.

```
{skill:hc-cook} "Add JWT refresh token rotation"
{skill:hc-cook} "Add JWT refresh token rotation" --auto
{skill:hc-cook} .agents/260531-feature/plan.md
{skill:hc-cook} "Refactor auth middleware" --tdd
{skill:hc-cook} "Fix typo in README" --quick
{skill:hc-cook} "Refactor auth middleware" --deep --auto
{skill:hc-cook} mockup.png
{skill:hc-cook} https://figma.com/file/abc123
{skill:hc-cook} migrate "Moment.js → date-fns"
{skill:hc-cook} migrate "callbacks → async/await in auth module"
```

## Mode×Pipeline Reference

Which stages are active per flag combination:

| Mode | Recon | Scope Contract | Draft gate | Spec gate | Build gate | Verify | Ship |
|------|-------|----------------|-----------|-----------|-----------|--------|------|
| *(none)* task | ✅ | ✅ | User approval | — | User approval | Full + execution evidence | Full |
| *(none)* plan-path | skip | skip | User approval | — | User approval | Full + execution evidence | Full |
| `--quick` | **skip** | **skip** | User approval | — | User approval | Full — execution evidence skipped | Full |
| `--deep` | ✅ | ✅ | User approval | — | User approval | Full + refuter votes + domain-risk unconditional | Full |
| `--spec` | ✅ | ✅ | User approval | User approval | User approval | Full + execution evidence | Full |
| `--auto` | ✅ | skip | Auto | — | Auto | Auto (artifact-gated) + execution evidence | Full |
| `--spec --auto` | ✅ | skip | Auto | Auto | Auto | Auto + execution evidence | Full |
| `--tdd` | ✅ | ✅ | User approval | — | TDD sub-phases | Full + execution evidence | Full |

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

2. **Recon** — reuse-first: session context already holding a scout report or recon covering the task's modules replaces the scout spawn (log `✓ Recon: reused session recon`); otherwise spawn `{skill:hc-scout}` or parallel Explore agents. Capture 3–6 findings; mine git history for precedent commits (`git log --grep` → `git show --stat`) and flag any file in their footprint that current scope omits, each cited by commit hash; capture Scope Contract (see § Scope Contract above); spawn `haily-researcher` agents in parallel (reports ≤150 lines). Log `✓ Recon: [N] findings, Scope Contract locked`. [skip: plan-path, layout]

3. **Draft** — spawn `haily-planner`; produce `plan.md` + `phase-XX-*.md`. Build Stage Graph from `blockedBy` fields; identify parallel-eligible phases. Log `✓ Draft: [N] phases, [M] parallel-eligible`. [skip plan.md production when plan-path input]
   - **Checkpoint (Draft exit):** `AskUserQuestion`: Approve / Revise / Validate (`{skill:hc-plan} validate`) / Abort. [skip: `--auto`]
   - **Spec Checkpoint (`--spec` only):** invoke `{skill:hc-spec}` with plan context; pause for user approval. In `--auto` mode the spec is drafted and auto-approved. Build does not begin until the spec is approved.

4. **Build** — execute plan phases; parallel when Stage Graph allows + `--auto`. Spawn `haily-designer` for frontend work; activate `{skill:hc-db}` for schema/query/migration work. Run compile check after each file. Implementors honor each phase file's `deviation-log` rule — reversible divergences are logged and the pipeline continues without pausing; only irreversible or contract-breaking divergence escalates to a Checkpoint. Run Lean Pass if LOC delta breaches threshold (see `references/process-steps.md` § Lean Pass). Forward `--tier` hint to Build and Verify agents (see `references/agent-invocations.md` § Tier Routing). Log `✓ Build: [N] files changed — [M/M] phases complete`.
   - **Checkpoint (Build exit):** review implementation summary. [skip: `--auto`]

5. **Verify** — spawn `haily-tester` via Task tool; on failures spawn `haily-debugger`; repeat until all pass. Run Verify-by-Execution (`references/process-steps.md` § Verify-by-Execution) — normal + `--deep`; skipped on `--quick`. Then spawn `haily-reviewer` via Task tool with Scope Contract + Recon context; when `--deep` is set (or `haily.json deep.auto`, unless `--quick` is explicit), forward `--deep` to the reviewer prompt so it applies `{skill:hc-review}` `--deep` semantics (refuter votes on Critical findings) and always spawn the domain-risk second-pass reviewer unconditionally (`references/agent-invocations.md` § Domain-Risk Review). When `--cross` is set (or `haily.json crossReview.auto`), also run `{skill:hc-review} --cross` on the diff for an external second opinion — `--deep` upgrades this from advisory to confidence-raising when it runs, but never activates the cross leg by itself. `--auto`: auto-approve if `references/review-artifacts.md` artifact clears; else apply Auto-Resolve Ladder (see `references/review-gates.md`). Log `✓ Verify: [N/N] tests passed — review [score]/10 — evidence [N/N] criteria`.
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
