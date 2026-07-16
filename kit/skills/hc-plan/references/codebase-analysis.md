# Codebase Analysis

**Skip when:** scout reports are already provided. Session-recon reuse (below) skips only the Scout sub-step — Precedent Mining, Failure & Incident Read-Back, and the Output write to `scout-report.md` always run.

## Process

### Read Project Docs First

Before touching source files, read the project's own documentation:

- `./docs/codebase-summary.md` — architecture overview, component relationships, current status
- `./docs/code-standards.md` — naming conventions, language-specific patterns, error handling approach
- `./docs/design-guidelines.md` — UI/UX conventions, component library usage (if exists)
- `CLAUDE.md` — project-specific constraints injected into context

Skip files that don't exist; continue without blocking.

### Scout the Codebase

Reuse before spawning: if the session already holds a scout report or recon summary covering the task's modules (typical when planning follows `{skill:hl-brainstorm}` or `{skill:hc-scout}` in the same session), use it and skip only this Scout sub-step — Precedent Mining and the Output write to `scout-report.md` still run. Log `✓ Scout: reused session recon`.

Otherwise run `{skill:hc-scout}` **once**, listing every aspect in a single prompt — scout partitions the repo and parallelizes internally, so one invocation covers all aspects; invoking it per-aspect runs overlapping repo-wide sweeps:

```
{skill:hc-scout} "auth module and middleware; database models and migrations"
{skill:hc-scout} --graph    # only for >200-file codebases needing cross-file dependency chains
```

Narrow follow-up lookups after the first report use `{skill:hc-scout} --quick` — never a second full scout.

Wait for the scout report before proceeding to analysis.

### Precedent Mining

Prospective blind-spot detection: find commits that already did work like this task, and treat their file footprint as a checklist of files the current plan may be missing. This is forward-looking (unknown unknowns before writing code) — distinct from `{skill:hc-debug}`, which traces root cause backward after a failure.

1. Extract 2–4 keywords from the task description — feature nouns, verbs, module or symbol names.
2. Search history per keyword: `git log --all -i --grep="<keyword>" --oneline -15`. Also probe the primary target path: `git log --oneline -10 -- <path>`.
3. Select up to 3 commits most similar to the task — same subsystem or same kind of change. This is a judgment call, not automatic inclusion of every match.
4. For each selected commit: `git show --stat <hash>`. Its changed-file list is the precedent checklist.
5. Diff that footprint against the files the scout already surfaced. A file present in the footprint but absent from current scope is a blind-spot candidate:
   `⚠ Blind spot candidate: <path> — touched by <hash> "<subject>", not in current scope`

> **Required — evidence-cite:** Every precedent finding carries a citable source — a commit hash, file path, or doc reference. Drop any finding you cannot ground in one; generic speculation ("there may be related config somewhere") is not a finding.

Skip gracefully — log one line and continue — when there is no usable history: `ℹ Precedents: skipped — [no git history | no matches for "<keywords>"]`. Shallow CI clones and fresh repos hit this path normally; it is never an error.

Record surviving precedents as a `### Precedents` subsection in `scout-report.md`; feed blind-spot candidates into the Blast Radius map below.

### Failure History Ledger Shape

`.agents/failure-history.jsonl` — repo root, sibling to `.agents/review-history.jsonl` (same gitignore + retention-exemption status: `kit/rules/haily-documentation.md` § Report Retention). Append-only, one JSON object per line:

```json
{"date":"2026-07-08","context":"add rate limiting to API endpoints","approach":"in-memory token bucket per process","rootCause":"token bucket state lives per Node process; horizontal scaling forks N processes with independent buckets, so the effective limit is N times looser than specified","verifierSignal":"load-test assertion 'requests/min <= 600' failed at 640/min with 4 workers (e2e/rate-limit.spec.ts:42)","module":"cli"}
```

