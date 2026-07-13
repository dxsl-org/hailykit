# Phase File Template

Use this structure for every `phase-XX-name.md` file. Keep each phase file under 150 lines; split into sub-phases if it grows larger.

```markdown
---
phase: <N>
title: "<Phase Name>"
status: pending       # pending | in-progress | completed
priority: P2          # P1 (critical path) | P2 (standard) | P3 (nice-to-have)
effort: ""            # e.g. "4h", "2d"
dependencies: []      # phase numbers this phase is blocked by
tier: medium          # fast (mechanical/boilerplate) | medium (logic/integration) | thinking (arch/security/schema)
---

# Phase <N>: <Name>

> **Required — deviation-log:** Log every Decision / Deviation / Surprise in § Deviation Log the moment it occurs — not at report time. On an edge case that diverges from this plan, choose the smallest reversible option, log four lines, and continue. Escalate only irreversible or contract-breaking divergence.

## Overview

<1–2 sentences: what this phase delivers and why it is its own phase.>

## Requirements

- Functional: <what the code must do>
- Non-functional: <performance, security, compatibility constraints>

## Architecture

<Component design, data flow, key decisions. Include a brief diagram in text or Mermaid if helpful.>

## Assumptions

<Every claim this phase relies on that has not been directly verified against the codebase — a file exists, an API behaves a certain way, a dependency is available. High-confidence claims pass through Recon unchecked; the top-3 low/medium-confidence entries get spot-verified before Build (`{skill:hc-cook}` Recon pre-Build Pass → Assumption Verification). If empty, write "None — no unverified claims." so absence is a statement, not an omission.>

**Fact vs assumption — only log assumptions here, facts belong in Architecture/Requirements:**
- Fact: grepped/read directly, cited as `file:line` — e.g. "`requireAuth` exported from `src/auth/middleware.ts:42`".
- Fact: confirmed by running a command — e.g. "`npm ls stripe` shows `stripe@14.2.0` installed".
- Assumption: inferred from naming convention — e.g. "files under `handlers/` follow the `on<Event>` pattern seen in 3/3 sampled files".
- Assumption: inferred from absence of counter-evidence — e.g. "no callers outside module X — verified only for `*.ts`, assumed for scripts".
- Assumption: inferred from docs without codebase confirmation — e.g. "README states rate limit is 100 req/min; not verified against the actual middleware config".

- **Claim:** <what is assumed true>
  **Confidence:** high | medium | low
  **How to verify:** <command to run, file to read, or doc to check>

## Related Files

- Create: `path/to/new-file.ts`
- Modify: `path/to/existing-file.ts`
- Delete: `path/to/removed-file.ts`

## Implementation Steps

1. <Specific, actionable step>
2. <Next step — concrete enough that a developer can execute without asking questions>
3. ...

## Success Criteria

- [ ] <Verifiable outcome — pass/fail, not "looks good">
- [ ] <Test name or command that confirms correctness>

## Security Considerations

<Auth/authz requirements for this phase. Data exposure risks. Input validation boundaries. If none: "N/A.">

## Risk Notes

<Known unknowns, gotchas, or decisions that could invalidate this phase's approach. If none, write "None identified.">

## Deviation Log

<Append-only during Build. One entry per Decision / Deviation / Surprise, logged when it happens. If empty at Ship, write "None." so absence is a statement, not an omission.>

- <Decision|Deviation|Surprise>: <what, one line>
  Why: <what triggered it>
  Impact: <files or contract affected>
  Revert: <how to undo — or "irreversible, escalated">
```

## Conventions

- Phase numbers start at 01 and are zero-padded: `phase-01-setup.md`, `phase-02-api.md`
- Title in filename uses kebab-case: `phase-03-auth-middleware.md`
- `dependencies: [1, 2]` means this phase cannot start until phases 1 and 2 are completed
- Success Criteria items use checkboxes — they become the sync-back source after implementation
- Implementation Steps must be specific enough that the Implement stage needs no clarification
- The Deviation Log is append-only during Build and read by `haily-project-manager` during Ship sync; it is written live, never reconstructed from memory at the end
