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

Give it a goal; it plans, implements, reviews, and commits each phase until done.

## Usage

```text
{skill:hc-goal} "<goal description>" [--deep] [--auto] [--tdd] [--retry N] [--budget N] [--budget Xtool] [--strict]
```

| Flag | Behavior |
|---|---|
| *(none)* | Stage-gate: pause at the plan checkpoint and between major stage groups |
| `--deep` | Pass-through to `{skill:hc-plan}` and every `{skill:hc-cook}` phase. Cost is typically 3–5× baseline per phase; pair with `--budget`. |
| `--auto` | Run through autonomously; escalate only critical blockers |
| `--tdd` | Pass-through to `{skill:hc-cook}`. New behavior uses Red-Green; refactor/legacy work uses Snapshot. |
| `--retry N` | Max analyze→fix attempts per failing phase before deferring (default: 3) |
| `--budget N` | Override phase cap (default: 15) |
| `--budget Xtool` | Override tool-call cap (default: 400) |
| `--strict` | Restore full-suite-green gating instead of the default no-new-failures gate |

## Constraints

> **Required — clarify-or-assume:** At Route, if the goal is fuzzy: interactive mode asks one targeted question; `--auto` states a reasonable assumption explicitly and continues. Halt only if the goal names no actionable outcome.

> **Required — recon-first:** Scan the codebase before planning. Collect project type, framework, relevant modules, and in-flight plans in `.agents/`. Report 3–6 findings.

> **Required — no-new-failures:** Each phase must pass the baseline-relative regression gate in `references/regression-gate.md`. A phase is incomplete if it introduces new failing tests or silently shrinks the baseline test-name set. Use `--strict` to restore full-suite-green gating.

> **Required — ledger-compaction:** After each phase, record a compact result in the run ledger and discard the phase transcript from orchestrator context. See `references/run-ledger.md`.

> **Required — budget-aware:** Track phase count and estimated tool-call count in the run ledger. Halt at 90% of either cap; never start a new phase at or past the cap.

> **Required — phase-commit:** After every phase that passes Verify, commit via `haily-git-manager` before advancing.

> **Required — delegate-only:** Never implement, test, or review code directly. Invoke registered skills and specialist agents as needed — `{skill:hc-cook}`, `{skill:hc-debug}`, `{skill:hc-fix}`, `{skill:hl-brainstorm}`, `{skill:hc-lookup}`, `{skill:hc-db}`, `{skill:hc-security}`, and others. Do not create new skills.

## Process

1. **Route** — parse flags, lock the goal, open `.agents/<plan-dir>/run-ledger.md`, set budget caps, capture baseline test results for `references/regression-gate.md`, and log `✓ Route: goal locked — mode=[interactive|auto], budget=[N phases / X tool-calls]`.
2. **Recon** — reuse current-session or active-plan recon first; otherwise delegate one scoped discovery request through `{skill:hc-scout}`. Capture project type, framework, relevant modules, and in-flight plans. Log `✓ Recon: [N] findings`.
3. **Plan** — delegate to `{skill:hc-plan} --auto "<goal>"` and append `--deep` verbatim when set. Require `plan.md` + `phase-NN-*.md` with `tier` and `dependencies`, then build the Stage Graph.
   - **Checkpoint (Plan exit):** present the phase count and parallel-eligible groups; ask the user to Approve / Revise / Abort. Skip only with `--auto`.
4. **Execute** — append `export HL_LOOP_GUARD_ACTIVE=1` to `$CLAUDE_ENV_FILE` before the phase loop. This enables the SECONDARY loop-guard tripwire on test/spec edits; the PRIMARY guard remains the regression gate shrinkage check. For each phase in Stage Graph order:
   - Delegate `{skill:hc-cook} <phase-NN.md> --tier <phase.tier>`, adding `--auto` when in auto mode and forwarding `--deep` verbatim when set.
   - After completion: update the ledger row, check composite budget, check divergence signals from `references/run-ledger.md`, and discard the phase transcript.
   - On success: run the regression gate; if it passes, `haily-git-manager` commit and advance.
   - On gate failure: run `{skill:hc-debug}` or `{skill:hc-fix}` as appropriate, then enter the retry loop.
   - Apex direction consult (`--auto`, tier-gated): when an ambiguous direction decision would be a user checkpoint and `HL_MODEL_TIER` ranks below `ultra`, ask `haily-advisor` once per run. If the tier is `ultra`, unset, or unrecognized, keep the decision at session tier. If unavailable, fall back with `⚠ advisor unavailable — advice by session model`.
5. **Close** — append `export HL_LOOP_GUARD_ACTIVE=0` to `$CLAUDE_ENV_FILE`, delegate plan-status sync to `haily-project-manager`, summarize completed and deferred phases, and stop at the user checkpoint or terminal success condition.

## Retry Loop

1. Delegate `{skill:hc-debug}` to determine the root cause.
2. Apply the smallest corrective change through the appropriate downstream skill.
3. Re-run Verify and the regression gate.
4. Repeat up to `--retry N` times total.
5. On exhaustion, defer the phase and append one line to `.agents/failure-history.jsonl` with the full field set used by Precedent Mining: `date`, `context`, `approach`, `rootCause`, `verifierSignal`, `module`.

## --auto Mode

`--auto` keeps the loop moving until success, budget exhaustion, or a critical blocker. Escalate for data loss risk, security holes, broken public contracts, or a missing external decision that changes the outcome.

## Output

- Run ledger: `.agents/<plan-dir>/run-ledger.md` (compact phase log + budget counters)
- Failure ledger: `.agents/failure-history.jsonl`
- Commits: one per phase after Verify succeeds

## Session Model

Judgment agents (`haily-planner`, `haily-implementor`, `haily-reviewer`, `haily-brainstormer`, `haily-debugger`) inherit the session model. Mechanical agents (`haily-tester`, `haily-git-manager`, `haily-stats`, etc.) remain capped at `model_max`.

## Workflow Position

**Follows:** `{skill:hl-brainstorm}` — after exploring approach options
**Precedes:** `{skill:hc-ship}` — if a formal release pipeline is needed after goal completion
**Related:** `{skill:hc-plan}`, `{skill:hc-cook}`, `{skill:hc-fix}`

## References

| File | Content |
|---|---|
| `references/run-ledger.md` | Ledger schema, compaction protocol, composite proxy budget gate, economics |
| `references/regression-gate.md` | Baseline-relative no-new-failures gate, runner detection, `--strict` escape hatch, test-set shrinkage (deletion) check |
