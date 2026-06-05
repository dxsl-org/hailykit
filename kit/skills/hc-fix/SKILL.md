---
name: hc-fix
description: "Root-cause-first bug resolution for any symptom: runtime errors, test failures, type errors, lint violations, CI failures, and dependency vulnerabilities. Auto-routes by input type. --hotfix for active production incidents. deps for dependency audits and upgrades."
when_to_use: "Invoke when there is a concrete bug, error, CI failure, or dependency vulnerability to fix."
user-invocable: true
argument-hint: "[issue] [--auto] [--hotfix] | deps [scope]"
metadata:
  category: workflow
  keywords: [bugfix, error, test-failure, CI, lint, debug]
---

# Fix — Root-Cause-First Bug Resolution

Find the root cause before writing a single line of fix. Symptom-level patches that pass the immediate error while hiding the real problem are worse than no fix — they delay the actual failure and corrupt the debugging trail.

## Usage

```
{skill:hc-fix} [issue description] [--auto] [--hotfix]
{skill:hc-fix} deps [security | outdated | major <package>]
```

| Flag / Subcommand | Behavior |
|---|---|
| *(none)* | Interactive — pauses at each Checkpoint; asks before parallelizing |
| `--auto` | Autonomous — agent decides all trade-offs; auto-parallelizes; exits with report on Critical regressions |
| `--hotfix` | Emergency mode for **active production incidents** — triage → minimal fix → smoke test → direct push. Bypasses full suite and PR review. See `references/workflow-hotfix.md`. |
| `deps` | Dependency audit and upgrade workflow — runs package manager audit, triages CVEs vs outdated, applies in risk-ordered batches. See `references/workflow-deps.md`. |

```
{skill:hc-fix} "login returns 500 after deploy"
{skill:hc-fix} "login returns 500 after deploy" --hotfix   # active incident
{skill:hc-fix} deps                                        # full audit + triage
{skill:hc-fix} deps security                               # CVE patches only
{skill:hc-fix} deps major react                            # React major version bump
```

**Auto-routing for bug fixes** (both modes) — no explicit flag needed:
- Lint violations → quick path via `references/workflow-quick.md`
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

2. **Diagnose** (mandatory) — capture exact pre-fix state: error messages, stack traces, failing test output — this becomes the Verify baseline. Activate `{skill:hc-debug}` for systematic root-cause tracing. Form and test hypotheses against codebase evidence. If two or more hypotheses fail, activate `{skill:hl-reasoning}`. Produce a diagnosis report: confirmed root cause, evidence chain, affected scope. See `references/diagnosis-protocol.md`. Log `✓ Diagnose: Root cause: [summary], Scope: [N files]`

3. **Assess complexity** — classify and select workflow:

   | Level | Indicators | Workflow |
   |---|---|---|
   | Simple | Single file, clear error, lint/type | `references/workflow-quick.md` |
   | Moderate | Multi-file, investigation required | `references/workflow-standard.md` |
   | Complex | System-wide, architectural impact | `references/workflow-deep.md` |

   **Parallel detection:** if 2+ issues are independent (no shared files, no dependency order), determine execution:
   - **Interactive:** `AskUserQuestion` — "Found [N] independent issues. Run in parallel?"
   - **`--auto`:** parallelize automatically via `haily-implementor` agents with file ownership boundaries.

   For Moderate+, create Claude Tasks upfront. See `references/task-orchestration.md`. Fall back to `TodoWrite` if Tasks unavailable. Log `✓ Assess: [level] — [workflow] selected`

4. **Fix** — implement per selected workflow. Fix the root cause, not the symptom. Keep changes minimal; follow existing patterns. Load `references/anti-rationalization.md` to avoid shortcut rationalizations. Log `✓ Fix: [N] files changed`

5. **Verify** (mandatory) — re-run the exact pre-fix repro and confirm the symptom no longer appears. Run all tests in modified and transitively-affected files. Walk the full blast radius. Add or update at least one regression test. Run typecheck, lint, and build in parallel. For Standard/Deep: spawn `haily-reviewer` subagent — address all Critical findings. Apply prevention measures (`references/prevention-gate.md`). Write workflow artifacts (`references/workflow-artifacts.md`). If Verify fails, loop back to Diagnose. After 3 failures, stop and discuss architecture. Log `✓ Verify: [N] tests pass, [M] guards added`

6. **Finalize** (mandatory) — report root cause, files changed, prevention measures. Spawn `haily-docs-writer` if fix warrants doc updates. Mark Claude Tasks completed. Ask user to commit via `haily-git-manager`. Run `{skill:hl-log}`. Log `✓ Finalize: [action taken]`

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
- `references/workflow-quick.md` — Simple issues
- `references/workflow-standard.md` — Moderate issues
- `references/workflow-deep.md` — Complex issues
- `references/review-cycle.md` — autonomous vs. HITL review loop

Specialized:
- `references/workflow-ci.md` — GitHub Actions / CI pipeline failures
- `references/workflow-logs.md` — application log analysis
- `references/workflow-test.md` — test suite failures
- `references/workflow-types.md` — TypeScript type errors
- `references/workflow-ui.md` — visual / UI regressions
- `references/workflow-hotfix.md` — emergency production incident fix (--hotfix)
- `references/workflow-deps.md` — dependency audit, CVE patching, major version upgrades (deps)
