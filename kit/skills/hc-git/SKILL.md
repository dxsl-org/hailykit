---
name: hc-git
description: "Git workflows: commits, PRs, merges, conflict resolution, change impact analysis, sprint retrospectives, and autonomous GitHub issue triage. Auto-splits by scope, scans for secrets."
when_to_use: "Invoke for all git operations: committing, branching, PRs, conflict resolution, change analysis, sprint metrics, or working through GitHub issues autonomously."
user-invocable: true
argument-hint: "cm|cp|pr|merge|analyze|retro|issues [args]"
metadata:
  category: dev-tools
  keywords: [git, commits, staging, PR, merge, impact, analysis, retrospective, technical-debt, risk, issues, triage, github]
---

# Git Operations — Commits, Analysis & Retrospectives

## Usage

```
{skill:hc-git} cm|cp|pr|merge|analyze|retro|issues [args]
```

| Command | Contract |
|---|---|
| `cm` | Stage and commit |
| `cp` | Stage, commit, then push |
| `pr [to] [from]` | Create PR; defaults main/current branch |
| `pr --merge <refs...>` | Review, label, ordered merge, then post-merge CI watch |
| `merge [to] [from]` | Merge branches; defaults main/current branch |
| `analyze [ref]` | Intent, architecture delta, debt, risk, gaps |
| `retro [timeframe]` | Git-history sprint retrospective |
| `issues [--auto] [--loop] [--filter label]` | Prioritize and delegate GitHub issues |

Without arguments, ask which operation and include analysis, retro, and issues.

## Constraints

> **Required — secrets check:** Before every `cm` or `cp`, scan the staged diff. On any API key, token, password, secret, or credential: stop, name affected files, and suggest `.gitignore`; never commit it.

> **Required — explicit mutation:** `analyze` and `retro` are read-only. `cm` never pushes; only `cp` or an explicit push request may push. Do not checkout, merge, commit, or push outside the selected command.

> **Required — merge safety:** `pr --merge` requires `haily-reviewer` with zero Critical/Important findings, no conflicts, and green required checks. Merge in order, delete successful head branches, monitor post-merge CI, and never force-push or direct-push protected branches.

## Process

- `cm`, `cp`, `pr`, `merge`: delegate mechanics to `haily-git-manager`, at most four tool calls per operation.
- `pr --merge`: use `haily-reviewer`, then `haily-git-manager`; route CI failures to `{skill:hc-fix}`. Load `references/workflow-merge-pr.md`.
- `analyze`, `retro`, `issues`: run their referenced protocols inline. `issues` delegates implementation to `{skill:hc-goal}`.

For `cm`/`cp`:

1. Stage; inspect staged stat and filenames.
2. Scan staged content for secrets.
3. Load `references/workflow-commit.md`; split mixed types/scopes, config+code, or more than 10 unrelated files. Keep a single commit for same type/scope when files ≤3 and lines ≤50. `.claude/` changes use `feat`, `fix`, or `perf`, never `docs`.
4. Match recent commit style, link issues, omit AI attribution. Push only for `cp`.

Report staged counts, secret-scan result, commit hash/message, and whether push occurred. On no changes, exit cleanly; on rejected push, suggest `git pull --rebase`; on conflicts, request manual resolution.

## Workflow Position

**Follows:** `{skill:hc-cook}` or `{skill:hc-fix}` — after verified changes
**Precedes:** `{skill:hc-ship}`
**Related:** `{skill:hc-review}`, `{skill:hc-scout}`

## References

| File | Content |
|---|---|
| `references/workflow-commit.md` | Commit and split logic |
| `references/workflow-push.md` | Push and failures |
| `references/workflow-pr.md` | PR creation |
| `references/workflow-merge.md` | Branch merge |
| `references/workflow-analyze.md` | Impact analysis |
| `references/workflow-retro.md` | Retrospective |
| `references/commit-standards.md` | Commit format |
| `references/safety-protocols.md` | Secrets and branch protection |
| `references/branch-management.md` | Branch lifecycle |
| `references/gh-cli-guide.md` | GitHub CLI |
| `references/retro-metrics.md` | Metric definitions |
| `references/retro-report.md` | Report template |
| `references/workflow-issues.md` | Issue triage and delegation |
| `references/workflow-merge-pr.md` | Review, ordered merge, CI convergence |
