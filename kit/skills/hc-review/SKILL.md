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

4-stage Review Circuit: Spec compliance gates in the main loop, then Quality (haily-reviewer) and Stress Probe (adversarial) run in parallel; the Simplification Scan (advisory) rides inside the Quality pass. Accepts PR numbers, commit hashes, pending changes, and full codebase scans.

## Usage

```
{skill:hc-review} [#PR | COMMIT | --pending | codebase [parallel]] [--quick] [--deep] [--comment] [--fix]
{skill:hc-review} --ui [files/pattern]
```

| Flag | Behavior |
|------|----------|
| *(none)* | Interactive — present findings; user decides next action |
| `--quick` | Quality checklist only — skip Scout, Stage 1 (Spec), Stage 3 (Adversarial), and Stage 4 (Simplification). Use for docs, config, simple style changes. |
| `--deep` | Full circuit (Stages 1–4) plus refuter votes: every Critical finding, and every Medium the adjudicator marks Accept, must survive 2–3 independent `haily-reviewer` skeptics before it can block (`references/review-adversarial.md` → `## --deep: Refuter Votes`). This raises the evidence bar to block, so `--deep` can block LESS than normal mode by design — it trades block-rate for precision, never the reverse. Cross findings escalate to confidence-raising only when `--cross`/`crossReview.auto` separately authorizes egress (`references/flow-cross.md` → `## --deep Mode`) — `--deep` alone never sends the diff externally. Mutually exclusive with `--quick` — `--deep` wins if both are given. Auto-on via `haily.json deep.auto`; an explicit `--quick` overrides it. |
| `--comment` | Post accepted findings as inline PR comments (PR input only) |
| `--fix` | Apply accepted findings to working tree after review |
| `--ui [pattern]` | UI/UX audit — load `references/flow-ui-ux.md` checklist |
| `--batch <"#N,#M,...">` | Review multiple PRs or commits in one session. Runs full 3-stage review per target; produces per-target findings + Team Health Report. Composes with `--quick` and `--comment`. |
| `--agentic` | Force-inject OWASP Agentic Top 10 (ASI:2026) checks into Stage 2, regardless of auto-detection. Auto-detect fires on any diff containing LLM/agent SDK imports, `@tool` decorators, or MCP tool schema patterns. |
| `--cross` | Cross-model review: after the Simplification Scan, send the diff to an external AI model (different provider than the session) for a second opinion; findings are advisory and merged into the report. Auto-on via `haily.json crossReview.auto`. See `references/flow-cross.md`. |
| `--quiz` | Comprehension quiz: after every machine stage, quiz the developer on the diff — questions mined from Deviation Logs, review findings, and the Scope Contract; answer key fixed before asking, hidden until resolve; 100% to pass. The final human checkpoint before commit. Auto-on via `haily.json quiz.auto`. See `references/flow-quiz.md`. |

Flags compose freely: `--quick --fix`, `--quick --comment`, `--fix --comment`, `--batch --quick`, `--batch --comment`, `--quick --cross`, `--cross --quiz`, `--deep --cross`, `--deep --quiz`, `--deep --batch`. `--quick` and `--deep` are mutually exclusive — `--deep` wins if both are given.

```
{skill:hc-review}                             # auto-detect from context
{skill:hc-review} --pending                   # staged + unstaged changes
{skill:hc-review} --pending --quick           # quick quality check only
{skill:hc-review} #123                        # PR diff
{skill:hc-review} #123 --comment             # review + post inline PR comments
{skill:hc-review} #123 --quick --comment      # quick review + post comments
{skill:hc-review} abc1234                     # single commit
{skill:hc-review} codebase                    # full codebase scan
{skill:hc-review} codebase parallel           # parallel edge-case audit
{skill:hc-review} --ui src/components/        # UI/UX checklist audit
{skill:hc-review} --batch "#123,#456,abc1234" # batch review — Team Health Report
{skill:hc-review} --batch "#123,#456" --quick # batch quick review
{skill:hc-review} #123 --agentic              # force OWASP Agentic checks
{skill:hc-review} #123 --deep                 # full circuit + refuter votes on Critical/accepted-Medium
```

