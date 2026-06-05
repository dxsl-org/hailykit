---
name: flow-codebase
description: Full codebase scan workflow — research, parallel haily-reviewer agents, adversarial review, and improvement plan. Activated by `{skill:hc-review} codebase`.
---

# Codebase Scan Workflow

Full scan of the codebase: research context, parallel code review, adversarial pass, improvement plan.

## Workflow

### Research

Spawn 2 `haily-researcher` subagents in parallel to gather context:
- Codebase architecture and key modules
- Known issues, tech debt, recent refactors

Use `{skill:hc-scout}` to map the codebase: entry points, data flows, public contracts, security surfaces.

Keep each research report ≤ 150 lines.

### Code Review

Spawn multiple `haily-reviewer` subagents in parallel — one per major subsystem or concern area:
- Each reviewer receives: subsystem scope, relevant files, research context
- If issues found: surface to main agent; iterate until critical issues are resolved
- After quality review passes: run adversarial pass (`references/review-adversarial.md`) — always-on, no scope gate in codebase mode
- Report combined quality + adversarial findings

### Plan

Spawn `haily-planner` subagent to analyze all findings and produce an improvement plan:
- Save overview at `.agents/<timestamp>-codebase-review/plan.md`
- Save phase files as `phase-XX-<name>.md`

### Final Report

Summary structure:
```
## Codebase Review — [date]

### Findings Summary
- Critical: N (must fix)
- Major: N (fix before next release)
- Minor: N (track)
- Deferred: N (GitHub issues)

### Improvement Plan
→ .agents/<plan-dir>/plan.md

### Suggested Next Steps
[ordered by impact]
```

Ask user: "Commit improvement plan? [Y/n]" → spawn `haily-git-manager` if yes.
