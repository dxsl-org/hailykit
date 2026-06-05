---
name: process-core
description: Core revision and branching patterns for sequential reasoning — assumption challenge, scope expansion, approach shift, trade-off evaluation, hypothesis testing, and adjustment guidelines.
---

# Core Reasoning Patterns

Essential patterns for revision and branching during sequential analysis.

## Revision Patterns

### Assumption Challenge
An early assumption proves invalid as new evidence arrives.
```
Thought 1/5: Assume X is the bottleneck
Thought 4/5 [REVISION of Thought 1]: X is adequate; Y is the actual bottleneck
```

### Scope Expansion
The problem is larger than initially understood.
```
Thought 1/4: Fix the bug
Thought 4/5 [REVISION of scope]: An architectural change is needed, not a patch
```

### Approach Shift
The initial strategy cannot meet the requirements.
```
Thought 2/6: Optimize the query
Thought 5/6 [REVISION of Thought 2]: Query optimization alone insufficient — a cache layer is also required
```

### Understanding Deepening
A later insight fundamentally changes the interpretation of the problem.
```
Thought 1/5: Feature is broken
Thought 4/5 [REVISION of Thought 1]: Not a bug — users are confused by the interaction design
```

## Branching Patterns

### Trade-off Evaluation
Compare approaches with different strengths and weaknesses.
```
Thought 3/7: Choose between X and Y
Thought 4/7 [BRANCH A]: X — simpler, less scalable
Thought 4/7 [BRANCH B]: Y — complex, scales better
Thought 5/7: Choose Y for long-term needs
```

### Risk Mitigation
Prepare a fallback for a high-risk primary approach.
```
Thought 2/6: Primary path: API integration
Thought 3/6 [BRANCH A]: API implementation details
Thought 3/6 [BRANCH B]: Fallback: webhook alternative
Thought 4/6: Implement A with B as contingency
```

### Parallel Exploration
Investigate independent concerns concurrently.
```
Thought 3/8: Two unknowns — DB schema and API design
Thought 4/8 [BRANCH DB]: Schema options
Thought 4/8 [BRANCH API]: API patterns
Thought 5/8: Integrate findings
```

### Hypothesis Testing
Test multiple candidate explanations systematically.
```
Thought 2/6: Could be A, B, or C
Thought 3/6 [BRANCH A]: Test A — not the cause
Thought 3/6 [BRANCH B]: Test B — confirmed
Thought 4/6: Root cause identified via Branch B
```

## Adjustment Guidelines

**Expand when:** more complexity is discovered, multiple aspects need addressing, verification is required, or alternatives warrant exploration.

**Contract when:** a key insight resolves the problem earlier than expected, the problem is simpler than assumed, or steps can be merged without losing clarity.

**Example of dynamic adjustment:**
```
Thought 1/5: Initial analysis
Thought 3/7: Complexity discovered (5 → 7)
Thought 5/8: Additional aspect identified (7 → 8)
Thought 8/8 [FINAL]: Complete
```

## Anti-Patterns

**Premature completion** — rushing to a conclusion before verification → add explicit verification thoughts before `[FINAL]`.

**Revision cascade without diagnosis** — repeated revisions without identifying why they keep happening → stop and identify the root misunderstanding.

**Branching explosion** — too many open branches → limit to 2–3 active branches; converge before opening more.

**Context loss** — ignoring insights from earlier thoughts → always reference prior thoughts explicitly when building on them.
