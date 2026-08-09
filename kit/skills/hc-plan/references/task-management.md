# Task Management Integration

Plan files are persistent and remain the source of truth. Claude Tasks are session-scoped coordination state; `~/.claude/tasks/` stores locks, not task data.

`TaskCreate` / `TaskUpdate` / `TaskGet` / `TaskList` are CLI-only. When unavailable, use `TodoWrite`; planning and execution must still work.

## Hydration Rule

Hydrate Tasks after writing a plan with at least 3 phases or a meaningful dependency graph. Skip hydration for 1–2 trivial phases because coordination overhead exceeds its value.

```
plan checkboxes --hydrate--> session Tasks --work--> Task status
       ^                                             |
       +---------------- sync-back -----------------+
```

- Hydrate one Task per unchecked phase; add critical step Tasks only when independent tracking or risk warrants it.
- Treat checked `[x]` items as complete when resuming.
- Track live work as `pending -> in_progress -> completed`.
- Sync completed Tasks back to phase checkboxes and plan status before finalization.

## Task Contract

Each phase Task carries:

- `subject`: imperative deliverable, under 60 characters.
- `activeForm`: present-continuous form of the subject.
- `description`: concrete output plus its phase-file pointer.
- required metadata: `phase`, `priority`, `effort`, `planDir`, `phaseFile`.
- optional metadata: `step`, `critical`, `riskLevel`, `dependencies`.

```text
TaskCreate(
  subject: "Implement OAuth2 flow",
  activeForm: "Implementing OAuth2 flow",
  description: "Implement refresh and recovery; see phase-03-api.md",
  metadata: { phase: 3, priority: "P1", effort: "2h",
              planDir: ".agents/260205-auth/", phaseFile: "phase-03-api.md" },
  addBlockedBy: ["phase-2-task-id"]
)
```

Use `addBlockedBy` when the new Task depends on known predecessors. Use `addBlocks` only when creating the predecessor before its dependents. Reject dependency cycles.

## Cook Handoff

Same session:

1. Planning hydrates Tasks.
2. Cook reuses existing Tasks and begins with the first unblocked phase.

New session:

1. Cook reads the plan because prior Tasks no longer exist.
2. Cook hydrates unchecked phases and skips checked phases.

Sync-back:

1. Mark completed session Tasks.
2. `haily-project-manager` reconciles every phase file by `phase` and `phaseFile` metadata.
3. Backfill completed `[ ] -> [x]` items across all phases, then derive `plan.md` status from the files.
4. Report unresolved mappings before claiming completion.

## Validation

- Task count matches the unchecked phases plus justified critical steps.
- Every hydrated phase has required metadata and a phase-file target.
- The dependency graph is acyclic and exposes at least one unblocked Task.
- Output: `✓ Hydrated [N] phase tasks + [M] critical step tasks with dependency chain`.
