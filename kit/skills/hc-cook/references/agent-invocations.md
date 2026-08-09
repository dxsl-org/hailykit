# Agent Delegation Patterns

Canonical tags used by `{skill:hc-cook}`. The installer converts them to provider-native spawn syntax.

```text
{agent:<role>}           single agent
{agents:<role1>,<role2>} parallel agents
{agent-result:<role>}    result transition marker
```

## Recon And Planning

{agent:haily-researcher}

Investigate one bounded topic. Cite sources and cap the report at 150 lines. Use parallel researchers only for independent domains.

{agents:haily-researcher,haily-researcher}

{agent-result:haily-researcher}

{agent:scout}

Locate relevant modules, patterns, and contracts. Pass prior recon, active-plan path, and touched-module hints. Reuse first; use `{skill:hc-scout} ext` only after reuse fails in a 500+ file codebase.

{agent-result:scout}

{agent:haily-planner}

Produce one `plan.md` plus one `phase-XX-*.md` per phase from the verified recon.

{agent-result:haily-planner}

## Build And Test

{agent:haily-designer}

Own UI layout, tokens, and component markup under `./docs/design-guidelines.md`; implementation owns backend wiring.

{agent:haily-tester}

Run the final phase code. Any failure routes to the debugger; never accept a test run against pre-final code.

{agent-result:haily-tester}

{agent:haily-debugger}

Root-cause observed test failures and propose bounded fixes. Spawn only after a tester reports failure.

{agent-result:haily-debugger}

## TDD Context Split

Under `--tdd` Red-Green, separate test design/writing from implementation so implementation knowledge cannot shape the tests.

{agent:haily-test-architect}

Design tests from the phase spec and acceptance criteria only. With `--spec`, translate each `AC-N` into a tagged given-when-then acceptance test.

{agent-result:haily-test-architect}

The test-writing context creates failing tests, executes them for red proof, and commits test-only. It passes committed tests—not its rationale—to the implementor.

{agent:haily-implementor}

Implement to green without editing committed tests. Any test diff is a tamper flag.

{agent-result:haily-implementor}

## Review

{agent:haily-reviewer}

Audit acceptance coverage, regressions, public contracts, pattern consistency, and build hygiene. Return `pass`, `conditional`, or `block` with severity-ranked evidence.

Forward `--deep` when explicitly set or `haily.json deep.auto` applies, except when `--quick` is explicit. Deep review uses refuter votes for every Critical and accepted Medium finding; it does not activate cross-model review.

{agent-result:haily-reviewer}

### Domain-Risk Review

Spawn a second reviewer after the standard audit when the phase touches a listed domain. Under `--deep`, spawn it unconditionally.

| Domain | Risk surface |
|---|---|
| Auth/authz | sessions, JWT, OAuth, permissions, RBAC |
| Secrets | env vars, credential storage, key rotation |
| Payments | billing, calculations, payment webhooks |
| Data migrations | schema changes, drops, backfills, destructive ALTER |
| Public APIs | endpoint signatures, response shapes, versioned routes |
| CI/deploy | workflows, Dockerfile, releases, environment promotion |
| Filesystem | writes outside the project, cleanup, permissions |
| Production config | flags, limits, timeouts, circuit breakers |

{agent:haily-reviewer}

Review only the named domain. Assume adversarial inputs and worst-case state; cite paths to unauthorized access, data loss, billing error, or deployment failure.

{agent-result:haily-reviewer}

## Complexity Reduction

{agent:haily-refiner}

Preserve behavior while reducing only files in `git diff --name-only HEAD`. Trigger when any configured/default threshold is exceeded:

- `simplify.threshold.locDelta`: 400
- `simplify.threshold.fileCount`: 8
- `simplify.threshold.singleFileLoc`: 200

Measure the resulting diff; do not accept agent prose as proof. Bypass only with `HL_SIMPLIFY_DISABLED=1` or `simplify.gate.enabled: false`.

## Finalization

{agents:haily-project-manager,haily-docs-writer}

{agent-result:haily-project-manager}

Project manager reconciles every phase checkbox and `plan.md` status. Docs writer updates `./docs` only when warranted.

{agent:haily-git-manager}

Stage the owned changes, scan for secrets, and commit using the repository's message style.

## Exemplar Injection

Before Build, append 2–3 in-repo exemplars to the implementor prompt, capped at 80 excerpt lines total:

```text
## Exemplar(s)
<file>:<line>-<line> — <why it matches>
<excerpt>
```

Exclude vendored, generated, ignored, and dependency paths. If none exists, write `No in-repo exemplar — follow injected standards.` Never omit the result silently. Skip this pass only under `--quick`.

{agent:haily-implementor}

Match the exemplars' structure, naming, and error-handling style.

{agent-result:haily-implementor}

## Parallel Phase Execution

{agent:haily-implementor}

Assign one independent phase per implementor with explicit, non-overlapping file ownership.

## Tier Routing

Forward `--tier` only to Build and Verify agents:

| Tier | Task `model:` |
|---|---|
| `fast` | `{model:fast}` |
| `medium` | `{model:medium}` |
| `thinking` | `{model:thinking}` |
| absent | inherit session model |

Apply to `haily-implementor` and `haily-tester`. Never downgrade `haily-reviewer`; it uses the session model or higher. Resolve tier placeholders through `kit/model-map.json`; never hard-code vendor model IDs.
