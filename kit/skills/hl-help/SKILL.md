---
name: hl-help
description: "Discover skills across 3 prefixes. List, search, filter, or show workflow combos."
when_to_use: "Invoke when discovering available skills or getting help with HailyKit."
user-invocable: true
argument-hint: "[--list] [--search <keyword>] [--domain <area>] [--prefix <hc|hd|hl>] [--all] [--combos]"
metadata:
  category: utilities
  keywords: [help, discover, search, list, skills, catalog, prefix, domain, workflow, combo]
---

# Help — Skill Discovery

Browse and search all available skills across all domain prefixes.

## Domain Prefix System (3 prefixes)

| Prefix | Domain |
|--------|--------|
| `hl:*` | Universal — thinking, research, planning, **+ design** (hl:design) |
| `hc:*` | Coding — backend, frontend, infra, testing, dev-tools, AI app frameworks, MCP, docs+extraction |

## Built-in vs HailyKit Skills (Common Confusions)

Some HailyKit skills have names that look similar to Claude Code built-in commands. They are NOT the same — scope and behavior differ.

| Built-in | HailyKit skill | Difference |
|---|---|---|
| `/init` — create a `CLAUDE.md` for the current repo | `{skill:hc-new}` — scaffold a whole new project (research → tech stack → design → plan → cook → test → review → docs → onboard) | `/init` is one file; `{skill:hc-new}` is end-to-end project creation with `--full/--auto/--quick/--parallel` modes |
| `/init` (CLAUDE.md only) | `{skill:hc-docs} init` — initialize `./docs/*` + CLAUDE.md for an existing project (scouts real code, writes real docs) | `{skill:hc-docs} init` reads the actual codebase; `/init` only emits one generic file |
| `/review` — review the current PR/diff | `{skill:hc-review}` — adversarial code review with red-team analysis, supports pending changes / PR# / commit / full scan | `{skill:hc-review}` is deeper and configurable |
| `/security-review` — review pending changes for security | `{skill:hc-security}` — STRIDE/OWASP audit with optional auto-fix loop, secret/dep scan | `{skill:hc-security}` covers broader surface and can fix findings |
| `/run` — launch this project's app to verify a change | `{skill:hc-test}` — execute test suites (unit/integration/e2e, optionally `--web` for Playwright/k6/a11y) | `/run` is manual verification; `{skill:hc-test}` is automated test execution |
| `/loop` — recurring task on an interval | `{skill:hc-optimize}` — autonomous metric-driven optimization loop (coverage, perf, bundle size) with auto-keep/discard | `/loop` schedules; `{skill:hc-optimize}` experiments toward a metric |
| `/mcp` — manage MCP servers (list, add, remove) | `{skill:hc-mcp-builder}` — build a new MCP server from scratch or agentize code | `/mcp` is client-side management; `hc:mcp-builder` creates the server code |
| `/schedule` — cron-scheduled remote agents | (no equivalent HailyKit skill) | Use the built-in directly |
| `/verify` — manually verify a code change works | `{skill:hc-test}` for automated checks, or built-in `/run` for hands-on verification | `/verify` is observation-based, not test-based |

**Rule of thumb:** if you want a quick, single-purpose action on the current session/repo, the built-in is usually right. If you want a full workflow with phases, modes, and reports, reach for the `/hc:*` skill.

## Usage

```
{skill:hl-help}                          # Quick-start guide + most common skills
{skill:hl-help} --list                   # All skills grouped by category
{skill:hl-help} --search <keyword>       # Search by keyword across name/description/tags
{skill:hl-help} --domain <area>          # Filter by domain area (see aliases below)
{skill:hl-help} --prefix <hc|hd|hl>     # Filter by domain prefix
{skill:hl-help} --all                    # Full catalog with complete descriptions
{skill:hl-help} --combos                 # Show common workflow chains (feature dev, bugfix, ...)
```

## Workflow

### No arguments — Quick Start

Print goal-first skill listing so users can immediately find what they need.

