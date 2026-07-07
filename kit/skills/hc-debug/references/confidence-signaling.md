# Confidence Signaling

Before proposing a fix, classify the evidence collected so far into a confidence level. Never propose fix code at SUSPECTED confidence.

## Vocabulary

| Level | Meaning | Fix allowed? |
|-------|---------|-------------|
| **SUSPECTED** | One signal type observed; not reproducible; competing hypotheses not eliminated | No — emit hypothesis warning |
| **PROBABLE** | One reproducible test case; OR ≥2 independent signal types agreeing | Yes |
| **CONFIRMED** | Reproducible test case AND at least one competing hypothesis eliminated | Yes |

> Signal types must be *different types*, not the same tool run twice.

## Signal Types (ranked most to least reliable)

1. **Hermetic reproduction** — deterministic test that fails, isolated from environment. Highest reliability.
2. **Two-environment reproduction** — same failure in dev + staging, or two independent machines. Eliminates "works on my machine."
3. **Stack trace at failure point** — precise file + line; can mislead in async/framework-heavy code.
4. **Log correlation** — before/after event matching. Corroborating only; temporal proximity ≠ causation.
5. **Static analysis finding** — known-pattern detection. High false-positive rate. Corroborating, not primary.
6. **Fix eliminates symptom** — strong supporting signal but does not prove causality alone.

## Confidence Display Format

Emit this line at root cause proposal time:

```
Confidence: PROBABLE (2 signals: stack trace + log correlation)
```

Structure: `Confidence: [LEVEL] ([N] signals: [type, type, ...])`

## Gate Rule

```
SUSPECTED   → DO NOT proceed to hc-fix
              Output: "Confidence: SUSPECTED — [evidence so far].
                       This is a hypothesis, not a confirmed cause.
                       Next falsification step: [specific test or observation]."

PROBABLE    → Proceed to hc-fix
              Output: "Confidence: PROBABLE — [evidence].
                       Proposed fix: [fix].
                       Verify by: [reproduction step]."

CONFIRMED   → Proceed to hc-fix
              Output: "Confidence: CONFIRMED — [evidence].
                       Competing hypotheses eliminated: [list].
                       Proposed fix: [fix]."
```

## Decision Rules

- **1 signal type only** → SUSPECTED (even if that signal is very strong)
- **Reproducible test case** → minimum PROBABLE (one strong signal suffices)
- **≥2 independent signal types agreeing** → PROBABLE
- **Reproducible test + competing hypotheses eliminated** → CONFIRMED
- **Fix eliminates symptom, but no reproduction test** → PROBABLE (not CONFIRMED — correlation ≠ causation)

## Panel Consensus (--deep)

`--deep` replaces the single investigation stream with a capped hypothesis panel (`references/hypothesis-panel.md`). Panel convergence maps onto this ladder — it is not a new tier:

- **≥2 of the panel's independent streams converge on the same cause** → this is the "≥2 independent signal types agreeing" rule above, applied to streams instead of tool outputs → **PROBABLE**.
- **CONFIRMED keeps its existing bar** regardless of panel size or convergence: a reproducible test case AND at least one competing hypothesis eliminated. Convergence alone — without reproduction — never reaches CONFIRMED.
- **Streams diverge** (no cause gets ≥2 votes) → do not average or pick a majority-by-default; present the differential to the user instead of guessing.

## User Override

If the user explicitly says "just fix it," "I know the cause," or "skip investigation":
- Treat as PROBABLE minimum
- Note in report: `Confidence: PROBABLE (user assertion — not independently verified)`
- Do not block the user

## Report Header Format

Every debug report in `.agents/debug/debug-*.md` must include:

```
**Root Cause:** [one-sentence cause statement]
**Confidence:** SUSPECTED | PROBABLE | CONFIRMED ([N] signals: [list])
**Next Step:** hc-fix | further investigation ([what to do next])
```

## Examples

**SUSPECTED (do not propose fix):**
```
Confidence: SUSPECTED (1 signal: log shows UserService error at 14:32)
This is a hypothesis, not a confirmed cause.
Competing hypotheses not eliminated: database timeout, middleware auth failure.
Next falsification step: reproduce the error with a unit test isolating UserService.
```

**PROBABLE (proceed to fix):**
```
Confidence: PROBABLE (2 signals: stack trace points to auth.ts:45 + log correlation shows
every 500 error preceded by token expiry event)
Proposed fix: refresh token before expiry threshold.
Verify by: run integration test with token within 30s of expiry.
```

**CONFIRMED (proceed to fix):**
```
Confidence: CONFIRMED (2 signals: hermetic reproduction — test fails with expired token,
passes with fresh token + static analysis confirms no token refresh in auth flow)
Competing hypotheses eliminated: middleware caching (cache disabled in test env),
clock skew (both machines NTP-synced).
Proposed fix: add token refresh middleware before auth check.
```
