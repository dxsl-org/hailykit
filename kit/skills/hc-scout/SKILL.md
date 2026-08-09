---
name: hc-scout
description: "Parallel codebase discovery before implementation. Splits the repo into segments and spawns one Explore subagent per segment. Reports project type, relevant modules, patterns, in-flight plans, and public APIs. Supports ext (broad parallel scouting), --pack (repomix dump), and --graph (knowledge graph)."
when_to_use: "Invoke when locating code, mapping dependencies, or discovering relevant files before making changes."
user-invocable: true
argument-hint: "[target] [ext] [--quick] [--contracts] [--pack] [--graph] [--deps <module> [--owner <org>]]"
metadata:
  category: project
  keywords: [codebase, scouting, file-discovery, parallel, repomix, knowledge-graph]
---

# hc-scout — Parallel Codebase Discovery

Split the codebase into non-overlapping segments, launch one Explore subagent per segment, and merge results into one report within 3 minutes.

## Usage

```
{skill:hc-scout} [target]              # parallel Explore subagents (default)
{skill:hc-scout} ext [target]          # broad parallel scouting for large codebases
{skill:hc-scout} --quick [target]      # single-agent fast lookup for known areas
{skill:hc-scout} --contracts [target]  # extract public API surface and contracts
{skill:hc-scout} --pack                # full repo dump via repomix
{skill:hc-scout} --graph               # codebase-memory-mcp knowledge graph
{skill:hc-scout} --deps @my-org/api-client           # trace cross-repo consumers
{skill:hc-scout} --deps src/api/users --owner my-org # trace local module consumers
```

| Mode | When to use |
|------|-------------|
| *(default)* | First contact with an area; discovery + mapping |
| `ext` | Broad coverage for large codebases |
| `--quick` | Known area; locate something fast |
| `--contracts` | Extract the public API surface before a refactor |
| `--pack` | Share a full repo snapshot with another model |
| `--graph` | Understand deep cross-file dependency chains |
| `--deps` | Trace downstream consumers and drift |

Modes compose: `{skill:hc-scout} --quick --contracts src/auth` gives fast contract extraction in a known module. Only default and `ext` persist orientation maps; `--quick` can feed same-session recon metadata but never becomes a persisted `scout-report.md`.

## Constraints

> **Required — recon-first:** Never ask the user "where is X?" without scouting first. If the answer exists in the repo, find it.

> **Required — 3-minute cap:** Every parallel agent must return within 3 minutes. Log timeouts and continue with available results.

> **Required — no directory overlap:** Partition assignments must be mutually exclusive — each agent owns an exclusive slice of the tree, and every Glob/Grep it runs sets `path` to one of its assigned directories (one scoped call per directory). An unscoped Grep searches the whole repo — N agents grepping the same keyword unscoped is N-fold duplicate work.

> **Required — sequential below threshold:** Skip parallel spawning when the segment count is 2 or fewer — overhead exceeds benefit at that scale.

## Process

1. **ReconEnvelope routing** — read prior recon in this order: explicit caller recon, active-plan `context-snippets.json.reconEnvelope`, active-plan `scout-report.md`, then none. Classify each candidate by `freshness` (`observed`, `same-plan`, `prior`, `stale`), `complete`, `coveredPaths`, `ownedPaths`, and `gaps`.

   | Envelope state | Route |
   |---|---|
   | `freshness=observed|same-plan`, `complete=true`, target fully covered | `reuse` — return the existing result |
   | `freshness=observed|same-plan`, uncovered delta = 1–2 exclusive path slices | `quick` — run only the delta lookup |
   | `freshness=observed|same-plan`, uncovered delta >= 3 exclusive path slices | `parallel` — partition and scout the uncovered delta |
   | `freshness=prior|stale` | Never suppress a new lookup; use only as path hints |

   Same-session `--quick` output is targeted recon metadata only (`coveredPaths`, `ownedPaths`, `gaps`) — never a full orientation map. Skip the `.agents` glob when caller recon already exists or the caller explicitly rejected an on-disk report. Log `✓ Reuse: [explicit recon | same-plan context | scout-report.md path | none]`.
