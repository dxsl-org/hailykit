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

Turns a task description into a structured, phased plan through research, codebase analysis, and adversarial review. Never writes implementation code — only plan artifacts.

## Usage

```
{skill:hc-plan} <task> [--quick] [--deep] [--auto] [--tdd]
{skill:hc-plan} red-team [plan-path]
{skill:hc-plan} validate [plan-path]
```

If invoked without arguments or with ambiguous intent, use `AskUserQuestion` (header: "Planning Operation") to clarify task scope before proceeding.

| Flag | Behavior |
|------|----------|
| *(none)* | Interactive — agent auto-detects research depth; pauses at each Checkpoint |
| `--quick` | Skip Research + Red Team + Validation. Go straight to Codebase Analysis → Solution Design → Plan Writing. Use when you already know the codebase and approach — small features, bug fixes, or well-understood refactors. |
| `--deep` | Force maximum depth: 2–3 researchers + per-phase scout + a 2-lens judge panel at Solution Design (risk-first + simplicity-first, then judge synthesis — `references/solution-design.md`) + red-team + validation. Cost: 3–5× baseline token cost. When cross review is *also* separately authorized (`--cross` or `crossReview.auto`), its findings upgrade from advisory to confidence-raising instead of merely advisory (`references/cross-review.md`) — `--deep` alone never triggers external egress. Auto-on via `haily.json` `deep.auto: true` (checked at Scope Check, same pattern as `crossReview.auto`); an explicit `--quick` always overrides `deep.auto`. Use for architecture decisions where the cost of a wrong approach is high. |
| `--auto` | Autonomous — agent decides all trade-offs, no stops. Composes with `--deep` or `--quick`. |
| `--tdd` | Behavioral modifier — adds a tests-first structure block to each phase |
| `--resume` | Memory-augmented planning: load relevant memories (`feedback`, `project`) before Research; write new memories (rejected alternatives, discovered constraints, user preferences) after Red Team. Composes with all other flags. See `references/memory-bridge.md`. |
| `--cross` | Cross-model review: after Red Team + Validation, send the final plan to an external AI model (different provider than the session) for a second opinion. Advisory only. Composes with all flags; auto-on via `haily.json crossReview.auto`. See `references/cross-review.md`. |

Flags compose freely: `--quick --auto`, `--deep --auto`, `--tdd --auto`, `--deep --tdd --auto`. `--quick` and `--deep` are mutually exclusive — `--deep` wins if both given.

**Research depth auto-detection (default and `--auto`):** Agent assesses task complexity from description and codebase context — simple features get lightweight research; complex/cross-cutting changes get deeper research. Override with `--deep` when you know the decision warrants maximum scrutiny regardless of apparent complexity.

**Parallel phase detection:** Agent builds a dependency graph from phase dependencies and identifies phases that can execute in parallel. Interactive: offers parallel; `--auto`: parallelizes automatically.

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
| **Scope Check** | Confirm task boundaries before spending research cycles. Also resolve `--deep`: explicit flag wins, else `haily.json` `deep.auto: true` behaves as if `--deep` was passed unless `--quick` was given. **Parity hint (downward):** when `HL_MODEL_TIER` ranks below `ultra` and the task touches a high-risk domain (`{skill:hc-cook}` `references/agent-invocations.md` § Domain-Risk Review), print one line suggesting `--deep` at this Scope Check (this skill's Route-equivalent stage) and proceed at the requested depth — advisory only. See `docs/engineering-standards.md` § Depth Tiers → Parity hint. | Trivially small task |
| **Memory READ** | Load `references/memory-bridge.md` read protocol: type-filter MEMORY.md (feedback + project), keyword-scan descriptions against plan topic, inject top-5 relevant memories; flag entries >90 days as "verify before acting" | `--resume` absent; MEMORY.md not found |
| **Research** | Spawn `haily-researcher` subagents in parallel — `references/research-phase.md` | `--quick`; research reports already provided |
| **Codebase Analysis** | Read relevant files, patterns, constraints; mine git history for precedent commits (blind-spot detection) — `references/codebase-analysis.md`. Scout runs once with all aspects in one prompt — never one scout per aspect; session recon covering the task's modules replaces the Scout sub-step only (Precedent Mining + scout-report.md write always run) | Scout reports already provided |
| **Solution Design** | Evaluate approach options, select best fit — `references/solution-design.md`. Under `--deep`: a judge panel (2 lenses + synthesis) replaces the single-pass evaluation | — |
| **Plan Writing** | Produce `plan.md` + phase files — `references/plan-structure.md`, `references/plan-quality.md`. Auto-classify `tier` per phase: `fast` (mechanical/boilerplate), `medium` (logic/integration, default), `thinking` (arch/security/schema). Populate each phase's `## Assumptions` section — claim + confidence (high/medium/low) + how-to-verify — from claims made during Research/Codebase Analysis that were not directly grepped/read. See `references/phase-template.md`. | — |
| **Red Team** | `{skill:hc-plan} red-team {plan-path}` — `references/red-team-workflow.md` | `--quick`; default: auto on `--deep`; Interactive: Checkpoint |
| **Memory WRITE** | Write atomic memories per `references/memory-bridge.md` write protocol: one file per rejected alternative (type: feedback), discovered constraint (type: project), observed user preference (type: feedback); dedup-check before writing; update MEMORY.md index | `--resume` absent; Red Team triggered major revision (defer until re-plan completes) |
| **Validation** | `{skill:hc-plan} validate {plan-path}` — `references/validate-workflow.md` | `--quick`; default: auto on `--deep`; Interactive: Checkpoint |
| **Cross Review** | Run `hailykit cross-review --stage plan` on the final plan; present blind-spot findings for adjudication — `references/cross-review.md`. Under `--deep`, findings are confidence-raising rather than purely advisory (still evidence-gated) | `--cross` absent and `crossReview.auto` not set; no eligible reviewer CLI |
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

`--resume` is NOT about resuming a paused plan session — it is about cross-session memory injection. Activates a bidirectional bridge to `~/.claude/projects/<project>/memory/`.

**Before Research:** scans MEMORY.md for entries matching the plan topic (type: `feedback` + `project`; keyword scan on `description:` fields against plan topic nouns; recency preference). Top-5 loaded into planning context; entries >90 days flagged as "verify before acting, not acting on." Gracefully skips if MEMORY.md is absent.

**After Red Team (if Red Team passes):** writes one atomic memory file per: rejected alternative (type: `feedback`) · discovered constraint (type: `project`) · observed user preference (type: `feedback`). Dedup guard: updates existing entry if similar description found. Updates MEMORY.md index. Full protocol: `references/memory-bridge.md`.

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
| `references/phase-template.md` | Phase file template and frontmatter |
| `references/red-team-workflow.md` | Adversarial review process |
| `references/validate-workflow.md` | Critical-questions validation interview |
| `references/task-management.md` | Task hydration and Claude Task patterns |
| `references/plan-dependencies.md` | Dependency detection across plans |
| `references/memory-bridge.md` | `--resume` mode: memory read protocol, write protocol, relevance scoring, staleness handling, dedup guard, write examples |
| `references/cross-review.md` | `--cross` mode: when it runs, `hailykit cross-review` invocation, findings interpretation, blind-spot marking, adjudication, privacy; `--deep` confidence-raising upgrade |
