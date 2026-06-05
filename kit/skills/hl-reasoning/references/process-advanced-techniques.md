---
name: process-advanced-techniques
description: Advanced sequential reasoning techniques — spiral refinement, hypothesis-driven investigation, multi-branch convergence, progressive context deepening.
---

# Advanced Reasoning Techniques

Complex problem-solving patterns for multi-layered or iterative analysis.

## Spiral Refinement

Return to concepts with progressively deeper understanding. Each pass reveals constraints that require adjusting earlier conclusions.

```
Thought 1/7: Initial design (high level)
Thought 2/7: Discover constraint A
Thought 3/7: Refine design for A
Thought 4/7: Discover constraint B
Thought 5/7: Refine design for both A and B
Thought 6/7: Integration reveals an edge case
Thought 7/7 [FINAL]: Design addressing all discovered constraints
```

**Use for:** complex systems where constraints emerge iteratively.
**Key:** each return is a refinement, not a restart — prior work informs the update.

## Hypothesis-Driven Investigation

Generate a hypothesis, test it, refine based on results, and repeat until verified.

```
Thought 1/6: Observe symptoms
Thought 2/6 [HYPOTHESIS]: Explanation X
Thought 3/6 [VERIFICATION]: Test X — partial match
Thought 4/6 [REFINED HYPOTHESIS]: Adjusted explanation Y
Thought 5/6 [VERIFICATION]: Test Y — confirmed
Thought 6/6 [FINAL]: Solution based on verified Y
```

**Use for:** debugging, root cause analysis, diagnostics.
**Pattern:** generate → test → refine → re-test loop.

## Multi-Branch Convergence

Explore alternatives independently, then synthesize the best elements.

```
Thought 2/8: Multiple viable approaches
Thought 3/8 [BRANCH A]: Approach A — benefits
Thought 4/8 [BRANCH A]: Approach A — drawbacks
Thought 5/8 [BRANCH B]: Approach B — benefits
Thought 6/8 [BRANCH B]: Approach B — drawbacks
Thought 7/8 [CONVERGENCE]: Hybrid combining A's strengths with B's strengths
Thought 8/8 [FINAL]: Hybrid is superior to either branch alone
```

**Use for:** complex decisions where no single option clearly dominates.
**Key:** convergence often produces a better solution than either branch in isolation.

## Progressive Context Deepening

Build understanding in layers, moving from abstract to concrete before integrating.

```
Thought 1/9: High-level problem statement
Thought 2/9: Identify major components
Thought 3/9: Examine component A in detail
Thought 4/9: Examine component B in detail
Thought 5/9: Identify A–B interactions
Thought 6/9: Discover emergent constraint from interaction
Thought 7/9 [REVISION of 3–4]: Adjust both components for the interaction
Thought 8/9: Verify the integrated system
Thought 9/9 [FINAL]: Integrated solution
```

**Use for:** system design, architecture decisions, integration problems.
**Pattern:** abstract → components → details → interactions → integration.

## Related

See `process-advanced-strategies.md` for: Uncertainty Management, Revision Cascade Management, Meta-Thinking Calibration, Parallel Constraint Satisfaction.
