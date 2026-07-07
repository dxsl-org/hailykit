# Skill Workflow Routing

Typical skill sequences for multi-step work. Flow chains show order; tables give skill to invoke.

## Core Development

Flow: `plan → cook → test → review → ship → log`

| User Intent | Start |
|-------------|-------|
| "implement X", "build X", "add X" | `{skill:hc-plan}` then `{skill:hc-cook}` |
| "spec first, then build X" | `{skill:hc-spec}` then `{skill:hc-cook}`, or `{skill:hc-cook} --spec` |
| "autonomously build X until done, no manual steps" | `{skill:hc-goal} "description"` |
| "autonomously build, no prompts" | `{skill:hc-goal} "description" --auto` |
| "long autonomous run, many phases, bounded by budget" | `{skill:hc-goal} "description" --auto --budget N` |
| "execute this plan" | `{skill:hc-cook} <plan-path>` |
| "quick implementation, I know the codebase" | `{skill:hc-cook} --quick` |
| "implement with tests first" | `{skill:hc-cook} --tdd` |
| "migrate library/framework/pattern X → Y" | `{skill:hc-cook} migrate "description"` |
| "port/extract feature X from <repo>" | `{skill:hc-cop} <source> [feature]` |
| "high-stakes implementation, adversarial verify before merge" | `{skill:hc-cook} --deep` |

## Bugfix

Flow: `scout → debug → fix → test → review`

| User Intent | Start |
|-------------|-------|
| "X is broken", "error in X", "bug in X" | `{skill:hc-fix}` (auto-scouts internally) |
| "CI is failing", "tests broken" | `{skill:hc-fix} --auto` |
| "production is down / active incident" | `{skill:hc-fix} --quick` |
| "CVE found / deps outdated / audit" | `{skill:hc-fix} deps` |
| "architectural failure, adversarial verify the fix" | `{skill:hc-fix} --deep` |
| "investigate why X happens" | `{skill:hc-scout}` then `{skill:hc-debug}` |
| "analyze this flame graph / heap dump" | `{skill:hc-debug} --profile <artifact>` |
| "failure spans multiple services" | `{skill:hc-debug} --trace <trace-id>` |
| "root cause uncertain, adversarial verify against 2-3 hypotheses" | `{skill:hc-debug} --deep` |

## Security Operations (Systems)

Flow: `assess → harden` (proactive) · `dfir → harden` (post-incident). Authorized-use only. For security of the **code you write**, use `{skill:hc-security}` / `{skill:hc-fix}` instead.

| User Intent | Start |
|-------------|-------|
| "pentest / recon / assess this authorized target" | `{skill:hs-assess}` |
| "solve this CTF challenge" | `{skill:hs-assess} --ctf` |
| "audit / harden this running system vs CIS/STIG" | `{skill:hs-harden}` |
| "apply hardening fixes with rollback" | `{skill:hs-harden} --fix` |
| "we were breached — investigate what happened" | `{skill:hs-dfir}` |
| "build a log timeline / correlate IOCs from evidence" | `{skill:hs-dfir}` |

## Planning & Architecture

| User Intent | Start |
|-------------|-------|
| "plan feature X" | `{skill:hc-plan}` |
| "quick plan, skip research" | `{skill:hc-plan} --quick` |
| "high-stakes architecture decision" | `{skill:hc-plan} --deep` |
| "document this architectural decision" | `{skill:hc-adr}` |
| "find undocumented decisions in codebase" | `{skill:hc-adr} scan` |
| "write formal spec before coding X" | `{skill:hc-spec} "X"` |
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

## Writing

| User Intent | Start |
|-------------|-------|
| "viết/write <document\|book\|story> X" | `{skill:hl-write} "X"` |
| "viết tiểu thuyết/tiểu luận/kế hoạch kinh doanh X" | `{skill:hl-write} "X"` |
| "continue/resume writing X" (long book/novel workspace) | `{skill:hl-write} <workspace-dir>` |

## Shipping & Release

| User Intent | Start |
|-------------|-------|
| "ship / release / create PR" | `{skill:hc-ship}` |
| "gradual rollout with feature flag" | `{skill:hc-ship} rollout <flag-name>` |
| "review before merge" | `{skill:hc-review}` |
| "quick review, no ceremony" | `{skill:hc-review} --quick` |
| "post review as inline PR comments" | `{skill:hc-review} --comment` |
| "adversarial verify, high-stakes review before merge" | `{skill:hc-review} --deep` |
| "thoroughly audit for vulnerabilities before release" | `{skill:hc-security} --deep` |

## Thinking Spectrum

Increasing depth — match level to problem:

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
`{skill:hl-brainstorm} --deep` — alias for `--debate --edges`, no separate machinery

## Post-Implementation

`{skill:hc-review}` (before merge) · `{skill:hc-ship}` (full pipeline: tests, review, version, PR) · `{skill:hl-log}` (document decisions) · `{skill:hc-git} analyze` (impact analysis).

## Setup (new/shared codebase)

`{skill:hc-docs} init` (docs/ + CLAUDE.md, first time) · `{skill:hc-worktree}` (isolated worktree) · `{skill:hc-scout}` (discover files + patterns).
