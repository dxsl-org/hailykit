---
name: hc-goal
description: "Autonomous development loop: give it a goal, it plans, implements, reviews, and commits each phase until done. Bounded by a proxy budget and baseline-relative regression gate. Longer than hc-cook (many phases), cheaper than native goal (structured ledger bounds context). Delegates to hc-plan, hc-cook, and haily-git-manager."
when_to_use: "Invoke only when the user explicitly types /hc-goal. Do not auto-trigger from natural language — autonomous scope makes accidental activation harmful."
user-invocable: true
argument-hint: "\"<goal>\" [--deep] [--auto] [--tdd] [--retry N] [--budget N] [--budget Xtool] [--strict]"
metadata:
  category: workflow
  keywords: [autonomous, goal, loop, orchestrate, automate, pipeline, long-running]
---

# Goal — Autonomous Development Loop

Give it a goal; it plans, implements, reviews, and commits each phase until done. Longer than `{skill:hc-cook}` (many phases), cheaper than native `/goal` (a structured ledger keeps orchestrator context ~flat). Replaces the manual `{skill:hc-plan}` → `{skill:hc-cook}` → `{skill:hc-review}` → `{skill:hc-ship}` cycle.

## Usage

```
{skill:hc-goal} "<goal description>" [--deep] [--auto] [--tdd] [--retry N] [--budget N] [--budget Xtool] [--strict]
```

| Flag | Behavior |
|------|----------|
| *(none)* | Stage-gate — pauses at plan checkpoint and between major stage groups |
| `--deep` | Pass-through — forwarded verbatim to the `{skill:hc-plan}` invocation at Plan and to every `{skill:hc-cook}` phase delegation at Execute. Egress and domain-risk rules are governed by those downstream skills' own `--deep` semantics — not restated here. Cost: 3–5× baseline per phase × N phases — pair with `--budget` to bound total spend. Never auto-activates — pass it explicitly or set `haily.json deep.auto`. |
| `--auto` | Autonomous — runs through; escalates only critical blockers |
| `--tdd` | Pass-through to `{skill:hc-cook}` — write tests before each phase |
| `--retry N` | Max analyze→fix attempts per failing phase before deferring (default: 3) |
| `--budget N` | Override phase cap (default: 15) |
| `--budget Xtool` | Override tool-call cap (default: 400) |
| `--strict` | Restore full-suite-green gating (overrides default no-new-failures; rollback escape hatch) |

```
{skill:hc-goal} "Add OAuth login with GitHub and Google"
{skill:hc-goal} "Add OAuth login with GitHub and Google" --auto
{skill:hc-goal} "Migrate from Moment.js to date-fns across the codebase" --auto
{skill:hc-goal} "Implement rate limiting on all API endpoints" --retry 5 --budget 20
{skill:hc-goal} "Rework the payment webhook flow" --deep --budget 8
```

## Constraints

> **Required — clarify-or-assume:** At Route, if the goal is fuzzy: interactive → ask one targeted question before proceeding; `--auto` → state a reasonable assumption explicitly ("Assuming: … — correct me if wrong") and continue. Halt only if the goal names no actionable outcome at all.

> **Required — recon-first:** Scan the codebase before planning. Collect project type, framework, relevant modules, in-flight plans in `.agents/`. Report 3–6 findings.

> **Required — no-new-failures:** Each phase must pass the baseline-relative regression gate (see `references/regression-gate.md`). A phase is not complete if it introduces new failing tests vs the Route baseline, OR if it silently shrinks the baseline test-name set (deletion) — the gate's shrinkage check is the PRIMARY guard against this, backstopped by a SECONDARY edit-tripwire during Execute (see step 4). Use `--strict` to restore full-suite-green gating when needed.

> **Required — ledger-compaction:** After each phase, record a compact result in the run ledger and discard the phase's working detail from orchestrator context. See `references/run-ledger.md`. Accumulating full phase transcripts is the behavior this skill exists to prevent.

> **Required — budget-aware:** Track phase count and estimated tool-call count in the run ledger. Halt gracefully at 90% of either cap; do not start a new phase when at or past the cap. See `references/run-ledger.md` § Composite Budget Gate.

> **Required — phase-commit:** After every phase that passes Verify, commit via `haily-git-manager` before advancing. Uncommitted work is unprotected work.

> **Required — delegate-only:** Never implement, test, or review code directly. Invoke registered skills and specialist agents as the situation demands — `{skill:hc-cook}`, `{skill:hc-debug}`, `{skill:hc-fix}`, `{skill:hl-brainstorm}`, `{skill:hc-lookup}`, `{skill:hc-db}`, `{skill:hc-security}`, and others. Do not create new skills.

## Process

1. **Route** — parse flags; assess goal: if fuzzy, apply clarify-or-assume rule; if no actionable outcome, halt with one sentence explaining what is missing. Open run ledger at `.agents/<plan-dir>/run-ledger.md`; set budget caps. Capture baseline test results for the regression gate (see `references/regression-gate.md`). Log `✓ Route: goal locked — mode=[interactive|auto], budget=[N phases / X tool-calls]`.

2. **Recon** — spawn Explore agent; capture project type, framework, relevant modules, in-flight plans in `.agents/`. Log `✓ Recon: [N] findings`.

