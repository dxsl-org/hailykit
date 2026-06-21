# Sprint Retrospective Protocol

Data-driven retrospective from git history. No guesswork — use `N/A` when data unavailable.

## Flags

| Flag | Default | Description |
|------|---------|-------------|
| `timeframe` | `7d` | `7d`, `2w`, `1m`, `sprint`, or `YYYY-MM-DD:YYYY-MM-DD` |
| `--compare` | off | Compare vs preceding equal-length period (adds delta column to each metric) |
| `--team` | off | Break down metrics per author |
| `--format html\|md` | `md` | `html` = self-contained HTML report with charts |

## Fast path — `hailykit git-insights`

Prefer the native command for the deterministic git metrics; it computes them in one pass with no `awk`/`sort`/`uniq` pipelines:

```bash
hailykit git-insights . --since <days> --json
```

Returns `data.git` (bus factor, owners, risk hotspots = churn × complexity, stale files) and `data.activity` (12-week velocity sparkline, avg/week, active authors, release cadence). Always exits 0; `data.git` is `null` outside a repo. Use this for Velocity, File hotspots, and bus-factor/ownership rows below; fall back to the raw git commands only for metrics it does not cover (commit-type distribution, plan completion).

## Metrics Collected

| Category | Metric | Source |
|----------|--------|--------|
| Velocity | Commits/wk, active authors, release cadence | `hailykit git-insights --json` → `data.activity` |
| Code health | Risk hotspots (churn × complexity), bus factor, stale files | `hailykit git-insights --json` → `data.git` |
| Volume | LOC added/removed, net delta | `git diff --shortstat [range]` |
| Commit quality | Type distribution (feat/fix/chore/docs/…) | `git log --oneline` parsed by prefix |
| Plan progress | Task completion rate | `.agents/` checkbox counts + `gh` issue close rate |

For full metric definitions, thresholds, and interpretation guidance see `retro-metrics.md`.

## Output

File: `.agents/reports/retro-{YYMMDD}-{slug}.md` (or `.html` with `--format html`)

For the full report template see `retro-report.md`.

## Edge Cases

| Condition | Action |
|-----------|--------|
| No git history in range | "No commits in [timeframe]." |
| `gh` unavailable | Skip plan completion metric; note limitation |
| `--team` with single author | Show team table with one row (still valid) |
| Large history (>500 commits) | Sample; note in report |
