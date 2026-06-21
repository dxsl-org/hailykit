# Changelog

All notable changes to this project will be documented in this file.
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### 🚀 Improvements

- Codex provider: register agents as `[agents.<slug>]` in `~/.codex/config.toml` (sentinel-managed) so Codex actually discovers installed agents — previously the per-agent `.toml` files were inert
- Codex provider: escape `developer_instructions` for TOML multiline (bodies containing `"""` no longer corrupt the generated file)
- Codex hooks: per-hook timeout baked into wrappers (from each hook's `timeout`), and `additionalContext` is kept only for events Codex accepts it on (`SessionStart`, `SubagentStart`, `PreToolUse`, `PostToolUse`, `UserPromptSubmit`) — stripped at the verified nested `hookSpecificOutput.additionalContext` location for all others
- Codex hooks: warn (never block) when the `codex` CLI is missing or older than the recommended baseline
- Codex agents: emit `sandbox_mode` inferred from each agent's `tools` (`workspace-write` / `read-only`) and preserve an unknown concrete `model` id as a comment instead of writing `model = undefined`; `model_reasoning_effort` wiring in place (emitted only when the model map supplies an effort)
- Codex config.toml: all writes are now atomic (temp + rename); the `[features] hooks` flag writer self-heals — merges into an existing `[features]` section without a duplicate header/key, flips `hooks = false` → `true`, and drops the legacy `codex_hooks` flag

### 🐛 Fixes

- Codex hooks: hook-command parser now matches the shipped `bash -c` runner command shape, not only `node …` — previously `hooks.json` / the feature flag were never written against the real catalog

---

## [1.10.1] (2026-06-21)

### 🚀 Improvements

- hailykit git-insights — churn, bus factor, velocity, change-impact
- hailykit secrets / vuln-scan — native secret + vulnerability scanners
- hailykit contracts — extract exports, signatures, endpoints (TS/Py/Go)
- hailykit test-detect / coverage-parse — framework + coverage normalization
- hailykit deps-audit — unified npm/pip/cargo/go advisory schema
- hailykit adr-next / license-detect / pack — ADR, license, secret-safe pack
- cli/lib — shared zero-dep git/fs-scan/spawn/gitignore primitives
- hc-spec: EARS-notation acceptance criteria with approval gate
- hc-adr: capture or auto-discover architectural decisions
- hc-review: batch mode, team health report, OWASP Agentic checks
- hc-debug: SUSPECTED/PROBABLE/CONFIRMED confidence signaling
- hc-scout: cross-repo consumer tracing via --deps flag
- hc-plan: memory-augmented planning via --resume flag

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
