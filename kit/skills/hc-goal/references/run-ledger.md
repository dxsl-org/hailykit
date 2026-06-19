# Run Ledger — hc-goal Orchestrator State

The orchestrator reads **only this file** between phases. All phase working detail lives on disk in per-phase result files; the orchestrator drops it from its own context after recording the compact result here.

## Ledger File

Location: `.agents/<plan-dir>/run-ledger.md`

Overwrite on each update (re-read cost stays flat; no append-only growth).

### Schema

```markdown
---
goal: "<the user's goal, restated verbatim — recite this at the top of each phase delegation>"
mode: interactive | auto
started: YYYY-MM-DD HH:MM
phases_cap: 15        # overridable: --budget N
tool_call_cap: 400    # overridable: --budget Xtool
phases_run: 0         # increment after each phase
tool_calls_est: 0     # self-estimate; advisory only (no runtime API)
baseline_signal: ctrf | junit | exit-code | none
---

## Phase Log

| # | Phase | Tier | Status | Result file | Outcome (1 line) | Residual risk |
|---|-------|------|--------|-------------|------------------|---------------|
| 1 | name  | fast | ✅ done | phase-01-result.md | <outcome> | <risk or None> |
```

Status values: `🔄 running` · `✅ done` · `⚠️ deferred` · `❌ failed`

## Per-Phase Result File

Written by the phase agent on completion. Location: `.agents/<plan-dir>/phase-NN-result.md`

```markdown
# Phase N Result — <Phase Name>

**Status:** success | deferred | failed
**Model tier used:** fast | medium | thinking
**Outcome:** <1 sentence>
**Files changed:** <comma-separated list>
**Residual risk:** <1 sentence, or "None">
**Test signal:** passed N/N | no-new-failures | degraded: X new failures | no runner detected
**Assumption-invalidated:** false | <description of invalidated assumption>
```

## Compaction Protocol

After each phase completes:

1. Read the phase agent's compact return (≤10 lines).
2. Write the result to `phase-NN-result.md`.
3. Update the ledger row: `phases_run++`, estimate `tool_calls_est`, record status/outcome/risk.
4. **Discard the phase's working detail from context.** Carry forward only the ledger and the compact result summary.
5. Check composite budget (§ Composite Budget Gate).
6. Check for divergence signals: `assumption-invalidated: true` or ≥2 consecutive phases with `deferred` status → halt and surface (§ Divergence Handling).
7. Recite the `goal:` field to the next phase delegation to prevent goal drift over long runs.

The orchestrator at phase N carries: goal + full ledger + compact results of recent phases. It does **not** carry full transcripts of phases 1…N-1.

## Composite Budget Gate

```
halt when: phases_run ≥ phases_cap  OR  tool_calls_est ≥ tool_call_cap
```

| Cap | Default | `--budget` override |
|-----|---------|---------------------|
| Phase cap | 15 | `--budget 20` sets phases_cap=20 |
| Tool-call cap | 400 | `--budget 600tool` sets tool_call_cap=600 |

Both may be overridden in the same invocation.

**Advisory only.** The orchestrator self-estimates tool-call count by tracking Edit/Write/Bash/Read calls. There is no runtime API for true counts (Claude Code issue #11008). Runtime auto-compact and the context window remain the only hard backstops.

**Graceful halt at 90%:** When either counter reaches 90% of its cap, do not start a new phase. Write a completion summary (phases done + remaining-work list) and stop cleanly.

**Runaway guard:** The tool-call cap catches a single phase stuck in a retry/Edit/Bash loop that a phase counter alone reads as "1/15". Estimate conservatively — each Edit/Write/Bash/Read ≈ 1 tool-call.

## Divergence Handling

The orchestrator adapts to reality but does **not** invoke `{skill:hc-plan}` programmatically mid-run (token-thrash risk; banned).

- **Interactive mode:** if a phase result records `assumption-invalidated: true`, OR ≥2 consecutive phases are deferred → halt, surface the ledger state to the user, and ask whether to re-plan manually.
- **`--auto` mode:** write a `replan-needed` note to the ledger and stop the affected branch. Independent (unblocked) branches continue.

## Economics — Context Growth and Isolation Crossover

**Short runs (≤ ~5 phases):** delegate `{skill:hc-cook}` directly. Warm orchestrator context is cheap; the rehydration overhead of wrapping phases in subagents is not justified.

**Long runs (~6+ phases):** orchestrator context grows super-linearly (phase 10 carries phase 1–9 back-and-forth). Compact-ledger discipline (this file) is the primary fix — it keeps orchestrator context ~flat. Optionally opt into heavy isolation: wrap each `{skill:hc-cook}` call in a `haily-implementor` subagent so hc-cook's transcript stays in the subagent and never backflows to the orchestrator.

Rough arithmetic for a 10-phase run (illustrative):
- Without ledger: orchestrator context ≈ baseline + Σ(transcripts 1–9) — grows unboundedly
- Compact-ledger default: orchestrator ≈ baseline + 10 × (1 ledger row + 10-line result) ≈ ~flat
- Heavy isolation adds: ~1–2k rehydration tokens × 10 phases; buys fully bounded growth; net positive past crossover

Auto-enable heavy isolation when: `phases_cap > 5` OR any earlier phase produced a result file > 2k tokens.

## Worked Example — 6-Phase Run at Phase 4

```markdown
---
goal: "Add rate limiting on all API endpoints"
mode: auto
started: 2026-06-19 14:00
phases_cap: 15
tool_call_cap: 400
phases_run: 4
tool_calls_est: 112
baseline_signal: ctrf
---

## Phase Log

| # | Phase | Tier | Status | Result file | Outcome | Residual risk |
|---|-------|------|--------|-------------|---------|---------------|
| 1 | scaffold middleware | fast | ✅ done | phase-01-result.md | RateLimiter class created | None |
| 2 | redis integration | medium | ✅ done | phase-02-result.md | Redis store wired; tests green | TTL edge-case logged |
| 3 | route decorators | medium | ✅ done | phase-03-result.md | All endpoints decorated | None |
| 4 | e2e tests | medium | ✅ done | phase-04-result.md | 24 tests passing | Flaky test #12 noted |
| 5 | docs update | fast | 🔄 running | — | — | — |
| 6 | perf benchmark | thinking | pending | — | — | — |
```

Status: 112/400 tool-calls (28%), 4/15 phases (27%). Budget healthy; continue.
