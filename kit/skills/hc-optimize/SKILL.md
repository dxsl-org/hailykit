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

# Optimize — Autonomous Metric-Driven Improvement

Runs N iterations against a measurable metric, keeps changes that improve it, discards those that don't. Each iteration commits before verifying — git is the memory, not a safety net. Use when a metric can be evaluated mechanically; not for subjective goals.

## Usage

```
{skill:hc-optimize}
Objective: <what to improve>
Scope: <glob pattern for editable files>
Measure: <shell command that prints a single number>
```

If required fields are missing, they are captured via a batched `AskUserQuestion`.

## Constraints

> **Required — mechanical metric:** The `Measure` command must output a single number to stdout in under 30 seconds. Validate before iterating: dry-run `Measure` once after config capture — if stdout is not a single number, stop and re-ask for a corrected command instead of entering the loop. Subjective or aesthetic goals are out of scope — use `{skill:hc-cook}` instead.

> **Required — git clean working tree:** A git repository with a clean working tree is required before starting. The skill commits before each verify to preserve history.

> **Required — scope boundary:** The skill cannot modify files outside the declared `Scope`, nor files referenced by the `Guard` command.

## Not for

| Situation | Better skill |
|---|---|
| Subjective goals ("make it cleaner") | `{skill:hc-cook}` |
| Bug fixing with known root cause | `{skill:hc-fix}` or `{skill:hc-debug}` |
| One-shot tasks, no repetition needed | `{skill:hc-cook}` |
| No mechanical metric to measure progress | `{skill:hc-cook}` (interactive) |

## Configuration Format

Parsed from user message. Missing required fields trigger a **batched** `AskUserQuestion`.

### Required

| Field | Description | Example |
|-------|-------------|---------|
| `Objective` | What to improve | `"Increase test coverage in src/utils"` |
| `Scope` | Glob pattern(s) for editable files | `"src/utils/**/*.ts"` |
| `Measure` | Shell command that outputs **a single number** | `"npx jest --coverage --json \| jq '...' \| tail -1"` |

### Optional

| Field | Default | Description |
|-------|---------|-------------|
| `Guard` | none | Regression check command (exit 0 = pass) |
| `Iterations` | 10 | Maximum iterations to run |
| `Tolerance` | medium | Metric variance tolerance: `low` / `medium` / `high` |
| `Min-Gain` | 0 | Minimum improvement to count as progress |
| `Direction` | higher | Whether `higher` or `lower` metric value is better |

## Interactive Setup

When required fields are missing, ask all at once:

```
AskUserQuestion({
  questions: [
    { question: "What metric do you want to improve? (e.g. 'test coverage in src/utils')", field: "Objective" },
    { question: "Which files may be edited? (glob, e.g. 'src/utils/**/*.ts')", field: "Scope" },
    { question: "Measure command — must print a single number to stdout", field: "Measure" },
    { question: "Guard command for regression check? (optional, press Enter to skip)", field: "Guard" }
  ]
})
```

## Core Protocol

Full iteration protocol in `references/loop-protocol.md`.

**Key invariants:**
- ONE atomic change per iteration — atomicity test: describe it in one sentence without "and"
- Commit BEFORE measuring — git is the rollback mechanism, not a post-hoc save
- Guard files are **read-only** — never modify files in the Guard command's scope
- Prefer `git revert` over `git reset` — preserves history for pattern analysis

## Results Logging

Each iteration appends one tab-separated row to `.agents/reports/optimize-YYMMDD-HHMM.tsv`. TSV (Tab-Separated Values) opens directly in any spreadsheet.

```
run   timestamp           score   gain    accept  change
0     2026-06-01T10:00:00 80.1    -       baseline  initial measurement
1     2026-06-01T10:01:12 82.4    +2.3    yes     add branch coverage to auth module
2     2026-06-01T10:02:30 81.9    -0.5    no      extract assertion helper
```

Full column schema and status values: `references/loop-protocol.md` § Stage 8.

## Stuck Detection

| Condition | Action |
|-----------|--------|
| 4 consecutive discards | Analyze patterns → shift strategy (different files, different approach) |
| 8 consecutive discards | STOP — write findings report, surface to user |

