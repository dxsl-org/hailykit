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

## --deep: Judge Panel

Under `--deep` (or `haily.json` `deep.auto`), Solution Design runs a judge panel instead of a single pass. This is separate from Red Team: the panel generates and evaluates *approaches* before the plan is written; Red Team attacks the *written plan* after. Both run under `--deep` — neither replaces the other.

### Spawn

Spawn two `haily-planner` agents in parallel, each given the same Research findings and Codebase Analysis facts but a distinct lens:

| Lens | Optimizes for | Weighs heaviest |
|---|---|---|
| **Risk-first** | Blast Radius, Reversibility | Failure modes, rollback path, what breaks if this is wrong |
| **Simplicity-first** | Complexity, Fit | KISS/YAGNI, smallest diff, lowest operational load |

Each agent independently designs one full approach and scores it against all six dimensions from Approach Evaluation above (Blast Radius, Reversibility, Complexity, Fit, Security, Performance) — not just its own lens's dimensions.

### Judge Synthesis

Spawn `haily-judge` with both scored approaches, their evidence, and the six-dimension rubric as the decision package. If the ultra spawn is unavailable or errors, fall back to the session model in the main loop with the notice `⚠ apex judge unavailable — verdict by session model` (best-effort: a skill cannot deterministically detect Task-spawn failure). Either way, the judge pass:

- Re-scores both against the same six dimensions independently of the authors' self-scores
- Selects the higher-scoring approach as the base
- Grafts any element from the losing approach that scores strictly better on an individual dimension without raising the base approach's Complexity or Blast Radius
- **Tie-break:** if the two approaches score equal overall, simplicity-first wins (KISS)

Document the synthesis decision in the plan's Solution Design section: which approach won, on what dimensions it led, and what (if anything) was grafted from the loser.

### Cost

3–5× the baseline Solution Design token cost (two full approach designs + one judge pass vs. one design). This is the standard `--deep` multiplier — see `docs/engineering-standards.md` → Depth Tiers. Do not run the panel outside `--deep`/`deep.auto`.

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
