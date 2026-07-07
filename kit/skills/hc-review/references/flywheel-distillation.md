---
name: flywheel-distillation
description: Findings-to-rules flywheel — appends accepted findings to a local history log, detects recurrence, and proposes distillation into shared standards/guards/lint/memory. Loaded by hc-review Act and hc-fix Finalize.
---

# Findings-to-Rules Flywheel

Deterministic history append (no model judgment) plus a recurrence check that PROPOSES — never silently writes — a shared artifact once the same finding class repeats.

## Scope Guard

Activates only in repos with an `.agents/` directory (HailyKit-managed projects). No `.agents/` → skip the entire flywheel; this is the expected bare-repo behavior, not a failure, and needs no log line.

## Honest Scope

`.agents/` is gitignored (see `.gitignore`) — `review-history.jsonl` is per-developer, per-machine. A recurring finding on a teammate's machine does not feed your recurrence check, and vice versa; this history does not observe team-wide activity. What compounds across the team is the DISTILLED OUTPUT — a `docs/code-standards.md` entry, a `.claude/haily.json` guard pattern, or a lint rule — because those are committed and shared. Local history only decides *when* to propose; never describe it as team-wide learning in the proposal text or the final report.

## History Line Shape

Append one line per ACCEPTED finding — Stage 3 Accept verdicts in `{skill:hc-review}`, applied fixes in `{skill:hc-fix}` — to `.agents/review-history.jsonl` (repo root; create the file on first write):

```json
{"date":"2026-07-07","skill":"hc-review","category":"missing-error-handling","module":"kit","file":"kit/hooks/haily-guard/pattern.cjs","severity":"Medium","summary":"async fs read has no try/catch"}
```

Fields:
- `date` — ISO date (`YYYY-MM-DD`)
- `skill` — `hc-review` | `hc-fix`
- `category` — short kebab-case finding class; reuse the reviewer's own taxonomy tag (checklist ID or a stable freeform slug) so recurrence matching stays exact
- `module` — top-level directory of `file` (`kit`, `cli`, `docs`, …)
- `file` — path relative to repo root
- `severity` — `Critical` | `Medium` | `Low`
- `summary` — one line; strip secrets first (reuse the diff secret-redaction pass already applied to review artifacts)

Append-only, one JSON object per line. This step is a mechanical write, not a decision point — no model judgment involved.

## Recurrence Detection

At the end of Act (`{skill:hc-review}`) / Finalize (`{skill:hc-fix}`), for each finding just accepted: read `.agents/review-history.jsonl` (skip the check if the file is absent — first occurrence, nothing to compare) and count prior lines sharing the same `category` + `module` pair.

- 0–1 prior occurrences: append the new line and stop.
- ≥2 prior occurrences (this finding is the 3rd+ of its class in this module): append, then PROPOSE distillation (below).

## Distillation Proposal

> **Required — checkpoint, never silent:** always surface the proposal before anything is written. Interactive sessions use `AskUserQuestion`; non-interactive modes (`--fix`, `--comment`, `--batch` in `{skill:hc-review}`; `--auto` in `{skill:hc-fix}`) fold the proposal into the returned report instead of blocking on a prompt. A distillation write never happens without this checkpoint having been shown.

Cite the 2–3 prior instances by `date` + `file` before proposing anything. Pick ONE target, in this order:

| Target | When | Write location |
|---|---|---|
| Project standards entry | Lesson is a repo-specific convention (naming, structure, required pattern) | `docs/code-standards.md` — create with a minimal header (`# Code Standards`) if absent; if the project has no `docs/` convention at all, fall through to memory |
| Deterministic guard | Class is a path pattern that should never be touched a certain way (mechanically detectable by path) | `.claude/haily.json` → `guard.block` / `guard.allow` arrays (`kit/hooks/haily-guard/pattern.cjs`) |
| Lint rule | The project's linter already expresses the exact check (e.g. `no-restricted-imports`, a custom rule) | Note the rule name + config location; do not hand-roll a rule the linter can't express — fall through to standards or memory instead |
| Memory `feedback` file | Lesson is behavioral, not mechanically enforceable (a judgment call, a rejected approach, a style preference) | `~/.claude/projects/<project>/memory/feedback-<slug>.md` per `{skill:hc-plan}` `references/memory-bridge.md` § WRITE Protocol frontmatter/body shape |

## Write Protocol

- One finding-class per entry — never bundle two unrelated categories into a single standards line or guard pattern.
- Cite 2–3 concrete historical instances (`date` + `file`) pulled from the history lines that triggered the proposal.
- **Dedup before writing:** grep `docs/code-standards.md` for the category's keywords, scan `.claude/haily.json` `guard.block` / `guard.allow` for an existing matching pattern, or run the memory-bridge dedup guard (`{skill:hc-plan}` `references/memory-bridge.md` § Dedup Guard) — update the existing entry instead of creating a duplicate.
- Every written entry is deletable like any other standards line, guard pattern, or memory file — a bad distillation is not permanent.

## Retention

`review-history.jsonl` lives at the repo root, not inside a plan folder — it is excluded from the `.agents/` report-retention archive sweep (`haily-documentation.md` § Report Retention) and persists across plan archival cycles.
