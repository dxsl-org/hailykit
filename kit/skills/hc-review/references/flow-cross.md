# Cross-Model Review (--cross)

An advisory stage that sends the review target's diff to an external AI model whose provider differs from the session's, then merges its findings into the report. Runs after the Simplification Scan, before Act. Never blocks and never edits — the session model and the developer decide.

> **Required — advisory-only:** cross-model findings are advisory. They never gate the review or auto-apply. Present them; the developer decides.

> **Required — secret-safe:** run the existing secret scan on the diff BEFORE sending it out. On any hit, abort the cross leg and log `⚠ Cross review skipped — secrets in diff`. Diff content leaves the machine to an external provider.

## When it runs

- `--cross` flag present, OR `.hl.json` has `crossReview.auto: true`.
- Composes with every input mode and with `--quick` (`--quick --cross` = Stage 2 Quality + Cross).
- Skips silently (one-line log) when no eligible reviewer CLI is installed.

## Invoke

Capture the target diff to a temp file by input mode, then run the tool:

| Input mode | Diff source |
|---|---|
| `#PR` | `gh pr diff <n>` |
| commit | `git show <hash>` |
| `--pending` / default | `git diff HEAD` |

```
hailykit cross-review --stage code --input <diff-file> --session-provider <your-provider> --json
```

**Size guard:** if the diff exceeds ~3000 lines, send the file list + hunk headers instead of full content and note the truncation in the report — a large blob degrades reviewer quality and risks arg limits.

## Merge findings

Parse `data.findings` and reconcile against Stage 2/3 findings:

- Same `file` + `line` + category as an existing finding → **confirmation** (raises confidence; do not double-count).
- Not raised by any prior stage → **blind-spot catch**; tag `[cross: <cli>/<model>]` and list it first.
- `data.skipped` present → log `ℹ Cross review: skipped — <reason>` and continue.

## Act

Fold cross findings into the normal Act step (interactive present / `--fix` apply / `--comment` post) alongside the other stages' findings, clearly attributed to the cross reviewer.

## Privacy

For restricted repos, set `crossReview.reviewer: ollama` (local) or `crossReview.disable: true` in `.hl.json`.