2. **Extract targets** — parse the prompt for file types, symbol names, directories, or patterns to locate. When `--deps <module>` is present, load `references/flow-deps.md` and follow the 3-query fan-out protocol instead of standard segment partition.
3. **Partition** — divide the target into non-overlapping segments; size agent count from uncovered path slices, not the whole repo. Each segment carries `ownedPaths` and `gaps`. Root files (`package.json`, `README`, config files) and `docs/`/`.agents/` belong to the orchestrator, never to a segment, so agents do not duplicate them.
4. **Register tasks** — call `TaskList` to check for existing scout tasks; create one per agent via `TaskCreate` with scope in metadata. Fall back to `TodoWrite` when Task tools are absent. Log `✓ Registered [N] scout tasks ([internal|external] mode)`.
5. **Spawn in parallel** — launch one Explore subagent per segment; set each to `in_progress` via `TaskUpdate` before spawning. Each prompt must include its `ownedPaths`, current `gaps`, and the instruction that every Glob/Grep call is scoped to one owned path at a time.
6. **Aggregate & persist** — after the 3-minute window, mark completed agents via `TaskUpdate`, note timeouts, and merge findings into the output format below. Persist only full discovery output (default and `ext`) to `scout-report.md` at the root of the active plan dir — not under `reports/`. Never overwrite a plan-authored `scout-report.md`; append a `## Scout Addendum` section instead, replacing any previous addendum rather than stacking a new one. When no plan is active, create a plan-style dir and write there. Emit `context-snippets.json.reconEnvelope` for full discovery and same-session `--quick` lookups. Output from `--contracts`, `--pack`, `--graph`, and `--deps` is never persisted to `scout-report.md` — it is not an orientation map and would poison downstream reuse.

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

Entries must stay short — this is an orientation map, not exhaustive documentation.

## --quick Mode

Single Explore subagent (no parallel spawning, no task registration). Returns a focused Relevant Modules list in under 15 seconds.

**Use when:** you already know the area and only need to locate files or verify structure. Skip `--quick` when you need a full orientation map.

```
{skill:hc-scout} --quick "auth middleware"
{skill:hc-scout} --quick src/api/users.ts
```

Output: `Relevant Modules` + `Unresolved Questions` only. No parallel agents, no task registration overhead. It may populate same-session `reconEnvelope` metadata for delta routing, but it is not a persisted orientation map.

## --contracts Mode

Extracts the public API surface of a target module or scope — exported interfaces, function signatures, REST/GraphQL endpoints, DB schemas, event types — without broad discovery. Answers: "what must I not break?"

**Use when:** planning a refactor, reviewing cross-module dependencies, or establishing a stability boundary before making changes.

**Fast path (TS/JS, Python, Go):** run `hailykit contracts <scope> --json` first. It extracts exported symbols, signatures, and HTTP endpoints deterministically with no subagent. Use manual extraction only when that fast map misses edge syntax or the stack is unsupported.

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

Collapse the repository into one AI-consumable file for external review or snapshotting.

For a quick zero-dependency local dump, `hailykit pack [path] --json` concatenates text files (gitignore-aware) with a token estimate and is **secret-safe by default** (credential-file denylist + content secret scan exclude any file that could leak). For remote repos, compression, alternate output formats, or clipboard, use `repomix`:

```bash
hailykit pack . --json                                          # zero-dep, secret-safe local dump
repomix                                                          # pack CWD → repomix-output.xml
repomix --style markdown                                         # markdown output
repomix --include "src/**/*.ts" --remove-comments -o output.md  # scoped, comments stripped
npx repomix --remote owner/repo                                  # remote repo without cloning
repomix --copy                                                   # copy result to clipboard
```

See `references/tech-repomix-config.md` and `references/tech-repomix-patterns.md`.

## --graph Mode

Index the codebase with **codebase-memory-mcp** and expose structured cross-file dependency queries.

```bash
codebase-memory build .   # build the index
codebase-memory serve     # expose as MCP server
```

Use `--graph` only when the repo is large, the task is a major feature or refactor, and cross-file dependency chains must be understood before planning.

## --deps Mode

Activated by `--deps <module-name-or-path> [--owner <org>]`. It traces downstream consumers of an API or module across repos using `gh search code`, runs the 3-query fan-out from `references/flow-deps.md`, classifies each consumer as ACTIVE / DECLARED_ONLY / DRIFTED / IMPLICIT, and sorts the output by urgency. Limits still apply: default branch only, about 1000 results per query, and a 9 req/min rate limit with the enforced 7-second pause.

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
| `references/flow-deps.md` | `--deps` mode: 3-query fan-out protocol, org inference, consumer table format, drift detection, rate-limit protocol, hard limitations |
