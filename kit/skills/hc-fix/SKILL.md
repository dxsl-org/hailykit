---
name: hc-fix
description: "Root-cause-first bug resolution for any symptom: runtime errors, test failures, type errors, lint violations, CI failures, and dependency vulnerabilities. Auto-routes by input type. --quick for active production incidents (renamed from the old hotfix flag). --deep for architectural failures. deps for dependency audits and upgrades."
when_to_use: "Invoke when there is a concrete bug, error, CI failure, or dependency vulnerability to fix."
user-invocable: true
argument-hint: "[issue] [--auto] [--quick] [--deep] | deps [scope]"
metadata:
  category: workflow
  keywords: [bugfix, error, test-failure, CI, lint, debug]
---

# Fix — Root-Cause-First Bug Resolution

Find the root cause before writing a single line of fix. Symptom-level patches that pass the immediate error while hiding the real problem are worse than no fix — they delay the actual failure and corrupt the debugging trail.

## Usage

```
{skill:hc-fix} [issue description] [--auto] [--quick] [--deep]
{skill:hc-fix} deps [security | outdated | major <package>]
```

| Flag / Subcommand | Behavior |
|---|---|
| *(none)* | Interactive — pauses at each Checkpoint; asks before parallelizing |
| `--auto` | Autonomous — agent decides all trade-offs; auto-parallelizes; exits with report on Critical regressions |
| `--quick` *(renamed from the old `hotfix` flag)* | Emergency mode for **active production incidents** — triage → minimal fix → smoke test → direct push. Bypasses full suite and PR review; direct push requires incident confirmation first. See `references/workflow-quick.md`. |
| `--deep` | Diagnose runs the `{skill:hc-debug}` hypothesis panel instead of a single trace; Verify's review pass gets `{skill:hc-review}` `--deep` refuter votes on Critical findings. Orthogonal to the Complexity table below — composes with Simple/Moderate/Complex. |
| `deps` | Dependency audit and upgrade workflow — runs package manager audit, triages CVEs vs outdated, applies in risk-ordered batches. See `references/workflow-deps.md`. |

`--quick` and `--deep` are mutually exclusive — `--deep` wins if both are given, with a one-line notice that incident-speed mode was overridden.

```
{skill:hc-fix} "login returns 500 after deploy"
{skill:hc-fix} "login returns 500 after deploy" --quick    # active incident (renamed from hotfix)
{skill:hc-fix} "intermittent data corruption under load" --deep   # panel diagnosis + refuter review
{skill:hc-fix} deps                                        # full audit + triage
{skill:hc-fix} deps security                               # CVE patches only
{skill:hc-fix} deps major react                            # React major version bump
```

**Auto-routing for bug fixes** (both modes) — no explicit flag needed:
- Lint violations → simple path via `references/workflow-simple.md`
- TypeScript type errors → types path via `references/workflow-types.md`
- CI/CD failure → ci path via `references/workflow-ci.md`
- Test suite failure → test path via `references/workflow-test.md`
- Runtime/application error → full workflow via `references/workflow-standard.md`
- Dependency vulnerability → deps path via `references/workflow-deps.md`

## Constraints

> **Required — root cause before fix:** Do NOT propose or implement any fix before Steps 1 and 2 are complete. A hypothesis is not a root cause. The fix must be traceable to a specific line, contract violation, race condition, or missing check — not to a symptom. If 3 or more fix attempts fail, STOP and discuss the architecture with the user before trying again.

> **Required — scout first:** Scan the codebase before asking clarifying questions or forming hypotheses. Report project type, affected files, their callers/dependents, related tests, and the last 20 commits touching those files. State a 3–6 bullet context summary before any question.

> **Required — exact diagnosis:** All six items must be known before fixing: (1) exact symptom — verbatim error or failing assertion; (2) minimal reproduction steps; (3) expected vs. actual behavior; (4) root cause with `file:line` citation; (5) why now — what change or condition exposed it; (6) blast radius — every code path that depends on the broken behavior. If any item is vague, use `AskUserQuestion` to gather facts. Never guess.

> **Required — no side effects:** The fix is not done until verified. All tests in modified files and transitively-affected modules must pass. The original symptom must no longer reproduce against the exact pre-fix repro. No new lint, type, or build errors. Public API contracts unchanged — or the change is intentional and explicitly called out.

