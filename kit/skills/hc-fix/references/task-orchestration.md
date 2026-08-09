# Task Orchestration

Use Claude Tasks when a fix has at least 3 meaningful steps, multiple agents, or independent issue trees. Quick fixes skip Tasks because tracking overhead exceeds their value.

`TaskCreate`, `TaskUpdate`, `TaskGet`, and `TaskList` are CLI-only. When unavailable, use `TodoWrite`; the fix workflow must remain functional. For hydration and cross-session sync-back, follow `../../hc-plan/references/task-management.md`.

Lifecycle: `pending -> in_progress -> completed`. Keep at most one Task `in_progress` per agent.

## Standard Workflow — 6 Phases

```text
scout + diagnose -> implement -> verify/prevent -> review -> finalize
```

Create the six Tasks up front. `implement` blocks on scout and diagnosis; every later phase blocks on its predecessor. Mark each Task in progress when claimed and complete immediately after its evidence exists.

## Deep Workflow — 9 Phases

```text
(1 scout || 2 diagnose || 3 research)
  -> 4 brainstorm -> 5 plan -> 6 implement
  -> 7 verify/prevent -> 8 review -> 9 finalize/docs
```

Steps 1, 2, and 3 run in parallel. Each later Task carries `addBlockedBy` for the preceding stage. Preserve this graph when a deep fix adds specialist work.

## Parallel Issues

For two or more independent issues, create one tree per issue:

```text
issue A: (scout || diagnose) -> fix -> verify --+
                                                  +-> integration verify
issue B: (scout || diagnose) -> fix -> verify --+
```

- Assign each tree a non-overlapping file or responsibility boundary.
- Use metadata `{ issue, step, phase, severity }` for filtering.
- Block the shared integration verification on every issue verification.
- Never let an agent claim work owned by another tree.

## Ownership And Failure Rules

- Assign an owner before parallel execution; list only `pending` Tasks with no blockers when selecting work.
- If a Task fails, keep it `in_progress`, record the blocker, and create a bounded remediation subtask.
- Do not mark a fix complete before its verification evidence exists.
- Do not batch status changes; update immediately so dependents unblock correctly.
- A blocked or incomplete Task prevents finalization.

## Minimal Task Shape

```text
TaskCreate(
  subject: "Implement authorization fix",
  activeForm: "Implementing authorization fix",
  description: "Apply the diagnosed fix and preserve the public contract",
  metadata: { issue: "A", step: 3, phase: "implement", severity: "high" },
  addBlockedBy: [scoutTask, diagnoseTask]
)
```
