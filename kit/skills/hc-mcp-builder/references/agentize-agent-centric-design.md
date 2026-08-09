# Agent-Centric Design Rules

Expose task-level capabilities that reduce agent orchestration and context cost.

## Capability Selection

Keep a capability when it completes a user task, replaces an error-prone prose workflow, or can be safely idempotent. Drop thin duplicates, internal plumbing, and operations whose default output cannot fit useful context.

When documentation says “call X, then Y, then Z” for one outcome, prefer one workflow tool that performs the sequence and returns its result.

## Context Contract

- Default to concise IDs, names, and status; provide `format: detailed`/`--detailed` as opt-in.
- Paginate, normally 10–25 records.
- Prefer human-readable names alongside opaque IDs.
- Truncate long fields with an ellipsis plus original-length hint.

## Errors

Every error states what failed, why, and the next safe action. Include a stable `error.code` for branching and structured retry details such as `retry_after_s` when relevant.

## Mutation Safety

- Read-only tools need no confirmation semantics.
- Mutations describe their side effect and should support `dry_run` with a diff/preview.
- Destructive tools require explicit `confirm: true` or a unique token returned by a preceding `plan_*` tool.

## Naming And Idempotency

- MCP tools: `verb_noun` snake_case.
- CLI commands: `noun verb` or `verb`; flags use long-form kebab-case.
- Creates accept an idempotency key where possible.
- Updates are PATCH-shaped.
- Deletes may succeed when the target is already absent.

## Output Envelope

Success: `{ "ok": true, "data": {...}, "warnings": [], "next_actions": [] }`.

Failure: `{ "ok": false, "error": { "code": "...", "message": "..." } }`.
