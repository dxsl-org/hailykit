# Project Documentation Management

## Living Docs

Keep these current in `./docs`:

| File | Holds |
|------|-------|
| `project-roadmap.md` | phases, milestones, progress |
| `project-changelog.md` | significant changes, features, fixes |
| `system-architecture.md` | architecture + significant structural changes |
| `code-standards.md` | codebase structure + code standards |

## Update Triggers

The `haily-project-manager` agent MUST update the docs above when: a phase status changes (e.g. In Progress → Complete) · a major feature ships · a significant bug/security patch lands · timeline or scope shifts · an external dependency or breaking change occurs.

**Protocol:** read current state first → keep version + formatting consistent → verify links/dates/cross-refs after → confirm updates match actual implementation progress.

## Plans

Save plans in `.agents/` (gitignored — never ships). Folder name from the `## Naming` pattern injected by hooks, e.g. `.agents/251101-1505-auth-and-profile/`.

```
.agents/<plan-name>/
├── research/        # haily-researcher-XX-report.md
├── reports/         # scout, review, agent reports
├── plan.md          # overview access point
└── phase-NN-<slug>.md
```

**Templates:** ship with HailyKit, installed to `.claude/templates/` (source: `kit/templates/`).

### Report Retention

- Active plans (<30 days): keep all reports
- Completed plans: archive `reports/` → `.agents/archive/YYYYMM/<plan-name>/`
- Stale (>90 days, no active plan): delete
- >20 reports in one plan: consolidate older ones into `consolidated-summary.md`

`haily-project-manager` triggers archival when closing a plan.

### plan.md

Generic, <80 lines: each phase with status/progress, links to phase files, key dependencies.

### phase-NN-<slug>.md

Respect `coding.md`. Each phase file contains: **Context Links** · **Overview** (priority, status, description) · **Key Insights** (research findings, critical considerations) · **Requirements** (functional + non-functional) · **Architecture** (design, interactions, data flow) · **Related Code Files** (modify/create/delete) · **Implementation Steps** (numbered) · **Todo List** (checkboxes) · **Success Criteria** (done definition + validation) · **Risk Assessment** (issues + mitigation) · **Security Considerations** · **Next Steps** (dependencies, follow-ups).
