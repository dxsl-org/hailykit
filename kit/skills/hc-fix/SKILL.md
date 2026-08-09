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

Find the root cause before writing a fix. Symptom patches that hide the real problem are worse than no fix.

## Usage

```
{skill:hc-fix} [issue description] [--auto] [--quick] [--deep]
{skill:hc-fix} deps [security | outdated | major <package>]
```

| Flag / Subcommand | Behavior |
|---|---|
| *(none)* | Interactive; pause at Checkpoints and ask before parallelizing |
| `--auto` | Autonomous; decide trade-offs, auto-parallelize, and exit with a report on Critical regressions |
| `--quick` *(renamed from the old `hotfix` flag)* | Emergency mode for **active production incidents** — triage → minimal fix → smoke test → direct push. Bypasses full suite and PR review; direct push still requires incident confirmation first. See `references/workflow-quick.md`. |
| `--deep` | Use `{skill:hc-debug}`'s hypothesis panel in Diagnose and `{skill:hc-review}` `--deep` refuter votes in Verify. It raises rigor at any complexity level; it does not pick the Complex row by itself. |
| `deps` | Dependency audit and upgrade workflow — runs package manager audit, triages CVEs vs outdated, applies in risk-ordered batches. See `references/workflow-deps.md`. |

`--quick` and `--deep` are mutually exclusive — `--deep` wins if both are given, with a one-line notice that incident-speed mode was overridden.

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

1. **Scout** (mandatory, reuse-first) — resolve recon down the ladder; first hit wins: session context or explicit recon, active-plan `reconEnvelope` / root `scout-report.md`, relevant prior root-level `scout-report.md`, then a scoped `{skill:hc-scout}` request. Prefer `--quick` for affected files, direct callers, related tests, and recent commits; escalate to full `{skill:hc-scout}` only when unknown modules still span the symptom after the quick pass. Under `--quick`, keep lookup narrowed to incident touchpoints only. Read `./docs` when the project is unfamiliar. Log `✓ Scout: [N] files, [M] deps, [K] tests | reused [source]`

2. **Diagnose** (mandatory) — capture the exact pre-fix baseline: errors, stack traces, and failing test output. Activate `{skill:hc-debug}` for root-cause tracing; if two or more hypotheses fail, activate `{skill:hl-reasoning}`. Under `--deep`, invoke `{skill:hc-debug} --deep` instead so the hypothesis panel replaces single-stream tracing. Produce a diagnosis report with confirmed root cause, evidence chain, and affected scope. See `references/diagnosis-protocol.md`. Log `✓ Diagnose: Root cause: [summary], Scope: [N files]`

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

4. **Fix** — implement per selected workflow. Fix the root cause, keep changes minimal, follow existing patterns, and load `references/anti-rationalization.md` to avoid shortcut rationalizations. Log `✓ Fix: [N] files changed`

5. **Verify** (mandatory) — re-run the exact pre-fix repro, walk the blast radius, run tests in modified and transitively affected files, add or update at least one regression test, and run typecheck, lint, and build in parallel. For Standard/Complex, spawn `haily-reviewer` and address all Critical findings. Under `--deep`, each Critical finding gets refuter votes per `{skill:hc-review}` `--deep` semantics before it can block. Apply `references/prevention-gate.md`, write workflow artifacts, and loop back to Diagnose if Verify fails. After 3 failures, stop and discuss architecture. Log `✓ Verify: [N] tests pass, [M] guards added`

6. **Finalize** (mandatory) — report root cause, files changed, and prevention measures. Spawn `haily-docs-writer` if docs must change. Mark Claude Tasks completed. **Findings flywheel:** for every accepted Verify finding applied in this fix, append one line to `.agents/review-history.jsonl` and run the recurrence check — skip entirely when `.agents/` is absent (`{skill:hc-review}` `references/flywheel-distillation.md`; `--auto` folds any distillation proposal into the final report instead of an interactive checkpoint).
   An approved distillation writes or updates the committed target's `playbook-id` anchor rather than a bare prose append (`references/flywheel-distillation.md` § Distillation ID).
   Ask user to commit via `haily-git-manager`. Run `{skill:hl-log}`. Log `✓ Finalize: [action taken]`

   **Dead-end ledger:** when this fix is abandoned or escalated to the user after exhausting attempts (root cause before fix constraint above; Verify step 5's 3-failure stop), append one line to `.agents/failure-history.jsonl` — a one-line index entry pointing at the incident report already written for this dead-end (`haily-reporter`, `.agents/incidents/`), never a duplicate of its root-cause paragraph (`{skill:hc-plan}` `references/codebase-analysis.md` § Failure History Ledger Shape).

## --deep Mode

Replaces single-stream Diagnose with `{skill:hc-debug}`'s hypothesis panel and adds refuter votes to Verify's Critical findings. Recommended whenever the symptom touches a high-risk domain. No cross-model leg exists here — refuter votes stay internal to `haily-reviewer` subagents, so `--deep` never sends anything externally on its own. It is orthogonal to the Simple/Moderate/Complex table, composes with `--auto`, and beats `--quick`; `deep.auto` may default it on.

**Parity hint (upward):** on an `ultra`-tier session, `--deep` still spawns the panel and refuter votes when requested — the tier only adds an advisory note that the marginal gain over the default Diagnose/Verify pass is smaller. See `docs/engineering-standards.md` § Depth Tiers → Parity hint.

## Output

Minimum closeout:

```
✓ Root cause: [file:line] — [1-line cause]
✓ Fix: [what changed and why]
✓ Tests: [N passed, M added]
```

Full stage trace still emits:

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
- `references/parallel-exploration.md` — hypothesis-falsification fan-out and Bash verification patterns
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
