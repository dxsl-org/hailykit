# Iteration Protocol

One iteration of the Hill Climbing loop. Execute all stages in order.

---

## Before First Iteration (Setup)

1. Confirm git repo with clean working tree: `git status --porcelain` must return empty
2. Confirm HEAD is on a named branch (not detached)
3. Confirm Scope glob matches at least one file
4. Dry-run the `Measure` command — must exit 0 and print a number within 30 seconds
5. Dry-run the `Guard` command if configured — must exit 0
6. Record baseline score as run 0 in `.agents/reports/optimize-YYMMDD-HHMM.tsv`

Abort with a clear error message if any check fails.

---

## Stage 1: Review State

Read before every iteration — not optional even if "nothing changed".

```bash
git log --oneline -10              # what has been tried
git diff HEAD~1                    # detail of last change
cat .agents/reports/optimize-YYMMDD-HHMM.tsv           # full run history
```

Extract: which files/approaches yielded gains? Which were consistently rejected? Is the score trending, flat, or oscillating?

---

## Stage 2: Select Change

Pick **one** focused, atomic change. Atomicity rule: you must be able to describe the change in one sentence without the word "and". If you need "and", split into two iterations.

- Prefer high-leverage targets: low-coverage files, large bundle contributors, most violations
- Avoid repeating a rejected approach on the same file
- When stuck (4+ consecutive rejects in same area), pivot to a different file or strategy

---

## Stage 3: Apply

- Edit only files that match the `Scope` glob
- Never modify files in the `Guard` command's scope — Guard must stay independent
- Verify syntax after editing (run typecheck or equivalent linter)

---

## Stage 4: Commit

Commit **before** measuring. The commit is the rollback point — without it, a crashing `Measure` command leaves the working tree dirty.

```bash
git add <changed files>
git commit -m "optimize(run-N): <one-line description>"
```

---

## Stage 5: Measure

Run the `Measure` command. Extract the numeric result.

| Outcome | Action |
|---|---|
| Exit 0, number printed | Proceed |
| Exit 0, no number | Revert — fix `Measure` command before continuing |
| Exit non-zero | Revert — treat as rejected, log reason `measure-error` |
| Timeout (>30s) | Abort loop — surface to user |

---

## Stage 6: Guard (skip if no Guard configured)

Run `Guard` command after measuring.

- Exit 0: proceed to Stage 7
- Non-zero: revert, attempt one rework, then run Guard again
- If rework also fails Guard: log as `guard-fail`, proceed to Stage 7 as rejected

---

## Stage 7: Decide

**Accept if:** gain meets `Direction` + `Min-Gain` threshold AND Guard passed.
**Reject if:** gain below threshold, Guard failed, or Measure errored.

On **accept:** update running best score, reset consecutive-reject counter.

On **reject:**
```bash
git revert HEAD --no-edit     # preserves history — preferred
# only if revert has conflicts:
# git reset --hard HEAD~1
```
Increment consecutive-reject counter.

---

## Stage 8: Log

Append one row to `.agents/reports/optimize-YYMMDD-HHMM.tsv`:

```
run   timestamp           score   gain    accept  change
1     2026-06-01T10:00:00 84.2    +2.1    yes     add branch coverage to auth module
2     2026-06-01T10:01:30 83.9    -0.3    no      extract assertion helper
```

---

## Stage 9: Continue or Stop

Continue if: run count < `Iterations` AND consecutive rejects < 8.

| Consecutive rejects | Action |
|---|---|
| 4 | Analyze `.agents/reports/optimize-YYMMDD-HHMM.tsv` → shift strategy (different scope area or approach) |
| 8 | Stop — write findings summary, surface to user |

**Final output:**
```
Optimization complete: N runs, K accepted
Baseline → Best: X → Y (delta: +Z)
Accepted changes: [list]
Recommendation: [target met / diminishing returns / manual review needed]
```
