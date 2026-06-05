# Parallel Exploration

Patterns for launching multiple subagents in parallel to scout the codebase, verify implementation, and coordinate fixes.

## Parallel Codebase Scouting

Spawn multiple scout agents simultaneously when root cause spans different areas:

{agents:scout,scout,scout}

Each scout targets a distinct area. Include the target in the surrounding prompt context:
- scout 1: auth-related files in src/
- scout 2: API routes handling users
- scout 3: test files for auth module

{agent-result:scout}

## Parallel Verification

For verifying implementation from multiple angles, run the checks in sequence
(typecheck → lint → build → test). On Claude Code, these can run in parallel
via native parallel tool calls — this is a Claude-specific runtime optimization,
not a skill-level pattern.

**After implementation, verify in order:**
1. `npx tsc --noEmit` (typecheck)
2. `npm run lint` (lint)
3. `npm run build` (build)
4. `npm test` (tests)

## Multi-Phase Fix Coordination

For 2+ independent issues, launch one haily-implementor per issue tree:

{agents:haily-implementor,haily-implementor}

Each haily-implementor claims its task tree via `TaskUpdate(status="in_progress")` and completes via `TaskUpdate(status="completed")`. Blocked tasks auto-unblock when dependencies resolve.

> **NOTE — Claude Code:** Use native `TaskCreate`/`TaskUpdate`/`TaskList` for dependency tracking between parallel implementors. See `task-orchestration.md` for full patterns.
> **Other providers:** Track progress with `TodoWrite`; implementors run sequentially.

## When to Use Parallel

| Scenario | Strategy |
|---|---|
| Root cause unclear, multiple suspects | 2-3 scout agents on different areas |
| Multi-module fix | Scout each module in parallel |
| 2+ independent issues | One haily-implementor per issue tree |

## Combined Scout → Implement → Verify Flow

**Scout phase:** {agents:scout,scout} across relevant areas

{agent-result:scout}

**Implement phase:** apply fix based on scout findings

**Verify phase:** run typecheck + lint + build + tests sequentially (or parallel on Claude Code)
