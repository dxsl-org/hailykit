---
name: hc-spec
description: "Draft EARS-notation acceptance criteria before implementation. Produces a human-approved spec doc that gates the Build stage in hc-cook. Invoke standalone or via hc-cook --spec."
when_to_use: "Invoke before implementing a feature when formal acceptance criteria, edge-case coverage, or stakeholder approval is needed before code is written."
user-invocable: true
argument-hint: "<task | plan.md> [--update <spec.md>] [--quick]"
metadata:
  category: workflow
  keywords: [spec, requirements, EARS, acceptance-criteria, design-first]
---

# hc-spec — Spec-Driven Requirements

Drafts a formal specification from a task or plan, presents it for approval, and saves the approved doc as the acceptance contract for implementation. The Build stage in `{skill:hc-cook}` will not begin until the spec is approved.

## Usage

```
{skill:hc-spec} <task | plan.md>
{skill:hc-spec} <task | plan.md> --update <existing-spec.md>
{skill:hc-spec} <task | plan.md> --quick
```

| Flag | Behavior |
|------|----------|
| *(none)* | Draft a new spec from the task description or plan |
| `--update <file>` | Revise an existing spec: appends new `AC-N` ids (never renumbers or reuses a retired one), records a `## Change Log` entry, bumps `**Version:**`. Requires re-approval unless `--auto`. |
| `--quick` | Draft a lightweight spec — Context + numbered `AC-N` criteria + Out of Scope only, no EARS patterns or edge-case enumeration. Still requires approval unless `--auto`. See § --quick Mode. |

```
{skill:hc-spec} "Add JWT refresh token rotation"
{skill:hc-spec} .agents/260601-auth/plan.md
{skill:hc-spec} "Add payment webhook" --update .agents/specs/payment-webhook-spec.md
{skill:hc-spec} "Add a default response header" --quick
```

## Constraints

> **Required — recon-first:** Scan the relevant codebase area before drafting. Collect existing patterns, adjacent contracts, and public interfaces the feature will touch.

> **Required — approval before Build:** The spec checkpoint is blocking — `{skill:hc-cook}` must not proceed past Draft until the spec is approved (explicitly or via `--auto`).

> **Required — observable criteria only:** Every acceptance criterion must be independently testable. Reject vague criteria ("it works correctly", "it handles errors well").

> **Required — re-approval on criteria change:** When acceptance criteria change during Build, the spec must be re-approved via `--update` before Ship; under `--auto` the update is auto-approved and the Change Log entry records it.

## Process

1. **Recon** — reuse session recon first, then active-plan `context-snippets.json.reconEnvelope`, then active-plan root `scout-report.md`, then — only when no active plan exists — the most relevant root-level `.agents/*/scout-report.md`. Otherwise route one scoped `{skill:hc-scout} --quick` lookup. Identify adjacent contracts, existing error-handling patterns, and prior decisions in `.agents/` or `docs/decisions/`. Log `✓ Recon: [N] findings | reused [source]`.

2. **Draft** — write a spec doc (see § Output) covering: functional requirements in EARS notation, edge cases, out-of-scope items, testable acceptance criteria with stable `AC-N` ids, and open questions. Under `--quick`, skip EARS patterns and edge-case enumeration — see § --quick Mode.

3. **Checkpoint** — present spec via `AskUserQuestion`: Approve / Revise / Abort. On Revise, apply feedback and re-present once; on second revision, open a full editing session. [skip in `--auto`: spec is drafted and auto-approved]

4. **Save** — write approved spec to:
   - Active plan exists: `.agents/<plan-dir>/spec.md`
   - No active plan: `.agents/specs/<YYMMDD-slug>-spec.md`

   Log `✓ Spec: approved — saved to <path>`

5. **Revise** (`--update` only) — invoke when scope changes mid-Build or an acceptance criterion is added/retired. Append new `AC-N` ids (never renumber or reuse a retired id), bump `**Version:**`, record a `## Change Log` entry, then re-run the Checkpoint. [auto-approved and logged under `--auto`] Log `✓ Spec: updated — v[N], AC-ids [added/retired] — <path>`.

## Output

```markdown
# Spec: [Feature Name]
**Date:** YYYY-MM-DD
**Status:** Draft | Approved
**Version:** v1
**Plan:** .agents/<plan-dir>/plan.md   ← omit if no active plan

## Context
[1–2 sentences: why this feature is needed and what problem it solves]

## Functional Requirements

### Core Behaviors
- WHEN [trigger] the [system] SHALL [response]
- WHILE [state] the [system] SHALL [behavior]

### Edge Cases & Failure Modes
- IF [condition] THEN the [system] SHALL [response]

### Out of Scope
- [What this spec explicitly excludes this iteration]

## Acceptance Criteria
- [ ] AC-1: [Observable, independently testable condition] → test: <path|TBD>
- [ ] AC-2: [Observable, independently testable condition] → test: <path|TBD>

## Constraints
- [Performance, security, backward-compatibility requirements]

## Open Questions
- [Unresolved items that could affect implementation scope]

## Change Log
- v1 — YYYY-MM-DD — initial draft, AC-1..AC-N
```

EARS notation patterns:

| Pattern | Syntax |
|---------|--------|
| Ubiquitous | The [system] SHALL [action] |
| Event-driven | WHEN [trigger] the [system] SHALL [response] |
| State-driven | WHILE [state] the [system] SHALL [action] |
| Unwanted behavior | IF [condition] THEN the [system] SHALL [response] |
| Optional | WHERE [feature enabled], the [system] SHALL [action] |

## --quick Mode

Emits a minimal spec: `## Context` (1–2 sentences) + numbered `AC-N` acceptance criteria + `## Out of Scope` — no EARS patterns, no edge-case enumeration. The approval checkpoint still applies unless `--auto`. `{skill:hc-cook}` auto-routes tiny tasks (≤2 files touched, no new public interface) to `--quick`; anything larger or ambiguous in scope drafts the full spec.

## Workflow Position

**Follows:** `{skill:hc-plan}` — after a plan is approved, spec refines acceptance criteria before Build
**Precedes:** `{skill:hc-cook}` — the approved spec's `AC-N` ids become the traceability spine consumed through Build and by `{skill:hc-review}`
**Auto-invoked by:** `{skill:hc-cook}` when `--spec` flag is present, routing to `--quick` for tiny tasks (≤2 files, no new public interface)
