# Hailykit Rules

Rules for contributors and AI agents working on the hailykit repo.

## Metadata Deletions (MANDATORY)

When renaming or deleting ANY file under `kit/` (skills, hooks, agents, standards, templates), add the old relative path to `kit/metadata.json` `deletions[]`. This tells the installer to remove stale files from user machines on upgrade. Skipping it leaves orphaned files that cause conflicts.

## Skill Registry Contract

Canonical skill names live in each `kit/skills/*/SKILL.md` frontmatter `name:` field. Domain prefixes:

- `hl-` — universal/utility (thinking, planning, tools, design)
- `hc-` — coding (incl. AI app frameworks, MCP, docs/extraction)

## Skill Reference Syntax

All skill cross-references in `kit/**/*.md` (skills, agents, rules) use the **provider-neutral canonical form**:

```
{skill:prefix-name}    e.g. {skill:hc-cook}
```

Use the **registered name** (frontmatter `name:`) — it matches the directory name (`hc-cook` dir → `name: hc-cook` → `{skill:hc-cook}` ref).

## Cross-Reference Integrity (CI-enforced)

CI runs `node scripts/check-skill-cross-refs.js` on every push. It builds a registry from all `SKILL.md` `name:` fields and checks every `{skill:hX-name}` (and any legacy `/hX-name`) reference in `kit/**/*.md` resolves to a registered skill. A wrong prefix — writing `hl-debug` when the skill is registered as `hc-debug` — fails CI.

Before committing reference changes: `node scripts/check-skill-cross-refs.js`. When adding a skill to a routing rule (`workflow.md`, `domain.md`), update BOTH the rule and the skill's `## Workflow Position`.

## Model Tiers (agents)

Agent frontmatter `model:` uses provider-neutral tiers — `fast` / `medium` / `thinking` / `ultra` — resolved per provider by the installer. Never hard-code `opus`/`gpt-5`/etc. in agent source. The authoritative tier→model map ships as `kit/model-map.json` (built-in fallback: `MODEL_MAP` in `cli/installer/converter.ts`; user pin: `~/.hailykit/model-map.json`). When vendor model IDs change, update `kit/model-map.json` — no code change needed. CI validates agent tiers and the map shape via `scripts/check-skill-cross-refs.js`.

## Session Model & Agent Tiers

Tiers ordered low→high: `fast < medium < thinking < ultra`. In skill body text, `{model:ultra}` placeholders resolve to the provider's top model at install time.

Agent frontmatter has two tier fields:
- `model:` — floor (minimum tier this agent runs on; required)
- `model_max:` — ceiling (never exceed this tier regardless of session model; omit to allow up to `ultra`)

**Judgment agents** (`haily-planner`, `haily-implementor`, `haily-reviewer`, `haily-brainstormer`, `haily-debugger`, `haily-writer`, `haily-editor`) have no `model_max` — they inherit the session model so a developer running on `ultra` gets maximum quality where it matters.

**Mechanical agents** (`haily-git-manager`, `haily-stats`, etc.) pin both `model:` and `model_max:` at `fast` — escalating them wastes tokens with no quality gain.

When adding a new agent, set `model_max:` based on whether its work benefits from a stronger model. Update `kit/model-map.json` when a provider releases a new top-tier model — pin it under the `ultra` key.
