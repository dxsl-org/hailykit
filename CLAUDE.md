# CLAUDE.md

## Project
hailykit — a **zero-dependency** TypeScript **tool-execution engine** + multi-provider **skill-catalog installer** for AI coding agents. Two subs: **`cli/`** (the executable) and **`kit/`** (the catalog). Distributed via GitHub release zip + install script (never `npm publish`). Repo: `github.com/dxsl-org/hailykit`.

## Structure
| Dir | Purpose |
|-----|---------|
| `cli/` | **Sub "cli":** the tool (TypeScript). `bin.ts` builds to `dist/bin.js` |
| `cli/core-engine/` | Tool runtime: registry, router, executors (native + polyglot stdio), protocol |
| `cli/installer/` | Catalog distribution to providers (Claude/Cursor/Gemini/…); ported from old hailykit |
| `cli/utils/` | logger, errors, strip-json-comments (zero-dep) |
| `cli/tools/` | Bundled tools (polyglot); discovered by default from `dist/tools/` at runtime |
| `cli/tests/` | `node:test` test suite — compiles to `.test-build/` via `pretest` |
| `kit/` | **Sub "kit":** the distributable skill catalog (`skills/`, `rules/`, `hooks/`, `metadata.json`) |
| `scripts/` | `copy-tool-assets.mjs`, `package-release.mjs`, `zip-writer.mjs` |
| `.reference/hailykit_old/` | Old JS implementation — **port reference only** (gitignored) |

## Engineering Standards — Single Source of Truth

**`docs/engineering-standards.md`** is the authoritative reference for ALL content written in this repo: skills, hooks, rules, reference files, prompts, and documentation.

Read it before writing anything. It defines:
- **Pipeline stage names** — Route, Recon, Draft, Build, Verify, Ship (not "Step 1", "Phase", numbered steps)
- **Quality mechanism names** — Checkpoint (not "Gate"), Guardrail (not "HARD-GATE"), Scope Contract, Stage Graph, Lean Pass, Review Circuit, Stress Probe
- **Banned phrases** — "Hard Gate", "nail the spec", "blast surface", "Conformance Checklist", "budget = 3", "Anti-Rationalization", "brutal honesty", "elite expert", numbered steps, `metadata: author: claudekit`, "CK-Native"
- **Writing voice** — direct and technical, imperative mood, active voice; no roleplay openers, no superlatives
- **Cross-reference syntax** — `` `{skill:hc-plan}` `` in body text; `/hc-plan` is terminal syntax only

## Skill Authoring Standard

When creating or rewriting ANY `kit/skills/*/SKILL.md`, use in order:
1. **`docs/engineering-standards.md`** — terminology, pipeline vocabulary, writing voice, banned phrases
2. **`docs/skill-template.md`** — canonical section order, constraint callout syntax, Workflow Position format

Quick rules from engineering-standards.md:
- Guardrail callout: `> **Required — [shorthand]:** [what must hold]`
- No `<HARD-GATE>` XML, no numbered steps (`1. **Detect**` is fine; `Step 1: Detect` is not)
- Use stage names in descriptions: "During the Recon stage…" not "In step 2…"

## Rules
- **Zero runtime dependencies.** Node built-ins only, imported with the `node:` prefix. No npm-registry deps; never `npm publish`. `typescript` is a dev-only toolchain dep.
- **Relative imports only** — path aliases are intentionally not used (they break `dist/` resolution without a build-time dep).
- Tests use `node:test`: `npm test` compiles to `.test-build/` then runs `node --test`. Delete `.test-build/` before running after deleting source test files (tsc does not clean stale outputs).
- **Build:** `npm run build` = `tsc` → `dist/` + postbuild copies `cli/tools/` → `dist/tools/`. `cli/tools/` is excluded from tsconfig — assets only, never compiled.
- **Release:** `npm run release:pack` calls `buildDist()` directly (postbuild does NOT fire); `copyToolAssets()` is inlined in `buildDist()` to ensure `dist/tools/` is populated in the release zip.
- External (polyglot) tools communicate via **NDJSON over stdio** — one request line in, one response line out. Wire field: `"tool"` (was `"skill"` pre-0.1). See `docs/tech-stack.md`.
