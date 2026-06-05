---
name: hc-new
description: "Bootstrap a project end-to-end: detect project type → research domain → select stack → design (UI/fullstack only) → plan → implement → ship. Canonical Route→Recon→Draft→Build→Verify→Ship pipeline."
when_to_use: "Invoke when creating a new project from scratch with a full stack setup."
user-invocable: true
argument-hint: "<requirements> [--quick] [--auto]"
metadata:
  category: workflow
  keywords: [new, create, scaffold, project, setup, boilerplate]
---

# New — End-to-End Project Creation

From idea to running code: detect project type, research the domain, select stack, design (UI/fullstack projects only), plan phases, implement, test, review, and ship. Runs the full Route → Recon → Draft → Build → Verify → Ship pipeline. Direct about feasibility and trade-offs.

## Usage

```
{skill:hc-new} <requirements> [--quick] [--auto]
```

| Flag | Behavior |
|------|----------|
| *(none)* | Interactive — pauses at each Checkpoint for user approval |
| `--quick` | Skip Research agents and Design sub-stage; delegates `{skill:hc-plan} --quick` + `{skill:hc-cook} --quick` |
| `--auto` | Autonomous — agent decides all trade-offs; composes with `--quick` |

```
{skill:hc-new} "SaaS dashboard with auth and Stripe payments"
{skill:hc-new} "REST API with JWT auth" --quick
{skill:hc-new} "E-commerce platform" --auto
{skill:hc-new} "CLI tool for log parsing" --quick --auto
```

## Constraints

> **Required — delegate, never implement directly:** Always route implementation through `{skill:hc-plan}` then `{skill:hc-cook}`. Never write code directly from this skill.

> **Required — activate domain skills:** When the project requires a database, activate `{skill:hc-db}` during the Recon stage. Activate other domain skills (`{skill:hc-security}`, `{skill:hc-devops}`) as scope demands.

## Process

Pipeline: **Route → Recon → Draft → Build → Verify → Ship**

---

### Route

Check if Git is initialized.
- **Interactive:** ask user before init
- **`--auto`:** init `main` automatically via `haily-git-manager` subagent

**Interactive only:** use `AskUserQuestion` to clarify requirements, constraints, and objectives. Continue until deliverables, tech constraints, and scope boundaries are concrete. **`--auto`:** infer from input description.

Detect project type from the requirements description:

| Detected type | Design sub-stage in Recon |
|---|---|
| `ui` / `fullstack` | Active |
| `cli` / `library` / `api` / `backend` | Skipped — no Design Checkpoint |
| `unknown` | `AskUserQuestion` (header: "Project Type"): UI/Fullstack · API/Backend · CLI/Library · Other |

`--quick`: always skip Design sub-stage regardless of project type.

---

### Recon

Spawn multiple `haily-researcher` subagents in parallel. Explore domain validity, competing solutions, key challenges, best approaches. Keep reports ≤150 lines; list open questions at end.

**Skip Research when `--quick`:** proceed directly to Tech Stack.

**Tech Stack:** use `haily-planner` + `haily-researcher` subagents in parallel to evaluate options.
- **Interactive:** present 2–3 options with pros/cons via `AskUserQuestion`; write approved stack to `./docs/`
- **`--auto`:** auto-select best-fit stack; write to `./docs/`

**Checkpoint:** Interactive: present findings, proceed with approval. `--auto`: proceed automatically.

**Design sub-stage (ui/fullstack only — skip for cli/library/api/backend and when `--quick`):**

Use `haily-designer` + `haily-researcher` subagents in parallel:
- Research style, trends, fonts, colors, spacing, layout
- `haily-designer` produces: `./docs/design-guidelines.md` + wireframes at `./docs/wireframes/`
- If no logo: generate with `{skill:hl-design}`
- Screenshot wireframes → save to `./docs/wireframes/`

**Image tools:** `{skill:hl-design}` for generation; `gemini` CLI for analysis; `imagemagick` for crop/resize.

**Checkpoint (Interactive only):** present design for approval; repeat if rejected. Architectural decisions cannot be cheaply undone — always run this Checkpoint for UI/fullstack projects.