## Mode×Stage Reference

Which stages run per flag combination:

| Mode | Scout | Stage 1 Spec | Stage 2 Quality | Stage 3 Adversarial | Stage 4 Simplification | Act |
|------|-------|-------------|----------------|--------------------|-----------------------|----|
| *(none)* | ✅ ladder | ✅ | ✅ | ✅ (scope-gated) | ✅ (advisory) | Interactive |
| `--quick` | **skip** | **skip** | ✅ | **skip** | **skip** | Interactive |
| `--deep` | ✅ ladder | ✅ | ✅ | ✅ + refuter votes (scope-gated) | ✅ (advisory) | Interactive |
| `--fix` | ✅ ladder | ✅ | ✅ | ✅ | ✅ (advisory) | Apply to tree |
| `--quick --fix` | **skip** | **skip** | ✅ | **skip** | **skip** | Apply to tree |
| `--comment` | ✅ ladder | ✅ | ✅ | ✅ | ✅ (advisory) | Post PR comments |
| `--quick --comment` | **skip** | **skip** | ✅ | **skip** | **skip** | Post PR comments |
| `--ui` | skip | skip | UI/UX checklist | skip | skip | Interactive |
| `codebase` | internal | skip | Parallel research+review | skip | ✅ (advisory) | Report |
| `--batch` | ✅ ladder, reused across targets | ✅ (per target) | ✅ (per target) | ✅ scope-gated (per target) | ✅ (advisory, per target) | Per-target findings + Team Health Report |
| `--batch --quick` | **skip** | **skip** | ✅ (per target) | **skip** | **skip** | Per-target findings + Team Health Report |
| `--cross` | (per base mode) | (per base mode) | (per base mode) | (per base mode) | (per base mode) | Base mode + Cross-Model Review (advisory) |
| `--quiz` | (per base mode) | (per base mode) | (per base mode) | (per base mode) | (per base mode) | Base mode + Comprehension Quiz (human gate) |

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

> **Required — recon-first, reuse-first:** Before reviewing, obtain blast-radius context (affected files beyond the diff, data flow paths) — but never re-derive what already exists. Resolve via the Scout ladder (Process step 2): session context → plan artifact → inline trace → `{skill:hc-scout} --quick`. Full-mode `{skill:hc-scout}` is never spawned for diff reviews; codebase and codebase-parallel modes run scout internally.

> **Required — evidence-before-claims:** Run the verification command and read full output before declaring any finding fixed or the review complete.

## Process

1. **Route** — classify first arg via `references/input-routing.md`; select review mode; initialize diff context. When `--batch` is present, load `references/flow-batch.md` and follow the batch loop protocol instead of single-target processing — each target runs its own Route→Scout→Review Circuit, then results are aggregated into a Team Health Report. Log `✓ Route: [mode] — input=[type], flags=[list]`
   - **Parity hint (downward):** when `HL_MODEL_TIER` ranks below `ultra` and the diff touches a high-risk domain (`{skill:hc-cook}` → `references/agent-invocations.md` → Domain-Risk Review), suggest `--deep` in this Route log line and proceed at the requested depth — advisory only. See `docs/engineering-standards.md` § Depth Tiers → Parity hint.

2. **Scout** — obtain blast-radius context for the diff. Resolve down the ladder; first hit wins, later rungs never run:
   1. **Session context** — the conversation already holds a scout report or recon summary covering the changed modules (typical when review follows `{skill:hc-cook}` or `{skill:hc-plan}` in the same session). Reuse it. Log `✓ Scout: reused session recon`
   2. **Plan artifact** — glob `.agents/*/scout-report.md`; if the most recently modified one covers the changed modules, use it. Log `✓ Scout: used scout-report.md from [path]`
   3. **Inline trace** — the Stage 3 scope gate would skip (all its conditions hold, including no new dependencies and none of its never-skip overrides — `references/review-adversarial.md` § Scope Gate): grep importers of the changed files in the main loop; no subagent. Log `✓ Scout: inline trace ([N] consumers)`
   4. **Spawn** — `{skill:hc-scout} --quick` with the edge-case prompt (`references/process-edge-cases.md`), scoped to the changed files: consumers, data flows, boundary conditions, blast radius. Log `✓ Scout: [N] findings`

   Never spawn full-mode `{skill:hc-scout}` here — repo-wide partition scouting belongs to codebase modes, which run it internally.
   - Skip entirely: `codebase` / `codebase parallel` modes (scout runs internally); `--ui` mode (pattern-matched files are the scope); `--quick` mode (quality checklist needs no blast radius)