```
HailyKit — What do you want to do?

BUILD
  {skill:hc-new}          Bootstrap new project end-to-end
  {skill:hc-plan}         Plan a feature or architecture
  {skill:hc-cook}         Implement from a plan
  {skill:hc-cop}          Port a feature from another repo

FIX & DEBUG
  {skill:hc-fix}                Fix a concrete bug, error, or CI failure
  {skill:hc-fix} --hotfix       Emergency fix for active production incidents
  {skill:hc-fix} deps           Dependency audit, CVE patching, major version upgrades
  {skill:hc-debug}              Investigate unknown root cause
  {skill:hc-debug} --profile    Read heap dump / flame graph → identify bottleneck
  {skill:hc-debug} --trace      Correlate logs across services → distributed debugging
  {skill:hc-optimize}           Auto-optimize a measurable metric (N iterations)

SHIP & REVIEW
  {skill:hc-review}       Adversarial code review (red-team)
  {skill:hc-security}     STRIDE/OWASP audit + secret scan [--quick]
  {skill:hc-test}         Run tests + coverage [--web for Playwright/a11y]
  {skill:hc-ship}         Full release pipeline (test→review→version→PR)

UNDERSTAND & EXPLORE
  {skill:hc-scout}        Find files, map dependencies [--pack] [--graph]
  {skill:hc-docs}         Generate/update docs, extract PDFs/Office
  {skill:hc-lookup}                  Find library/framework API docs (context7)
  {skill:hc-lookup} react@19 hook   Version-specific lookup
  {skill:hc-lookup} hono vs express Parallel library comparison
  {skill:hc-lookup} next.js migration 14-to-15   Migration/changelog lookup

THINK & DECIDE
  {skill:hl-brainstorm}   Explore options + trade-offs [--persona] [--debate: all personas + edge analysis]
  {skill:hl-reasoning}    Step-by-step structured analysis
  {skill:hl-research}     Deep technical research with sources

GIT & ENVIRONMENT
  {skill:hc-git}                 Commit, push, PR, merge, impact analysis, sprint retro
  {skill:hc-git} analyze [ref]   What changed conceptually (intent, arch delta, risk radar)
  {skill:hc-git} retro [period]  Data-driven sprint retrospective from git history
  {skill:hc-worktree}            Parallel branches — no stash/switch (monorepo + submodule)

RECORD & TRACK
  {skill:hl-log}          Write session log → .agents/logs/
  {skill:hc-git} analyze  Impact analysis of recent changes
  {skill:hc-git} retro    Data-driven sprint retrospective from git history

VISUALIZE
  {skill:hl-visualize}    Diagrams, slides, HTML explanations [--mermaid --diagram --slides]
  {skill:hl-design}       Brand assets + AI image/video/TTS generation

DEPLOY & INFRA
  {skill:hc-deploy}       Deploy to Vercel, Railway, Fly.io (first-time setup)
  {skill:hc-devops}       Docker, Kubernetes, CI/CD, GitOps

DATABASE & MCP
  {skill:hc-db}           Schema design, SQL/NoSQL, migrations
  {skill:hc-mcp-builder}  Build MCP servers from scratch or agentize existing code

SPECIALIZED
  {skill:hc-browser}      AI-driven browser automation (long autonomous sessions)
  {skill:hl-context-engineering}  Optimize LLM context windows

Canonical chain: brainstorm → plan → cook → test → review → ship → log

  {skill:hl-help} --combos          All workflow chains
  {skill:hl-help} --list            All 30 skills by category
  {skill:hl-help} --search <kw>     Find by topic
```

### --list — Full catalog by category

Read `.claude/scripts/skills_data.yaml`, group by `category`, print with prefix:

