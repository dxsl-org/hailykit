# Changelog

All notable changes to this project will be documented in this file.
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] — 2026-06-04

### Improvements

- **Engine** — zero-dependency TypeScript tool-execution engine with native (in-process) and polyglot (Python/Rust/Go/…) execution via NDJSON-over-stdio protocol
- **CLI** — `list`, `run`, `info` commands with `--tools`, `--input`, `--timeout` options
- **Installer** — multi-provider skill catalog installer: Claude Code, Gemini CLI, Cursor, Windsurf, OpenCode, Codex CLI, Antigravity, Zed
- **Skills catalog** — 30 skills across two domain prefixes (`hc-*` coding, `hl-*` universal)
- **Provider install** — `hailykit install [--provider] [--project]`, `upgrade`, `status`
- **Skill conversion** — SKILL.md → TOML (Gemini), Markdown (Cursor/Windsurf), AGENTS.md catalog (Codex)
- **Deny rules** — merged into `settings.json` on every install/upgrade; union-add only, never removes user rules
- **File-access guard** — `PreToolUse` hook consolidating directory guard + sensitive-file blocker into one process; hard-blocks private keys and secrets, warns on `.env` and credential files
- **PII guard** — `UserPromptSubmit` hook that warns when prompts contain email addresses or card numbers; opt-in, disabled by default
- **Hook migration** — `migrateSettings()` upgrades hook command format and consolidates old guard hooks on upgrade without overwriting `settings.json`
- **Deletion tracking** — `kit/metadata.json` `deletions[]` removes stale files from user installs on upgrade
- **Atomic writes** — `settings.json` updates use temp-file + rename to prevent partial writes

---

[1.0.0]: https://github.com/dxsl-org/hailykit/releases/tag/v1.0.0
