# HailyKit Canonical SKILL.md Template

Copy this file as the starting point for every new skill or rewrite.
Delete all `[bracketed placeholders]` and comment lines before saving.

> **Terminology:** All stage names, quality mechanism names, and vocabulary must follow
> `docs/engineering-standards.md`. Check Part III (Terminology Reference) and Part V
> (Writing Conventions + Banned Phrases) before writing.

---

## Frontmatter

```yaml
---
name: [hl|hc|hd]:[kebab-name]
description: "[Capability-led. Start with verb or noun — NOT 'Use this to…'.
  Include 3–5 trigger keywords. Max 512 chars.]"
when_to_use: "[One imperative sentence: 'Invoke when …']"
user-invocable: true
category: [workflow | thinking | coding | design | project | dev-tools | database | infrastructure | security]
keywords: [keyword1, keyword2, keyword3]
argument-hint: "<required-arg> [--auto] [--flag2]"
---
```

**Required fields:** `name`, `description`, `when_to_use`, `user-invocable`, `category`, `keywords`, `argument-hint`

**Optional fields** (add only when relevant):
```yaml
metadata:
  attribution: "[Author/source (MIT)]"   # for skills adapted from public work
```

**Category guide:**
- `workflow` — orchestrates a multi-step dev process (plan, cook, fix, ship)
- `thinking` — reasons, analyzes, brainstorms (brainstorm, research, reasoning)
- `coding` — tied to a technical domain (db, devops, security, test)
- `design` — produces visual or brand artifacts
- `project` — project state, team coordination (team, worktree, scout)
- `dev-tools` — developer tooling (git, mcp-builder, lookup)
- `database` — database design, queries, migrations
- `infrastructure` — deployment, cloud, CI/CD
- `security` — audits, vulnerability scanning

---

## Body Template

```markdown
# [Name] — [Tagline]

[1–2 sentences. What it does. When to use it.
DO NOT start with "You are", "I am", or any roleplay opener.
DO NOT use "brutal honesty" or "elite expert" language.]

## Usage

```
{skill:[prefix]:[name]} <required-arg> [--flag]
```

[Flag table — only include if the skill has 2+ distinct modes. Omit if single mode.]

| Flag | Behavior |
|------|----------|
| *(none)* | [Default behavior] |
| `--auto` | [Autonomous/no-gates behavior] |

[Examples — always include 2-4 concrete examples]

## Constraints

[Mandatory rules. Use > **Required — name:** callout syntax.
Each callout = one rule. 1–4 callouts max. Skip section entirely if no mandatory rules.]

> **Required — [rule name]:** [What must happen. One sentence. Why in one clause if non-obvious.]

> **Required — [rule name]:** [What must happen.]

## Scope Contract

[Workflow skills only — omit for tool, analysis, and thinking skills.
Captures three sections before the Draft stage begins.
Present via `AskUserQuestion` grounded in Recon findings.]

- **Deliverables** — concrete output artifacts the user will see (file paths, endpoints, screens)
- **Boundaries** — acceptance criteria (done-when list) + scope exclusions + invariants that must not change
- **Blast Radius** — modules, contracts, and interfaces the change touches or could affect

[Maps to `context-snippets.json` fields: task, acceptanceCriteria, touchpoints, blastRadius, publicContracts.]

## Process

[Numbered steps. 1–3 lines per step. No paragraph walls.
Name steps after what they DO, using bold prefix for scannability.

Workflow skills: use canonical stage names where applicable —
  Route · Recon · Draft · Build · Verify · Ship
Tool/analysis/thinking skills: use descriptive action names.

Every step that completes a stage should emit a status line:
  ✓ [StageName]: [status summary] — [key metrics]
  e.g. ✓ Recon: 5 findings, 3 requirements locked]

1. **[Route / Step name]** — [input classification or action; log `✓ [Stage]: …`]
2. **[Recon / Step name]** — [codebase scan, requirements capture; log `✓ Recon: …`]
3. **[Step name]** — [what happens, which agent is delegated, what output is produced]

[If the skill has a mode that substantially changes behavior, add a section at the same ## level:]

## --[flag] Mode

[What this mode does differently. Input, process, output — 3–8 lines max.
If longer than 8 lines, move content to a references/ file and load it from here.]

## --deep Mode

[Only for skills implementing the shared depth axis (`docs/engineering-standards.md` → Depth Tiers).
State concretely what deepens — more research streams, an added adversarial/red-team pass, per-item
depth — and the cost multiplier if it differs from the standard 3–5×. Never claim `--deep` auto-activates;
point to the never-auto-escalate rule instead of restating it. Omit this section for skills that don't
offer `--deep`.]

## Output

[What artifact is produced. Where it's saved. Format.
Example: "Saves to `.agents/reports/debug-YYMMDD-HHMM-{slug}.md`"]

[Omit this section when output is obvious from the Process section.]

## Session Model

[Optional — include when the skill delegates to judgment agents whose model tier escalates with the
session. Judgment agents (`haily-planner`, `haily-implementor`, `haily-reviewer`, `haily-brainstormer`,
`haily-debugger`, ...) inherit the session model — running on `{model:ultra}` passes that model through
automatically. Mechanical agents stay capped at their `model_max` tier and never escalate. Depth tiers use
the canonical vocabulary (`fast|medium|thinking|ultra`, compared by ordinal rank — never the literal
string) and are surfaced to every subagent via `HL_MODEL_TIER`; see `docs/engineering-standards.md` →
Depth Tiers. Omit this section for skills with no tier-sensitive agent delegation.]

## Workflow Position

**Follows:** `{skill:xx:yyy}` — [one-clause reason, or omit the clause if self-evident]
**Precedes:** `{skill:xx:yyy}` — [one-clause reason]
**Related:** `{skill:xx:yyy}`

[Use "Follows/Precedes" — NOT "Typically follows/precedes".
Use "Auto-invoked by" when another skill calls this one programmatically.
Use "Used alongside" when there is no ordering relationship.
At least one of Follows/Precedes must be present. Related is optional.]

## References

[Only include this section if the skill loads reference files.
Use a table for 3+ files. Use bullets for 1–2 files.]

| File | Content |
|------|---------|
| `references/[filename].md` | [One-line description of what it contains] |
```