3. **Review Circuit** — Stage 1 gates in the main loop; Stages 2 and 3 spawn in parallel:
   - **Stage 1 — Spec** (`references/review-spec.md`): verify implementation matches plan/spec; absent plan, check for unjustified scope additions. Main-loop check — must pass before any reviewer spawns (fail-fast: never spend reviewer runs on non-compliant code). Skip if `--quick`.
   - **Stage 2 — Quality**: auto-discover `.agents/checks/*.yaml`; filter by scope glob vs diff files; log `✓ Checks: [N] discovered, [M] matched`; inject matching checks into `haily-reviewer` prompt (see `references/checks.md`). **Agentic check injection:** scan diff for agentic patterns (LLM SDK imports — `from anthropic`, `from langchain`, `import openai`; `@tool` decorator; MCP tool schema keys — `"tools": [{`, `inputSchema`; agent invocation — `.invoke(`, `.run(` on agent objects). If patterns found (≥1 LLM SDK import, OR ≥2 other signals) OR `--agentic` flag is set, load `references/checklists/agentic.md` and append to reviewer prompt; log `ℹ Agentic code detected — injecting OWASP Agentic Top 10 checks`. If not detected and no `--agentic`, log `ℹ No agentic patterns — skipping agentic checks`. Delegate `haily-reviewer` subagent with diff + scout findings + repo-specific checks + injected agentic checks + the Stage 4 YAGNI taxonomy block (`references/flow-simplification.md` § Pass 2; omit when `--quick`). Standards, security, performance, edge cases.
   - **Stage 3 — Stress Probe** (`references/review-adversarial.md`): adversarial pass — skip if `--quick`; also scope-gated (evaluate before spawning): skip if ≤2 files AND ≤30 lines AND no auth/crypto/schema/env/migration files touched. Under `--deep`, after adjudication run refuter votes on every Critical and every accepted Medium (`references/review-adversarial.md` → `## --deep: Refuter Votes`) before a finding can block.
   - **Parallel spawn:** the Stage 2 and Stage 3 reviewers take the same inputs (diff + scout findings) and neither consumes the other's output — once Stage 1 passes and the scope gate is evaluated, spawn both in one message. Adjudicate all findings together after both return; dedupe overlapping findings by `file:line` + category, keeping the higher severity.
   - For 3+ changed files: use task-managed pipeline (`references/process-task-pipeline.md`)
   - Log `✓ Review: [N] findings — [X critical, Y medium, Z low]`

4. **Simplification Scan** (`references/flow-simplification.md`) — informational pass; does not block review completion. Skip if `--quick`.
   - **Pass 1 — Haily markers:** grep diff files for `// haily:` comments in the main loop; report each with its ceiling and upgrade trigger
   - **Pass 2 — YAGNI taxonomy:** rides in the Stage 2 reviewer prompt (5-tag taxonomy: `delete:`, `stdlib:`, `native:`, `yagni:`, `shrink:`) — no separate spawn; extract tagged findings from the Stage 2 report and output the `net: -N lines possible` summary
   - Findings are advisory — present to developer; fix now / defer / accept
   - Log `✓ Simplification: [N markers, M findings] — net: -N lines possible`

4.5. **Cross-Model Review** (`references/flow-cross.md`) — advisory; runs only when `--cross` is set or `haily.json crossReview.auto` is true. Secret-scan the diff, then run `hailykit cross-review --stage code` with the session's provider; merge findings (tag blind-spot catches `[cross: <cli>/<model>]`). Skips silently when no eligible reviewer CLI is installed. Does not block completion. Under `--deep` (when this stage is authorized to run — `--deep` never authorizes egress by itself), confirmations raise confidence and blind-spot Criticals enter the refuter-vote pool (`references/flow-cross.md` → `## --deep Mode`).
   - Log `✓ Cross: [reviewer] — [N findings, M blind-spot] | skipped: [reason]`

