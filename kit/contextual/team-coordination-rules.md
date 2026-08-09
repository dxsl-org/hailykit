# Team Coordination Rules

> These rules only apply when operating as a teammate within an Agent Team.
> They have no effect on standard sessions or subagent workflows.

## File Ownership (CRITICAL)

- Each teammate owns distinct files; no overlapping edits.
- Define ownership with glob patterns in the task.
- Tester owns test files only; may read implementation files but does not edit them.
- If ownership violation is detected: STOP and report to lead immediately.

## Git Safety

- Prefer git worktrees for implementation teams.
- Never force-push from a teammate session.
- Commit frequently with descriptive messages.
- Pull before push to catch conflicts early.
- In a worktree, commit and push the worktree branch, not `main` or `dev`.

## Communication Protocol

- Use `SendMessage(type: "message")` for peer DMs and name the recipient.
- Use `SendMessage(type: "broadcast")` only for critical blockers that affect the whole team.
- Mark tasks complete via `TaskUpdate` before messaging the lead.
- Send actionable findings, not just "I'm done".
- Never send structured JSON status messages; use plain text.

## HailyKit Stack Conventions

### Report Output
- Save reports to `{HL_REPORTS_PATH}` (fallback: `.agents/reports/`).
- Naming: `{type}-{date}-{slug}.md`, where type is the role.
- Sacrifice grammar for concision. List unresolved questions at end.

### Commit Messages
- Use conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`.
- No AI references in commit messages.
- Keep commits focused on the actual change.

### Docs Sync (Implementation Teams Only)
- After implementation, the lead evaluates docs impact.
- State it explicitly: `Docs impact: [none|minor|major]`.
- If impact exists, update `docs/` or note it in the completion message.

## Task Claiming

- Claim the lowest-ID unblocked task first.
- Check `TaskList` after each task for newly unblocked work.
- Set the task to `in_progress` before starting.
- If all tasks are blocked, notify the lead and offer unblock help.

## Plan Approval Flow

When `plan_mode_required` is set:
1. Research and plan in read-only mode.
2. Send the plan via `ExitPlanMode`.
3. Wait for the lead's `plan_approval_response`.
4. If rejected, revise and resubmit.
5. If approved, proceed with implementation.

## Conflict Resolution

- If two teammates need the same file, escalate to the lead immediately.
- If a teammate's plan is rejected twice, the lead takes over.
- If findings conflict between reviewers, the lead synthesizes and documents the disagreement.
- If blocked by another teammate's incomplete work, message them first, then escalate if they do not respond.

## Shutdown Protocol

- Approve shutdown requests unless mid-critical-operation.
- Mark the current task complete before approving shutdown.
- If rejecting shutdown, explain why concisely.
- Extract `requestId` from the shutdown JSON and pass it to `shutdown_response`.

## Idle State (Normal Behavior)

- Going idle after sending a message is normal, not an error.
- Idle means waiting for input, not disconnected.
- Sending a message to an idle teammate wakes them.
- Do not treat idle notifications as completion signals; check task status instead.

## Discovery

- Read `~/.claude/teams/{team-name}/config.json` to discover teammates.
- Always refer to teammates by name, not agent ID.
- Names are used for `recipient` in `SendMessage` and `owner` in `TaskUpdate`.
