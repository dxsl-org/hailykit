# Review Task Pipeline

Use Claude Tasks to expose review dependencies and parallel work. Tasks coordinate a session; they do not replace review artifacts or findings.

## Activation

- Skip task creation for a single-file review with fewer than 3 meaningful steps.
- Create Tasks for multi-file reviews, parallel reviewers, or a fix/re-verify cycle.
- If `TaskCreate` fails, continue sequentially; task tracking is not a correctness dependency.

## Dependency Graph

The canonical graph is:

```text
scout -> (review || adversarial) -> fix -> verify
```

- Omit `scout` when the Scout ladder already resolved without a spawn.
- `review` and `adversarial` start together and never block each other.
- `fix` blocks on both review branches.
- Create `fix` only when actionable findings exist.
- `verify` blocks on the applied fix, or directly on both reviews when no fix is needed.

## Task Contract

Every Task carries `reviewStage`, `priority`, and a concrete subject. Add evidence pointers needed by that stage:

| Stage | Required metadata or description context |
|---|---|
| scout | feature, changed files, relevant boundaries |
| review | feature, `baseSha`, `headSha`, plan/spec reference |
| adversarial | feature, target risks, adversarial reference |
| fix | severity, issue count, cited findings |
| verify | commands or acceptance evidence to run |

Example dependency registration:

```text
review = TaskCreate(metadata={ reviewStage: "review", baseSha, headSha }, addBlockedBy=[scout])
adversarial = TaskCreate(metadata={ reviewStage: "adversarial" }, addBlockedBy=[scout])
fix = TaskCreate(metadata={ reviewStage: "fix" }, addBlockedBy=[review, adversarial])
verify = TaskCreate(metadata={ reviewStage: "verify" }, addBlockedBy=[fix])
```

Lifecycle: `pending -> in_progress -> completed`. Complete a review Task only after its findings or verdict exists; complete verification only after commands have run.

## Parallel Scopes

For independent scopes, create one review Task per ownership boundary with no dependency between them. A shared fix Task blocks on every scoped review:

```text
backend-review --+
                 +--> shared-fix --> verify
frontend-review -+
```

Never assign overlapping files to parallel fix owners.

## Re-review

When fixes alter reviewed behavior, create a new review Task blocked by the fix and set `cycle: 2` (then `3`). Stop after 3 cycles and escalate unresolved Critical or Important findings.

## Integration Rules

1. Cook completes implementation before starting review Tasks.
2. Run `review` and `adversarial` in parallel when both are required.
3. Apply and verify all blocking findings.
4. Mark the implementation phase reviewed only after verification completes.

Output: `Registered [N] review tasks (scout -> review || adversarial -> fix -> verify)`.
