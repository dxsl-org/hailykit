---
name: hc-optimize
description: "Iterative metric-driven optimization. Auto-runs N iterations, keeps/discards by score."
when_to_use: "Invoke when autonomously optimizing a measurable metric (coverage, bundle size, lint errors) over N iterations."
user-invocable: true
argument-hint: "[Objective/Metric description] or inline config block"
metadata:
  category: workflow
  keywords: [optimize, iteration, metrics, coverage, bundle-size]
---

# Optimize — Metric-Driven Improvement

Iterate against one mechanical metric; keep gains and revert regressions.

## Usage

```
{skill:hc-optimize}
Objective: <what to improve>
Scope: <glob pattern for editable files>
Measure: <shell command that prints a single number>
```

Capture missing required fields in one batched `AskUserQuestion`.

## Constraints

> **Required — mechanical metric:** `Measure` must print a single number to stdout within 30 seconds. Dry-run once; on invalid output, stop and request a corrected command. Route subjective goals to `{skill:hc-cook}`.

> **Required — git clean working tree:** Start only in a clean git repository; commit each candidate before verification.

> **Required — scope boundary:** Modify only `Scope`; files referenced by `Guard` are read-only.

Use `{skill:hc-cook}` for subjective goals or one-shot work. Use `{skill:hc-fix}` / `{skill:hc-debug}` for root-cause bug repair.

## Configuration Format

Required fields: `Objective`, `Scope`, `Measure`.

Optional fields: `Guard`, `Iterations` (default 10), `Tolerance` (`low|medium|high`), `Min-Gain` (default 0), `Direction` (`higher|lower`, default `higher`).

If required fields are missing, ask for `Objective`, `Scope`, `Measure`, and optional `Guard` together via `AskUserQuestion`.

## Core Protocol

Full loop details live in `references/loop-protocol.md`.

1. Validate `Measure`; record the baseline.
2. Make ONE atomic in-scope change.
3. Commit BEFORE measuring.
4. Run `Measure` and `Guard`. Accept only a gain meeting `Min-Gain` within tolerance.
5. Otherwise revert. Prefer `git revert` over `git reset`.
6. Log the result, then repeat to the iteration cap.

## Results Logging

Append score, gain, accept/reject, and change note to `.agents/reports/optimize-YYMMDD-HHMM.tsv`; schema: `references/loop-protocol.md`.

## Stuck Detection

| Condition | Action |
|-----------|--------|
| 4 consecutive discards | Analyze patterns → shift strategy (different files, different approach) |
| 8 consecutive discards | STOP — write findings report, surface to user |

Presets and commands: `references/measure-library.md`. For competing metrics, use `references/multi-metric.md`. Improvement is not guaranteed; the loop is sequential because each iteration uses prior results.

## References

| File | Content |
|------|---------|
| `references/loop-protocol.md` | Full iteration protocol: setup, 9 stages, stuck detection, final report |
| `references/measure-library.md` | Copy-paste `Measure:` commands for coverage, bundle, lint, memory, latency, startup, DB |
| `references/guard-and-noise.md` | Guard pattern, recovery flow, noise-aware verification, multi-run median |
| `references/git-memory-pattern.md` | Pattern recognition from git history, exploit/avoid patterns, commit convention |
| `references/multi-metric.md` | Multi-objective configs: primary metric + secondary constraints via Guard |

## Workflow Position

**Follows:** `{skill:hc-test}` — identify a measurable metric to improve
**Follows:** `{skill:hc-cook}` — iteratively improve after initial implementation
**Precedes:** `{skill:hc-review}` — review after optimization to verify behavior is preserved
**Related:** `{skill:hc-fix}` (use when root cause is known), `{skill:hc-cook}` (use for subjective goals)
