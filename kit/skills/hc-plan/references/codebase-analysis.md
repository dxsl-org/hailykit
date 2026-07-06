# Codebase Analysis

**Skip when:** scout reports are already provided.

## Process

### Read Project Docs First

Before touching source files, read the project's own documentation:

- `./docs/codebase-summary.md` — architecture overview, component relationships, current status
- `./docs/code-standards.md` — naming conventions, language-specific patterns, error handling approach
- `./docs/design-guidelines.md` — UI/UX conventions, component library usage (if exists)
- `CLAUDE.md` — project-specific constraints injected into context

Skip files that don't exist; continue without blocking.

### Scout the Codebase

Use `{skill:hc-scout}` to locate relevant files for the task. Run scouts in parallel for different aspects:

```
{skill:hc-scout} "auth module and middleware"
{skill:hc-scout} "database models and migrations"
{skill:hc-scout} --graph    # for large codebases needing cross-file analysis
```

Wait for all scouts to report before proceeding to analysis.

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
4. Blast Radius: modules and contracts at risk
5. Inconsistencies or technical debt the plan should note but not fix

Write this summary to `.agents/<plan-dir>/scout-report.md` before proceeding to Solution Design. Downstream skills (`{skill:hc-review}`, `{skill:hc-debug}`) read this file to skip re-scouting within the same working session.
