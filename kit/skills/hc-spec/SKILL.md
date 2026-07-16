---
name: hc-spec
description: "Draft EARS-notation acceptance criteria before implementation. Produces a human-approved spec doc that gates the Build stage in hc-cook. Invoke standalone or via hc-cook --spec."
when_to_use: "Invoke before implementing a feature when formal acceptance criteria, edge-case coverage, or stakeholder approval is needed before code is written."
user-invocable: true
argument-hint: "<task | plan.md> [--update <spec.md>]"
metadata:
  category: workflow
  keywords: [spec, requirements, EARS, acceptance-criteria, design-first]
---

# hc:spec — Spec-Driven Requirements

Drafts a formal specification from a task or plan, presents it for approval, and saves the approved doc as the acceptance contract for implementation. The Build stage in `{skill:hc-cook}` will not begin until the spec is approved.

## Usage

```
{skill:hc-spec} <task | plan.md>
{skill:hc-spec} <task | plan.md> --update <existing-spec.md>
```

| Flag | Behavior |
|------|----------|
| *(none)* | Draft a new spec from the task description or plan |
| `--update <file>` | Revise an existing spec (e.g., after scope change mid-implementation) |

```
{skill:hc-spec} "Add JWT refresh token rotation"
{skill:hc-spec} .agents/260601-auth/plan.md
{skill:hc-spec} "Add payment webhook" --update .agents/specs/payment-webhook-spec.md
```

## Constraints

> **Required — recon-first:** Scan the relevant codebase area before drafting. Collect existing patterns, adjacent contracts, and public interfaces the feature will touch.

> **Required — approval before Build:** The spec checkpoint is blocking — `{skill:hc-cook}` must not proceed past Draft until the spec is approved (explicitly or via `--auto`).

> **Required — observable criteria only:** Every acceptance criterion must be independently testable. Reject vague criteria ("it works correctly", "it handles errors well").

## Process

1. **Recon** — reuse session recon or `.agents/*/scout-report.md` when it covers the relevant modules (typical when invoked via `{skill:hc-cook} --spec`); otherwise spawn a quick Explore agent. Identify adjacent contracts, existing error-handling patterns, and prior decisions in `.agents/` or `docs/decisions/`. Log `✓ Recon: [N] findings | reused [source]`.

2. **Draft** — write a spec doc (see § Output) covering: functional requirements in EARS notation, edge cases, out-of-scope items, testable acceptance criteria, and open questions.

3. **Checkpoint** — present spec via `AskUserQuestion`: Approve / Revise / Abort. On Revise, apply feedback and re-present once; on second revision, open a full editing session. [skip in `--auto`: spec is drafted and auto-approved]

4. **Save** — write approved spec to:
   - Active plan exists: `.agents/<plan-dir>/spec.md`
   - No active plan: `.agents/specs/<YYMMDD-slug>-spec.md`

   Log `✓ Spec: approved — saved to <path>`

## Output

```markdown
# Spec: [Feature Name]
**Date:** YYYY-MM-DD
**Status:** Draft | Approved
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
- [ ] [Observable, independently testable condition]

## Constraints
- [Performance, security, backward-compatibility requirements]

## Open Questions
- [Unresolved items that could affect implementation scope]
```

EARS notation patterns:

| Pattern | Syntax |
|---------|--------|
| Ubiquitous | The [system] SHALL [action] |
| Event-driven | WHEN [trigger] the [system] SHALL [response] |
| State-driven | WHILE [state] the [system] SHALL [action] |
| Unwanted behavior | IF [condition] THEN the [system] SHALL [response] |
| Optional | WHERE [feature enabled], the [system] SHALL [action] |

## Workflow Position

**Follows:** `{skill:hc-plan}` — after a plan is approved, spec refines acceptance criteria before Build
**Precedes:** `{skill:hc-cook}` — the approved spec becomes the Build acceptance contract
**Auto-invoked by:** `{skill:hc-cook}` when `--spec` flag is present
