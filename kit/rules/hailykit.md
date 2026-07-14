# Hailykit Rules

Rules for contributors and AI agents working on hailykit repo.

## Metadata Deletions (MANDATORY)

When renaming or deleting ANY file under `kit/` (skills, hooks, agents, standards, templates), add old relative path to `kit/metadata.json` `deletions[]`. This tells installer to remove stale files from user machines on upgrade. Skipping it leaves orphaned files that cause conflicts.

## Skill Registry Contract

Canonical skill names live in each `kit/skills/*/SKILL.md` frontmatter `name:` field. Domain prefixes:

- `hl-` — universal/utility (thinking, planning, tools, design)
- `hc-` — coding (incl. AI app frameworks, MCP, docs/extraction) — security **of code you write** (`hc-security` appsec, `hc-fix` code/CVE patching)
- `hs-` — security operations on **running systems** (`hs-assess` red-team recon/pentest/CTF, `hs-harden` blue-team config audit/hardening, `hs-dfir` forensics/incident response). Distinct from `hc-security`/`hc-fix`, which own code-level security.

## Skill Reference Syntax

All skill cross-references in `kit/**/*.md` (skills, agents, rules) use the **provider-neutral canonical form**:

```
{skill:prefix-name}    e.g. {skill:hc-cook}
```

Use the **registered name** (frontmatter `name:`) — it matches directory name (`hc-cook` dir → `name: hc-cook` → `{skill:hc-cook}` ref).

## Cross-Reference Integrity (CI-enforced)

CI runs `node scripts/check-skill-cross-refs.js` on every push. It builds registry from all `SKILL.md` `name:` fields and checks every `{skill:hX-name}` (and any legacy `/hX-name`) reference in `kit/**/*.md` resolves to registered skill. Wrong prefix — writing `hl-debug` when skill is registered as `hc-debug` — fails CI.

Before committing reference changes: `node scripts/check-skill-cross-refs.js`. When adding skill to routing rule (`workflow.md`, `domain.md`), update BOTH rule and skill's `## Workflow Position`.

## Model Tiers (agents)

Agent frontmatter `model:` uses provider-neutral tiers — `fast` / `medium` / `thinking` / `ultra` — resolved per provider by installer. Never hard-code `opus`/`gpt-5`/etc. in agent source. Authoritative tier→model map ships as `kit/model-map.json` (built-in fallback: `MODEL_MAP` in `cli/installer/converter.ts`; user pin: `~/.hailykit/model-map.json`). When vendor model IDs change, update `kit/model-map.json` — no code change needed. CI validates agent tiers and map shape via `scripts/check-skill-cross-refs.js`.

## Session Model & Agent Tiers

Tiers ordered low→high: `fast < medium < thinking < ultra`. In skill body text, `{model:ultra}` placeholders resolve to provider's top model at install time.

Agent frontmatter has two tier fields:
- `model:` — floor (minimum tier this agent runs on; required)
- `model_max:` — ceiling (never exceed this tier regardless of session model; omit to allow up to `ultra`)

**Judgment agents** (`haily-planner`, `haily-implementor`, `haily-reviewer`, `haily-brainstormer`, `haily-debugger`, `haily-writer`, `haily-editor`) have no `model_max` — they inherit session model so developer running on `ultra` gets maximum quality where it matters.

**Mechanical agents** (`haily-git-manager`, `haily-stats`, etc.) pin both `model:` and `model_max:` at `fast` — escalating them wastes tokens with no quality gain.

**Apex agents** (`haily-judge`, `haily-advisor`) pin both `model:` and `model_max:` at `ultra` — the opposite floor from mechanical agents, for the opposite reason: they exist solely to make a verdict, so they always run on the top tier. Read-only tools (no Write/Edit) and a token-lean contract (cited evidence only, no exploring beyond the decision package) keep the cost bounded even at ultra. Reserve this category for verdict- or advice-shaped work only — a future agent may claim `ultra`/`ultra` if its job is to adjudicate or advise on a pre-assembled package (returning a ruling or a recommendation), not to draft or investigate; drafting/investigating agents stay judgment-tier (no `model_max`) even under `--deep`.

When adding new agent, set `model_max:` based on whether its work benefits from stronger model. Update `kit/model-map.json` when provider releases new top-tier model — pin it under the `ultra` key.
