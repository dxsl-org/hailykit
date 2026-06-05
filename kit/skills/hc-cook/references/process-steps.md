# Workflow Steps

Steps are shared across all input types. Skip conditions vary by input type and flags.

**Input types:** `task` · `plan-path` · `layout-screenshot` · `layout-video` · `layout-figma` · `layout-framer`
**Flags:** `--quick` (skip Recon+Scope Contract) · `--auto` (skip all gates, auto-parallelize) · `--tdd` (tests-first per phase)

**Task Tool Fallback:** `TaskCreate`/`TaskUpdate`/`TaskGet`/`TaskList` are CLI-only — unavailable in VSCode. If they error, use `TodoWrite`. All steps remain functional without Task tools.

## Mode Reference

| Input type + flags | Research | Scout | Requirements | Plan gate | Review gates |
|---|---|---|---|---|---|
| `task` | ✓ | ✓ | ✓ | ✓ | Stops (unless `--auto`) |
| `task` + `--quick` | **✗** | **✗** | **✗** | ✓ | Stops (unless `--auto`) |
| `task` + `--auto` | ✓ | ✓ | ✗ | ✗ | Auto-approved |
| `task` + `--quick --auto` | **✗** | **✗** | ✗ | ✗ | Auto-approved |
| `plan-path` | ✗ | ✗ | ✗ | ✗ | Stops (unless `--auto`) |
| `layout-*` | ✗ | ✗ | ✗ | ✓ | Stops (unless `--auto`) |

## Step 0: Input Detection & Setup

1. Parse input with `input-detect.md` rules
2. Log: `✓ Step 0: [inputType] detected | flags: [--auto] [--tdd]`
3. If `plan-path`: locate plan file, parse phases
4. Use `TaskCreate` to create workflow step tasks if complex (or `TodoWrite` if unavailable)

**Output:** `✓ Step 0: [task|plan-path|layout-*] detected | flags: [list]`

## Step 1: Research

**Skip if:** `plan-path`, `layout-*`, or `--quick` flag.

- Spawn `haily-researcher` agents in parallel
- Use `{skill:hc-scout}` for codebase context
- Keep reports ≤150 lines

**Output:** `✓ Step 1: Research complete - [N] reports gathered`

### [Review Gate 1] Post-Research
**Skip if `--auto` flag present.**
- Present research summary
- `AskUserQuestion`: "Proceed to planning?" / "More research" / "Abort"

## Step 2: Planning

**Skip if:** `plan-path` input (plan already exists — parse phases directly).

- Spawn `haily-planner` agent with research context
- Create `plan.md` + `phase-XX-*.md` files

**Output:** `✓ Step 2: Plan created - [N] phases`

### Phase Dependency Analysis

Runs immediately after plan is available (both `task` and `plan-path` input types):

1. Build dependency graph from `blockedBy` fields in phase files.
2. Identify phases with no dependencies and no shared file ownership → **parallelizable**.
3. **Interactive mode:** if parallelizable phases found → `AskUserQuestion`:
   > "Phase X and Phase Y are independent. Run them in parallel?"
   > Options: "Yes — parallel" / "No — sequential"
4. **`--auto` flag:** auto-parallelize without prompting.
5. Log: `✓ Phase analysis: [N] phases, [M] parallelizable`

### [Review Gate 2] Post-Plan
**Skip if `--auto` flag present.**
- Present plan overview
- `AskUserQuestion`: "Approve" / "Revise" / "Validate" / "Abort"
  - "Validate": run `{skill:hc-plan} validate`
  - "Revise": revise plan based on feedback, repeat gate

## Step 3: Implementation

**IMPORTANT:**
1. `TaskList` first — check for existing tasks (hydrated by planning skill in same session)
2. If tasks exist → pick them up, skip re-creation
3. If no tasks → read plan phases, `TaskCreate` for each unchecked `[ ]` item with priority order and metadata (`phase`, `planDir`, `phaseFile`)
4. Tasks can be blocked by other tasks via `addBlockedBy`

### Pre-Code Audit

Before touching any file in a phase, the agent runs this gate:

| # | Check | How |
|---|-------|-----|
| 1 | **Repo conventions** | Open `./docs/code-standards.md` — validate that naming rules, directory layout, and error-handling style have not drifted since the plan was written. Flag stale docs before coding. |
| 2 | **Neighborhood scan** | Inspect 2–3 files adjacent to each edit target. Mirror their import order, log format, and error wrapping exactly. |
| 3 | **Reuse search** | `grep` / symbol-search for utilities that already do what the phase needs. Duplicating a helper is a review blocker. |
| 4 | **Surface continuity** | Trace every public interface the phase touches — new code must extend it, not shadow it with a parallel API. |
| 5 | **Inventory reconciliation** | Walk the phase file list; every entry must map to an actual edit or an explicit deferral note. |