4.7. **Comprehension Quiz** (`references/flow-quiz.md`) — runs only when `--quiz` is set or `haily.json quiz.auto` is true, after every machine stage so questions mine their findings. Generate questions from Deviation Logs, findings, and the Scope Contract; compose the answer key first and keep it hidden until resolve; grade to 100%. A wrong answer whose expectation matches the requirement is an alignment finding → route to `{skill:hc-fix}`. On ABORT the commit decision stays with the developer; the report records the failed gate. Under `--deep`, refuter votes (step 3) settle before the quiz gate runs — the quiz mines the post-vote finding set, not the raw adjudication.
   - Log `✓ Quiz: [N] questions — [PASS|ABORT] after [R] rounds, [K] alignment findings`

5. **Act** — apply results based on flags:
   - `--fix`: apply accepted findings to working tree; run compile check after each; verify no regressions
   - `--comment`: post accepted findings as inline comments via `gh pr review`
   - Interactive (default): present findings summary; `AskUserQuestion` for each Critical finding: Fix now / Defer / Reject
   - `--batch` active: after all targets complete, generate Team Health Report per `references/flow-batch.md` § Report Format; save to `.agents/reports/batch-review-<YYMMDD-HHMM>.md`; log `✓ Batch: [N] targets reviewed — [X critical, Y medium, Z low] total`
   - **Findings flywheel** (`references/flywheel-distillation.md`) — for every ACCEPTED finding, append one line to `.agents/review-history.jsonl`; skip entirely when `.agents/` does not exist (bare repo). On the 3rd+ occurrence of the same `category`+`module` pair, PROPOSE a distillation target (standards / guard / lint / memory) via checkpoint — never silent — citing the prior instances. An approved distillation writes or updates the committed target's `playbook-id` anchor (`references/flywheel-distillation.md` § Distillation ID), never a bare prose append. Log `✓ Flywheel: [N] appended, [M] recurrence proposals`
   - Log `✓ Act: [N applied | N commented | N deferred]`

## --batch Mode

Activated by `--batch "<comma-separated targets>"`. Follows `references/flow-batch.md` in place of single-target processing. Runs the full Route→Scout→Review Circuit on each target sequentially, collects per-target findings, identifies cross-PR patterns (same finding type in ≥2 targets), then generates a Team Health Report saved to `.agents/reports/batch-review-<YYMMDD-HHMM>.md`. A single inaccessible target does not abort the batch — it is logged as skipped. Composes with `--quick` (Stage 2 only per target) and `--comment` (inline comments per PR target). Composes with `--deep` — refuter votes run per-target, inside each target's own Review Circuit, before that target's findings join the Team Health Report.

## --ui Mode

Activated by `--ui [files/pattern]`. Loads `references/flow-ui-ux.md` checklist. Skips Route/Scout/Review Circuit. Output per finding: `file:line` — CRITICAL / HIGH / MEDIUM / LOW + Accept / Defer. Critical violations (§1 Accessibility, §2 Touch) block delivery.

## --deep Mode

Forces the full circuit (Stages 1–4, ignoring the Stage 3 scope gate) and adds refuter votes: every Critical finding, and every Medium the adjudicator marks Accept, is checked by 2–3 independent `haily-reviewer` skeptics before it can block — `references/review-adversarial.md` → `## --deep: Refuter Votes` (survival table, skeptic contract, demotion). This raises the evidence bar to block, so `--deep` trades block-rate for precision and can surface FEWER blocking findings than normal mode by design, never more.

Cross findings escalate to confidence-raising, and blind-spot Criticals join the refuter-vote pool, only when `--cross`/`crossReview.auto` has separately authorized egress — `--deep` never authorizes sending the diff externally on its own (`references/flow-cross.md` → `## --deep Mode`).

Composes with `--quiz` (votes settle before the quiz gate) and `--batch` (votes run per-target). Mutually exclusive with `--quick` — `--deep` wins if both are given. Auto-on via `haily.json deep.auto`; an explicit `--quick` on the invocation overrides the config default.

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
