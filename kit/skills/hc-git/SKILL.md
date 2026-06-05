---
name: hc-git
description: "Git workflows: commits, PRs, merges, conflict resolution, change impact analysis, and sprint retrospectives. Auto-splits by scope, scans for secrets."
when_to_use: "Invoke for all git operations: committing, branching, PRs, conflict resolution, change analysis, or sprint metrics."
user-invocable: true
argument-hint: "cm|cp|pr|merge|analyze|retro [args]"
metadata:
  category: dev-tools
  keywords: [git, commits, staging, PR, merge, impact, analysis, retrospective, technical-debt, risk]
---

# Git Operations — Commits, Analysis & Retrospectives

## Usage

```
{skill:hc-git} cm|cp|pr|merge|analyze|retro [args]
```

| Subcommand | Description |
|---|---|
| `cm` | Stage files & create commits |
| `cp` | Stage files, create commits, and push |
| `pr [to] [from]` | Create Pull Request (defaults: main / current branch) |
| `merge [to] [from]` | Merge branches (defaults: main / current branch) |
| `analyze [ref]` | Impact analysis: intent, arch delta, tech debt, risk radar, open gaps |
| `retro [timeframe]` | Data-driven sprint retrospective from git history |

No arguments: `AskUserQuestion` (header "Git Operation") with primary options `cm / cp / pr / merge`; note "For analysis: `{skill:hc-git} analyze` | For retro: `{skill:hc-git} retro`".

## Constraints

> **Required — secrets check (cm/cp):** Scan staged diff before every commit. Secrets found → STOP, warn user, suggest `.gitignore`. Never commit secrets.

> **Required — analysis only (analyze/retro):** Do not implement, commit, checkout, merge, or push unless explicitly requested.

## Execution Model

**cm / cp / pr / merge** — delegate to `haily-git-manager` subagent; execute in ≤4 tool calls per operation.  
**analyze / retro** — run inline; require reasoning. Full protocols in `references/workflow-analyze.md` and `references/workflow-retro.md`.

## Commit Process (cm / cp)

1. `git add -A && git diff --cached --stat && git diff --cached --name-only`
2. Security: `git diff --cached | grep -iE "(api[_-]?key|token|password|secret|credential)"`
3. Split decision (full logic in `references/workflow-commit.md`):
   - `.claude/` files: `feat`/`fix`/`perf` only — never `docs`
   - Split: mixed types, multiple scopes, config+code mixed, FILES > 10 unrelated
   - Single: same type/scope, FILES ≤ 3, LINES ≤ 50
4. `git commit -m "type(scope): description"` — search related issues, add to body. No AI attribution.

## Output Format

```
✓ staged: N files (+X/-Y lines)
✓ security: passed
✓ commit: HASH type(scope): description
✓ pushed: yes/no
```

## Error Handling

| Error | Action |
|-------|--------|
| Secrets detected | Block commit, show files |
| No changes | Exit cleanly |
| Push rejected | Suggest `git pull --rebase` |
| Merge conflicts | Suggest manual resolution |

## Workflow Position

**Follows:** `{skill:hc-cook}`, `{skill:hc-fix}` — commit after implementing or fixing
**Precedes:** `{skill:hc-ship}` — git is part of the release pipeline
**Related:** `{skill:hc-review}` — run `analyze` before PR review for intent + risk context
**Related:** `{skill:hc-scout}` — scout for codebase context; `analyze` for change impact

## References

- `references/workflow-commit.md` — commit workflow with full split logic
- `references/workflow-push.md` — push workflow with error handling
- `references/workflow-pr.md` — PR creation with remote diff analysis
- `references/workflow-merge.md` — branch merge workflow
- `references/workflow-analyze.md` — impact analysis protocol (ref forms, data sources, 5-section output)
- `references/workflow-retro.md` — sprint retrospective protocol (flags, metrics, output)
- `references/commit-standards.md` — conventional commit format rules
- `references/safety-protocols.md` — secret detection, branch protection
- `references/branch-management.md` — naming, lifecycle, strategies
- `references/gh-cli-guide.md` — GitHub CLI commands reference
- `references/retro-metrics.md` — metric definitions, git commands, health thresholds
- `references/retro-report.md` — retro report template with all sections