## Routing

Auto-routing selects the workflow reference from symptom type (see Usage). When ambiguous, default to `references/workflow-standard.md` and narrow after Diagnose.

## Process

1. **Scout** (mandatory) — activate `{skill:hc-scout}` or launch 2–3 parallel `Explore` subagents. Map affected files, direct callers, related tests, and recent commits. Read `./docs` if the project is unfamiliar. Log `✓ Scout: [N] files, [M] deps, [K] tests`

2. **Diagnose** (mandatory) — capture exact pre-fix state: error messages, stack traces, failing test output — this becomes the Verify baseline. Activate `{skill:hc-debug}` for systematic root-cause tracing. Form and test hypotheses against codebase evidence. If two or more hypotheses fail, activate `{skill:hl-reasoning}`. **Under `--deep`:** invoke `{skill:hc-debug} --deep` instead — its hypothesis panel replaces single-stream tracing (see `{skill:hc-debug}` `references/hypothesis-panel.md`; do not duplicate the protocol here). Produce a diagnosis report: confirmed root cause, evidence chain, affected scope. See `references/diagnosis-protocol.md`. Log `✓ Diagnose: Root cause: [summary], Scope: [N files]`

3. **Assess complexity** — classify and select workflow:

   | Level | Indicators | Workflow |
   |---|---|---|
   | Simple | Single file, clear error, lint/type | `references/workflow-simple.md` |
   | Moderate | Multi-file, investigation required | `references/workflow-standard.md` |
   | Complex | System-wide, architectural impact | `references/workflow-deep.md` |

   Complexity is auto-classified from symptom scope and is independent of the `--deep` flag — `--deep` changes Diagnose/Verify rigor at any complexity level; it does not select the Complex row by itself.

   **Parallel detection:** if 2+ issues are independent (no shared files, no dependency order), determine execution:
   - **Interactive:** `AskUserQuestion` — "Found [N] independent issues. Run in parallel?"
   - **`--auto`:** parallelize automatically via `haily-implementor` agents with file ownership boundaries.

   For Moderate+, create Claude Tasks upfront. See `references/task-orchestration.md`. Fall back to `TodoWrite` if Tasks unavailable. Log `✓ Assess: [level] — [workflow] selected`

4. **Fix** — implement per selected workflow. Fix the root cause, not the symptom. Keep changes minimal; follow existing patterns. Load `references/anti-rationalization.md` to avoid shortcut rationalizations. Log `✓ Fix: [N] files changed`

5. **Verify** (mandatory) — re-run the exact pre-fix repro and confirm the symptom no longer appears. Run all tests in modified and transitively-affected files. Walk the full blast radius. Add or update at least one regression test. Run typecheck, lint, and build in parallel. For Standard/Complex: spawn `haily-reviewer` subagent — address all Critical findings. **Under `--deep`:** every Critical finding also gets refuter votes per `{skill:hc-review}` `--deep` semantics (2–3 independent `haily-reviewer` refuters vote to survive or demote the finding) before it can block — vote thresholds live in `{skill:hc-review}`'s own reference, not restated here. Apply prevention measures (`references/prevention-gate.md`). Write workflow artifacts (`references/workflow-artifacts.md`). If Verify fails, loop back to Diagnose. After 3 failures, stop and discuss architecture. Log `✓ Verify: [N] tests pass, [M] guards added`