After saving each file, run three micro-gates:
- **Build gate:** execute the project's type-check / compile command
- **Style gate:** diff new code against neighboring files for convention drift
- **Dependency gate:** verify no circular imports or orphaned re-exports were introduced

### `--tdd` Flag Behavior

When `--tdd` is active, each phase cycles through three stages:

```
Phase 3a — Snapshot:   lock current behavior into tests (baseline safety net)
Phase 3b — Transform:  apply the planned implementation changes
Phase 3c — Verify:     re-run snapshot tests + build gates — any failure = rollback before continuing
```

The snapshot tests from Phase 3a serve as a behavioral contract. If any turn
red after Phase 3b, the transformation introduced a regression and must be
reverted or fixed before the workflow advances.

**All input types:**
- Use `TaskUpdate` to mark tasks `in_progress` immediately
- Use `haily-designer` for frontend work; `{skill:hl-design}` for image asset generation
- Run type checking after each file

**When phases run in parallel** (detected in Phase Dependency Analysis):
- Use `TaskCreate`/`TaskUpdate`/`TaskGet`/`TaskList` to coordinate
- Launch parallel `haily-implementor` agents with worktree isolation
- Respect file ownership boundaries — each agent owns its assigned files
- Wait for all agents in a parallel group before advancing to the next group

**Output:** `✓ Step 3: Implemented [N] files - [X/Y] tasks complete`

### Step 3.S: Complexity Reduction (diff-triggered)

Measure change magnitude directly from the worktree:

```bash
# Collect diff metrics
changed_files=$(git diff --name-only HEAD)
file_count=$(echo "$changed_files" | grep -c . || echo 0)
stat_summary=$(git diff --shortstat HEAD --ignore-all-space)
line_delta=$(echo "$stat_summary" | grep -oP '\d+(?= insertion)' || echo 0)
hottestFile=$(git diff --numstat HEAD | sort -t$'\t' -k1 -rn | head -1 | cut -f1)
```

Compare against limits in `haily.json` (`simplify.threshold.{locDelta,fileCount,singleFileLoc}`);
defaults are 400 / 8 / 200. When any limit is exceeded, delegate to a haily-refiner
targeting only the affected files:

{agent:haily-refiner}

Reduce complexity in the affected files without changing observable behavior.

On return, compare `git diff --shortstat HEAD -- [file-list]` before and after:
- Delta changed → log "haily-refiner applied targeted edits"
- No delta → log "haily-refiner found nothing to trim"

Never re-trigger or gate on the haily-refiner result.

Bypass entirely when `HL_SIMPLIFY_DISABLED=1` or `haily.json` has
`simplify.gate.enabled: false`.

**Output:** `✓ Step 3.S: Simplify [ran|skipped] - [trimmed|clean|below limits]`

### [Review Gate 3] Post-Implementation
**Skip if `--auto` flag present.**
- Present implementation summary (files changed, key changes)
- `AskUserQuestion`: "Proceed to testing?" / "Request changes" / "Abort"

## Step 4: Testing

**Applies to all input types:**
- Cover the golden path, boundary conditions, and expected error states
- **Delegate via** `haily-tester` subagent — never run the suite inline: {agent:haily-tester}
- On failure: hand off to `haily-debugger` subagent → patch → re-test loop
- **Hard bans:** stub-only mocks with no real behavior · `skip`/`xtest`/commented-out bodies · weakening assertions to force green · bypassing subagent delegation

**Output:** `✓ Step 4: Tests [X/X passed] - haily-tester subagent invoked`

### [Review Gate 4] Post-Testing
**Skip if `--auto` flag present.**
- Present test results summary
- `AskUserQuestion`: "Proceed to code review?" / "Request test fixes" / "Abort"

## Step 5: Code Review

**Mandatory delegation — all modes:**

Spawn `haily-reviewer` with the full audit brief:

{agent:haily-reviewer}

Audit this changeset across five axes:
- ACCEPTANCE — map every criterion to concrete proof (test or manual)
- REGRESSION — walk each touchpoint from scout; verify all callers still behave
- CONTRACTS — flag any public signature, schema, API shape, env var, or config key that changed
- CONSISTENCY — confirm new code follows patterns identified during scout
- HYGIENE — assert zero new lint, type, or build errors repo-wide

Include scout summary and acceptance criteria as context. Return: verdict (pass/conditional/block), severity-ranked findings, side-effect flags.

