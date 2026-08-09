# Skill Workflow Routing

Use these chains only when an intent spans multiple stages; single-domain routing lives in `haily-domain.md`.

## Core Development

Flow: `plan → cook → test → review → ship → log`

| User intent | Start |
|---|---|
| Implement or build | `{skill:hc-plan}` → `{skill:hc-cook}` |
| Spec-gated build | `{skill:hc-spec}` → `{skill:hc-cook}`, or `{skill:hc-cook} --spec` |
| Autonomous multi-phase delivery | `{skill:hc-goal}` |
| Execute an existing plan | `{skill:hc-cook} <plan-path>` |
| Quick known implementation | `{skill:hc-cook} --quick` |
| Tests first | `{skill:hc-cook} --tdd` |
| Library/framework/pattern migration | `{skill:hc-cook} migrate "description"` |
| High-stakes implementation | `{skill:hc-cook} --deep` |

## Bugfix

Flow: `scout → debug → fix → test → review`

| User intent | Start |
|---|---|
| Bug or runtime error | `{skill:hc-fix}` |
| Failing CI/tests | `{skill:hc-fix} --auto` |
| Active production incident | `{skill:hc-fix} --quick` |
| Dependency/CVE work | `{skill:hc-fix} deps` |
| Investigation without an authorized fix | `{skill:hc-scout}` → `{skill:hc-debug}` |
| Uncertain root cause | `{skill:hc-debug} --deep` |

## Investigation

Flow: `{skill:hc-scout}` → `{skill:hc-debug}` → `{skill:hl-brainstorm}` → `{skill:hc-plan}`. Skip stages already satisfied by current evidence.

## Security Operations (Systems)

Authorized proactive work: `{skill:hs-assess}` → `{skill:hs-harden}`. Post-incident work: `{skill:hs-dfir}` → `{skill:hs-harden}`. Code security stays with `{skill:hc-security}` / `{skill:hc-fix}`.

## Content Pipeline

Scanned corpus: `{skill:hl-ocr}` → `{skill:hl-write}` for authored prose or `{skill:hl-research}` for a research artifact.

## Shipping & Release

| User intent | Start |
|---|---|
| Ship, release, or create PR | `{skill:hc-ship}` |
| Commit or push only | `{skill:hc-git}` |
| Gradual rollout | `{skill:hc-ship} rollout <flag-name>` |
| Review before merge | `{skill:hc-review}` |
| Quick review | `{skill:hc-review} --quick` |
| Post inline findings | `{skill:hc-review} --comment` |
| Adversarial review | `{skill:hc-review} --deep` |
| Release security audit | `{skill:hc-security} --deep` |
