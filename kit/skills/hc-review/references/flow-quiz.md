# Comprehension Quiz (--quiz)

The final human checkpoint before commit, closing a three-stage arc: Precedent Mining surfaces blind spots at Recon, the Deviation Log records Decisions / Deviations / Surprises during Build, and the quiz verifies — before anything is committed — that the person committing holds a correct model of what the code now does. The quiz measures the one axis no machine stage covers: divergence between the developer's mental model and the code's actual behavior. Divergence in either direction is a defect — a comprehension gap in the developer, or an alignment gap in the code.

> **Required — quiz alignment, not requirements:** never ask what tests or the Stress Probe already prove (does it compile, do tests pass, is the claim true). Ask what the developer must be able to answer to own the commit: behavior at edges, why deviations happened, blast radius, revert paths.

> **Required — key-first:** compose the full answer key at question-generation time, before presenting any question, and grade strictly against it — never revise the key after seeing an answer. Do not print or write the key anywhere the developer can read until the gate resolves (PASS or ABORT); a visible key makes the gate meaningless.

## When it runs

- `--quiz` flag, or `.hl.json` has `quiz.auto: true`.
- Position: after every machine stage (Spec, Quality, Stress Probe, Simplification, Cross), immediately before Act — questions mine their findings.
- Recommended (suggest, never force) when the diff is mostly AI-authored (an `--auto` run), exceeds ~200 lines or 5 files, or touches auth/crypto/schema/public contracts. Small self-written diffs do not need a quiz.

## Question generation

Default 5 questions (3 for small diffs, 7 max). Sources, in priority order — every question must cite its source artifact in the key, and be answerable from the diff plus plan artifacts:

1. **Deviation Log entries** — the spots where implementation diverged from plan carry the highest blind-spot density: "Phase 2's log records switching to helper X — why, and how would you revert it?"
2. **Review findings** (any stage, including cross-model): "Stage 3 flagged a race in `enqueue()` — under what interleaving does it fire?"
3. **Scope Contract / acceptance criteria** — behavior at the boundary: "A request with an expired token hits the new endpoint — status code and side effects?"
4. **Blast radius** — "which existing callers observe the changed return shape of `resolveLeg`?"
5. **Edge and failure paths visible in the diff** — null/empty input, concurrency, timeout, partial failure.

No trivia: never ask names, line counts, or anything a glance at the file answers without understanding.

## Grading loop

Present all questions at once; the developer answers free-text. Grade each strictly against the pre-composed key:

- **Correct** → next question.
- **Wrong, code is right (comprehension gap)** → explain the misunderstood concept quoting the exact relevant code (`file:line`), then generate ONE new question targeting the same spot from a different angle. Re-ask. Loop until that spot passes; after 3 misses on the same spot, offer abort.
- **Developer's expectation matches the requirement but the code does not (alignment gap)** → this is a finding, not a miss. Record it, route to `{skill:hc-fix}` (or fix inline for a trivial case), then regenerate that question against the fixed code.

The gate passes only at 100%. Abort is always available. On ABORT, the commit decision stays with the developer — the gate never hard-blocks a human — but the report records the failed gate and recommends not committing.

## Resolution and report

At PASS or ABORT, append the full answer key and per-question grading to the report, then log:

```
✓ Quiz: [N] questions — [PASS|ABORT] after [R] rounds, [K] alignment findings
```

Report: `.agents/reports/quiz-<YYMMDD-HHMM>.md` — header (diff ref, trigger, question count), Questions (written at generation, no key), then at resolve: Answers & Grading, Answer Key (with per-question source citations), Outcome (rounds, alignment findings routed, comprehension gaps explained).
