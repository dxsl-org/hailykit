---
name: hc-review
description: "Adversarial code review pipeline: Spec gate → Quality (haily-reviewer) ∥ Stress Probe in parallel → Simplification Scan (rides the Quality pass). Supports PR, commit, pending, codebase, and UI/UX targets. Post findings inline with --comment, apply to working tree with --fix."
when_to_use: "Invoke when reviewing code changes, a PR, a commit, or the full codebase."
user-invocable: true
argument-hint: "[#PR | COMMIT | --pending | codebase] [--quick] [--deep] [--comment] [--fix] [--ui [pattern]] [--batch <\"#N,#M,...\">] [--agentic] [--cross] [--quiz]"
metadata:
  category: workflow
  keywords: [review, quality, adversarial, red-team, code-quality, security]
---

# Review — Adversarial Code Review Pipeline

Review Circuit: Spec gate in the main loop, then Quality and Stress Probe in parallel; Simplification rides inside Quality. Accepts PRs, commits, pending diffs, and codebase scans.

## Usage

```
{skill:hc-review} [#PR | COMMIT | --pending | codebase [parallel]] [--quick] [--deep] [--comment] [--fix]
{skill:hc-review} --ui [files/pattern]
```

| Flag | Behavior |
|------|----------|
| *(none)* | Interactive; present findings and let the developer decide |
| `--quick` | Quality checklist only; skip Scout, Spec, Adversarial, and Simplification |
| `--deep` | Full circuit plus refuter votes on every Critical and every accepted Medium. This raises the evidence bar to block, so `--deep` trades block-rate for precision and may block less than normal mode. Cross findings only become confidence-raising when `--cross` or `crossReview.auto` separately authorizes egress; `--deep` alone never sends the diff externally. `deep.auto` may default this on; explicit `--quick` wins. |
| `--comment` | Post accepted findings as inline PR comments (PR input only) |
| `--fix` | Apply accepted findings to working tree after review |
| `--ui [pattern]` | UI/UX audit — load `references/flow-ui-ux.md` checklist |
| `--batch <"#N,#M,...">` | Review multiple PRs or commits in one session; emit per-target findings plus a Team Health Report |
| `--agentic` | Force-inject OWASP Agentic Top 10 checks into Stage 2 even if auto-detection would not fire |
| `--cross` | Run external cross-model review after Simplification; advisory unless other rules upgrade it |
| `--quiz` | Run the comprehension quiz after machine stages; 100% required to pass |

Flags compose freely: `--quick --fix`, `--quick --comment`, `--fix --comment`, `--batch --quick`, `--batch --comment`, `--quick --cross`, `--cross --quiz`, `--deep --cross`, `--deep --quiz`, `--deep --batch`. `--quick` and `--deep` are mutually exclusive — `--deep` wins if both are given.

## Mode×Stage Reference

Stage effects by mode:
- Default: Scout ladder, Spec, Quality, scope-gated Adversarial, advisory Simplification, then interactive action.
- `--quick`: Stage 2 Quality only.
- `--deep`: default path plus refuter votes on Critical and accepted-Medium findings.
- `--fix` / `--comment`: keep the base review path, then apply findings to the tree or PR.
- `--ui`: bypass the Review Circuit and run the UI/UX checklist only.
- `codebase`: run the internal codebase workflow instead of a diff review.
- `--batch`: repeat the same target workflow per PR/commit and aggregate into a Team Health Report.
- `--cross` / `--quiz`: append those stages to the selected base mode.

Stages 2 and 3 spawn in parallel (one message) once Stage 1 passes; Stage 4's YAGNI pass rides inside the Stage 2 prompt. "✅ ladder" = Scout resolves reuse-first (Process step 2) — a subagent spawns only when no existing recon covers the diff.

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
| `--batch <targets>` | Batch | comma-separated PR numbers, commit hashes, or `--pending` |

## Constraints

