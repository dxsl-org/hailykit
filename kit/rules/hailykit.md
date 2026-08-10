# HailyKit contributor rules

## Metadata deletions

When renaming or deleting any file under `kit/`, add the old relative path to `kit/metadata.json` `deletions[]`. This is the installer cleanup contract; skipping it leaves stale files on user machines.

## Skill registry and references

- Canonical skill names come from each `kit/skills/*/SKILL.md` frontmatter `name:`.
- Prefix contract: `hl-` universal/utility, `hc-` coding and code security, `hs-` security operations on running systems.
- Cross-references in `kit/**/*.md` use the provider-neutral form `{skill:prefix-name}` and the registered name.

## Cross-reference CI

CI runs `node scripts/check-skill-cross-refs.js` on every push. It builds the registry from `name:` fields and fails unresolved `{skill:hX-name}` or legacy `/hX-name` refs. Before committing reference edits, run the same command. When adding a route in `workflow.md` or `domain.md`, update the skill's `## Workflow Position` too.

## Model tiers

Agent frontmatter `model:` uses provider-neutral tiers `fast | medium | thinking | ultra`; never hard-code vendor model ids. The authoritative tier map ships in `kit/model-map.json`, with fallback `MODEL_MAP` in `cli/installer/converter.ts` and optional user override `~/.hailykit/model-map.json`. Update the `ultra` entry when providers change their top model.

## Agent tier policy

- `model:` is the floor; `model_max:` is the ceiling.
- Judgment agents (`haily-planner`, `haily-implementor`, `haily-reviewer`, `haily-brainstormer`, `haily-debugger`, `haily-writer`, `haily-editor`) omit `model_max` so they inherit the session tier.
- Mechanical agents (`haily-git-manager`, `haily-stats`, etc.) pin both fields to `fast`.
- Apex agents (`haily-judge`, `haily-advisor`) pin both fields to `ultra`; reserve this for verdict/advice work on a prepared package.
