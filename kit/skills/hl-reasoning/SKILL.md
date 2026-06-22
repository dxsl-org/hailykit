---
name: hl-reasoning
description: "Structured sequential analysis with dynamic thought-count adjustment, hypothesis testing, branching, and revision. Use for complex decomposition, debugging causal chains, adaptive planning, or any problem where scope is unclear or emerging."
when_to_use: "Invoke when step-by-step sequential reasoning or hypothesis revision is needed."
user-invocable: true
argument-hint: "[problem to analyze]"
metadata:
  category: thinking
  keywords: [systematic reasoning, sequential thinking, step-by-step, analysis, problem-solving, stuck, simplify, inversion]
---

# Reasoning — Structured Sequential Analysis

Sequential analysis with dynamic adjustment and targeted problem-solving techniques. Each thought builds on the previous, states its assumptions, and signals what the next thought should address.

## Usage

```
{skill:hl-reasoning} [problem to analyze]
```

```
{skill:hl-reasoning} "why is the auth middleware slowing down after the refactor?"
{skill:hl-reasoning} "how should we design the multi-tenant data isolation layer?"
{skill:hl-reasoning} "the cache invalidation logic isn't working under concurrent writes"
```

Apply when: complex decomposition, adaptive planning needing revision, hypothesis-driven debugging, unclear or emerging scope, complexity spiraling, recurring patterns, assumption constraints, or scale uncertainty.

## Constraints

> **Required — complete before claiming done:** Mark `[FINAL]` when the conclusion is actionable and all critical aspects are addressed. Remaining uncertainties are acceptable — state them explicitly so the next step can address them. Do not delay `[FINAL]` waiting to eliminate unknowns that don't block action.

## Core Process

### Start with a Loose Estimate

```
Thought 1/5: [Initial analysis]
```

Adjust the total dynamically as understanding evolves.

### Structure Each Thought

- Build on previous context explicitly
- Address one aspect per thought
- State assumptions, uncertainties, and realizations
- Signal what the next thought should address

### Dynamic Adjustment

- **Expand** — more complexity discovered → increase total
- **Contract** — simpler than expected → decrease total
- **Revise** — new insight invalidates previous → mark revision
- **Branch** — multiple approaches → explore alternatives

### Revision

```
Thought 5/8 [REVISION of Thought 2]: [Corrected understanding]
- Original: [What was stated]
- Why revised: [New insight]
- Impact: [What changes]
```

### Branching

```
Thought 4/7 [BRANCH A from Thought 2]: [Approach A]
Thought 4/7 [BRANCH B from Thought 2]: [Approach B]
```

Compare explicitly; converge with decision rationale.

### Hypothesis and Verification

```
Thought 6/9 [HYPOTHESIS]: [Proposed solution]
Thought 7/9 [VERIFICATION]: [Test results]
```

Iterate until verified.

### Completion

```
Thought N/N [FINAL]: [Conclusion with confidence and remaining assumptions]
```

## Application Modes

**Explicit** — use visible thought markers when complexity warrants it or the user requests a step-by-step breakdown.

**Implicit** — apply the methodology internally for routine problem-solving without cluttering the response.

## When Stuck

Load `references/process-when-stuck.md` — maps stuck symptoms to targeted techniques (simplification, inversion, collision-zone thinking, scale testing, meta-pattern recognition).

## Scripts (Optional)

For deterministic validation and tracking:
- `scripts/process-thought.js` — validate and track thoughts with history
- `scripts/format-thought.js` — format for display (box / markdown / simple)

Use when validation or persistence is needed; otherwise apply the methodology directly.

## When to Use vs Related Skills

| Situation | Skill |
|---|---|
| Problem space is unclear — causal chain has 3+ unknown variables | `{skill:hl-reasoning}` |
| Problem is clear — solution space has multiple viable paths | `{skill:hl-brainstorm}` |
| Symptom is known (error, test failure) — root cause is unknown | `{skill:hc-debug}` |
| Approach is decided — need execution | `{skill:hc-plan}` or `{skill:hc-cook}` |

## Session Model

Judgment agents (`haily-planner`, `haily-implementor`, `haily-reviewer`, `haily-brainstormer`, `haily-debugger`) inherit the session model — running on `{model:ultra}` passes that model to these agents automatically. Mechanical agents (`haily-tester`, `haily-git-manager`, `haily-stats`, etc.) are capped at their `model_max` tier and never escalate.

## Workflow Position

**Used alongside:** `{skill:hc-debug}` — structured diagnosis of complex bugs
**Used alongside:** `{skill:hl-brainstorm}` — deep problem analysis before proposing solutions
**Auto-invoked by:** `{skill:hc-fix}` and `{skill:hc-debug}` when causal chain is non-obvious
**Related:** `{skill:hl-brainstorm}`, `{skill:hc-debug}`

## References

Load when deeper understanding is needed:

| File | Content |
|------|---------|
| `references/process-core.md` | Revision and branching patterns |
| `references/process-advanced-techniques.md` | Spiral refinement, hypothesis testing, convergence |
| `references/process-advanced-strategies.md` | Uncertainty, revision cascades, meta-thinking |
| `references/process-when-stuck.md` | Stuck-type dispatch to targeted techniques |
| `references/process-collision-zone.md` | Forcing unrelated concepts together for breakthroughs |
| `references/process-inversion.md` | Flipping assumptions to reveal alternatives |
| `references/process-meta-patterns.md` | Spotting patterns across multiple domains |
| `references/process-scale.md` | Testing at extremes to expose fundamental truths |
| `references/process-simplification.md` | Finding insights that eliminate multiple components |
| `references/example-api.md` | API design worked example |
| `references/example-debug.md` | Performance debugging worked example |
| `references/example-architecture.md` | Architecture decision worked example |
| `references/attribution.md` | Source attribution for problem-solving techniques |
