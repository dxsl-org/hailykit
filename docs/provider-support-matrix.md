# Provider Support Matrix

Feature support across all HailyKit-supported AI coding agent providers.
Last researched: **2026-08-21** — verify against provider release notes when updating installers.

Installer default: **Pi**. Claude remains supported through `hailykit install --provider claude`.

## Legend

| Icon | Meaning |
|------|---------|
| ✅ | Fully supported |
| ⚠️ | Partial — works with limitations (see notes) |
| ❌ | Not supported |

## Matrix

| Feature | Claude | Codex | Gemini | Antigrav | Kimi | OpenCode | Cursor | Windsurf | Zed | Crush | Pi | OMP |
|---------|:------:|:-----:|:------:|:--------:|:----:|:--------:|:------:|:--------:|:---:|:-----:|:--:|:---:|
| **Skill invocation** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ | ⚠️ | ✅ | ✅ | ✅ | ✅ |
| **Cross-skill references** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ | ⚠️ | ✅ | ✅ | ✅ | ✅ |
| **Native SKILL.md format** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| **Always-loaded rules/context** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **@import in context file** | ✅ | ❌ | ✅ | ⚠️ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Hook: PreToolUse** | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ | ⚠️ | ✅ | ❌ | ✅ | ❌ | ❌ |
| **Hook: PostToolUse** | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ | ⚠️ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Hook: SessionStart** | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Hook: UserPromptSubmit** | ✅ | ✅ | ⚠️ | ✅ | ✅ | ⚠️ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Multi-agent / subagent spawn** | ✅ | ✅ | ⚠️ | ⚠️ | ⚠️ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |

## Notes

### Skill invocation
- **Claude**: `/hc-plan` slash command
- **Codex**: `$hc-plan` dollar-prefix mention; supports both explicit and implicit invocation
- **Gemini**: `/hc-plan` slash command (TOML commands) + native SKILL.md
- **Antigravity**: `/hc-plan` slash command (SKILL.md native format)
- **Kimi**: `/hc-plan` slash command
- **OpenCode**: `/hc-plan`; also auto-discovers SKILL.md from `.agents/skills/` (v1.16.0+)
- **Cursor** ⚠️: no native slash commands; skills installed as `.mdc` rules; AI follows instructions but user cannot `/invoke` directly
- **Windsurf** ⚠️: skills installed as workflow `.md` files; invoked via workflow panel, not slash commands
- **Zed**: `/hc-plan` style invocation via native `.agents/skills/<name>/SKILL.md`
- **Crush**: `/hc-plan` slash command (`user-invocable: true` in frontmatter)
- **Pi**: `/skill:hc-plan` via native `~/.pi/agent/skills/` or `.pi/skills/`
- **OMP**: `/skill:hc-plan` via native `~/.omp/agent/skills/` or `.omp/skills/`

### Cross-skill references
Installer converts `{skill:hc-cook}` to each provider's invocation syntax before installation. Providers with no skill invocation (Cursor, Windsurf) get text references that the AI can follow as instructions but cannot auto-invoke.

### Hook: PreToolUse / PostToolUse
- **OpenCode** ⚠️: requires a JS/TS plugin module (`tool.execute.before`/`after`); shell command hooks not supported natively
- **Cursor** ⚠️: hook events `beforeShellExecution`, `afterFileEdit` exist in the Background Agent SDK but lifecycle hook support is unconfirmed as of 3.7 — verify before relying on this
- **Crush**: PreToolUse only (production); PostToolUse is an open feature request

### Hook: SessionStart
- **Windsurf** ❌: no SessionStart equivalent; closest is `pre_user_prompt` (mapped to UserPromptSubmit)
- **Cursor** ❌: no session-level hooks
- **OpenCode** ⚠️: `session.created` event via JS plugin only

### Hook: UserPromptSubmit
- **Gemini** ⚠️: no direct UserPromptSubmit event; `BeforeModel` is the closest approximation
- **OpenCode** ⚠️: `tui.prompt.append` via JS plugin only

### Multi-agent / subagent spawn
Skills like `hc-cook`, `hc-ship`, `hc-plan` spawn specialist subagents (`haily-planner`, `haily-tester`, etc.). This is the most provider-specific capability:
- **Claude** ✅: native `Task` tool; agents defined in `kit/agents/`
- **Codex** ✅: custom agent TOML in `~/.codex/agents/`; agents invocable by natural language
- **Gemini** ⚠️: `agents/` directory installed; no native spawn mechanism — AI interprets agent instructions as workflow steps
- **Antigravity / Kimi** ⚠️: similar to Gemini — agents may be supported depending on version, but spawn is not guaranteed
- **Pi** ✅: HailyKit ships the runnable `task` extension as part of the Pi overlay, installs native agent files, and maps Claude tool policies to Pi-native allowlists. Isolation is conversation-context isolation plus extension policy, not an OS sandbox.
- **OMP** ✅: native task-agent discovery from `agents/*.md`; HailyKit maps Claude tool policies to an explicit OMP allowlist and strips unsupported frontmatter
- **All others** ❌: AI follows multi-agent instructions as sequential steps within a single context; no true subagent isolation

### Pi / OMP native roots
- **Pi**: global `~/.pi/agent`, project `.pi`, additive rules in `APPEND_SYSTEM.md`
- **OMP**: global `~/.omp/agent`, project `.omp`, additive rules in `APPEND_SYSTEM.md`
- **Shared env override**: both CLIs honor `PI_CODING_AGENT_DIR`. HailyKit scopes markers, rule sentinels, and version metadata by provider so cleanup stays fail-closed, but one shared override path still cannot act as two independent native roots.

### Pi baseline installed by HailyKit
- Runtime package: stock `@earendil-works/pi-coding-agent@0.84.2`
- Supported runtime range: `>=0.84.2 <0.85.0`
- Bootstrap: bare `hailykit install` may install Pi when missing; `upgrade`, `status`, and `uninstall` never bootstrap
- Removal: uninstall drops only HailyKit-owned overlay resources; stock Pi remains installed
- Included baseline overlay: native skills, prompts, runnable task/subagent extension, plan mode, presets, diagnostics, trust gate, protected-path guard, dirty-repo guard, and destructive confirmation
- Trust and safety: project trust, protected paths, dirty-repo guard, and destructive confirmation are extension-level controls. They are fail-closed, but they are not an OS sandbox.
- Pi event surface differs from Claude's hook names. HailyKit uses Pi's native extension events and commands rather than emulating Claude hook APIs.
- Deferred vs OMP: Pi baseline does not claim OMP-only async hub, stronger harness-level isolation, prewalk, or advisor flows.

## Workflow Chain Support Summary

| Tier | Providers | Capability |
|------|-----------|-----------|
| **Full** | Claude Code, Codex, Pi, OMP | Skills + hooks or native extension/agents — complete pipeline |
| **Good** | Gemini, Windsurf, Kimi | Skills + most hooks — no true agent spawn |
| **Basic** | Antigravity, Crush, OpenCode | Skills + limited/no hooks |
| **Limited** | Cursor | Rules-based guidance only — no slash commands, hooks unconfirmed |
| **Minimal** | Zed | Native invocation and always-on rules, but no hooks or native subagents |