6. **Finalize** (mandatory) — report root cause, files changed, prevention measures. Spawn `haily-docs-writer` if fix warrants doc updates. Mark Claude Tasks completed. **Findings flywheel:** for every accepted Verify finding applied in this fix, append one line to `.agents/review-history.jsonl` and run the recurrence check — skip entirely when `.agents/` is absent (`{skill:hc-review}` `references/flywheel-distillation.md`, same line shape and checkpoint rules; `--auto` folds any distillation proposal into the final report instead of an interactive checkpoint).
   An approved distillation writes or updates the committed target's `playbook-id` anchor rather than a bare prose append (`references/flywheel-distillation.md` § Distillation ID).
   Ask user to commit via `haily-git-manager`. Run `{skill:hl-log}`. Log `✓ Finalize: [action taken]`

   **Dead-end ledger:** when this fix is abandoned or escalated to the user after exhausting attempts (root cause before fix constraint above; Verify step 5's 3-failure stop), append one line to `.agents/failure-history.jsonl` — a one-line index entry pointing at the incident report already written for this dead-end (`haily-reporter`, `.agents/incidents/`), never a duplicate of its root-cause paragraph (`{skill:hc-plan}` `references/codebase-analysis.md` § Failure History Ledger Shape).

## --deep Mode

Replaces single-stream Diagnose with `{skill:hc-debug}`'s hypothesis panel and adds refuter votes to Verify's Critical findings (see Process steps 2 and 5) — protocols live in those skills, not duplicated here. Recommended whenever the symptom touches a high-risk domain (canonical list: `{skill:hc-cook}` `references/agent-invocations.md` → Domain-Risk Review). No cross-model leg here — refuter votes stay internal to `haily-reviewer` subagents; `--deep` never sends anything externally on its own. Orthogonal to the Simple/Moderate/Complex complexity table: `--deep` raises rigor at whichever complexity level Assess selects. `--quick` and `--deep` are mutually exclusive — `--deep` wins if both are given, with a one-line notice ("`--quick` overridden: `--deep` requested, full rigor applied"). Composes with `--auto`. Auto-on via `haily.json` `deep.auto`; an explicit `--quick` on the invocation overrides the config default.

**Parity hint (upward):** on an `ultra`-tier session, `--deep` still spawns the panel and refuter votes when requested — the tier only adds an advisory note that the marginal gain over the default Diagnose/Verify pass is smaller. See `docs/engineering-standards.md` § Depth Tiers → Parity hint.

## Output

```
✓ Root cause: [file:line] — [1-line cause]
✓ Fix: [what changed and why]
✓ Tests: [N passed, M added]
```

Full stage trace:

```
✓ Scout: [N] files, [M] deps, [K] tests
✓ Diagnose: Root cause: [summary], Scope: [N files]
✓ Assess: [Complexity] — [workflow] selected
✓ Fix: [N] files changed
✓ Verify: [N] tests pass, [M] guards added
✓ Finalize: [action taken]
```

## Session Model

Judgment agents (`haily-planner`, `haily-implementor`, `haily-reviewer`, `haily-brainstormer`, `haily-debugger`) inherit the session model — running on `{model:ultra}` passes that model to these agents automatically. Mechanical agents (`haily-tester`, `haily-git-manager`, `haily-stats`, etc.) are capped at their `model_max` tier and never escalate.

## Workflow Position

**Follows:** `{skill:hc-debug}` — complex investigation before fixing
**Follows:** `{skill:hc-scout}` — locate affected code first
**Precedes:** `{skill:hc-test}`, `{skill:hc-review}`
**Related:** `{skill:hc-debug}`, `{skill:hc-cook}`

## References

Core:
- `references/anti-rationalization.md` — shortcut patterns to avoid before and during fix
- `references/diagnosis-protocol.md` — structured root-cause methodology
- `references/prevention-gate.md` — defense-in-depth validation requirements
- `references/mode-selection.md` — autonomous vs. human-in-the-loop decision criteria
- `references/complexity-assessment.md` — Simple / Moderate / Complex classification
- `references/task-orchestration.md` — Claude Task creation patterns
- `references/skill-activation-matrix.md` — when to activate each skill/subagent
- `references/parallel-exploration.md` — parallel Explore and Bash patterns
- `references/workflow-artifacts.md` — 5 JSON artifacts required before finalize

Per-complexity:
- `references/workflow-simple.md` — Simple issues
- `references/workflow-standard.md` — Moderate issues
- `references/workflow-deep.md` — Complex issues (complexity-classified, not the `--deep` flag)
- `references/review-cycle.md` — autonomous vs. HITL review loop

Specialized:
- `references/workflow-ci.md` — GitHub Actions / CI pipeline failures
- `references/workflow-logs.md` — application log analysis
- `references/workflow-test.md` — test suite failures
- `references/workflow-types.md` — TypeScript type errors
- `references/workflow-ui.md` — visual / UI regressions
- `references/workflow-quick.md` — emergency production incident fix (`--quick`, renamed from the old `hotfix` flag)
- `references/workflow-deps.md` — dependency audit, CVE patching, major version upgrades (deps)