```
## Core Workflow (11)
  {skill:hc-plan}          Plan implementations and architectures
  {skill:hc-cook}          Implement features end-to-end
  {skill:hc-fix}           Scout, debug, implement fix
  {skill:hc-debug}         Investigate and root-cause bugs
  {skill:hc-test}          Run tests; [--web] for Playwright/k6/a11y/visual regression
  {skill:hc-review}        Review code for quality and security
  {skill:hc-ship}          Full release pipeline
  {skill:hc-scout}         Search the codebase for patterns
  {skill:hc-new}     Bootstrap new projects
  {skill:hc-optimize}          Autonomous iterative task runner
  {skill:hc-worktree}      Parallel branches in isolated folders — no stash/switch. Supports standalone, monorepo (turbo/pnpm/nx), and submodule repos

## Thinking & Analysis (4)
  {skill:hl-brainstorm}          Trade-off analysis, 2–3 approaches, expert personas, edge analysis via --debate
  {skill:hl-research}            Deep technical research with sources
  {skill:hl-reasoning}           Step-by-step structured analysis + problem-solving
  {skill:hl-context-engineering} Optimize context and agent architecture

## Security (1)
  {skill:hc-security}         STRIDE/OWASP audit + secret/vuln scan (--quick)

## Design & Visual (3)
  {skill:hc-cook} <mockup.png|figma-url>  Replicate UI from mockups/screenshots/video (auto-detected, visual IS spec)
  {skill:hl-design}               Brand assets + AI media + design intelligence (search.py)
  {skill:hl-visualize} --mermaid              Diagrams with Mermaid.js v11 syntax

(React, MUI, Suspense, performance patterns auto-inject via framework-react-standards rule.)

## Backend Development (2)
  {skill:hc-db}             Schema design, SQL/NoSQL, migrations
  {skill:hc-cop}                   Extract, compare, port code between projects

(NestJS, FastAPI, Django, Express, Better Auth, Stripe, Polar, Paddle, Creem, SePay standards auto-inject when detected.)

## Infrastructure & DevOps (2)
  {skill:hc-deploy}    Deploy to Vercel, Netlify, Railway, Fly.io
  {skill:hc-devops}    Docker, Kubernetes, CI/CD, GitOps

## Development Tools
  {skill:hc-git}              Commits, PRs, merges, impact analysis, sprint retrospectives
  {skill:hc-git} analyze      Impact analysis of recent changes
  {skill:hc-git} retro        Sprint retrospective from git history
  {skill:hc-docs}             Update project documentation
  {skill:hc-lookup}           Search library/framework docs — topic, version (@ver), comparison (vs), migration
  {skill:hc-scout} --pack     Pack repository into LLM context (repomix)
  {skill:hc-mcp-builder}      Build + agentize MCP servers

## Senior Dev Specialists (via Task tool)
  Task(subagent_type="haily-adr-writer")          Architecture Decision Records
  Task(subagent_type="haily-tech-analyst")   Systematic tech debt inventory + priority matrix
  Task(subagent_type="api-haily-designer")        REST/GraphQL API contract design
  Task(subagent_type="haily-test-architect")      Test strategy design before implementation
  Task(subagent_type="haily-optimizer")      Simplify + efficiency + dead code removal

## Project Management
  {skill:hl-log}             Persist session decisions to memory
  {skill:hc-git} analyze     What changed and what it means
  {skill:hc-git} retro       Data-driven sprint retrospective

## Utilities
  {skill:hl-help}                This skill — discover all skills
  {skill:hl-visualize}           Visual explanations, diagrams, slide decks
  {skill:hc-browser}             AI-driven browser automation (long sessions)
```

**Category grouping map:**

| yaml `category` | Display heading |
|---|---|
| `workflow` | Core Workflow |
| `thinking` | Thinking & Analysis |
| `security` | Security |
| `frontend` | Frontend & Design |
| `backend` | Backend Development |
| `infrastructure` | Infrastructure & DevOps |
| `database` | Database |
| `dev-tools` | Development Tools |
| `ai-ml` | AI / LLM |
| `frameworks` | Frameworks & Platforms |
| `multimedia` | Multimedia |
| `project` | Project Management |
| `utilities` | Utilities |
| `other` | Other |

### --search \<keyword\>

Filter skills where `name`, `description`, or `keywords` contains the keyword (case-insensitive).

**Example:** `{skill:hl-help} --search browser`

```
Search results for "browser" (2 matches):

  {skill:hc-browser}        AI-driven browser automation with context-efficient snapshots
```

### --prefix \<domain\>

Filter by domain prefix — shows only skills from that prefix group.

| Prefix arg | Shows |
|---|---|
| `hl` | Universal skills (thinking, planning, Office automation) |
| `hc` | Coding skills |

### --domain \<area\>

Shorthand aliases mapped to category filter:

| Alias | Matches category |
|---|---|
| `frontend`, `ui`, `design` | frontend |
| `backend`, `api` | backend |
| `db`, `database` | database |
| `devops`, `infra` | infrastructure |
| `security`, `sec` | security |
| `ai`, `llm`, `ml` | ai-ml |
| `media`, `docs`, `office` | multimedia |
| `test`, `testing` | workflow |
| `util`, `tools` | utilities |
| `project`, `pm` | project |
| `thinking`, `analysis` | thinking |

### --all

Same as `--list` but include the full description for each skill (not truncated to 60 chars).

### --combos

Print the "Workflow Combos" section with all common skill chains.

## Skill Flags Reference

### `{skill:hl-brainstorm}` — Persona Flags

