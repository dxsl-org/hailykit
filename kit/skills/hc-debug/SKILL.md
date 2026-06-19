---
name: hc-debug
description: "Root-cause analysis skill for bugs, test failures, CI/CD failures, performance regressions, and unexpected system behavior. Routes to 10 specialist techniques (systematic debugging, root-cause tracing, defense-in-depth, verification, investigation methodology, log/CI analysis, performance diagnostics, reporting, task management, frontend verification). Core mandate: investigate before fixing."
when_to_use: "Invoke when investigating issues, diagnosing failures, or analyzing unexpected behavior."
user-invocable: true
argument-hint: "[issue description] [--frontend] [--profile artifact] [--trace trace-id]"
metadata:
  category: workflow
  keywords: [debug, investigation, root-cause, CI, performance, test-failure]
---

# Debug — Systematic Root Cause Analysis

Diagnoses bugs, test failures, CI/CD pipeline errors, and performance regressions through a structured technique framework. Each investigation is evidence-driven — root cause must be confirmed before any fix is authored. Auto-invoked by `{skill:hc-fix}` at its diagnose step; use standalone for investigations without an immediate fix commitment.

## Usage

```
{skill:hc-debug} [issue description] [--frontend] [--profile artifact] [--trace trace-id]
```

| Flag | Routes to |
|------|-----------|
| *(none)* | Symptom routing table — describe the symptom and the correct technique is selected |
| `--frontend` | Frontend Verification — visual regression, UI bugs, console errors, network issues |
| `--profile [artifact]` | Profiling Analysis — reads heap dump, flame graph, or CPU profile to identify bottleneck |
| `--trace [trace-id\|symptom]` | Distributed Debugging — correlates logs across services, identifies fault domain |

```
{skill:hc-debug} "login endpoint returns 500 intermittently"
{skill:hc-debug} "checkout page slow on mobile"
{skill:hc-debug} "button hover state looks wrong in Safari" --frontend
{skill:hc-debug} --profile heap-dump.json
{skill:hc-debug} --profile flamegraph.svg
{skill:hc-debug} --trace abc123def456          # correlate by trace ID
{skill:hc-debug} --trace "payment timeout after auth" --trace-services "api,auth,payment"
```

## Constraints

> **Required — no fixes without root cause:** Write zero fix code until the exact cause is identified and documented. Guessing and patching wastes cycles and leaves the real defect in place. Every fix must be traceable to a specific, confirmed cause.

## Technique Routing

Select the row that best matches the presenting symptom. Load the reference file — it contains the complete technique including steps, tools, and decision points.

| Symptom | Technique | Reference |
|---------|-----------|-----------|
| Unknown bug, no clear entry point | Systematic Debugging | `references/systematic-debugging.md` |
| Error traced to a specific call stack | Root Cause Tracing | `references/root-cause-tracing.md` |
| Root cause found, validating fix layers | Defense in Depth | `references/defense-in-depth.md` |
| Claiming work is complete | Verification | `references/verification.md` |
| Multi-component failure or server incident | Investigation Methodology | `references/investigation-methodology.md` |
| CI/CD failure, deployment error, pipeline regression | Log & CI Analysis | `references/log-and-ci-analysis.md` |
| Slow queries, high latency, or resource exhaustion | Performance Diagnostics | `references/performance-diagnostics.md` |
| Need a formal diagnostic write-up | Reporting Standards | `references/reporting-standards.md` |
| Investigation spans 3+ components or steps | Task Management Debugging | `references/task-management-debugging.md` |
| Visual regression, UI bug, or frontend file touched | Frontend Verification | `references/frontend-verification.md` |
| Heap dump, flame graph, or CPU profile to analyze | Profiling Analysis | `references/workflow-profiling.md` |
| Failure spans multiple services; need trace correlation | Distributed Debugging | `references/workflow-distributed.md` |

## Process

1. Match the symptom to a routing table row.
2. Load the reference file — follow it completely, do not skim.
3. Work through all phases before writing any fix. Skipping phases to save time costs more time.
4. When the issue spans multiple techniques (e.g., a CI failure masking a performance regression), apply them in routing-table order: broader investigation before specialist analysis.
5. On confirmed root cause, write a one-paragraph cause statement before proceeding to `{skill:hc-fix}`.

## Red Flags

Stop and restart from systematic investigation if any of these thoughts occur:

- "It's probably X — let me just try changing that"
- "Quick patch for now, I'll look into the cause later"
- "Tests pass, we're done" (without reading the full output)
- "Seems fixed" stated without a reproduction test
- Three or more failed fix attempts with no change in diagnostic approach → **Oracle escalation:** spawn `haily-debugger` at `{model:thinking}` tier, carrying only confirmed evidence (not prior fix history). A fresh high-capacity perspective breaks the confirmation-bias loop. Do not retry the same approach a fourth time.
- Skipping a reference phase because the cause "looks obvious"

## Tools

- **Codebase:** `{skill:hc-scout}` to locate relevant files before starting investigation — first check `.agents/*/scout-report.md`; if one exists from the active plan, read it instead of re-scouting
- **Database:** `psql` for live query inspection and schema validation
- **CI/CD:** `gh` CLI for GitHub Actions log retrieval and pipeline introspection
- **Frontend:** Chrome DevTools MCP or Puppeteer scripts for console, network, and visual verification
- **Reasoning:** `{skill:hl-reasoning}` when the causal chain is non-obvious or spans multiple systems
- **LLM / Agent issues:** `{skill:hl-context-engineering}` — when the symptom involves context degradation, lost-in-middle hallucination, or multi-agent inconsistency

## Scripts

- `scripts/find-polluter.sh` — bisects a test suite to identify which test is polluting shared state and causing downstream failures; companion doc at `scripts/find-polluter.test.md`

## Output

Reports save to `.agents/debug/debug-YYMMDD-HHMM-{slug}.md`. Minimum contents: symptom, evidence collected, confirmed root cause, and fix recommendation. Use `references/reporting-standards.md` for structure.

## Workflow Position

**Follows:** `{skill:hc-scout}` — locate relevant files before investigating
**Precedes:** `{skill:hc-fix}` — fix only after root cause is confirmed
**Auto-invoked by:** `{skill:hc-fix}` at its diagnose step
**Related:** `{skill:hl-reasoning}`, `{skill:hl-brainstorm}`
