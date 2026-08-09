---
name: hl-help
description: "Discover skills across 3 prefixes. List, search, filter, or show workflow combos."
when_to_use: "Invoke when discovering available skills or getting help with HailyKit."
user-invocable: true
argument-hint: "[--list] [--search <keyword>] [--domain <area>] [--prefix <hc|hl|hs>] [--all] [--combos]"
metadata:
  category: utilities
  keywords: [help, discover, search, list, skills, catalog, prefix, domain, workflow, combo]
---

# Help — Skill Discovery

Browse and search HailyKit skills without loading the full catalog up front. Keep the hot path in this file; load cold references only when the request needs them.

## Domain Prefix System

| Prefix | Domain |
|--------|--------|
| `hl-*` | Universal skills — thinking, research, planning, writing, visualization |
| `hc-*` | Coding skills — implementation, testing, review, docs, infra, data, MCP |
| `hs-*` | Security ops for running systems — assessment, hardening, forensics/IR; distinct from `{skill:hc-security}`, which audits code |

## Usage

```text
{skill:hl-help}
{skill:hl-help} --list
{skill:hl-help} --search <keyword>
{skill:hl-help} --domain <area>
{skill:hl-help} --prefix <hc|hl|hs>
{skill:hl-help} --all
{skill:hl-help} --combos
```

## Quick Start

With no arguments, print a goal-first shortlist so the next step is obvious:

```text
BUILD
  {skill:hc-goal}       Autonomous loop: goal → plan → cook → review → commit [--auto]
  {skill:hc-plan}       Plan a feature or architecture
  {skill:hc-cook}       Implement from a plan
  {skill:hc-spec}       Write an EARS spec before coding

FIX & DEBUG
  {skill:hc-fix}        Fix a concrete bug, CI failure, or dependency issue
  {skill:hc-debug}      Investigate unknown root cause
  {skill:hc-test}       Run tests + coverage

SHIP & REVIEW
  {skill:hc-review}     Adversarial code review
  {skill:hc-security}   STRIDE/OWASP code audit [--quick] [--deep]
  {skill:hc-ship}       Full release pipeline

SECURITY OPS (running systems — authorized-use only)
  {skill:hs-assess}     Red-team assessment, pentest, or CTF
  {skill:hs-harden}     CIS/STIG audit + hardening [--fix]
  {skill:hs-dfir}       Forensics + incident response

DISCOVER
  {skill:hc-scout}      Find files and map dependencies
  {skill:hc-lookup}     Search library/framework docs
  {skill:hl-brainstorm} Explore options and trade-offs
  {skill:hl-write}      Write a report, proposal, essay, or story
```

Minimal combo examples stay in the hot path:

```text
{skill:hc-plan} "feature" -> {skill:hc-cook} <plan-path> -> {skill:hc-test} -> {skill:hc-review}
{skill:hc-debug} "symptom" -> {skill:hc-fix} -> {skill:hc-test}
{skill:hc-goal} "feature description" --auto
```

## Filters And Output Modes

| Flag | Behavior | Minimal example |
|------|----------|-----------------|
| none | Quick-start shortlist by goal | `{skill:hl-help}` |
| `--list` | Read `.claude/scripts/skills_data.yaml`, group by category, print full prefixed names, and keep core workflow skills near the top | `{skill:hl-help} --list` |
| `--search <keyword>` | Case-insensitive match on `name`, `description`, and `keywords` | `{skill:hl-help} --search browser` |
| `--domain <area>` | Apply alias-to-category mapping, then show matching skills | `{skill:hl-help} --domain design` |
| `--prefix <hc|hl|hs>` | Match skills whose `name` starts with `<prefix>-` | `{skill:hl-help} --prefix hs` |
| `--all` | Same routing as `--list`, but keep full descriptions instead of the truncated list view | `{skill:hl-help} --all` |
| `--combos` | Show common workflow chains and handoff patterns | `{skill:hl-help} --combos` |

Implementation contract:

- Read skill data from `.claude/scripts/skills_data.yaml`; if unavailable, fall back to scanning `.claude/skills/*/SKILL.md` frontmatter directly.
- Always print full prefixed names such as `{skill:hc-plan}` and `{skill:hs-assess}`.
- Truncate descriptions to 60 chars in `--list`; use full descriptions in `--all`.
- Keep the security routing distinction explicit: `{skill:hc-security}` is code security, `hs-*` skills are for authorized running-system security work.

## Reference Map

Load only the reference that matches the request:

| Need | Load |
|------|------|
| Built-in command confusion or community alias mapping | `references/common-confusions.md` |
| Full `--list` catalog, category headings, `--domain` aliases, `--all` behavior | `references/catalog-and-filters.md` |
| Full workflow chains, handoff recipes, and senior-dev sequences | `references/workflow-combos.md` |
| `{skill:hl-brainstorm}` persona flag details | `references/brainstorm-flags.md` |
