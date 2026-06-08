# Provider Support Matrix

Feature support across all HailyKit-supported AI coding agent providers.
Last researched: **2026-06-08** — verify against provider release notes when updating installers.

## Legend

| Icon | Meaning |
|------|---------|
| ✅ | Fully supported |
| ⚠️ | Partial — works with limitations (see notes) |
| ❌ | Not supported |

## Matrix

| Feature | Claude | Codex | Gemini | Antigrav | Kimi | OpenCode | Cursor | Windsurf | Zed | Crush |
|---------|:------:|:-----:|:------:|:--------:|:----:|:--------:|:------:|:--------:|:---:|:-----:|
| **Skill invocation** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ | ⚠️ | ❌ | ✅ |
| **Cross-skill references** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ | ⚠️ | ❌ | ✅ |
| **Native SKILL.md format** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ |
| **Always-loaded rules/context** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **@import in context file** | ✅ | ❌ | ✅ | ⚠️ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Hook: PreToolUse** | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ | ⚠️ | ✅ | ❌ | ✅ |
| **Hook: PostToolUse** | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ | ⚠️ | ✅ | ❌ | ❌ |
| **Hook: SessionStart** | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ | ❌ | ❌ | ❌ | ❌ |
| **Hook: UserPromptSubmit** | ✅ | ✅ | ⚠️ | ✅ | ✅ | ⚠️ | ❌ | ✅ | ❌ | ❌ |
| **Multi-agent / subagent spawn** | ✅ | ✅ | ⚠️ | ⚠️ | ⚠️ | ❌ | ❌ | ❌ | ❌ | ❌ |

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
- **Zed** ❌: only a summary rules document is installed; no direct invocation
- **Crush**: `/hc-plan` slash command (`user-invocable: true` in frontmatter)

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
- **All others** ❌: AI follows multi-agent instructions as sequential steps within a single context; no true subagent isolation

## Workflow Chain Support Summary

| Tier | Providers | Capability |
|------|-----------|-----------|
| **Full** | Claude Code, Codex | Skills + hooks + native agent spawn — complete pipeline |
| **Good** | Gemini, Windsurf, Kimi | Skills + most hooks — no true agent spawn |
| **Basic** | Antigravity, Crush, OpenCode | Skills + limited/no hooks — no agent spawn |
| **Limited** | Cursor | Rules-based guidance only — no slash commands, hooks unconfirmed |
| **Minimal** | Zed | Summary context only — no invocation, no hooks |
