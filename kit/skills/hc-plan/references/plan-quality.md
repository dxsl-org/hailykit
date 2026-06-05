# Plan Quality

Standards for what makes a good implementation plan.

## plan.md Frontmatter Schema

```yaml
---
title: "Feature Implementation Plan"
description: "One-sentence summary for preview"
status: pending         # pending | in-progress | completed
priority: P2            # P1 (critical path) | P2 (standard) | P3 (low)
effort: 4h              # sum of phase estimates
branch: feat/feature    # current git branch
tags: [frontend, api]   # category tags (see Tag Vocabulary below)
blockedBy: []           # plan slugs this depends on
blocks: []              # plan slugs this unblocks
created: 2026-06-01     # YYYY-MM-DD
---
```

**Auto-populate rules:**
- `title` — from task description
- `status` — always `pending` for new plans
- `branch` — from `git branch --show-current`
- `effort` — sum of phase effort estimates
- `created` — today's date
- `blockedBy`/`blocks` — from cross-plan dependency scan (empty `[]` if none)

## Tag Vocabulary

| Type | Values |
|---|---|
| Feature type | `feature`, `bugfix`, `refactor`, `docs`, `infra` |
| Domain | `frontend`, `backend`, `database`, `api`, `auth` |
| Scope | `critical`, `tech-debt`, `experimental` |

## Task Naming Conventions

**subject** (imperative): `<verb> <deliverable>`, under 60 chars
- "Setup database migrations", "Implement OAuth2 flow"

**activeForm** (continuous): `-ing` form of subject
- "Setting up database", "Implementing OAuth2"

**description**: 1–2 sentences with concrete deliverables, reference phase file path.

See `references/task-management.md` for full TaskCreate patterns.

## Phase File Quality

Each phase file must be:
- **Specific:** implementation steps concrete enough that a developer needs no clarification
- **Verifiable:** success criteria use checkboxes with pass/fail conditions
- **Scoped:** only addresses what this phase delivers — no speculation about future phases
- **Honest about risk:** Risk Notes names real unknowns, not generic disclaimers

## Plan Quality Checklist

Before handing off to `{skill:hc-cook}`:
- [ ] Every phase has at least one success criterion
- [ ] Blast radius documented (which existing modules get touched)
- [ ] No phase > 1 day of effort without sub-phase breakdown
- [ ] Dependencies are explicit (blockedBy fields match actual dependencies)
- [ ] Unresolved questions surfaced to user via `AskUserQuestion` before finalization
- [ ] plan.md is under 80 lines (index only, not specification)

## When to Ask vs When to Decide

**Ask user** when the decision:
- Changes the scope of the plan
- Picks between architecturally different approaches
- Involves a business or product tradeoff

**Decide autonomously** when:
- The decision is purely technical with one clearly better option
- Standard industry practice clearly applies
- The decision can be easily reversed in a later phase
