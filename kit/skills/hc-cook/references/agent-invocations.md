# Agent Delegation Patterns

Canonical invocation tags for every subagent role used by `{skill:hc-cook}`.
The installer resolves each tag to the provider's native agent-spawn syntax at install time.

General form:

```
{agent:<role>}           — spawn single agent
{agents:<role1>,<role2>} — spawn in parallel
{agent-result:<role>}    — result transition marker (Claude: implicit; others: prose bridge)
```

---

## Research

{agent:haily-researcher}

Investigate the topic in depth. Cap report at 150 lines; cite sources.
Spin up several researchers in parallel when the task spans unrelated domains:

{agents:haily-researcher,haily-researcher}

{agent-result:haily-researcher}

## Codebase Scout

{agent:scout}

Locate modules, patterns, and contracts related to the feature.
Prefer `{skill:hc-scout} ext`; fall back to `{skill:hc-scout}` in constrained contexts.

{agent-result:scout}

## Plan Authoring

{agent:haily-planner}

Synthesize a phased implementation plan from the research reports.
Expected deliverables: one `plan.md` root + one `phase-XX-*.md` per phase.

{agent-result:haily-planner}

## Frontend / UI

{agent:haily-designer}

Build the interface following `./docs/design-guidelines.md`.
Designer owns layout, tokens, and component markup; backend wiring stays with the haily-implementor.

## Test Execution

{agent:haily-tester}

Execute the full test suite for the current phase.
Target: 100 % green. Any red triggers the haily-debugger (see below).

{agent-result:haily-tester}

## Failure Diagnosis

{agent:haily-debugger}

Root-cause the failures and propose targeted fixes.
Only spawned after a haily-tester run surfaces failures; never pre-emptively.

{agent-result:haily-debugger}

## Code Audit

{agent:haily-reviewer}

Audit the phase across: acceptance coverage, regression risk, contract stability, pattern consistency, build hygiene.
Return verdict (pass / conditional / block) + severity-ranked findings.

When `--deep` is set (or `haily.json deep.auto`, unless `--quick` is explicit), forward `--deep` into this prompt so the agent applies `{skill:hc-review}` `--deep` semantics — refuter votes on Critical findings before they count toward the block threshold (see `references/review-gates.md`).

{agent-result:haily-reviewer}

## Domain-Risk Review

Spawn an additional `haily-reviewer` with a domain-specific lens when the phase touches a high-risk domain. Run after the standard code audit. **Under `--deep`, spawn this reviewer unconditionally** — regardless of whether the phase touches a listed domain below.

**Trigger conditions — spawn domain-risk reviewer when phase touches:**

| Domain | Examples |
|--------|---------|
| Auth / authz | Session handling, JWT, OAuth, permissions, RBAC |
| Secrets | Env vars written/read, credential storage, key rotation |
| Payments | Billing logic, price calculations, Stripe/Paddle webhooks |
| Data migrations | Schema changes, index drops, backfills, destructive ALTER |
| Public API contracts | Endpoint signatures, response shapes, versioned routes |
| CI / Deploy | Workflow files, Dockerfile, release scripts, env promotion |
| Filesystem | File writes outside project dir, temp file cleanup, permissions |
| Production config | Feature flags, rate limits, timeouts, circuit breakers |

{agent:haily-reviewer}

Prompt focus: "This phase touches [domain]. Review specifically for [domain] risks: [see domain table above for risk vectors]. Assume adversarial inputs and worst-case state. Flag any path where a logic error, missing validation, or race condition could cause [data loss / unauthorized access / billing error / deployment failure]."

{agent-result:haily-reviewer}

## Complexity Reduction

{agent:haily-refiner}

Reduce complexity without altering observable behavior.

Trigger conditions:
- `git diff --shortstat HEAD --ignore-all-space` exceeds any limit in `haily.json`
  (`simplify.threshold.{locDelta,fileCount,singleFileLoc}`, defaults 400 / 8 / 200)
- Scope to `git diff --name-only HEAD`
- Validate result via `git diff --shortstat HEAD -- [file-list]` delta, not agent prose
- Bypass: `HL_SIMPLIFY_DISABLED=1` or `haily.json` `simplify.gate.enabled: false`

## Plan Sync-Back + Documentation

{agents:haily-project-manager,haily-docs-writer}

{agent-result:haily-project-manager}

Reconcile completed work: align every phase file's checkboxes with task status, update plan.md progress fields.
Docs writer refreshes `./docs` to reflect changes in the current phase.

## Version Control

{agent:haily-git-manager}

Stage all changes and commit with a conventional-commit message.

## Exemplar Injection

Produced by the Recon pre-Build Pass (`references/process-steps.md` § Exemplar Pull) — normal + `--deep`, skipped on `--quick`. Before spawning `haily-implementor`, append this block to its prompt:

```
## Exemplar(s)
<file>:<line>-<line> — <one-line reason this matches the phase's work type>
<excerpt>
```

- 2–3 exemplars max, ≤80 lines of excerpt total across all of them combined — trim to the relevant function/block, never paste whole files
- Source only from the project's own tree — never vendored deps, generated code, `.gitignore`'d paths, or `node_modules`
- Greenfield hatch: no matching precedent → replace the block with the single line `No in-repo exemplar — follow injected standards.` (never omit silently)

{agent:haily-implementor}

Match this codebase's idiom: follow the injected exemplar(s) above for structure, naming, and error-handling style.

{agent-result:haily-implementor}

## Parallel Phase Execution

{agent:haily-implementor}

Execute the assigned phase file; owns the listed files exclusively.
Launch one haily-implementor per independent phase; enforce non-overlapping file ownership.

## Tier Routing

When `{skill:hc-cook}` receives `--tier fast|medium|thinking` (passed by `{skill:hc-goal}` per phase from the phase frontmatter), forward it to Build and Verify agents via the Task `model:` parameter:

| `--tier` value | Task `model:` param |
|---|---|
| `fast` | `{model:fast}` |
| `medium` | `{model:medium}` |
| `thinking` | `{model:thinking}` |
| absent | (inherit session model — backward compatible) |

Apply to `haily-implementor` (Build) and `haily-tester` (Verify). Do **not** apply to `haily-reviewer` — review judgment is always the session model or higher, never downgraded.

Tier names (`{model:fast}` etc.) resolve to provider model IDs at install time via `kit/model-map.json`. Never hard-code vendor model IDs here.
