---
name: hc-review
description: "Adversarial code review pipeline: Spec compliance → Quality (haily-reviewer) → Stress Probe. Supports PR, commit, pending, codebase, and UI/UX targets. Post findings inline with --comment, apply to working tree with --fix."
when_to_use: "Invoke when reviewing code changes, a PR, a commit, or the full codebase."
user-invocable: true
argument-hint: "[#PR | COMMIT | --pending | codebase] [--quick] [--comment] [--fix] [--ui [pattern]]"
metadata:
  category: workflow
  keywords: [review, quality, adversarial, red-team, code-quality, security]
---

# Review — Adversarial Code Review Pipeline

3-stage Review Circuit: Spec compliance → Quality (haily-reviewer) → Stress Probe (adversarial). Accepts PR numbers, commit hashes, pending changes, and full codebase scans.

## Usage

```
{skill:hc-review} [#PR | COMMIT | --pending | codebase [parallel]] [--quick] [--comment] [--fix]
{skill:hc-review} --ui [files/pattern]
```

| Flag | Behavior |
|------|----------|
| *(none)* | Interactive — present findings; user decides next action |
| `--quick` | Quality checklist only — skip Stage 1 (Spec) and Stage 3 (Adversarial). Use for docs, config, simple style changes. |
| `--comment` | Post accepted findings as inline PR comments (PR input only) |
| `--fix` | Apply accepted findings to working tree after review |
| `--ui [pattern]` | UI/UX audit — load `references/flow-ui-ux.md` checklist |

Flags compose freely: `--quick --fix`, `--quick --comment`, `--fix --comment`.

```
{skill:hc-review}                       # auto-detect from context
{skill:hc-review} --pending             # staged + unstaged changes
{skill:hc-review} --pending --quick     # quick quality check only
{skill:hc-review} #123                  # PR diff
{skill:hc-review} #123 --comment        # review + post inline PR comments
{skill:hc-review} #123 --quick --comment  # quick review + post comments
{skill:hc-review} abc1234              # single commit
{skill:hc-review} codebase             # full codebase scan
{skill:hc-review} codebase parallel    # parallel edge-case audit
{skill:hc-review} --ui src/components/ # UI/UX checklist audit
```

## Mode×Stage Reference

Which stages run per flag combination:

| Mode | Stage 1 Spec | Stage 2 Quality | Stage 3 Adversarial | Act |
|------|-------------|----------------|--------------------|----|
| *(none)* | ✅ | ✅ | ✅ (scope-gated) | Interactive |
| `--quick` | **skip** | ✅ | **skip** | Interactive |
| `--fix` | ✅ | ✅ | ✅ | Apply to tree |
| `--quick --fix` | **skip** | ✅ | **skip** | Apply to tree |
| `--comment` | ✅ | ✅ | ✅ | Post PR comments |
| `--quick --comment` | **skip** | ✅ | **skip** | Post PR comments |
| `--ui` | skip | UI/UX checklist | skip | Interactive |
| `codebase` | skip | Parallel research+review | skip | Report |

**Input Detection** (priority order; full routing logic in `references/input-routing.md`):

| Argument | Mode | Source |
|----------|------|--------|
| `#123` or PR URL | PR | `gh pr diff` |
| `abc1234` (7+ hex) | Commit | `git show` |
| `--pending` | Pending | `git diff HEAD` |
| `codebase` | Codebase scan | `references/flow-codebase.md` |
| `codebase parallel` | Parallel audit | `references/flow-parallel.md` |
| `--ui [pattern]` | UI/UX audit | `references/flow-ui-ux.md` |
| *(no args, recent context)* | Default | pending changes in context |
| *(no args, no context)* | Prompt | `AskUserQuestion` (header "Review Target") |

## Constraints

> **Required — recon-first:** Before reviewing, spawn `{skill:hc-scout}` to identify affected files beyond the diff, data flow paths, and blast radius. Skip for codebase and codebase-parallel modes (scout runs internally in those flows).

> **Required — evidence-before-claims:** Run the verification command and read full output before declaring any finding fixed or the review complete.

## Process

1. **Route** — classify first arg via `references/input-routing.md`; select review mode; initialize diff context. Log `✓ Route: [mode] — input=[type], flags=[list]`

