# Batch Review Flow

Invoked when `--batch <targets>` is present. Replaces the single-target process with a loop, then aggregates results into a Team Health Report.

## § Parse

Split the `--batch` argument on commas; trim whitespace from each token. Detect type of each target:

| Pattern | Detected type |
|---------|--------------|
| `#123` or bare integer | PR number |
| `7+ hex characters` (e.g. `abc1234f`) | Commit hash |
| `--pending` within batch list | Pending changes |

If a token does not match any pattern, log `⚠ Batch: unrecognized target "[token]" — skipping` and continue.

## § Per-Target Loop

Execute sequentially. For each target `[i/N]`:

1. Log `▶ Batch [i/N]: reviewing <target>…`
2. Run the full Route → Scout → Review Circuit process for this target (same as single-target mode).
   - **Scout reuse across targets:** before running the Scout ladder, check whether an earlier target's scout findings already cover this target's changed modules. If so, reuse them — log `✓ Scout: reused from target [j]`. Scout spawns at most once per distinct module cluster in the batch, not once per target.
   - Compose with `--quick` if passed: skip Scout + Stage 1 + Stage 3 on all targets.
   - Compose with `--comment` if passed: post inline comments for this target after its Act step.
3. Collect result object:
   ```
   {
     target: "<ref>",
     verdict: "PASS" | "PASS WITH NOTES" | "REVIEW REQUIRED",
     critical: <count>,
     medium: <count>,
     low: <count>,
     findings: [{ severity, title, location }]
   }
   ```
4. If target is inaccessible (PR not found, commit missing, permission denied):
   - Log `⚠ Batch [i/N]: <target> — skipped (<reason>)`
   - Push `{ target, verdict: "SKIPPED", reason }` to results
   - Continue to next target without aborting the batch

5. Log `✓ Batch [i/N]: <target> — <verdict> (<critical> critical, <medium> medium, <low> low)`

## § Cross-Pattern Detection

After all targets complete, scan the collected findings for cross-PR patterns:

- Group findings by normalized title (lowercase, strip file paths and line numbers).
- A pattern fires if the same normalized title appears in **≥ 2 distinct targets**.
- For each pattern, record: normalized title, affected targets, count.

## § Report Format

Generate a markdown Team Health Report. Save to `.agents/reports/batch-review-<YYMMDD-HHMM>.md`.

```markdown
# Team Health Report
**Targets:** <comma-separated list> (<N> total)
**Date:** <YYYY-MM-DD>
**Mode:** full | quick

## Finding Summary

| Severity | Total | Targets Affected |
|----------|-------|-----------------|
| Critical | N | #123, #456 |
| Medium | N | #123 (3×), #456 (2×) |
| Low | N | — |
| Skipped | N | — |

## Cross-PR Patterns
<!-- Only populated when the same finding type appears in 2+ targets -->
<!-- Omit section entirely if no cross-PR patterns found -->
- **<normalized finding title>** — <targets> (<M/N> targets). Recommend: <actionable suggestion>.

## Per-Target Results

### <target> — <verdict>
- 🔴 Critical: <title> (`<file>:<line>`)
- 🟡 Medium: <title> (× N)
- 🟢 Low: <title>
<!-- Omit severity rows with 0 findings -->
```

**Verdict rules:**

| Condition | Verdict |
|-----------|---------|
| 0 critical, 0 medium | PASS |
| 0 critical, medium > 0 | PASS WITH NOTES |
| critical > 0 | REVIEW REQUIRED |
| inaccessible | SKIPPED |

## § Error Handling

- A single target failure (PR not found, auth error, empty diff) does not abort the batch.
- Log the skip and continue.
- In the Team Health Report, list skipped targets under "Skipped" in the Finding Summary table with their skip reason in parentheses.
- If ALL targets are skipped, exit with: `✗ Batch: all targets skipped — no report generated`.
