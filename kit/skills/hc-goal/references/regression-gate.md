# Regression Gate — Baseline-Relative Completion Criterion

Replaces `zero-regress` (entire suite must be green) with **no-new-failures**: a phase passes its test gate if it introduces zero **new** failing test names compared to a baseline captured at Route.

This unblocks repos with pre-existing failures, flaky tests, or missing test runners — all conditions that made `zero-regress` impossible to satisfy in practice.

## Concept

Borrowed from the SWE-bench fail2pass/pass2pass methodology: snapshot per-test name+status before implementation → diff after on test-name identity. Exit-code comparison alone is insufficient: 3 pre-existing failures exit 1 before and after, silently masking 5 new failures.

## Runner Detection Table

Reuse `{skill:hc-test}` runner detection rather than re-implementing it. Format priority: CTRF > JUnit XML > machine JSON > exit-code.

| Language / runner | Preferred format | Capture command |
|---|---|---|
| Jest / Vitest | CTRF JSON | `npx jest --reporter @ctrf-io/jest-ctrf-json-reporter --outputFile current.json` |
| pytest | CTRF JSON | `pytest --ctrf current.json` |
| Go test | CTRF JSON | `go test ./... -json \| ctrf-go current.json` |
| Playwright | CTRF JSON | `playwright test --reporter @ctrf-io/playwright-ctrf-json-reporter` |
| Rust (cargo nextest) | JUnit XML | `cargo nextest run --profile ci --junit-output-file current.xml` |
| Flutter | machine JSON | `flutter test --machine > current.json` |
| Any (fallback) | exit-code text | `<test-command>; echo $? > current.txt` |

## File-Path Convention

All test result files use the plan directory and a consistent format-matched extension:

| Signal | Baseline file | Current file (per phase) |
|--------|--------------|--------------------------|
| CTRF JSON | `.agents/<plan-dir>/baseline-tests.json` | `.agents/<plan-dir>/current-tests.json` |
| JUnit XML | `.agents/<plan-dir>/baseline-tests.xml` | `.agents/<plan-dir>/current-tests.xml` |
| exit-code | `.agents/<plan-dir>/baseline-tests.txt` | `.agents/<plan-dir>/current-tests.txt` |

`diff-tests.sh` detects format from file content (not extension), so the extension is cosmetic — but the **exact path** must exist or `diff-tests.sh` exits 2 (file-not-found), which the gate treats as "omitted."

## Baseline Capture (Route Stage)

Before any implementation begins, run the test suite once and record the output to the appropriate baseline path:

```bash
# CTRF (preferred)
<test-command> --ctrf .agents/<plan-dir>/baseline-tests.json

# JUnit fallback
<test-command> --junit-xml .agents/<plan-dir>/baseline-tests.xml

# exit-code fallback
<test-command>; echo $? > .agents/<plan-dir>/baseline-tests.txt
```

Record the detected signal strength in the run ledger (`baseline_signal: ctrf|junit|exit-code|none`).

If no test runner is detected: log `no runner — gate omitted` in the ledger. The gate is skipped for that repo (never blocks a run due to missing infrastructure).

## Per-Phase Gate

After each phase implementation, before the commit: re-run the test suite and capture current results to the matching format path:

```bash
# Example (CTRF path):
<test-command> --ctrf .agents/<plan-dir>/current-tests.json
```

Then diff vs baseline:

```bash
kit/skills/hc-goal/scripts/diff-tests.sh \
  .agents/<plan-dir>/baseline-tests.json \
  .agents/<plan-dir>/current-tests.json
```

| Exit code | Meaning | Action |
|-----------|---------|--------|
| 0 | No new failures | Phase gate passes → advance |
| 1 | New failures listed by name | Phase gate fails → Retry Loop |
| 2 | Script error (missing files, etc.) | Log, treat as gate-omitted |

## Flaky Re-Run Rule

Before declaring a new failure: re-run the changed-status test once. If it flips back to passing, it is flaky — **do not** count it as a new failure. Log it as `flaky-noted` in the ledger row's residual risk.

## Completion Semantics

A phase is complete when any one of:

1. **No-new-failures:** gate script exits 0 (default; no new failing test names).
2. **Gate omitted:** no runner detected, or script error — logged, not blocking.
3. **`--strict` mode:** the entire suite must be green (restores old `zero-regress` behavior). Use `--strict` on greenfield repos or when no-new-failures proves insufficient.

`--strict` is the rollback escape hatch. Keep it for one release while `no-new-failures` proves out; remove once validated.

## Degraded-Signal Honesty

When running on exit-code fallback (no CTRF or JUnit available), log explicitly:

```
⚠️  test-signal: exit-code only — new-failure detection is best-effort.
    Pre-existing failures may mask regressions. Add a CTRF reporter for full coverage.
```

Always record which signal strength was used for each phase in the ledger row. Never claim "tests pass" when only exit-code degradation was checked.