Expert consultation through a specific lens. One persona flag = skip full brainstorm cycle, answer immediately. Higher-level personas can zoom into lower-level concerns; lower-level personas cannot zoom out.

| Flag | Vantage | Scope range |
|------|---------|-------------|
| `--architect` | System structure & evolvability | System → Component |
| `--scientist` | Empirical validation & measurement | Cross-level |
| `--social-scientist` | Human & org behavior | Individual → Societal |
| `--philosopher` | Logic + systems thinking | Meta — any level |
| `--economist` | Incentives & resource allocation | Micro → Macro |
| `--strategist` | Long-term positioning | Product → Business |
| `--creative-director` | Creative vision & experience integrity (encompasses Designer) | Concept → UX Detail |
| `--manager` | Org capacity + operations (encompasses Operator) | Decision → Ops Detail |
| `--devil` | Adversarial meta-level — challenges the premise itself | Everything |

**Examples:**
```
{skill:hl-brainstorm} --architect "how should we structure our auth module?"
{skill:hl-brainstorm} --philosopher "what are we assuming about our users?"
{skill:hl-brainstorm} --strategist "should we build or buy this feature?"
{skill:hl-brainstorm} --devil "is our entire approach to this problem wrong?"
{skill:hl-brainstorm} --debate "add real-time notifications"
{skill:hl-brainstorm} --edges "checkout flow"
{skill:hl-brainstorm} --debate --edges "migrate auth to OAuth2"
```

## Workflow Combos — Common Sequences

Skills compose into chains. Each `→` means "after that step completes, invoke the next skill".

### Feature Development (canonical chain)

```
{skill:hl-brainstorm} "feature idea"
  → {skill:hc-plan}
  → {skill:hc-cook} <plan-path>
  → {skill:hc-test}
  → {skill:hc-review}
  → {skill:hc-ship}
```

**Fast variant:** `{skill:hc-plan} --quick "task"` → `{skill:hc-cook}` → `{skill:hc-ship}`

### Bugfix

```
{skill:hc-scout} "auth flow"
  → {skill:hc-debug} "error message or behavior"
  → {skill:hc-fix}
  → {skill:hc-test}
  → {skill:hc-review} (optional for risky fixes)
```

**Shortcut:** `{skill:hc-fix} --auto "ci failing on tests"` runs the whole chain end-to-end.

### Risky/Major Change (extra safety)

```
{skill:hl-research} "topic"
  → {skill:hl-brainstorm}
  → {skill:hl-brainstorm} --debate        (all 8 personas + 12-dimension edge sweep → GO/CAUTION/STOP)
  → {skill:hc-plan}
  → {skill:hc-cook}
  → {skill:hc-review}
```

### UI from Mockup/Screenshot

```
{skill:hl-design} search.py --design-system   (pick style, palette, typography)
  → {skill:hc-cook} screenshot.png            (layout auto-detected from file extension)
  → {skill:hc-test} --web     (Playwright visual regression + a11y)
```

### New Project Bootstrap

```
{skill:hc-new} --auto "project description"
```

Single command: research → tech stack → design → plan → cook → test → review → docs → onboard. Use `--full` for interactive, `--quick` to skip research, `--parallel` for multi-agent.

### AI Application Building

```
{skill:hl-research} "agent framework comparison"
  → {skill:hc-plan}
  → {skill:hc-mcp-builder}
  → {skill:hc-test}
  → {skill:hc-review}
```

### Design System / Brand Identity

```
{skill:hl-design} <brand-name>
  → `scripts/ui-ux/search.py --design-system` (style + token grounding)
  → {skill:hc-cook} <mockup.png|figma-url>   (layout auto-detected)
```

### Documentation Maintenance

```
{skill:hc-docs} init                    (first time — analyze codebase, generate docs/*)
{skill:hc-docs} update                  (sync docs with code changes)
{skill:hc-docs} summarize               (quick refresh of codebase-summary.md)
{skill:hc-docs} extract <file.pdf>      (extract external PDF/Office → markdown)
{skill:hc-docs} llms                    (generate llms.txt for AI-friendly site index)
```

### Release Pipeline

```
{skill:hc-ship}
```

One command: merge main → test → review → version → commit → push → PR.

### Quick Diagram or Visual Explanation

```
{skill:hl-visualize} --diagram "topic"
{skill:hl-visualize} --explain "topic"
{skill:hl-visualize} --slides "topic"
```