Fields:
- `date` — ISO date (`YYYY-MM-DD`)
- `context` — what was being attempted (the goal, phase, or task)
- `approach` — the specific path tried
- `rootCause` — verifier-grounded reason it failed. Not a surface symptom.
- `verifierSignal` — the concrete signal that proved the failure: failing test name, gate/build output line, or red-team/validate finding id
- `module` — top-level directory of the affected code, for keyword matching

**Worked example — symptom vs root cause, same failure:**

Symptom line (do not write this shape):
```json
{"rootCause":"tests timed out","verifierSignal":"jest timeout after 5000ms"}
```
"Tests timed out" restates that the check failed, not why — a later session re-attempts the identical design and only rediscovers the same timeout.

Root-cause line (write this shape):
```json
{"rootCause":"token bucket state lives per Node process; horizontal scaling forks N processes with independent buckets, so the limit is N times looser than specified and the load test correctly saturates it","verifierSignal":"load-test assertion 'requests/min <= 600' failed at 640/min with 4 workers (e2e/rate-limit.spec.ts:42)"}
```
This traces the failure to its mechanism (per-process state under horizontal scaling), so a later plan for the same module reaches for shared-state rate limiting (Redis, sticky routing) instead of re-trying the in-process design.

Staleness: entries older than 90 days are still surfaced, never silently dropped — flag `(⚠ verify — N days old)`, mirroring `references/memory-bridge.md` § Staleness Handling.

### Failure & Incident Read-Back

Retrospective anti-repeat check, mirroring Precedent Mining's prospective blind-spot check: Precedent Mining asks "what worked before that this plan might be missing"; this asks "what was already tried for this module and failed, so the plan doesn't re-propose it."

1. Reuse the keywords from Precedent Mining, plus the module list from Map Blast Radius below.
2. Grep `.agents/failure-history.jsonl` for lines whose `module` matches a Blast Radius module, or whose `context`/`approach` contains a keyword (case-insensitive). Grep `.agents/incidents/*.md` filenames and content for the same keywords/modules — this is the ledger's only reader today.
3. Cap at top-5, ranked by recency, then by exact module match over keyword-only match.
4. Entries >90 days old are still included, flagged `(⚠ verify — N days old)` per the staleness rule above — never acted on blindly.
5. Surface each match into planning context as `⚠ Prior failure: <approach> — failed because <rootCause> (<verifierSignal>, <date>)` for ledger hits, or `⚠ Prior incident: <file> — <one-line summary>` for incident hits.
6. No file, or no matches: skip gracefully, log one line — `ℹ Failure read-back: skipped — [no ledger/incidents | no matches for "<keywords>"]`. This is the expected first-run/no-history path, not an error.

### Analyze Patterns

From scout output, extract:

- **Naming conventions:** how files, functions, and variables are named in this codebase
- **Architectural patterns:** how components communicate, where business logic lives
- **Error handling approach:** what error types exist, how they propagate
- **Testing patterns:** test file location, naming, what is and isn't tested
- **Existing utilities:** helpers, services, or abstractions the plan should reuse

### Map Blast Radius

Identify:
- Which existing modules the planned change will touch
- Which public contracts (APIs, types, events) must stay stable
- Which tests cover the affected areas

This feeds directly into the Scope Contract — specifically the Blast Radius section.

## Output

Brief written summary (≤150 lines) covering:
1. Relevant files and their roles
2. Patterns the implementation must follow
3. Precedents: prior commits that did similar work (hash + subject) and any blind-spot candidates they surface
4. Prior failures: matching lines from `.agents/failure-history.jsonl` + `.agents/incidents/` (module/keyword match, capped, staleness-flagged)
5. Blast Radius: modules and contracts at risk
6. Inconsistencies or technical debt the plan should note but not fix

Write this summary to `.agents/<plan-dir>/scout-report.md` before proceeding to Solution Design. Downstream skills (`{skill:hc-review}`, `{skill:hc-debug}`) read this file to skip re-scouting within the same working session.