## Domain Quick Reference

Pick the row matching your goal — full configs in `references/measure-library.md`:

| Goal | `Direction` | `Tolerance` | `Min-Gain` | Common `Guard` |
|------|-------------|-------------|-----------|----------------|
| Test coverage ↑ | higher | low | 0.5 | `npm test` |
| Bundle size ↓ | lower | low | 0.5 | `tsc --noEmit` |
| Lint errors → 0 | lower | low | 0 | `npm test` |
| TypeScript errors → 0 | lower | low | 0 | `npm test` |
| Heap memory ↓ | lower | medium | 1 | `npm test` |
| API latency ↓ | lower | high | 5 | `npm test` |
| Startup time ↓ | lower | medium | 50 | `npm test` |
| DB query count ↓ | lower | low | 1 | `npm test` |
| Lighthouse score ↑ | higher | high | 2 | health check |

For competing metrics (e.g. "reduce bundle AND keep coverage above 80%"), see `references/multi-metric.md`.

## Example Invocations

### 1. Increase test coverage

```
{skill:hc-optimize}
Objective: Increase test coverage in src/utils from ~60% to 80%
Scope: src/utils/**/*.ts, tests/utils/**/*.test.ts
Measure: npx jest tests/utils --coverage --coverageReporters=json-summary 2>/dev/null | node -e "const d=require('./coverage-summary.json');console.log(d.total.lines.pct)"
Guard: npx tsc --noEmit && npx jest --passWithNoTests
Iterations: 15
Direction: higher
```

### 2. Reduce bundle size

```
{skill:hc-optimize}
Objective: Reduce main bundle size below 200KB
Scope: src/**/*.ts, src/**/*.tsx
Measure: npx vite build 2>/dev/null | grep "dist/index" | awk '{print $2}' | sed 's/kB//'
Guard: npx tsc --noEmit
Direction: lower
Min-Gain: 0.5
```

### 3. Eliminate ESLint errors

```
{skill:hc-optimize}
Objective: Drive ESLint error count to zero in src/api
Scope: src/api/**/*.ts
Measure: npx eslint src/api --format=json 2>/dev/null | node -e "const r=require('/dev/stdin');console.log(r.reduce((a,f)=>a+f.errorCount,0))" || echo 999
Direction: lower
Iterations: 20
```

## Limitations

- Cannot optimize subjective or aesthetic goals
- Cannot modify files outside declared `Scope`
- Cannot modify files referenced by the `Guard` command
- Cannot guarantee improvement — some metrics have hard ceilings
- Requires a **git repository with a clean working tree** before starting
- `Measure` command must complete in **< 30 seconds**
- Sequential by design — each iteration learns from the last

## References

| File | Content |
|------|---------|
| `references/loop-protocol.md` | Full iteration protocol: setup, 9 stages, stuck detection, final report |
| `references/measure-library.md` | Copy-paste `Measure:` commands for coverage, bundle, lint, memory, latency, startup, DB |
| `references/guard-and-noise.md` | Guard pattern, recovery flow, noise-aware verification, multi-run median |
| `references/git-memory-pattern.md` | Pattern recognition from git history, exploit/avoid patterns, commit convention |
| `references/multi-metric.md` | Multi-objective configs: primary metric + secondary constraints via Guard |

## Session Model

Judgment agents (`haily-planner`, `haily-implementor`, `haily-reviewer`, `haily-brainstormer`, `haily-debugger`) inherit the session model — running on `{model:ultra}` passes that model to these agents automatically. Mechanical agents (`haily-tester`, `haily-git-manager`, `haily-stats`, etc.) are capped at their `model_max` tier and never escalate.

## Workflow Position

**Follows:** `{skill:hc-test}` — identify a measurable metric to improve
**Follows:** `{skill:hc-cook}` — iteratively improve after initial implementation
**Precedes:** `{skill:hc-review}` — review after optimization to verify behavior is preserved
**Related:** `{skill:hc-fix}` (use when root cause is known), `{skill:hc-cook}` (use for subjective goals)