---

## Section Order (canonical)

```
1.  Frontmatter
2.  # Title — Tagline
3.  Intro paragraph (1–2 sentences)
4.  ## Usage
5.  ## Constraints        ← only if mandatory rules exist
6.  ## Scope Contract     ← workflow skills only; omit for tool/analysis/thinking skills
7.  ## Process
8.  ## [--flag Mode]      ← only if a flag creates substantially different behavior (includes ## --deep Mode)
9.  ## Output             ← only if not obvious from Process
10. ## Session Model      ← only if judgment agents in this skill escalate with the session tier
11. ## Workflow Position
12. ## References         ← only if reference files are loaded
```

Do NOT add sections outside this order. Do NOT add `## Examples` (examples go in `## Usage`). Do NOT add `## Anti-Rationalization` or `## Communication Style`.

---

## Constraint Callout Syntax

Always `> **Required — [name]:**` format. The name is kebab-case or short phrase.

**Canonical shorthand names for workflow skills** (use these verbatim when applicable):
- `plan-first` — no implementation until a plan exists and has been reviewed
- `recon-first` — scan codebase before asking the user or producing a plan
- `zero-regress` — all existing tests pass, no regressions, public contracts unchanged unless intentional

```markdown
> **Required — scout first:** Before any question or action, scan the codebase.
> Collect: project type, language/framework, relevant modules, docs in `./docs/`,
> in-flight plans in `./.agents/`. Report 3–6 findings before proceeding.

> **Required — no code before plan:** Do not write implementation code until a
> plan exists and has been reviewed. User override: if user says "just code it",
> respect their instruction.
```

**DO NOT use:**
- `<HARD-GATE>` XML blocks
- `**Bold (mandatory):**` inline style
- `## Hard Gates` or `## HARD-GATEs` section names

---

## Cross-Reference Syntax

In body text — always wrap in backticks:
```
`{skill:hc-plan}`, `{skill:hl-brainstorm}`, `{skill:hc-cook}`
```

In Workflow Position — always wrap in backticks:
```
**Follows:** `{skill:hc-plan}` — after brainstorming options
```

**DO NOT use** slash form (`/hc-plan`) anywhere in SKILL.md body. Slash form is user-terminal syntax.

---

## Length Guidelines

| Section | Target |
|---------|--------|
| Frontmatter description | 80–200 chars |
| Intro paragraph | 1–2 sentences |
| Constraints | 1–4 callouts |
| Process steps | 4–12 steps, 1–3 lines each |
| Total SKILL.md | 60–150 lines for simple skills; up to 250 for complex multi-mode skills |

Skills over 250 lines should move content to `references/` files.

---

## Anti-Patterns

For the full banned phrases list, see `docs/engineering-standards.md` Part V (Writing Conventions).

Structural patterns to avoid in SKILL.md:

| Pattern | Fix |
|---------|-----|
| `<HARD-GATE>` XML blocks | Use `## Constraints` + `> **Required —**` callouts |
| `## Hard Gates` / `## HARD-GATEs` section name | Rename to `## Constraints` |
| Roleplay opener ("You are a…", "As an expert…") | Delete. Start with what the skill does. |
| `/hc-plan` in body text | Use `` `{skill:hc-plan}` `` (slash form is terminal-only) |
| `**Follows:** {skill:xx:yyy}` without backticks | Wrap skill refs in backticks |
| `## Typically follows:` label | Use `**Follows:**` (no "Typically") |
| `## Communication Style` section | Delete; coding-level guidelines inject this |
| `## Anti-Rationalization` table | Remove; context is provided by the rules layer |
| Numbered pipeline steps ("Step 1:", "Step N:") | Use stage names: Route, Recon, Draft, Build, Verify, Ship |

---

## Agent Report Contract (for kit/agents/*.md, not SKILL.md)

`kit/agents/*.md` files are a different document type from `SKILL.md` — they follow a `## Report Contract` section instead of the section order above. Full canonical wording (universal rules, structured-output override, model-trace exemption) lives once in `docs/engineering-standards.md` Part V → Agent Report Contract. Copy the matching class line verbatim, then add one agent-specific delta — do not re-explain "no process narration" etc. per file:

```markdown
## Report Contract

Mechanical class — ≤10 lines. [agent-specific delta]. Full rules: `docs/engineering-standards.md` → Agent Report Contract.
```

```markdown
## Report Contract

Discovery class — ≤40 lines, findings-first. [agent-specific delta]. Full rules: `docs/engineering-standards.md` → Agent Report Contract.
```

```markdown
## Report Contract

Judgment class — verdict header + ~5 lines per finding, never cut for length. [agent-specific delta]. Full rules: `docs/engineering-standards.md` → Agent Report Contract.
```
