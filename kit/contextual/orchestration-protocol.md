# Orchestration Protocol

## Delegation Context (MANDATORY)

Every Task prompt includes:

1. **Work Context Path** - git root for the files being changed
2. **Reports Path** - `{work_context}/.agents/reports/`
3. **Plans Path** - `{work_context}/.agents/`

If CWD differs from the work context, use the work-context paths, not CWD paths.

---

## Routing

- Use sequential chaining for dependent work: `Planning -> Implementation -> Simplification -> Testing -> Review` or `Research -> Design -> Code -> Documentation`.
- Use parallel execution only for independent work with pre-declared integration points and no file conflicts.

---

## Subagent Status Protocol

Allowed end states:

- **DONE** - task complete and verification passed
- **DONE_WITH_CONCERNS** - complete, but concerns need review
- **BLOCKED** - cannot continue with current inputs
- **NEEDS_CONTEXT** - missing required context

Handling:

- Never ignore `BLOCKED` or `NEEDS_CONTEXT`.
- Never repeat the same blocked approach unchanged.
- Treat correctness concerns in `DONE_WITH_CONCERNS` before review.
- If the same task blocks 3+ times, escalate instead of retrying blindly.

Required ending format:

```
**Status:** DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
**Summary:** [1-2 sentence summary]
**Verification:** [command run + result, required when status is DONE]
**Concerns/Blockers:** [if applicable]
```

`DONE` without `Verification` is treated as `DONE_WITH_CONCERNS`. Verification names the command and result, not just "tests passed".

---

## Context Isolation Principle

Subagents receive only the context they need. Never pass full session history.

Rules:

1. Craft prompts explicitly with task, files, acceptance criteria, and constraints.
2. No session-history dump; summarize decisions instead.
3. Scope file references precisely.
4. Include the relevant phase text, not the entire plan.
5. Keep coordination detail in the controller.

Prompt template:

```
Task: [specific task description]
Files to modify: [list]
Files to read for context: [list]
Acceptance criteria: [list]
Constraints: [any relevant constraints]
Plan reference: [phase file path if applicable]

Work context: [project path]
Reports: [reports path]
```

Anti-patterns:

- `"Continue from where we left off"` -> use a concrete task and phase reference.
- `"Fix the issues we discussed"` -> name the file, line, and root cause.
- `"Look at the codebase and figure out"` -> scope the read set and output.
- Passing 50+ lines of conversation -> replace with a short task summary.

---

## Agent Teams (Optional)

For multi-session parallel collaboration, use Claude Code Agent Teams. Teammates coordinate via `SendMessage`; membership is detected from `~/.claude/teams/{team-name}/config.json`. Once a session is operating as a teammate, `team-coordination-rules.md` governs file ownership, communication, and shutdown handling.
