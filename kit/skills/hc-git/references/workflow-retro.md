# Sprint Retrospective Protocol

Data-driven retrospective from git history. No guesswork — use `N/A` when data unavailable.

## Flags

| Flag | Default | Description |
|------|---------|-------------|
| `timeframe` | `7d` | `7d`, `2w`, `1m`, `sprint`, or `YYYY-MM-DD:YYYY-MM-DD` |
| `--compare` | off | Compare vs preceding equal-length period (adds delta column to each metric) |
| `--team` | off | Break down metrics per author |
| `--format html\|md` | `md` | `html` = self-contained HTML report with charts |

## Metrics Collected

| Category | Metric | Source |
|----------|--------|--------|
| Velocity | Commits/day, active days | `git log --format="%ad" --date=short` |
| Volume | LOC added/removed, net delta | `git diff --shortstat [range]` |
| Code health | File hotspots (churn), test-to-code ratio | `git log --name-only` + count test files |
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
