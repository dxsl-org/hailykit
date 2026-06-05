---
name: process-advanced-strategies
description: Advanced reasoning strategies — uncertainty management, revision cascade recovery, meta-thinking calibration, parallel constraint satisfaction.
---

# Advanced Reasoning Strategies

Sophisticated patterns for handling complex or problematic reasoning situations.

## Uncertainty Management

Handle incomplete information systematically without stalling analysis.

```
Thought 2/7: Need to decide X but data is incomplete
Thought 3/7: Two scenarios are plausible
Thought 4/7 [SCENARIO A — if P is true]: Analysis for A
Thought 4/7 [SCENARIO B — if P is false]: Analysis for B
Thought 5/7: Identify a decision that works for both scenarios
Thought 6/7: Or identify the minimum information needed to resolve the uncertainty
Thought 7/7 [FINAL]: Robust solution, or explicit statement of what needs clarification
```

**Strategies:**
- Find a solution that is robust to the uncertainty
- Identify the minimal information needed to resolve it
- Document all assumptions explicitly

## Revision Cascade Management

Handle a foundational revision that invalidates multiple subsequent thoughts.

```
Thought 1/8: Foundation assumption established
Thought 2/8: Built on Thought 1
Thought 3/8: Further built on Thought 2
Thought 4/8: Foundation assumption is invalid
Thought 5/8 [REVISION of Thought 1]: Corrected foundation
Thought 6/8 [REASSESSMENT]: Which of Thoughts 2–3 remain valid?
  - Thought 2: Partially valid; needs adjustment
  - Thought 3: Completely invalid
Thought 7/8: Rebuild from the corrected foundation in Thought 5
Thought 8/8 [FINAL]: Solution on a correct foundation
```

**Key:** after a major revision, explicitly assess the downstream impact before continuing.

## Meta-Thinking Calibration

Monitor and adjust the reasoning process itself when it is not making progress.

```
Thought 5/9: [Regular analytical thought]
Thought 6/9 [META]: Last three thoughts are circling without progress
  Diagnosis: Missing key information
  Adjustment: Research X before continuing
Thought 7/9: Research findings on X
Thought 8/9: Proceed with an informed decision
Thought 9/9 [FINAL]: [Resume productive path]
```

**Use when:** analysis is stuck, circling, or repeating without new insight.
**Action:** pause, diagnose why the pattern is unproductive, change strategy.

## Parallel Constraint Satisfaction

Satisfy multiple independent constraints by analyzing them separately, then finding the intersection.

```
Thought 2/10: Solution must satisfy constraints A, B, and C
Thought 3/10 [CONSTRAINT A]: Solutions satisfying A: {X, Y, Z}
Thought 4/10 [CONSTRAINT B]: Solutions satisfying B: {Y, Z, W}
Thought 5/10 [CONSTRAINT C]: Solutions satisfying C: {X, Z}
Thought 6/10 [INTERSECTION]: Z satisfies all three constraints
Thought 7/10: Verify Z is feasible
Thought 8/10 [BRANCH if infeasible]: Which constraint can be relaxed?
Thought 9/10: Decision on constraint relaxation if needed
Thought 10/10 [FINAL]: Optimal solution given constraints
```

**Use for:** optimization problems, multi-criteria decisions, design with hard requirements.
**Pattern:** analyze each constraint independently → find intersection → verify feasibility → relax constraints if needed.
