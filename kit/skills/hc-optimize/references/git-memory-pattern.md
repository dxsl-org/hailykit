# Git as Long-Term Memory

Git history is the optimization loop's only persistent memory across iterations. Read it every time at the start of each iteration — without exception.

---

## Required Reads — Every Iteration

Run at the start of Phase 1 (Review) before planning the next change:

```bash
git log --oneline -20                              # what changed and in what order
git diff HEAD~1                                    # exact diff of last iteration
cat .agents/reports/optimize-YYMMDD-HHMM.tsv     # metric trend + keep/discard record
```

Together these answer three questions:
1. **What worked?** — `accept=yes` rows with positive gain
2. **What failed?** — `accept=no` rows; note repeated file paths
3. **Where is the trend going?** — last 5 deltas: accelerating, flat, or reversing?

---

## Pattern Recognition

### Exploit Successful Patterns

- Same file category improved → try adjacent files in the same category
- Same technique (e.g. adding edge-case tests) → apply to untouched functions
- Large delta correlates with a specific module → prioritize that module next

### Avoid Failed Patterns

- File + technique pair that was already discarded → do not retry the same pair
- Zero-gain changes (refactors that don't move the metric) → skip unless required by guard
- Oscillating metric on a file (improves then regresses) → leave it, move elsewhere

### Detect Diminishing Returns

If the last 5 kept iterations all have `gain < Min-Gain * 2`, the low-hanging fruit is gone:
- Broaden scope to adjacent files not yet touched
- Switch technique entirely (structural → test-quality, or vice versa)
- Report plateau to user rather than grinding through remaining iterations

---

## Stuck Detection Integration

Track consecutive discards across iterations:

```bash
CONSEC_DISCARDS=0   # reset on accept, increment on discard

# After Phase 6 decision:
if accepted; then
  CONSEC_DISCARDS=0
else
  CONSEC_DISCARDS=$((CONSEC_DISCARDS + 1))
fi

# Thresholds (hc-optimize defaults):
[ $CONSEC_DISCARDS -ge 4 ]  && analyze_patterns_and_shift_strategy
[ $CONSEC_DISCARDS -ge 8 ]  && stop_loop_write_report
```

---

## Revert vs Reset

Always prefer `git revert`. Fall back to `git reset` only when revert produces a conflict.

| Command | Preserves history | Safe for pattern analysis | Use when |
|---------|------------------|--------------------------|----------|
| `git revert HEAD --no-edit` | Yes | Yes | Default discard path |
| `git reset --hard HEAD~1` | No | No | Revert conflicts only |

**Why history matters:** `git log --grep="optimize(run-"` relies on intact history. A reset destroys the record of what was tried and silently breaks pattern analysis for future iterations and for the final report.

---

## Commit Message Convention

```
optimize(run-N): <one-line description of the change>
```

Examples:
```
optimize(run-3): add null guard to parseToken in lexer.ts
optimize(run-7): split large test fixture into focused unit cases
optimize(run-12): remove unused lodash import reducing bundle 1.2kB
```

This convention enables targeted log queries:

```bash
# All optimization commits in this run
git log --oneline --grep="optimize(run-"

# Cross-reference with TSV to see which were kept vs discarded
git log --oneline --grep="optimize(run-" | head -20
```

Reverted commits remain in history with the standard revert message:
```
Revert "optimize(run-4): ..."
```

This is intentional — discards are part of the experiment record and inform the final report.