> **Required — recon-first, reuse-first:** Before reviewing, obtain blast-radius context (affected files beyond the diff, data flow paths) — but never re-derive what already exists. Resolve via the Scout ladder (Process step 2): session context → active-plan artifact → prior root-level scout artifact only when no active plan exists → inline trace → `{skill:hc-scout} --quick`. Full-mode `{skill:hc-scout}` is never spawned for diff reviews; codebase and codebase-parallel modes run scout internally.

> **Required — evidence-before-claims:** Run the verification command and read full output before declaring any finding fixed or the review complete. A finding cites what was OBSERVED at `file:line`; a claim carried from plan text, a scout report, or a prior review is PRIOR until grep-verified and never becomes OBSERVED by being restated. See `docs/engineering-standards.md` → Claim Provenance.

> **Required — rollback named for Critical and High:** Every Critical or High finding states how the change is undone and which part cannot be (data written, messages sent, migrations applied). Tests say the change works; rollback says what happens when it does not. See `{skill:hl-reasoning}` `references/reasoning-primitives.md` → Rollback Check.

## Process

1. **Route** — classify first arg via `references/input-routing.md`; select review mode; initialize diff context. When `--batch` is present, load `references/flow-batch.md` and follow the batch loop protocol instead of single-target processing — each target runs its own Route→Scout→Review Circuit, then results are aggregated into a Team Health Report. Log `✓ Route: [mode] — input=[type], flags=[list]`
   - **Parity hint (downward):** when `HL_MODEL_TIER` ranks below `ultra` and the diff touches a high-risk domain (`{skill:hc-cook}` → `references/agent-invocations.md` → Domain-Risk Review), suggest `--deep` in this Route log line and proceed at the requested depth — advisory only. See `docs/engineering-standards.md` § Depth Tiers → Parity hint.

2. **Scout** — obtain blast-radius context for the diff. Resolve down the ladder; first hit wins:
   1. **Session context** — the conversation already holds a scout report or recon summary covering the changed modules (typical when review follows `{skill:hc-cook}` or `{skill:hc-plan}` in the same session). Reuse it. Log `✓ Scout: reused session recon`
   2. **Active-plan artifact** — if the active plan's root `scout-report.md` covers the changed modules, use it. Log `✓ Scout: used active-plan scout-report.md from [path]`
   3. **Prior artifact** — when no active plan exists, glob root-level `.agents/*/scout-report.md`; nested legacy `reports/scout-report.md` is `prior` context only and never outranks an active plan. Log `✓ Scout: used prior scout-report.md from [path]`
   4. **Inline trace** — if the Stage 3 scope gate would skip, grep importers of the changed files in the main loop; no subagent. Log `✓ Scout: inline trace ([N] consumers)`
   5. **Spawn** — `{skill:hc-scout} --quick` with the edge-case prompt from `references/process-edge-cases.md`, scoped to changed files only. Log `✓ Scout: [N] findings`

   Never spawn full-mode `{skill:hc-scout}` here — repo-wide partition scouting belongs to codebase modes, which run it internally.
   - Skip entirely: `codebase` / `codebase parallel` modes (scout runs internally); `--ui` mode (pattern-matched files are the scope); `--quick` mode (quality checklist needs no blast radius)

3. **Review Circuit** — Stage 1 gates in the main loop; Stages 2 and 3 spawn in parallel:
   - **Stage 1 — Spec** (`references/review-spec.md`): verify the change matches plan/spec or, without a plan, that scope additions are justified. Fail fast; skip on `--quick`.
   - **Stage 2 — Quality**: auto-discover `.agents/checks/*.yaml`, scope-match them, and inject matching checks into the `haily-reviewer` prompt. Detect agentic patterns (`from anthropic`, `from langchain`, `import openai`, `@tool`, MCP tool schema keys, agent `.invoke(` / `.run(`); if detected or forced by `--agentic`, append `references/checklists/agentic.md`. Also inject the Stage 4 YAGNI taxonomy block unless `--quick`.
   - **Stage 3 — Stress Probe** (`references/review-adversarial.md`): skip on `--quick`; otherwise apply the scope gate before spawning. Under `--deep`, run refuter votes on every Critical and every accepted Medium before a finding can block.
   - Spawn Stages 2 and 3 together after Stage 1 passes, then adjudicate and dedupe by `file:line` + category, keeping the higher severity.
   - For 3+ changed files, use `references/process-task-pipeline.md`.
   - Log `✓ Review: [N] findings — [X critical, Y medium, Z low]`

