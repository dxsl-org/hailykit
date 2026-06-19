# Plan Structure

## Directory Layout

Plans are created in `.agents/[YYMMDD]-[HHMM]-[slug]/` using the naming pattern from the `## Naming` section injected by hooks.

```
.agents/260601-1000-auth-feature/
├── research/
│   ├── haily-researcher-01-report.md
│   └── haily-researcher-02-report.md
├── reports/
│   └── scout-report.md
├── plan.md                         ← overview, phase table, dependencies
├── phase-01-setup.md
├── phase-02-database.md
├── phase-03-api-endpoints.md
└── phase-04-tests.md
```

## plan.md Structure

```markdown
---
title: "Feature Implementation Plan"
description: "One-sentence summary of what this plan delivers"
status: pending       # pending | in-progress | completed
priority: P2          # P1 | P2 | P3
effort: 8h
branch: feat/auth-feature
tags: [auth, backend]
blockedBy: []         # plan slugs this depends on (same scope)
blocks: []            # plan slugs this unblocks (same scope)
created: 2026-06-01
---

# Feature Implementation Plan

## Overview

Brief description of what this plan accomplishes and why.

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Setup Environment](./phase-01-setup.md) | pending |
| 2 | [Core Implementation](./phase-02-core.md) | pending |
| 3 | [Tests](./phase-03-tests.md) | pending |

## Dependencies

- List cross-plan dependencies with justification
```

**Link text must be human-readable names, not filenames.**
Keep plan.md under 80 lines — it is an index, not a specification.

## Phase File Structure

See `references/phase-template.md` for the full template. Key sections:
```
phase, title, status, priority, effort, dependencies, tier
---
Overview · Requirements · Architecture
Related Files · Implementation Steps · Success Criteria · Risk Notes
```

**`tier` field** — model tier hint for this phase. Auto-classified by hc-plan; passed to hc-cook by hc-goal for cost routing:
- `fast` — mechanical work: renames, boilerplate, docs, config edits
- `medium` — standard logic: CRUD, integration, refactors (default)
- `thinking` — complex reasoning: architecture decisions, security, schema design, novel algorithms

Absent `tier` field: behaves as `medium` (backward compatible).

## Cross-Plan References

- Bare slug: `260301-1200-auth-system` → same scope as current plan
- `global:260301-1200-auth-system` → global plans root
- `project:260301-1200-auth-system` → project plans root

Missing references warn and show `not found` — they do not block plan creation.

## --deep and --tdd Extensions

**`--deep`:** Add to each phase file:
- File inventory table (file, action, estimated size, test impact)
- Test scenario matrix (critical, high, medium paths)
- Phase dependency map calling out cross-phase links

**`--tdd`:** Add to each phase file:
- **Tests Before** — regression stubs written before any code changes
- **Refactor** — protected implementation changes
- **Tests After** — new behavior tests
- Regression gate: compile+test command that must pass before proceeding