3. **Plan** — delegate to `{skill:hc-plan} --auto "<goal>"` (append `--deep` verbatim when set) → produces `plan.md` + `phase-NN-*.md` with `tier` and `dependencies` fields per phase. Build Stage Graph from `dependencies` fields.
   - **Checkpoint (Plan exit):** present plan summary (phase count, parallel-eligible). User: Approve / Revise / Abort. [skip: `--auto`]
   - Log `✓ Plan: [N] phases, Stage Graph built`.

4. **Execute** — set the loop-guard marker before entering the phase loop: append `export HL_LOOP_GUARD_ACTIVE=1` to `$CLAUDE_ENV_FILE`. While set, test/spec files and `diff-tests.sh` are tripwire-blocked + audit-logged for Edit/Write/MultiEdit/NotebookEdit (`kit/hooks/haily-lib/directory.cjs` `checkLoopGuardTripwire`) — a SECONDARY, agent-writable guard; the regression gate's test-name-set shrinkage check (`references/regression-gate.md`) is PRIMARY and catches a removed test regardless. Loop over phases in Stage Graph order; run parallel when `dependencies` allow:
   - Delegate `{skill:hc-cook} <phase-NN.md> --tier <phase.tier>` (adds `--auto` when in `--auto` mode; forwards `--deep` verbatim when set — budget-aware: deep multiplies per-phase token cost, pair with `--budget`).
   - After completion: update ledger row (compact result only); check composite budget; check divergence signals (see `references/run-ledger.md` § Divergence Handling). **Discard phase transcript from orchestrator context.**
   - On success → run regression gate; if gate passes → `haily-git-manager` commit; advance.
   - On gate fail or build failure → enter Retry Loop (see § Retry Loop).
   - Gate at stage boundaries in default mode (not every phase). Invoke supplementary skills as needed: `{skill:hc-scout}` before complex phases, `{skill:hl-brainstorm}` on ambiguous decisions, `{skill:hc-db}` on schema work, `{skill:hc-security}` on auth/payment surfaces.
   - Log `✓ Execute: [M/N] phases complete` after each successful phase.

5. **Report** — unset the loop-guard marker: append `export HL_LOOP_GUARD_ACTIVE=0` to `$CLAUDE_ENV_FILE`. Spawn `haily-project-manager` to sync plan status. Emit completion summary: phases done, deferred phases with links, remaining blocked work, final ledger state.

## Retry Loop

When a phase fails (build error, test failure, review blocker, gate fail):

1. Analyze failure; identify root cause (logic error / missing dependency / integration mismatch).
2. Spawn `haily-debugger` for targeted fix; re-run the phase via `{skill:hc-cook}`.
3. Repeat up to `--retry N` times total.
4. After N attempts: write `deferred-<phase-slug>.md` to `.agents/<plan-dir>/reports/`.
   - **Interactive:** ask user — defer and continue / abort / apply manual fix.
   - **`--auto`:** defer automatically; continue unless all remaining phases are blocked.
   - Append one line to `.agents/failure-history.jsonl` with the FULL field set the reader keyword-matches on — omitting `context`/`approach` silently degrades recall, since Precedent Mining greps those fields, not just `module`: `date` (today, ISO), `context` (the goal/phase/task being attempted), `approach` (the specific path tried before it failed), `rootCause` (from the debugger's final analysis, § Retry Loop step 2), `verifierSignal` (the last failing gate/test name), `module` (the phase's primary directory). Shape and field definitions: `{skill:hc-plan}` `references/codebase-analysis.md` § Failure History Ledger Shape.
5. If all remaining phases have this deferred phase in their `dependencies` chain → terminate and print deferred report.

## --auto Mode

All Checkpoints auto-proceed. Escalates to user only on:

- Goal names no actionable outcome (clarify-or-assume cannot proceed)
- Critical-severity blocker: data loss, security hole, broken public contract
- All phases deferred — nothing left to execute
- Divergence signal: write `replan-needed` to ledger, halt affected branch (independent branches continue); do NOT invoke `{skill:hc-plan}` programmatically mid-run

## Output

- Plan directory: `.agents/[YYMMDD]-[HHMM]-[goal-slug]/`
- Run ledger: `.agents/<plan-dir>/run-ledger.md` (compact phase log + budget counters)
- Phase results: `.agents/<plan-dir>/phase-NN-result.md`
- Deferred reports: `.agents/<plan-dir>/reports/deferred-<phase-slug>.md`
- Completion summary printed after Execute stage

## Session Model

Judgment agents (`haily-planner`, `haily-implementor`, `haily-reviewer`, `haily-brainstormer`, `haily-debugger`) inherit the session model — running on `{model:ultra}` passes that model to these agents automatically. Mechanical agents (`haily-tester`, `haily-git-manager`, `haily-stats`, etc.) are capped at their `model_max` tier and never escalate.

## Workflow Position

**Follows:** `{skill:hl-brainstorm}` — after exploring approach options
**Precedes:** `{skill:hc-ship}` — if a formal release pipeline is needed after goal completion
**Related:** `{skill:hc-plan}`, `{skill:hc-cook}`, `{skill:hc-fix}`

## References

| File | Content |
|------|---------|
| `references/run-ledger.md` | Ledger schema, compaction protocol, composite proxy budget gate, economics |
| `references/regression-gate.md` | Baseline-relative no-new-failures gate, runner detection, `--strict` escape hatch, test-set shrinkage (deletion) check |
