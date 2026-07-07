# Cross Review (--cross)

A second-opinion pass by an external AI model whose provider differs from the session's, run AFTER Red Team + Validation so the reviewer sees the final, stabilized plan — not a draft that is about to change. Advisory only: the session model adjudicates every finding.

> **Required — advisory-only:** cross-model findings never block or edit the plan. Present them; the session model decides each one. Do not send a second round unless the plan was revised as a result.

> **When `--deep` is active:** cross findings are confidence-raising, not merely advisory — a confirmation of an existing Red Team finding raises that finding's confidence; a blind-spot `critical` finding enters red-team adjudication (`references/red-team-workflow.md` → Adjudicate) under the same evidence requirement as any other finding. This upgrade only applies when cross review is separately authorized (`--cross` or `crossReview.auto` — `--deep` alone never triggers external egress). Normal mode (no `--deep`) stays advisory-only, unchanged.

## When it runs

- `--cross` flag present, OR `haily.json` has `crossReview.auto: true`.
- Position: immediately after Validation passes, before Task Hydration.
- Skips silently (one-line log) when no eligible reviewer CLI is installed — never an error.

## Invoke

Write the final `plan.md` path to the tool and pass the provider this session runs under (so the reviewer is guaranteed to differ):

```
hailykit cross-review --stage plan --input <plan.md> --session-provider <your-provider> --json
```

`--session-provider` is the provider you are running under (`claude`, `codex`, `gemini`, …); default `claude`. The tool walks `codex → gemini → opencode → cline → ollama`, picks the first installed, authenticated CLI whose provider differs, and returns findings as JSON.

## Interpret

Parse the JSON envelope's `data.findings` (each: `severity`, optional `file`/`line`, `summary`, `evidence`).

- **Blind-spot catch:** a finding NOT already raised by Red Team. Mark these `[blind-spot catch]` and surface them first — they are the point of cross review.
- Map severities: `critical` → address before Cook; `medium`/`low` → note in the relevant phase's Risk Notes.
- `data.skipped` present → log `ℹ Cross review: skipped — <reason>` and continue.

## Decide

- **Interactive:** present findings grouped by severity; `AskUserQuestion` per critical finding — Fold into plan / Defer / Reject. Folding a finding triggers a plan revision, which permits exactly one re-run.
- **`--auto`:** fold `critical` findings into a revision note on the affected phase without pausing; record `medium`/`low` in Risk Notes.
- **Under `--deep`:** before presenting, route each finding through the confidence-raising rule above — confirmations attach to the matching Red Team finding instead of listing separately; blind-spot `critical` findings go through red-team adjudication first, then follow the Interactive/`--auto` path above for whatever survives adjudication.

## Privacy

Plan content leaves the machine to an external provider. For restricted repos, set `crossReview.reviewer: ollama` (local, offline) or `crossReview.disable: true` in `haily.json`.
