---
name: quality-verification
description: Verification gate — run the full verification command and read its output before making any completion, success, or fix claim. Evidence before assertions, always.
---

# Verification Gate

> **Iron Law:** Claiming work is complete without verification is not efficiency — it is a false statement. A review finding marked "fixed" that has not been verified is misinformation. Run the command. Read the output. Then claim.

Run the verification command before claiming work is done, fixed, or passing. Evidence before assertions.

## The Gate

```
Before any completion or success claim:

1. IDENTIFY — what command proves this claim?
2. RUN — execute it fully (not partial, not cached, not from memory)
3. READ — full output, check exit code, count failures explicitly
4. VERIFY — does output confirm the claim?
   - If NO: state actual status with evidence ("Tests: 3 failures — [list]")
   - If YES: state claim WITH evidence cited ("Tests: 34/34 pass — npm test output")
5. ONLY THEN — make the claim
```

Skipping any step produces an unsupported claim. Unsupported claims block the review from closing.

## Common Verification Requirements

| Claim | Requires | Not sufficient |
|-------|----------|----------------|
| Tests pass | Test command output: 0 failures, exit 0 | Previous run, "should pass", partial run |
| Linter clean | Linter output: 0 errors | Partial check, extrapolation, "looks clean" |
| Build succeeds | Build command: exit 0, no warnings-as-errors | Linter passing, "compiles in my head" |
| Bug fixed | Original symptom reproduced and now passes | Code changed, assumed fixed |
| Regression test works | Red-green cycle verified (fail → fix → pass) | Test passes once after fix only |
| Agent completed | VCS diff shows changes exist | Agent reports success |
| Requirements met | Line-by-line checklist against spec | Tests passing (tests ≠ requirements) |
| Finding resolved | Re-run original failing check after fix | Explanation of why it should be fixed |

## Rationalization Prevention

These thoughts signal a verification shortcut. Stop. Run the command.

| Rationalization | Reality |
|----------------|---------|
| "I can see the fix is correct" | Correct-looking code can have typos, scope issues, wrong variable |
| "The test for this passed last time" | State changes; run it now |
| "The agent said it passed" | Agents hallucinate success; check the diff |
| "Linter passed, build must be fine" | Linter ≠ compiler; run both |
| "It's a trivial change, no need to verify" | Trivial changes cause production outages; run it |
| "I'm in a hurry" | A wrong verification costs more time than running the command |

## Key Patterns

**Tests:**
```
✅ [Run test command] → [See: 34/34 pass, 0 failures] → cite output → "All tests pass"
❌ "Should pass now" / "Looks correct" / "Passed earlier"
```

**Regression tests (Red-Green-Refactor):**
```
✅ Write test → Run (RED: must fail) → Apply fix → Run (GREEN: must pass)
❌ "I've written a regression test" without completing both red and green runs
```

**Build:**
```
✅ [Run build command] → [See: exit 0, no errors] → "Build passes"
❌ "Linter passed" — linter does not check compilation
❌ "Type-check passed" — may not catch runtime errors caught by build
```

**Requirements:**
```
✅ Re-read spec/plan → create checklist → verify each line → list gaps explicitly
❌ "Tests pass, phase complete" — tests encode what was written, not necessarily what was required
```

**Agent delegation:**
```
✅ Agent reports success → git diff → count changed files → read key changes → report actual state
❌ Pass through agent's self-report without independent verification
```

**Review findings marked "fixed":**
```
✅ Re-run the check that surfaced the finding → confirm it no longer triggers → cite run output
❌ "I've addressed the finding" without re-running the check
```