---

### Draft

Delegate to `{skill:hc-plan}`:
- **Interactive:** `{skill:hc-plan} <requirements>` — presents plan for approval
- **`--quick`:** `{skill:hc-plan} --quick <requirements>` — skips research depth; no gate
- **`--auto`:** `{skill:hc-plan} --auto <requirements>` — auto-detects complexity; no gate

Creates plan directory (naming from `## Naming` section): `plan.md` + `phase-XX-*.md` files. Analyze phase dependency graph — **Interactive:** offer to parallelize independent phases; **`--auto`:** parallelize automatically.

**Checkpoint (Interactive only).**

---

### Build

Delegate to `{skill:hc-cook}`:
- **Interactive:** `{skill:hc-cook} <plan-path>`
- **`--quick`:** `{skill:hc-cook} <plan-path> --quick`
- **`--auto`:** `{skill:hc-cook} <plan-path> --auto`

For UI/fullstack projects: use `haily-designer` subagent per `./docs/design-guidelines.md`. Asset pipeline: `{skill:hl-design}` (generate) → `gemini` CLI (analyze) → `imagemagick` (crop/resize).

---

### Verify

Handled by `{skill:hc-cook}`:
- Write real tests — no fake data, mocks, or shortcuts to pass CI
- `haily-tester` subagent runs tests; `haily-debugger` subagent fixes failures; repeat until all pass
- `haily-reviewer` subagent reviews code; fix critical issues → retest → repeat until clean

---

### Ship

**Docs:** Activate `{skill:hc-docs} init`. Use `haily-docs-writer` subagent to create:
- `./docs/README.md` (≤300 lines)
- `./docs/codebase-summary.md`
- `./docs/project-overview-pdr.md`
- `./docs/code-standards.md`
- `./docs/system-architecture.md`

Use `haily-project-manager` subagent to create `./docs/project-roadmap.md` and mark plan phases complete.

**Quick-start:** Generate `./docs/quick-start.md` (≤50 lines):
- Required env vars (derived from `.env.example` or project scan)
- First-run command
- Key API endpoints or CLI commands (if applicable)

**Haily profile (optional):** Use `AskUserQuestion` (header: "Haily — Assistant Profile") to offer personalization:

```
Would you like to set Haily's communication style for this project?
  - Vietnamese preset  → xưng em / gọi bạn · language: vi · comments: English
  - English preset     → I/you · language: en · comments: English
  - Skip               → Claude auto-adapts (no config written)
```

If Vietnamese or English preset chosen, write `.claude/haily.json` (create or merge if exists):

```json
{
  "assistant": {
    "name": "Haily",
    "addressStyle": "em/bạn",
    "language": "vi",
    "codeComments": "en",
    "documentation": "en"
  }
}
```

Adjust `addressStyle`/`language` per choice. Skip → do not write `haily.json`.
The profile is auto-injected by the session bootstrap — no CLAUDE.md section needed.

**CLAUDE.md:** Generate `./CLAUDE.md` — project context only (no assistant profile section):

```markdown
# CLAUDE.md

## Project
[Name] — [1-sentence: purpose + primary tech stack]

## Structure
| Dir | Purpose |
|-----|---------|
| `src/` | [actual source dir] |
[Add only dirs that are non-obvious]

## Rules
[Only project-specific constraints. Delete if none.]
```

**Include:** project name, 1-line description, non-obvious directory purposes, project-specific constraints.  
**Exclude:** assistant profile (in `haily.json`), modularization rules, workflow descriptions, coding standards — all auto-injected by hooks.

**Final:**
1. Summary of all changes with brief explanations
2. Suggest next steps
3. Ask whether to commit → spawn `haily-git-manager` if yes
4. Run `{skill:hl-log}` for a concise journal entry

## Workflow Position

**Entry point:** project creation from scratch — runs before all other skills
**Internally invokes:** `{skill:hc-plan}` → `{skill:hc-cook}` → `{skill:hc-docs}`
**Related:** `{skill:hc-plan}`, `{skill:hc-cook}`, `{skill:hc-deploy}`
