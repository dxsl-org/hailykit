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
---

# Phase <N>: <Name>

## Overview

<1–2 sentences: what this phase delivers and why it is its own phase.>

## Requirements

- Functional: <what the code must do>
- Non-functional: <performance, security, compatibility constraints>

## Architecture

<Component design, data flow, key decisions. Include a brief diagram in text or Mermaid if helpful.>

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
```

## Conventions

- Phase numbers start at 01 and are zero-padded: `phase-01-setup.md`, `phase-02-api.md`
- Title in filename uses kebab-case: `phase-03-auth-middleware.md`
- `dependencies: [1, 2]` means this phase cannot start until phases 1 and 2 are completed
- Success Criteria items use checkboxes — they become the sync-back source after implementation
- Implementation Steps must be specific enough that the Implement stage needs no clarification
