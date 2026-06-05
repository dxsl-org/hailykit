# Solution Design

Evaluate candidate approaches and select the one to plan. This stage produces the Scope Contract and drives phase structure.

## Approach Evaluation

For each candidate approach identified in Research, evaluate:

| Dimension | Questions |
|---|---|
| **Blast Radius** | Which modules, contracts, and tests are touched? Can the scope be contained? |
| **Reversibility** | Can this be rolled back if it fails? Is the migration path clean? |
| **Complexity** | Does this introduce new patterns, dependencies, or operational burden? |
| **Fit** | Does this follow the patterns already in the codebase? |
| **Security** | Does this touch auth, credentials, or public APIs? What new attack surface does it introduce? |
| **Performance** | Does this change query patterns, add network hops, or affect hot paths? |

Apply YAGNI/KISS/DRY (see `docs/engineering-standards.md`) — prefer the approach that solves the problem without adding unnecessary complexity.

## Selection

Pick one approach. Document:
- Why this approach over the alternatives
- What assumptions it makes (these become Scope Contract Boundaries)
- What existing code it reuses vs. what it adds new

## Scope Contract

Before writing phase files, capture three sections:

**Deliverables** — what the user will see when done (file paths, endpoints, UI screens)

**Boundaries** — acceptance criteria (input→output behaviors that must work) + what is explicitly excluded this round + invariants that must not change

**Blast Radius** — which existing modules get touched and which public contracts must hold. Be specific: list file paths and function/API names where known.

This Scope Contract drives phase structure: one phase per independently testable slice of the deliverables.

## Phase Structure

From the selected approach and Scope Contract, derive phases:

- Each phase delivers one independently testable slice
- Phases run sequentially unless the dependency graph shows they can parallelize
- Name phases by what they deliver, not by how ("Setup database schema" not "Phase 2")
- Estimate effort per phase; flag phases >1 day for sub-division

## Edge Cases and Failure Modes

For each phase, identify the top 2–3 failure scenarios:
- What happens if the external dependency is unavailable?
- What data inconsistency could result from a partial failure?
- What rollback path exists if this phase needs to be reverted?

Document these in the phase file's Risk Notes section.
