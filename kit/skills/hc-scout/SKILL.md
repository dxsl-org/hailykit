---
name: hc-scout
description: "Parallel codebase discovery before implementation. Splits the repo into segments and spawns one Explore subagent per segment simultaneously. Reports project type, relevant modules, patterns, in-flight plans, and public APIs. Supports ext (broad parallel scouting), --pack (repomix dump), and --graph (knowledge graph)."
when_to_use: "Invoke when locating code, mapping dependencies, or discovering relevant files before making changes."
user-invocable: true
argument-hint: "[target] [ext] [--quick] [--contracts] [--pack] [--graph]"
metadata:
  category: project
  keywords: [codebase, scouting, file-discovery, parallel, repomix, knowledge-graph]
---

# hc:scout — Parallel Codebase Discovery

Splits the codebase into non-overlapping segments and launches one Explore subagent per segment in parallel. Results merge into a single structured report within 3 minutes.

## Usage

```
{skill:hc-scout} [target]              # parallel Explore subagents (default)
{skill:hc-scout} ext [target]          # broad parallel scouting for large codebases
{skill:hc-scout} --quick [target]      # single-agent fast lookup for known areas
{skill:hc-scout} --contracts [target]  # extract public API surface and contracts
{skill:hc-scout} --pack                # full repo dump via repomix
{skill:hc-scout} --graph               # codebase-memory-mcp knowledge graph
```

| Mode | Speed | When to use |
|------|-------|-------------|
| *(default)* | 30–90s | First contact with an area; discovery + mapping |
| `ext` | 60–180s | Broad coverage for 500+ file codebases with targeted Glob/Grep |
| `--quick` | ⚡ 5–15s | You know the area — just need to locate something fast |
| `--contracts` | ⚡ 10–30s | Before a refactor — extract the public API surface you must not break |
| `--pack` | 30–60s | Share full repo context with an external LLM or snapshot |
| `--graph` | 60–120s | Cross-file dependency chains on large codebases (>200 files) |

Modes compose: `{skill:hc-scout} --quick --contracts src/auth` — fast contract extraction from a known module.

## Constraints

> **Required — recon-first:** Never ask the user "where is X?" without scouting first. If the answer exists in the repo, find it.

> **Required — 3-minute cap:** Every parallel agent must return within 3 minutes. Log timeouts and continue with available results.

> **Required — no directory overlap:** Partition assignments must be mutually exclusive — each agent owns an exclusive slice of the tree.

> **Required — sequential below threshold:** Skip parallel spawning when the segment count is 2 or fewer — overhead exceeds benefit at that scale.

## Process

1. **Extract targets** — parse the prompt for file types, symbol names, directories, or patterns to locate.
2. **Partition** — divide the codebase into non-overlapping segments; determine agent count.
3. **Register tasks** — call `TaskList` to check for existing scout tasks; create one per agent via `TaskCreate` with scope in metadata. Fall back to `TodoWrite` when Task tools are absent. Log `✓ Registered [N] scout tasks ([internal|external] mode)`.
4. **Spawn in parallel** — launch one Explore subagent per segment; set each to `in_progress` via `TaskUpdate` before spawning. Scope each prompt to the 200K token context window.
5. **Aggregate** — after the 3-minute window, mark completed agents via `TaskUpdate`; note timed-out agents. Merge all findings into the output format below.

## Output

Every scout report must address all five items, even when the answer is "none found":

1. **Project type / language / framework** — primary language, framework, build tooling.
2. **Relevant modules** — files and directories directly tied to the task.
3. **Existing patterns and conventions** — naming style, file structure, error handling approach, test layout. **Always classify the architectural pattern** (Layered/Clean Architecture, Hexagonal, MVC, Repository, CQRS, Event-driven, or mixed). State it explicitly — this is the most critical input for refactor planning.
4. **Docs and in-flight plans** — any `docs/`, `README`, `.agents/` plan files, or open TODOs touching the task.
5. **Public APIs / schemas / contracts** — exported interfaces, route definitions, DB schemas, and types shared across module boundaries.

```markdown
# Scout Report

## Project Type
- Language / framework / build tooling (one line)

## Relevant Modules
- `path/to/file.ts` — what it does and why it matters

## Patterns & Conventions
- **Architecture:** [Layered / Hexagonal / MVC / Repository / CQRS / Event-driven / mixed] — evidence: folder layout + import direction
- Pattern name: brief description with example file reference

## Docs & In-Flight Plans
- `docs/foo.md` — summary | `.agents/plan.md` — phase N in progress

## APIs / Schemas / Contracts
- `src/types/bar.ts` — exported interface Baz consumed by modules X and Y

## Unresolved Questions
- Gaps, ambiguous ownership, or files needing a deeper pass
```

