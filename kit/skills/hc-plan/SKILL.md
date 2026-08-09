---
name: hc-plan
description: "Turns a task into a structured, phased plan through research, codebase analysis, and adversarial review. Auto-detects research depth. Use --deep for architecture decisions requiring maximum scrutiny."
when_to_use: "Invoke when planning a new feature or complex task before implementation."
user-invocable: true
argument-hint: "<task> [--quick] [--deep] [--auto] [--tdd] [--resume] [--cross] | red-team [plan-path] | validate [plan-path]"
metadata:
  category: workflow
  keywords: [planning, architecture, phases, roadmap, research, design]
---

# Plan — Phased Implementation Roadmaps

Turns a task into a phased implementation plan. Never writes implementation code.

## Usage

```
{skill:hc-plan} <task> [--quick] [--deep] [--auto] [--tdd]
{skill:hc-plan} red-team [plan-path]
{skill:hc-plan} validate [plan-path]
```

If the request is ambiguous, use `AskUserQuestion` (header: "Planning Operation") before planning.

| Flag | Behavior |
|------|----------|
| *(none)* | Interactive; auto-detect depth; pause at Checkpoints |
| `--quick` | Skip Research, Red Team, and Validation; go straight to Codebase Analysis → Solution Design → Plan Writing |
| `--deep` | Maximum scrutiny: 2–3 researchers, per-phase scout, 2-lens judge panel, red-team, and validation. Cross review stays off unless `--cross` or `crossReview.auto` authorizes it. `haily.json deep.auto` may default this on; explicit `--quick` wins. |
| `--auto` | Resolve checkpoints autonomously |
| `--tdd` | Add tests-first structure to each phase |
| `--resume` | Read/write project memories around Research and Red Team; see `references/memory-bridge.md` |
| `--cross` | Run external second-opinion review after Red Team + Validation; advisory unless `--deep` separately upgrades confidence; see `references/cross-review.md` |

Flags compose freely: `--quick --auto`, `--deep --auto`, `--tdd --auto`, `--deep --tdd --auto`. `--quick` and `--deep` are mutually exclusive — `--deep` wins if both given.

Default depth is auto-detected from task complexity. Phase parallelism is derived from phase dependencies; interactive mode offers it, `--auto` uses it.

## Subcommands

| Subcommand | Reference | Purpose |
|------------|-----------|---------|
| `red-team` | `references/red-team-workflow.md` | Spawn adversarial reviewers against a draft plan |
| `validate` | `references/validate-workflow.md` | Run a critical-questions interview before coding starts |

## Process

```
Scope Check → Research → Codebase Analysis → Solution Design
→ Plan Writing → Red Team → Validation → Cross Review → Task Hydration → Cook Handoff → Journal
```

| Stage | Detail | Skip condition |
|-------|--------|----------------|
| **Scope Check** | Confirm boundaries, resolve `--deep` vs `deep.auto`, and emit the downward parity hint when `HL_MODEL_TIER < ultra` on a high-risk task. | Trivially small task |
| **Memory READ** | Load top relevant `feedback` and `project` memories per `references/memory-bridge.md`; flag stale entries for verification. | `--resume` absent; MEMORY.md not found |
| **Research** | Spawn parallel `haily-researcher` runs per `references/research-phase.md`. | `--quick`; research reports already provided |
| **Codebase Analysis** | Read relevant files, mine precedent commits, and run scout once for all aspects. Reuse session recon only for the Scout sub-step; Precedent Mining and `scout-report.md` write still run. | Scout reports already provided |
| **Solution Design** | Evaluate options; `--deep` swaps single-pass evaluation for the judge panel in `references/solution-design.md`. | — |
| **Plan Writing** | Produce `plan.md` + phase files, auto-classify `tier`, record unverified claims in `## Assumptions`, keep PRIOR claims PRIOR until verified, and ensure each phase's `## Risk Assessment` names how the phase is undone and which part cannot be. See `references/phase-template.md`. | — |
| **Red Team** | `{skill:hc-plan} red-team {plan-path}` — `references/red-team-workflow.md` | `--quick`; default: auto on `--deep`; Interactive: Checkpoint |
| **Memory WRITE** | Write deduped atomic memories for rejected alternatives, discovered constraints, and observed user preferences; update MEMORY.md index. | `--resume` absent; Red Team triggered major revision (defer until re-plan completes) |
| **Validation** | `{skill:hc-plan} validate {plan-path}` — `references/validate-workflow.md` | `--quick`; default: auto on `--deep`; Interactive: Checkpoint |
| **Cross Review** | Run `hailykit cross-review --stage plan` and adjudicate blind-spot findings. Under `--deep`, findings become confidence-raising rather than purely advisory. | `--cross` absent and `crossReview.auto` not set; no eligible reviewer CLI |
| **Task Hydration** | `TaskCreate` per phase when CLI available; falls back to `TodoWrite` | Fewer than 3 phases |
| **Cook Handoff** | Print absolute plan path and `{skill:hc-cook}` invocation (MANDATORY) | — |
| **Log** | `{skill:hl-log}` on completion — records plan decisions and outcomes to session log | — |

