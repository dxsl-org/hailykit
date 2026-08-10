# Project documentation management

## Living docs

Keep these current in `./docs`: `project-roadmap.md`, `project-changelog.md`, `system-architecture.md`, `code-standards.md`.

## Update triggers

`haily-project-manager` updates the living docs when phase status changes, a major feature ships, a significant bug or security fix lands, scope/timeline changes, or an external dependency/breaking change appears. Protocol: read current state first, keep format/versioning consistent, then verify links, dates, and cross-references against the actual implementation state.

## Plans

Save plans under `.agents/` and never ship them. Layout:

```text
.agents/<plan-name>/
├── research/
├── reports/
├── plan.md
└── phase-NN-<slug>.md
```

Templates install to `.claude/templates/` from `kit/templates/`.

## Report retention

- Active plans under 30 days: keep all reports.
- Completed plans: archive `reports/` to `.agents/archive/YYYYMM/<plan-name>/`.
- Stale plans over 90 days with no activity: delete.
- More than 20 reports: consolidate older ones into `consolidated-summary.md`.

## Required plan files

- `plan.md`: generic, under 80 lines, one entry per phase with status/progress, links, and key dependencies.
- `phase-NN-<slug>.md`: must include Context Links, Overview, Key Insights, Requirements, Architecture, Related Code Files, Implementation Steps, Todo List, Success Criteria, Risk Assessment, Security Considerations, and Next Steps. These fields are mandatory because they lock scope, ownership, validation, and follow-up state into one reviewable artifact.