### Edge-Case Coverage Before Implementation

```
{skill:hl-brainstorm} --debate "feature"
  → {skill:hc-plan}
  → {skill:hc-cook} --tdd
```

### Senior Dev Workflows

```
# Understand before reviewing a PR
{skill:hc-git} analyze main..HEAD      (intent + arch delta + risk radar)
  → {skill:hc-review}

# Quick plan when you know the codebase
{skill:hc-plan} --quick "add rate limiting"   (skip research + red-team)
  → {skill:hc-cook}
  → {skill:hc-git} cp

# Sprint retrospective
{skill:hc-git} retro 2w --compare     (vs previous 2 weeks; add --team for per-author)

# Tech debt session
Task(subagent_type="haily-tech-analyst", prompt="audit src/ for P1-P2 debt")

# Architecture decision record
Task(subagent_type="haily-adr-writer", prompt="document decision: PostgreSQL over MongoDB")

# Feature flag gradual rollout
{skill:hc-ship} rollout feature.checkout.new-payment-flow

# Large-scale migration
{skill:hc-cook} migrate "Moment.js → date-fns"

# Distributed system debugging
{skill:hc-debug} --trace abc123def456

# Performance profiling
{skill:hc-debug} --profile flamegraph.svg
```

### Session Wrap-up

```
{skill:hc-git} analyze    (impact analysis: what changed conceptually)
{skill:hl-log}            (persist decisions to memory for future sessions)
{skill:hc-git} retro      (sprint retro from git metrics — for teams)
```

### Thinking Spectrum

```
{skill:hl-research} → {skill:hl-reasoning} → {skill:hl-brainstorm} → {skill:hl-brainstorm} --debate → Dynamic Workflows (`/workflow`)
```

| When | Use |
|------|-----|
| Need info, evaluate options, gather sources | `{skill:hl-research}` |
| Multi-step self-analysis, revise hypotheses | `{skill:hl-reasoning}` |
| Expert lens on one specific question | `{skill:hl-brainstorm} --[persona]` |
| Explore 2–3 approaches with trade-offs | `{skill:hl-brainstorm}` |
| Adversarial review + edge analysis before risky change | `{skill:hl-brainstorm} --debate` |

### Core Development Flow

```
brainstorm → debate            → plan → cook
(options)   (stress + edges)    (plan)  (impl)
```


## Stack Auto-Injection (Reference)

Language- and framework-specific guidance is **auto-loaded** at session start based on project detection — no skill to invoke.

| Detected | Rule file loaded |
|---|---|
| 	sconfig.json / package.json w/ TS | lang-typescript.md |
| package.json w/o TS | lang-javascript.md |
| pyproject.toml / 
equirements.txt | lang-python.md |
| Go / Rust / Java / Kotlin / Swift / PHP / Ruby / Elixir / C / C++ / Zig / etc. | matching lang-*-standards.md (25 languages) |
| 
ext / 
eact / ue / 
uxt / stro / svelte / 
emix in deps | matching ramework-*-standards.md |
| @nestjs/core / astapi / django / xpress / astify / hono / lysia | matching ramework-*-standards.md |
| lutter / 
eact-native / xpo | matching ramework-*-standards.md |
| etter-auth / stripe / polar / paddle / creem / sepay | extra framework rules (stack on primary) |
| 	urbo.json / 
x.json / pnpm-workspace.yaml | ramework-monorepo.md |
| shopify.app.toml | ramework-shopify.md |
| Phoenix / Nerves / LiveView / Ecto / Oban / Broadway / Absinthe | matching Elixir framework rules |

**Why no skill?** The hook detects and injects automatically — you get the right rules without doing anything.
## Implementation Notes

- Read skill data from `.claude/scripts/skills_data.yaml`
- If missing, fall back to scanning `.claude/skills/*/SKILL.md` frontmatter directly
- Always print skill names with their full prefix (e.g., `{skill:hc-plan}`, `{skill:hl-design}`, `{skill:hl-brainstorm}`)
- Truncate descriptions to 60 chars in `--list` mode; full description in `--all` mode
- Sort alphabetically within each category group
- `--prefix` filter: match skills where `name` starts with `<prefix>:` (e.g., `hl:` or `hc:`)
- Highlight the core workflow skills (`hc:plan`, `hc:cook`, `hc:fix`, `hc:test`, `hc:ship`) at the top of `--list` output
