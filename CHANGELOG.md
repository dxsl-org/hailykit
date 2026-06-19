# Changelog

All notable changes to this project will be documented in this file.
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

---

## [1.9.0] (2026-06-19)

### 🚀 Improvements

- `hailykit install` — wraps GitHub API and download calls with retry logic
- **`hc-git issues`** — discover and triage open GitHub issues by priority
- **`hc-goal`** — redesigned autonomous loop: clarify-or-assume instead of halting, no-new-failures regression gate, run-ledger compaction, per-phase model-tier routing
- **`hc-cook`** — no-new-failures regression gate (baseline-relative; pre-existing failures non-blocking); `--strict` restores full-suite-green
- **`hc-review`** — Checks system: user-defined per-repo criteria in `.agents/checks/*.yaml`, auto-discovered and injected at Stage 2 Quality
- **`hc-debug`** — Oracle escalation: 3+ failed fix attempts → `haily-debugger` at `{model:thinking}` tier with fresh evidence only
- **`hc-plan`** — writes `scout-report.md` to plan folder; `hc-review` and `hc-debug` reuse it to skip re-scouting within the same plan session

---

## [1.8.0] (2026-06-12)

### 🚀 Improvements

- **Statusline** — new `haily-statusline.cjs` renders a live session summary

---

## [1.7.0] (2026-06-12)

### 🚀 Improvements

- `hailykit stats` + `hl-stats`

---

## [1.6.7] (2026-06-12)

### 🐛 Fixes

- **`hailykit upgrade` / `install`** — upgrade logic
- **Model tracer + session summary** — now visible (dead hook revived)
- Release create fall back to upload

### 🚀 Improvements

- **`hailykit stats` + `hl-stats`** — zero-dep code statistics
- **`hailykit stats`** — Gleam support
- Model tracer + usage enabled by default

---

## [1.5.0] (2026-06-11)

### 🚀 Improvements

- **`hl-ultra`** — opt-in deep-model escalation

### 🐛 Fixes

- **Gemini / Antigravity / Codex / Zed** — upgrade fixes
- **Test isolation** — `HAILYKIT_HOME` guarded in converter tests

---

## [1.4.0] (2026-06-10)

### 🚀 Improvements

- Auto deep-research / dynamic workflows blocked on install
- **`hl-research`** — cost discipline + claim refutation
- **`hailykit uninstall`** — strips dangling hook refs

---

## [1.3.0] (2026-06-09)

### 🚀 Improvements

- `hailykit uninstall` + `--help`
- **`hc-ship`** — auto-detects git/release automation

### 🐛 Fixes

- **`hc-cop`** — reachable from routing files
- CI enforces skill cross-reference check

---

## [1.2.1] (2026-06-08)

### 🚀 Improvements

- **`hc-ship` / `hc-docs` / `hc-new`** — upgrades
- **`AGENTS.md`** — canonical project context file
- Skill cross-links added
- Provider specs
- **`hc-goal`** — autonomous plan → cook → review → commit loop

### 🐛 Fixes

- **Crush** — skills install as `hc-name/SKILL.md`
- Removed non-spec `user-invocable` field

---

## [1.1.0] (2026-06-07)

### 🚀 Improvements

- Kimi & Crush providers

### 🐛 Fixes

- Model stripping for user-configured providers
- **OpenCode** — `globalDir` on macOS/Windows

---

## [1.0.0] (2026-06-04)

### 🚀 Improvements

- Zero-dep TypeScript engine; NDJSON-over-stdio tool execution
- `list` / `run` / `info` CLI commands
- Multi-provider installer: Claude, Gemini, Cursor, Windsurf, OpenCode, Codex, Zed
- 30 skills (`hc-*` coding, `hl-*` universal)
- `install` / `upgrade` / `status` commands
- Per-provider SKILL.md conversion (TOML, Markdown, catalog)
- `settings.json` deny rules — union-add, atomic writes
- Secret/credential block hook + opt-in PII guard
- Non-destructive settings migration; `deletions[]` removes stale files

---

[1.6.2]: https://github.com/dxsl-org/hailykit/compare/v1.6.1...v1.6.2
[1.6.1]: https://github.com/dxsl-org/hailykit/compare/v1.6.0...v1.6.1
[1.6.0]: https://github.com/dxsl-org/hailykit/compare/v1.5.0...v1.6.0
[1.5.0]: https://github.com/dxsl-org/hailykit/compare/v1.4.0...v1.5.0
[1.4.0]: https://github.com/dxsl-org/hailykit/compare/v1.3.0...v1.4.0
[1.3.0]: https://github.com/dxsl-org/hailykit/compare/v1.2.1...v1.3.0
[1.2.1]: https://github.com/dxsl-org/hailykit/compare/v1.1.1...v1.2.1
[1.1.1]: https://github.com/dxsl-org/hailykit/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/dxsl-org/hailykit/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/dxsl-org/hailykit/releases/tag/v1.0.0
