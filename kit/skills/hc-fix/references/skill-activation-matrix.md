# Skill Activation Matrix

When to activate each skill and tool during fixing workflows.

## Always Activate (ALL Workflows)

| Skill/Tool | Step | Reason |
|------------|------|--------|
| Reuse-first recon, else `{skill:hc-scout} --quick` OR parallel `Explore` | Step 1 | Understand codebase context before diagnosing (SKILL Process step 1 ladder) |
| `{skill:hc-debug}` | Step 2 | Systematic root cause investigation |
| `{skill:hl-reasoning}` | Step 2 | Structured hypothesis formation — NO guessing |

## Task Orchestration (Moderate+ Only)

| Tool | Activate When |
|------|---------------|
| `TaskCreate` | After complexity assessment, create all phase tasks upfront |
| `TaskUpdate` | At start/completion of each phase |
| `TaskList` | Check available unblocked work, coordinate parallel agents |
| `TaskGet` | Retrieve full task details before starting work |

Skip Tasks for Quick workflow (< 3 steps). See `references/task-orchestration.md`.

## Auto-Triggered Activation

| Skill | Auto-Trigger Condition |
|-------|------------------------|
| `{skill:hl-brainstorm}` | 2+ hypotheses REFUTED in Step 2 diagnosis |
| `{skill:hl-reasoning}` | Always in Step 2 (mandatory for hypothesis formation) |

## Conditional Activation

| Skill | Activate When |
|-------|---------------|
| `{skill:hl-brainstorm}` | Multiple valid fix approaches, architecture decision (Deep only) |
| `{skill:hl-context-engineering}` | Fixing AI/LLM/agent code, context window issues |
| Native Read tool | UI issues, screenshots provided, visual bugs (Read the screenshot file directly to analyze it) |
| `{skill:hl-log}` | Moderate+ workflows — task hydration, sync-back, progress tracking |

## Subagent Usage

| Subagent | Activate When |
|----------|---------------|
| `haily-debugger` | Root cause unclear, need deep investigation (Step 2) |
| `Explore` (parallel) | Scout multiple areas simultaneously (Step 1), test hypotheses (Step 2) |
| `Bash` (parallel) | Verify implementation: typecheck, lint, build, test (Step 5) |
| `haily-researcher` | External docs needed, latest best practices (Deep only) |
| `haily-planner` | Complex fix needs breakdown, multiple phases (Deep only) |
| `haily-tester` | After implementation, verify fix works (Step 5) |
| `{skill:hc-review}` | After fix, verify quality and security (Step 5) |
| `haily-git-manager` | After approval, commit changes (Step 6) |
| `haily-docs-writer` | API/behavior changes need doc updates (Step 6) |
| `haily-project-manager` | Major fix impacts roadmap/plan status (Step 6) |
| `haily-implementor` | Parallel independent issues (each gets own agent) |

## Parallel Patterns

See `references/parallel-exploration.md` for detailed patterns.

| When | Parallel Strategy |
|------|-------------------|
| Scouting (Step 1) | 2-3 `Explore` agents on different areas |
| Testing hypotheses (Step 2) | 2-3 `Explore` agents per hypothesis |
| Multi-module fix | `Explore` each module in parallel |
| After implementation (Step 5) | `Bash` agents: typecheck + lint + build + test |
| 2+ independent issues | Task trees + `haily-implementor` agents per issue |

## Workflow → Skills Map

| Workflow | Skills Activated |
|----------|------------------|
| Quick | `{skill:hc-scout}` (minimal), `{skill:hc-debug}`, `{skill:hl-reasoning}`, `{skill:hc-review}`, parallel `Bash` verification |
| Standard | Above + Tasks, `{skill:hl-brainstorm}` (auto), `{skill:hl-log}`, `haily-tester`, parallel `Explore` |
| Deep | All above + `{skill:hl-brainstorm}`, `{skill:hl-context-engineering}`, `haily-researcher`, `haily-planner` |
| Parallel | Per-issue Task trees + `{skill:hl-log}` + `haily-implementor` agents + coordination via `TaskList` |

## Step → Skills Chain (Mandatory Order)

| Step | Mandatory Chain |
|------|----------------|
| Step 0: Mode | `AskUserQuestion` (unless auto/quick detected) |
| Step 1: Scout | `{skill:hc-scout}` OR 2-3 parallel `Explore` → map files, deps, tests |
| Step 2: Diagnose | Capture pre-fix state → `{skill:hc-debug}` → `{skill:hl-reasoning}` → parallel `Explore` hypotheses → (`{skill:hl-brainstorm}` if 2+ fail) |
| Step 3: Assess | Classify complexity → create Tasks (moderate+) |
| Step 4: Fix | Implement per workflow → follow root cause |
| Step 5: Verify+Prevent | Iron-law verify → regression test → defense-in-depth → parallel `Bash` verify |
| Step 6: Finalize | Report → `haily-docs-writer` → `TaskUpdate` → `haily-git-manager` → `{skill:hl-log}` |

## Detection Triggers

| Keyword/Pattern | Skill to Consider |
|-----------------|-------------------|
| "AI", "LLM", "agent", "context" | `{skill:hl-context-engineering}` |
| "stuck", "tried everything" | `{skill:hl-brainstorm}` |
| "complex", "multi-step" | `{skill:hl-reasoning}` |
| "which approach", "options" | `{skill:hl-brainstorm}` |
| "latest docs", "best practice" | `haily-researcher` subagent |
| Screenshot attached | Native Read tool |
