---
name: hl-stats
description: "Project code statistics — file counts, nLOC, complexity hotspots, LLM token estimate, COCOMO cost, test ratio, TODO/FIXME debt markers, oversized files, plus git insights: churn × complexity risk hotspots, bus factor, ownership, stale files, commit velocity, contributors, release cadence."
when_to_use: "Invoke when you need a codebase size snapshot, want to find high-complexity or high-risk (churn × complexity) hotspots, need a token budget before loading files into an LLM context, or want manager-facing metrics (COCOMO cost, bus factor, velocity, release cadence)."
user-invocable: true
argument-hint: "[path] [--json] [--lang <list>] [--top <n>] [--exclude <pattern>] [--since <days>] [--salary <n>] [--no-git]"
metadata:
  category: dev-tools
  keywords: [stats, metrics, loc, ncloc, complexity, hotspots, token, codebase, size, language]
---

# Stats — Project Code Metrics

Measure code size, languages, comments, complexity, context tokens, tests, debt, COCOMO cost, and Git ownership/activity risk.

## Usage

```
{skill:hl-stats} [path] [--json] [--lang <list>] [--top <n>] [--exclude <pattern>] [--since <days>] [--salary <n>] [--no-git]
```

| Flag | Behavior |
|---|---|
| `--json` | Compact schema: `v`, `summary`, `tests`, `cocomo`, `git`, `hotspots`, `thresholds` |
| `--lang ts,py` | Filter languages by name or extension |
| `--top N` | Hotspot count; default 10 |
| `--exclude pattern` | Skip paths containing substring |
| `--since days` | Git churn window; default 180 |
| `--salary n` | Annual salary for COCOMO cost; default 56286 USD |
| `--no-git` | Skip Git metrics; automatic outside a Git repo |

```
{skill:hl-stats} ./src
{skill:hl-stats} ./cli --lang ts --top 20
{skill:hl-stats} . --json --since 90
{skill:hl-stats} . --salary 120000
```

## Process

Delegate `Task(subagent_type="haily-stats")` with the target path and every supplied flag. Return its output unchanged.

## Output

Default table includes language files/nLOC/comments/complexity, token estimate, COCOMO, test ratio, debt, oversized files, hotspots, bus factor/owners, stale files, 12-week activity, contributors, and release cadence.

JSON preserves `summary` (files, ncloc, complexity, token_est), `tests` (file counts, nLOC ratio), `debt_markers`, `oversized`, `cocomo` (effort, schedule, people, cost, salary), `git` (window, bus factor, owners, risk hotspots, stale files, activity), `hotspots`, and `thresholds`.

- `token_est = ncloc × 18` estimates context budget.
- `risk = churn × complexity` prioritizes frequently changed complex files.
- `bus_factor` is the minimum contributors whose owned files cover at least 50% of nLOC.
- `cocomo` is directional COCOMO 81 organic-mode replacement cost, not a bid.
- `tests.test_ncloc_ratio` is test nLOC/source nLOC, not runtime coverage.
- `debt_markers` counts word-boundary TODO/FIXME/HACK matches, including strings.
- `activity.weekly_commits` has 12 buckets, oldest to newest.
- `git: null` means non-Git input or `--no-git`; other metrics remain valid.

Thresholds: complexity warning 15, error 25; file warning 200 lines. Auto-excludes `node_modules`, `dist`, `.git`, `.next`, `coverage`, `__pycache__`, `target`, `.venv`.

## Workflow Position

**Precedes:** `{skill:hc-plan}` or `{skill:hl-research}` — size and risk inform scope
**Related:** `{skill:hc-scout}`; `Task(subagent_type="haily-tech-analyst")`