The agent must **never** perform the review itself — always delegate.

**Interactive mode:**
- Enters a fix-review loop (capped at 3 rounds) per `review-gates.md`
- Requires explicit user sign-off

**`--auto` flag:**
- Proceeds only when `review-decision.json` yields `PASS`, the artifact validator clears, and `risk-gate.autoStopRequired` is false
- Auto-remediates critical findings for up to 3 rounds
- Writes abort report and exits after 3 unsuccessful rounds

**Artifact gate:** write review artifacts per `references/review-artifacts.md`, then validate:

```bash
node kit/hooks/workflow-artifact-gate.cjs --stage finalize --artifact-dir <artifact-dir>
```

High-risk `--auto` runs must surface `AskUserQuestion` before finalize/commit/ship unless `risk-gate.json` contains `humanApproved: true`.

**Output:** `✓ Step 5: Review [score]/10 - [Approved|Auto-approved] - validator [pass|warn|block]`

## Step 6: Finalize

**All modes - MANDATORY subagents (NON-NEGOTIABLE):**
1. **MUST** spawn these subagents in parallel:
   {agents:haily-project-manager,haily-docs-writer}
   - haily-project-manager: full sync-back for [plan-path] — reconcile all completed tasks with all phase files, backfill checkboxes across every phase, update plan.md progress. Do NOT only mark current phase.
   - haily-docs-writer: update docs to reflect changes in the current phase.
2. Project-manager sync-back MUST include:

### Status Sync (Finalize)

Use CLI commands for deterministic status updates:

```bash
# Mark completed phases
hc plan check <phase-id>

# Mark in-progress phases
hc plan check <phase-id> --start

# Revert if needed
hc plan uncheck <phase-id>
```

**Fallback:** If `hc` is not available, edit plan.md directly —
only change the Status column cell, preserve table structure.
   - Sweep all `phase-XX-*.md` files in the plan directory.
   - Mark every completed item `[ ] → [x]` based on completed tasks (including earlier phases finished before current phase).
   - Update `plan.md` status/progress (`pending`/`in-progress`/`completed`) from actual checkbox state.
   - Return unresolved mappings if any completed task cannot be matched to a phase file.
3. Use `TaskUpdate` to mark Claude Tasks complete after sync-back confirmation.
4. Onboarding check (API keys, env vars)
5. **MUST** spawn git subagent: {agent:haily-git-manager} — stage and commit all changes.

**CRITICAL:** Step 6 is INCOMPLETE without spawning all 3 subagents. DO NOT skip subagent delegation.

**Auto mode:** Continue to next phase automatically, start from **Step 3**.
**Others:** Ask user before next phase

**Output:** `✓ Step 6: Finalized - 3 subagents invoked - Full-plan sync-back completed - Committed`

## Flow Summary

Legend: `[R]` = Review Gate (human stops) · `→→` = parallel execution

```
task (default):   0 → 1 → [R] → 2 → phase-analysis → [R] → 3 → [R] → 4 → [R] → 5(user) → 6
task --auto:      0 → 1 → 2 → phase-analysis →→ 3(parallel when safe) → 4 → 5(artifact-gated) → 6
plan-path:        0 → phase-analysis → [R] → 3 → [R] → 4 → [R] → 5(user) → 6
plan-path --auto: 0 → phase-analysis →→ 3(parallel when safe) → 4 → 5(artifact-gated) → 6
layout-*:         0 → 2(plan only) → [R] → 3 → [R] → 4 → [R] → 5(user) → 6
```

**Key:** `--auto` skips all human gates; phase dependency analysis drives parallel execution.

## Critical Rules

- Never skip steps without skip-condition justification (see Mode Reference table above)
- **MANDATORY SUBAGENT DELEGATION:** Steps 4, 5, 6 MUST spawn subagents via Task tool. DO NOT implement directly.
  - Step 4: `haily-tester` (and `haily-debugger` if failures)
  - Step 5: `haily-reviewer`
  - Step 6: `haily-project-manager`, `haily-docs-writer`, `haily-git-manager`
- Use `TaskCreate` to create Claude Tasks for each unchecked item with priority order and dependencies (or `TodoWrite` if Task tools unavailable).
- Use `TaskUpdate` to mark Claude Tasks `in_progress` when picking up a task (skip if Task tools unavailable).
- Use `TaskUpdate` to mark Claude Tasks `complete` immediately after finalizing the task (skip if Task tools unavailable).
- All step outputs follow format: `✓ Step [N]: [status] - [metrics]`
- **VALIDATION:** If Task tool calls = 0 at end of workflow, the workflow is INCOMPLETE.