4. **Simplification Scan** (`references/flow-simplification.md`) — advisory only; skip on `--quick`.
   - Pass 1 greps diff files for `// haily:` markers in the main loop.
   - Pass 2 rides in the Stage 2 prompt via the 5-tag taxonomy: `delete:`, `stdlib:`, `native:`, `yagni:`, `shrink:`.
   - Output the advisory summary and `net: -N lines possible`.

4.5. **Cross-Model Review** (`references/flow-cross.md`) — advisory; run only when `--cross` or `crossReview.auto` authorizes it. Secret-scan the diff, run `hailykit cross-review --stage code`, merge blind-spot findings, and skip silently when no eligible reviewer CLI exists. Under `--deep`, confirmations raise confidence and blind-spot Criticals enter the refuter-vote pool.
   - Log `✓ Cross: [reviewer] — [N findings, M blind-spot] | skipped: [reason]`

4.7. **Comprehension Quiz** (`references/flow-quiz.md`) — runs only when `--quiz` or `quiz.auto` enables it. Generate questions from Deviation Logs, findings, and the Scope Contract; compose the answer key first; grade to 100%; route alignment failures to `{skill:hc-fix}`. Under `--deep`, the quiz mines the post-vote finding set.
   - Log `✓ Quiz: [N] questions — [PASS|ABORT] after [R] rounds, [K] alignment findings`

5. **Act** — apply results based on flags:
   - `--fix`: apply accepted findings to working tree; run compile check after each; verify no regressions
   - `--comment`: post accepted findings as inline comments via `gh pr review`
   - Interactive (default): present findings summary; `AskUserQuestion` for each Critical finding: Fix now / Defer / Reject
   - `--batch` active: after all targets complete, generate Team Health Report per `references/flow-batch.md` § Report Format; save to `.agents/reports/batch-review-<YYMMDD-HHMM>.md`; log `✓ Batch: [N] targets reviewed — [X critical, Y medium, Z low] total`
   - **Findings flywheel** (`references/flywheel-distillation.md`) — for every ACCEPTED finding, append one line to `.agents/review-history.jsonl`; on the 3rd+ recurrence of the same `category`+`module`, propose a distillation target and, if approved, write or update the committed target's `playbook-id` anchor. Skip entirely when `.agents/` does not exist. Log `✓ Flywheel: [N] appended, [M] recurrence proposals`
   - Log `✓ Act: [N applied | N commented | N deferred]`

## --batch Mode

Activated by `--batch "<comma-separated targets>"`. It swaps in `references/flow-batch.md`, runs Route→Scout→Review Circuit per target, detects cross-target patterns, and saves a Team Health Report to `.agents/reports/batch-review-<YYMMDD-HHMM>.md`. Inaccessible targets are logged and skipped. It composes with `--quick`, `--comment`, and `--deep`.

## --ui Mode

Activated by `--ui [files/pattern]`. Loads `references/flow-ui-ux.md` checklist. Skips Route/Scout/Review Circuit. Output per finding: `file:line` — CRITICAL / HIGH / MEDIUM / LOW + Accept / Defer. Critical violations (§1 Accessibility, §2 Touch) block delivery.

## --deep Mode

Forces the full circuit, ignores the Stage 3 scope gate, and adds refuter votes on every Critical and every accepted Medium. It trades block-rate for precision and can surface fewer blocking findings than normal mode by design. Cross findings only upgrade when `--cross` or `crossReview.auto` separately authorizes egress. It composes with `--quiz` and `--batch`; `--deep` beats `--quick`; `deep.auto` may default it on.

