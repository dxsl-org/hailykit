# Changelog

All notable changes to this project will be documented in this file.
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.6.0] (2026-06-11)

### 🚀 Features

- **`hailykit stats` command** — zero-dependency code statistics: file counts, nLOC per language, cyclomatic complexity hotspots, LLM token estimate (`ncloc × 18`); supports `--json`, `--lang`, `--top`, `--exclude`; auto-excludes `node_modules`, `dist`, `.git`, etc.
- **`hl-stats` skill + `haily-stats` agent** — user-invocable `/hl-stats [path]` delegates to a Haiku-tier agent; JSON schema follows SonarQube canonical keys (`ncloc`, `complexity`); thresholds: warn ≥ 15, error ≥ 25, file ≥ 200 loc.
- **`haily-tracer` hook** — PreToolUse hook that announces which model tier a subagent will use on each Agent call (e.g. `⚡ [haily-planner] → thinking (claude-opus-4-8)`); enabled by default; config key `model-tracer`.

### 🚀 Improvements

- **`haily-usage` hook** — now enabled by default (was `false`); shows session usage stats at end of each turn.
- **Installer Migration 4** — `hailykit upgrade` automatically injects `haily-tracer` into existing `settings.json` without overwriting user config.
- **Config cleanup** — removed dead `statusline`, `statuslineColors`, `statuslineQuota` keys from `DEFAULT_CONFIG`.

---

## [1.5.0] (2026-06-11)

### 🚀 Improvements

- **`hl-ultra` skill** — explicit opt-in deep-model escalation: main loop + five core reasoning agents (`haily-planner`, `haily-implementor`, `haily-reviewer`, `haily-brainstormer`, `haily-debugger`) escalate to the `deep` tier

### 🐛 Fixes

- **Gemini / Antigravity / Codex / Zed** — ` upgrade.
- **Test isolation** — `HAILYKIT_HOME` env mutation in converter tests now guarded with `before`/`after` hooks; no cross-test contamination.

---

## [1.4.0] (2026-06-10)

### 🚀 Improvements

- **Block auto deep-research / dynamic workflows** — installer force-sets `workflowKeywordTriggerEnabled=false` on install + upgrade; explicit `/deep-research`, `/workflows`, `/effort ultracode` still work
- **`hl-research` upgrade** — token-bounded cost discipline (snippet-first, sufficiency gate), active claim refutation, reverse/inversion fallback when forward search is dry, positioning vs native `/deep-research`
- **`hailykit uninstall`** now strips dangling hook refs from `settings.json` (keeps security deny-rules)

---

## [1.3.0] (2026-06-09)

### 🚀 Improvements

- `hailykit [uninstall] [--help]`
- `hc-ship` upgrade, auto detect git/release automation

### 🐛 Fixes

- `hc-cop` skill now reachable from routing files
- CI now enforces the skill cross-reference check

---

## [1.2.1] (2026-06-08)

### 🚀 Improvements

- **`hc-ship` / `hc-docs` / `hc-new`** upgrade
- **`AGENTS.md`** — adopted as canonical project context file
- Workflow cross-references — added missing links between skills
- Provider specs
- **`hc-goal`** — autonomous development loop: give it a goal, it runs plan → cook → review → commit for each phase until done.

### 🐛 Fixes

- **Crush** skills install as `hc-name/SKILL.md` per Agent Skills spec
- Remove `user-invocable` field not in agentskills.io spec

---

## [1.1.0] (2026-06-07)

### 🚀 Improvements

- Kimi & Crush provider

### 🐛 Fixes

- Model stripping for user-configured providers: `cursor`, `zed`, `windsurf`, `crush`, `opencode`, `kimi`
- **OpenCode** `globalDir` on macOS and Windows

---

## [1.0.0] (2026-06-04)

### 🚀 Improvements

- Zero-dep TypeScript engine; native + polyglot NDJSON-over-stdio execution
- `list`, `run`, `info` CLI commands with `--tools`, `--input`, `--timeout`
- Multi-provider installer: Claude, Gemini, Cursor, Windsurf, OpenCode, Codex, Zed
- 30 skills in `hc-*` (coding) and `hl-*` (universal) prefixes
- `hailykit install [--provider] [--project]`, `upgrade`, `status`
- SKILL.md → TOML (Gemini), Markdown (Cursor/Windsurf), catalog (Codex)
- `settings.json` deny rules: union-add only, never removes user entries
- `PreToolUse` hook blocks private keys, secrets, and credential files
- `UserPromptSubmit` PII guard warns on emails and card numbers; opt-in
- `migrateSettings()` upgrades hook format on upgrade non-destructively
- `metadata.json` `deletions[]` removes stale files from user installs
- `settings.json` writes use temp-file + rename for atomicity

---

[1.5.0]: https://github.com/dxsl-org/hailykit/compare/v1.4.0...v1.5.0
[1.4.0]: https://github.com/dxsl-org/hailykit/compare/v1.3.0...v1.4.0
[1.3.0]: https://github.com/dxsl-org/hailykit/compare/v1.2.1...v1.3.0
[1.2.1]: https://github.com/dxsl-org/hailykit/compare/v1.1.1...v1.2.1
[1.1.1]: https://github.com/dxsl-org/hailykit/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/dxsl-org/hailykit/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/dxsl-org/hailykit/releases/tag/v1.0.0
