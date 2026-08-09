# Skill Workflow Routing

Use these sequences when the task spans multiple steps.

## Core Development

Flow: `plan → cook → test → review → ship → log`

| User Intent | Start |
|-------------|-------|
| "implement X", "build X", "add X" | `{skill:hc-plan}` then `{skill:hc-cook}` |
| "spec first, then build X" | `{skill:hc-spec}` then `{skill:hc-cook}`, or `{skill:hc-cook} --spec` |
| "autonomously build X until done, no manual steps" | `{skill:hc-goal} "description"` |
| "execute this plan" | `{skill:hc-cook} <plan-path>` |
| "quick implementation, I know the codebase" | `{skill:hc-cook} --quick` |
| "implement with tests first" | `{skill:hc-cook} --tdd` |
| "migrate library/framework/pattern X → Y" | `{skill:hc-cook} migrate "description"` |
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
| "root cause uncertain, adversarial verify against 2-3 hypotheses" | `{skill:hc-debug} --deep` |

## Security Operations (Systems)

Flow: `assess → harden` or `dfir → harden`. Authorized-use only. For security of the **code you write**, use `{skill:hc-security}` / `{skill:hc-fix}` instead.

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
| "quick spec for a small change" | `{skill:hc-spec} --quick "X"` |
| "design the API for X" | Delegate: `Task(subagent_type="haily-api-designer")` |
| "what tests should we write for X?" | Delegate: `Task(subagent_type="haily-test-architect")` |
| "get a top-tier recommendation on one prepared decision" | `/hl-advisor` (delegates to `haily-advisor`) |

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
| "continue/resume writing X" (long book/novel workspace) | `{skill:hl-write} <workspace-dir>` |
| "OCR this scan corpus, then write/research from it" | `{skill:hl-ocr}` then `{skill:hl-write}` or `{skill:hl-research}` |

## Shipping & Release

| User Intent | Start |
|-------------|-------|
| "ship / release / create PR" | `{skill:hc-ship}` |
| "gradual rollout with feature flag" | `{skill:hc-ship} rollout <flag-name>` |
| "review before merge" | `{skill:hc-review}` |
| "quick review, no ceremony" | `{skill:hc-review} --quick` |
| "post review as inline comments" | `{skill:hc-review} --comment` |
| "adversarial verify, high-stakes review before merge" | `{skill:hc-review} --deep` |
| "thoroughly audit for vulnerabilities before release" | `{skill:hc-security} --deep` |

## Thinking

Evidence research → `{skill:hl-research}` · sequential analysis → `{skill:hl-reasoning}` · options and trade-offs → `{skill:hl-brainstorm}`.

## Setup

Existing repo docs → `{skill:hc-docs} init` · isolated worktree → `{skill:hc-worktree}` · codebase discovery → `{skill:hc-scout}`.