## When NOT to Use

- STRIDE/OWASP threat modeling, secret/dep scan → `{skill:hc-security}` (or `--quick`)
- Type/lint/build error fixes → `{skill:hc-fix}`
- Test failures investigation → `{skill:hc-debug}` then `{skill:hc-fix}`
- Automated a11y testing (axe-core/Lighthouse) → `{skill:hc-test} --web`
- Design system, palette/font selection → `{skill:hl-design}`
- Database query/schema review → activate `{skill:hc-db}` alongside

## Session Model

Judgment agents (`haily-planner`, `haily-implementor`, `haily-reviewer`, `haily-brainstormer`, `haily-debugger`, ...) inherit the session model — running on `{model:ultra}` passes that model through automatically. Mechanical agents stay capped at their `model_max` tier and never escalate. Depth tiers use the canonical vocabulary (`fast|medium|thinking|ultra`, compared by ordinal rank — never the literal string) and are surfaced to every subagent via `HL_MODEL_TIER`; see `docs/engineering-standards.md` → Depth Tiers.

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
| `references/review-adversarial.md` | Stage 3 Stress Probe: attack vectors, adjudication, `--deep` refuter votes (survival table), report format |
| `references/flow-codebase.md` | Full codebase scan workflow |
| `references/flow-parallel.md` | Parallel edge-case audit workflow |
| `references/flow-ui-ux.md` | UI/UX review checklist (§1–§10) |
| `references/flow-checklist.md` | Pre-landing checklist workflow |
| `references/quality-verification.md` | Verification gate: evidence before completion claims |
| `{skill:hl-reasoning}` `references/reasoning-primitives.md` | Shared reasoning vocabulary: negative-space scan for absent error branches/indexes/tests, rollback check for Critical and High findings |
| `references/process-task-pipeline.md` | Task-managed review pipeline for multi-file features |
| `references/process-reception.md` | Receiving and evaluating review feedback |
| `references/process-edge-cases.md` | Edge case scouting before review |
| `references/process-requesting.md` | Requesting code review from haily-reviewer subagent |
| `references/checks.md` | Checks system: YAML schema, glob matching, Stage 2 injection format, examples |
| `references/flow-batch.md` | Batch review loop: parse targets, per-target process, cross-PR pattern detection, Team Health Report format, error handling |
| `references/checklists/agentic.md` | OWASP Agentic Top 10 (ASI01–ASI10:2026): static check items (ASI02–ASI05, ASI07) + runtime testing guidance (ASI01, ASI06, ASI08–ASI10) |
| `references/checklists/base.md` | Universal review checklist (injection, auth, races, dead code, type coercion) |
| `references/checklists/api.md` | API overlay (auth/rate limiting, input validation, data exposure, observability) |
| `references/checklists/web-app.md` | Web app overlay (XSS, CSRF, N+1, frontend perf, accessibility) |
| `references/checklists/database.md` | Database / migration overlay (locking, backfill safety, N+1, SQL injection, cascade) |
| `references/checklists/observability.md` | Observability overlay (logging PII, metrics cardinality, tracing, error capture, health checks) |
| `references/flow-simplification.md` | Stage 4 Simplification Scan: main-loop Haily marker harvest + YAGNI taxonomy (5 tags) injected into the Stage 2 prompt, advisory output |
| `references/flow-cross.md` | `--cross` mode: secret-safe diff capture, `hailykit cross-review` invocation, size guard, findings merge + blind-spot tagging, privacy, `--deep` confidence-raising |
| `references/flywheel-distillation.md` | Findings-to-rules flywheel: history line shape, recurrence detection, distillation targets (standards/guard/lint/memory), dedup + citation protocol, per-developer scope note |
| `references/flow-quiz.md` | `--quiz` mode: artifact-ranked question generation, key-first protocol, grading loop (comprehension gap vs alignment finding), 100%-pass semantics, report format |