Entries must be short — this is an orientation map, not exhaustive documentation.

## --quick Mode

Single Explore subagent (no parallel spawning, no task registration). Returns a focused Relevant Modules list in under 15 seconds.

**Use when:** you already know which part of the codebase you're working in and just need to locate specific files or verify a structure. Skip `--quick` when you need a full orientation map.

```
{skill:hc-scout} --quick "auth middleware"
{skill:hc-scout} --quick src/api/users.ts
```

Output: `Relevant Modules` + `Unresolved Questions` only. No parallel agents, no task registration overhead.

## --contracts Mode

Extracts the public API surface of a target module or scope — exported interfaces, function signatures, REST/GraphQL endpoints, DB schemas, event types — without broad discovery. Answers: "what must I not break?"

**Use when:** planning a refactor, reviewing cross-module dependencies, or establishing a stability boundary before making changes.

See `references/protocol-contract-extraction.md` for extraction patterns per language/stack.

```
{skill:hc-scout} --contracts src/api/        # all contracts exported from src/api
{skill:hc-scout} --contracts src/auth.ts     # contracts of a specific file
{skill:hc-scout} --contracts "payment.*"     # contracts matching a glob
```

Output:

```markdown
## Contract Surface — [target]

### Exported Types / Interfaces
- `UserProfile` (src/types/user.ts:12) — consumed by: ProfilePage, API route /users/:id

### Function Signatures (public)
- `createUser(email, role): Promise<User>` (src/api/users.ts:34) — called by: register.ts, admin.ts

### REST Endpoints
- `POST /api/users` — body: CreateUserDto, response: UserDto

### Database Schemas
- `users` table — id, email, role, created_at (migrations/001_users.sql)

### Event Bus / Queue Contracts
- `user.created` event — payload: {userId, email} (src/events/user.ts:8)

### Stability Boundary
Files that MUST NOT change their public interface without a version bump or migration:
- src/types/user.ts, src/api/users.ts
```

## --pack Mode

Runs `repomix` to collapse the full repository into one AI-consumable file. Use when sharing context with an external LLM or when a complete snapshot is required.

```bash
repomix                                                          # pack CWD → repomix-output.xml
repomix --style markdown                                         # markdown output
repomix --include "src/**/*.ts" --remove-comments -o output.md  # scoped, comments stripped
npx repomix --remote owner/repo                                  # remote repo without cloning
repomix --copy                                                   # copy result to clipboard
```

See `references/tech-repomix-config.md` for configuration options and `references/tech-repomix-patterns.md` for workflow patterns.

## --graph Mode

Indexes the codebase with **codebase-memory-mcp** (66 languages, 14 MCP tools, zero-dependency C binary) and exposes structured cross-file dependency queries.

```bash
codebase-memory build .   # build the index
codebase-memory serve     # expose as MCP server
```

Use `--graph` only when all three conditions hold: the codebase exceeds ~200 files, the task is a major feature or refactor, and cross-file dependency chains must be understood before planning.

## Workflow Position

**Precedes:** `{skill:hc-plan}`, `{skill:hc-cook}`, `{skill:hc-debug}`
**Auto-invoked by:** `{skill:hc-fix}` (Recon stage), `{skill:hc-debug}` (Recon stage)
**Related:** `{skill:hc-git}` — scout for codebase context; `hc-git analyze` for change impact

## References

| File | Content |
|------|---------|
| `references/process-internal-agents.md` | Explore subagent spawning: partition strategy, prompt templates, chunked file reading |
| `references/process-external-tools.md` | Large codebase scouting: Glob/Grep/Read tool selection, parallel Explore spawning, aggregation |
| `references/process-task-tracking.md` | Task registration schema, lifecycle states, integration with cook/planning |
| `references/tech-repomix-config.md` | Repomix configuration file options, ignore patterns, output formats |
| `references/tech-repomix-patterns.md` | Repomix usage patterns: AI analysis, security audit, CI/CD integration |
| `references/protocol-contract-extraction.md` | `--contracts` mode: how to extract exported types, endpoints, schemas, event contracts per stack |