2. **Scout** — spawn `{skill:hc-scout}` with edge-case prompt: affected files, data flows, boundary conditions, blast radius. Document findings for review stages. Log `✓ Scout: [N] findings`
   - Skip: `codebase` and `codebase parallel` modes
   - Skip: `--ui` mode (pattern-matched files are the scope)

3. **Review Circuit** — 3 stages in sequence:
   - **Stage 1 — Spec** (`references/review-spec.md`): verify implementation matches plan/spec; absent plan, check for unjustified scope additions. Must pass before Stage 2. Skip if `--quick`.
   - **Stage 2 — Quality**: delegate `haily-reviewer` subagent with diff + scout findings. Standards, security, performance, edge cases.
   - **Stage 3 — Stress Probe** (`references/review-adversarial.md`): adversarial pass — skip if `--quick`; also scope-gated: skip if ≤2 files AND ≤30 lines AND no auth/crypto/schema/env/migration files touched.
   - For 3+ changed files: use task-managed pipeline (`references/process-task-pipeline.md`)
   - Log `✓ Review: [N] findings — [X critical, Y medium, Z low]`

4. **Act** — apply results based on flags:
   - `--fix`: apply accepted findings to working tree; run compile check after each; verify no regressions
   - `--comment`: post accepted findings as inline comments via `gh pr review`
   - Interactive (default): present findings summary; `AskUserQuestion` for each Critical finding: Fix now / Defer / Reject
   - Log `✓ Act: [N applied | N commented | N deferred]`

## --ui Mode

Activated by `--ui [files/pattern]`. Loads `references/flow-ui-ux.md` checklist. Skips Route/Scout/Review Circuit. Output per finding: `file:line` — CRITICAL / HIGH / MEDIUM / LOW + Accept / Defer. Critical violations (§1 Accessibility, §2 Touch) block delivery.

## When NOT to Use

- STRIDE/OWASP threat modeling, secret/dep scan → `{skill:hc-security}` (or `--quick`)
- Type/lint/build error fixes → `{skill:hc-fix}`
- Test failures investigation → `{skill:hc-debug}` then `{skill:hc-fix}`
- Automated a11y testing (axe-core/Lighthouse) → `{skill:hc-test} --web`
- Design system, palette/font selection → `{skill:hl-design}`
- Database query/schema review → activate `{skill:hc-db}` alongside

## Workflow Position

**Follows:** `{skill:hc-cook}` — review after implementation
**Follows:** `{skill:hc-fix}` — review after bug fix
**Precedes:** `{skill:hc-ship}` — ship after review passes
**Related:** `{skill:hc-scout}`, `{skill:hc-test}`, `{skill:hc-security}`

## References

| File | Content |
|------|---------|
| `references/input-routing.md` | Input detection algorithm, Routing Precedence, resolution commands |
| `references/review-spec.md` | Stage 1 spec compliance process and checklist |
| `references/review-adversarial.md` | Stage 3 Stress Probe: attack vectors, adjudication, report format |
| `references/flow-codebase.md` | Full codebase scan workflow |
| `references/flow-parallel.md` | Parallel edge-case audit workflow |
| `references/flow-ui-ux.md` | UI/UX review checklist (§1–§10) |
| `references/flow-checklist.md` | Pre-landing checklist workflow |
| `references/quality-verification.md` | Verification gate: evidence before completion claims |
| `references/process-task-pipeline.md` | Task-managed review pipeline for multi-file features |
| `references/process-reception.md` | Receiving and evaluating review feedback |
| `references/process-edge-cases.md` | Edge case scouting before review |
| `references/process-requesting.md` | Requesting code review from haily-reviewer subagent |
| `references/checklists/base.md` | Universal review checklist (injection, auth, races, dead code, type coercion) |
| `references/checklists/api.md` | API overlay (auth/rate limiting, input validation, data exposure, observability) |
| `references/checklists/web-app.md` | Web app overlay (XSS, CSRF, N+1, frontend perf, accessibility) |
| `references/checklists/database.md` | Database / migration overlay (locking, backfill safety, N+1, SQL injection, cascade) |
| `references/checklists/observability.md` | Observability overlay (logging PII, metrics cardinality, tracing, error capture, health checks) |
