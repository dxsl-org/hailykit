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

Analyze sequentially while exposing assumptions, revisions, alternatives, and checks.

## Usage

```
{skill:hl-reasoning} [problem to analyze]

{skill:hl-reasoning} "why did auth latency regress after the refactor?"
{skill:hl-reasoning} "design multi-tenant data isolation"
{skill:hl-reasoning} "cache invalidation fails under concurrent writes"
```

Use for unclear causal chains, adaptive plans, hidden constraints, or changing scope.

## Constraints

> **Required — actionable completion:** Emit `[FINAL]` only when the conclusion is actionable and critical aspects are covered. State non-blocking uncertainty instead of waiting to eliminate it.

## Process

1. **Estimate** — start `Thought 1/5: [analysis]`; adjust the total as complexity changes.
2. **Advance** — address one aspect, build on context, state uncertainty, name the next question.
3. **Revise** — mark `[REVISION of Thought N]`; state original claim, reason, and impact.
4. **Branch** — mark `[BRANCH A from Thought N]`; compare and converge with rationale.
5. **Verify** — pair `[HYPOTHESIS]` with `[VERIFICATION]`; iterate when the check fails.
6. **Conclude** — emit `Thought N/N [FINAL]: [conclusion, confidence, remaining assumptions]`.

Show markers for requested step-by-step output or complex work; otherwise reason internally.

When stuck, load `references/process-when-stuck.md`. It routes symptoms to simplification, inversion, collision-zone thinking, scale testing, and meta-pattern recognition.

Optional deterministic tracking:

- `scripts/process-thought.js` — validate and persist thought history
- `scripts/format-thought.js` — render box, Markdown, or simple output

## Workflow Position

**Follows:** `{skill:hc-scout}` — observed context grounds the analysis
**Precedes:** `{skill:hc-plan}` or `{skill:hc-cook}` — once an approach is decided
**Used alongside:** `{skill:hc-debug}` — causal diagnosis; `{skill:hl-brainstorm}` — compare viable solutions
**Auto-invoked by:** `{skill:hc-fix}` and `{skill:hc-debug}` when the causal chain is non-obvious

## References

| File | Content |
|------|---------|
| `references/reasoning-primitives.md` | Core checks |
| `references/process-core.md` | Revision, branching |
| `references/process-advanced-techniques.md` | Refinement, verification |
| `references/process-advanced-strategies.md` | Uncertainty, meta-thinking |
| `references/process-when-stuck.md` | Stuck routing |
| `references/process-collision-zone.md` | Collision zone |
| `references/process-inversion.md` | Inversion |
| `references/process-meta-patterns.md` | Meta-patterns |
| `references/process-scale.md` | Scale testing |
| `references/process-simplification.md` | Simplification |
| `references/example-api.md` | API example |
| `references/example-debug.md` | Debug example |
| `references/example-architecture.md` | Architecture example |
| `references/attribution.md` | Attribution |
