# Skill Workflow Routing

Typical skill sequences for multi-step work. Flow chains show order; the tables give the skill to actually invoke.

## Core Development

Flow: `plan → cook → test → review → ship → log`

| User Intent | Start |
|-------------|-------|
| "implement X", "build X", "add X" | `{skill:hc-plan}` then `{skill:hc-cook}` |
| "execute this plan" | `{skill:hc-cook} <plan-path>` |
| "quick implementation, I know the codebase" | `{skill:hc-cook} --quick` |
| "implement with tests first" | `{skill:hc-cook} --tdd` |
| "migrate library/framework/pattern X → Y" | `{skill:hc-cook} migrate "description"` |

## Bugfix

Flow: `scout → debug → fix → test → review`

| User Intent | Start |
|-------------|-------|
| "X is broken", "error in X", "bug in X" | `{skill:hc-fix}` (auto-scouts internally) |
| "CI is failing", "tests broken" | `{skill:hc-fix} --auto` |
| "production is down / active incident" | `{skill:hc-fix} --hotfix` |
| "CVE found / deps outdated / audit" | `{skill:hc-fix} deps` |
| "investigate why X happens" | `{skill:hc-scout}` then `{skill:hc-debug}` |
| "analyze this flame graph / heap dump" | `{skill:hc-debug} --profile <artifact>` |
| "failure spans multiple services" | `{skill:hc-debug} --trace <trace-id>` |

## Planning & Architecture

| User Intent | Start |
|-------------|-------|
| "plan feature X" | `{skill:hc-plan}` |
| "quick plan, skip research" | `{skill:hc-plan} --quick` |
| "high-stakes architecture decision" | `{skill:hc-plan} --deep` |
| "document this architectural decision" | Delegate: `Task(subagent_type="haily-adr-writer")` |
| "design the API for X" | Delegate: `Task(subagent_type="haily-api-designer")` |
| "what tests should we write for X?" | Delegate: `Task(subagent_type="haily-test-architect")` |

## Investigation

Flow: `scout → debug → brainstorm → plan`

| User Intent | Start |
|-------------|-------|
| "understand how X works" | `{skill:hc-scout}` |
| "why is X happening" | `{skill:hc-debug}` |
| "explore options for X" | `{skill:hl-brainstorm}` then `{skill:hc-plan}` |
| "inventory technical debt" | Delegate: `Task(subagent_type="haily-tech-analyst")` |
| "what changed and what does it mean?" | `{skill:hc-git} analyze [ref]` |

## Shipping & Release

| User Intent | Start |
|-------------|-------|
| "ship / release / create PR" | `{skill:hc-ship}` |
| "gradual rollout with feature flag" | `{skill:hc-ship} rollout <flag-name>` |
| "review before merge" | `{skill:hc-review}` |
| "quick review, no ceremony" | `{skill:hc-review} --quick` |
| "post review as inline PR comments" | `{skill:hc-review} --comment` |

## Thinking Spectrum

Increasing depth — match the level to the problem:

| Skill | Role | When |
|-------|------|------|
| `{skill:hl-research}` | gather info, evaluate tech | "What options exist for X?" |
| `{skill:hl-mindmap}` | persist relationships as navigable graph | "Map entities and connections for X" |
| `{skill:hl-reasoning}` | step-by-step self-analysis | "Walk me through the logic of X" |
| `{skill:hl-brainstorm}` | 2–3 approaches, trade-off analysis | "Help me decide between X and Y" |
| `{skill:hl-brainstorm} --[persona]` | targeted expert consultation | "What does an architect think of X?" |
| `{skill:hl-brainstorm} --debate` | all 9 personas + 12-dimension edge sweep | "What could go wrong with X?" |

`{skill:hl-brainstorm}` persona flags: `--architect` `--scientist` `--social-scientist` `--philosopher` `--economist` `--strategist` `--creative-director` `--manager` `--devil`

`{skill:hl-brainstorm} --debate` — all 9 personas → GO/CAUTION/STOP verdict
`{skill:hl-brainstorm} --edges` — 12-dimension edge case analysis (standalone or combined with --debate)

## Post-Implementation

`{skill:hc-review}` (before merge) · `{skill:hc-ship}` (full pipeline: tests, review, version, PR) · `{skill:hl-log}` (document decisions) · `{skill:hc-git} analyze` (impact analysis).

## Setup (new/shared codebase)

`{skill:hc-docs} init` (docs/ + CLAUDE.md, first time) · `{skill:hc-worktree}` (isolated worktree) · `{skill:hc-scout}` (discover files + patterns).