Cross-plan dependency analysis: `references/plan-dependencies.md`

## Output

Plans save to `.agents/[YYMMDD]-[HHMM]-[slug]/`:

- `plan.md` — overview table with phase status, links, and key dependencies
- `phase-01-name.md`, `phase-02-name.md`, … — per-phase: requirements, file ownership, implementation steps, success criteria, risk notes
- `scout-report.md` — codebase analysis summary written at Codebase Analysis stage; read by `{skill:hc-review}` and `{skill:hc-debug}` to skip re-scouting within the same plan

Phase file template: `references/phase-template.md`

## --resume Mode

`--resume` means cross-session memory injection, not resuming a paused plan. Before Research, load top relevant `feedback` and `project` entries from MEMORY.md and flag items older than 90 days as verify-first. After a passing Red Team, write one atomic memory per rejected alternative, discovered constraint, or observed user preference. Full protocol: `references/memory-bridge.md`.

## Constraints

> **Required — YAGNI/KISS/DRY:** Plans must not speculate features beyond what the task explicitly requires. Every phase must earn its existence. If a phase can be collapsed into an adjacent one without losing clarity, collapse it.

> **Required — plan before code:** `{skill:hc-cook}` must not execute against a task that lacks a plan. This skill produces the plan artifact that cook consumes. Do not write implementation code during planning.

## Database Phases

When any phase involves schema design, migrations, query optimization, or DB selection, activate `{skill:hc-db}` for domain guidance before detailing that phase's steps.

## Agent / LLM Phases

When any phase involves LLM context design, agent memory, token optimization, or multi-agent coordination, consult `{skill:hl-context-engineering}` for domain guidance before detailing that phase's steps.

## MCP Server Plans

When the task is building or agentizing an MCP server, the Cook Handoff must invoke `{skill:hc-mcp-builder}` instead of `{skill:hc-cook}`.

## Session Model

Judgment agents (`haily-planner`, `haily-implementor`, `haily-reviewer`, `haily-brainstormer`, `haily-debugger`) inherit the session model — running on `{model:ultra}` passes that model to these agents automatically. Mechanical agents (`haily-tester`, `haily-git-manager`, `haily-stats`, etc.) are capped at their `model_max` tier and never escalate. Depth tiers use the canonical vocabulary (`fast|medium|thinking|ultra`, compared by ordinal rank — never the literal string) and are surfaced to every subagent via `HL_MODEL_TIER`; see `docs/engineering-standards.md` → Depth Tiers.

## Workflow Position

**Follows:** `{skill:hl-brainstorm}` — after exploring approach options
**Follows:** `{skill:hc-scout}` — after codebase discovery
**Precedes:** `{skill:hc-cook}` — hands off plan path for implementation
**Related:** `{skill:hl-brainstorm}`, `{skill:hc-cook}`, `{skill:hc-scout}`

## References

| File | Content |
|------|---------|
| `references/scope-check.md` | Scope boundary confirmation before research |
| `references/research-phase.md` | Researcher agent orchestration |
| `references/codebase-analysis.md` | File and pattern analysis protocol |
| `references/solution-design.md` | Approach evaluation framework; `--deep` judge panel (2-lens spawn + synthesis) |
| `references/plan-structure.md` | Plan directory and file structure |
| `references/plan-quality.md` | Phase file content standards |
| `{skill:hl-reasoning}` `references/reasoning-primitives.md` | Shared reasoning vocabulary: outcome floor for phase success criteria, rollback check for `## Risk Assessment` |
| `references/phase-template.md` | Phase file template and frontmatter |
| `references/red-team-workflow.md` | Adversarial review process |
| `references/validate-workflow.md` | Critical-questions validation interview |
| `references/task-management.md` | Task hydration and Claude Task patterns |
| `references/plan-dependencies.md` | Dependency detection across plans |
| `references/memory-bridge.md` | `--resume` mode: memory read protocol, write protocol, relevance scoring, staleness handling, dedup guard, write examples |
| `references/cross-review.md` | `--cross` mode: when it runs, `hailykit cross-review` invocation, findings interpretation, blind-spot marking, adjudication, privacy; `--deep` confidence-raising upgrade |
