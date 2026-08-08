# Large Codebase Scouting

Use parallel Explore subagents for large-scale codebase discovery. This approach works under any provider (Claude Code, Cursor, Gemini CLI, etc.) using only native tools — no external CLI dependencies.

## When to Use This Mode

Invoke `ext` mode when the default parallel Explore strategy needs broader coverage:
- Codebase exceeds ~500 files and default partitioning produces too many segments
- Task requires surveying multiple unrelated subsystems in a single pass
- Cross-cutting concern spans the full tree (e.g., "find all auth checks")

For codebases under ~200 files, the default Explore subagent flow in `process-internal-agents.md` is sufficient.

## Tool Selection

| Search type | Primary tool | When |
|-------------|-------------|------|
| Find files by name/pattern | `Glob` | Filename or path pattern is known |
| Find code by content | `Grep` | Symbol name, string literal, or regex |
| Read a specific file | `Read` | File path is known |
| Survey an unknown subtree | Explore subagent | Subsystem boundary is fuzzy |

Combine tools: run `Glob` to locate candidates, then `Grep` to filter by content, then `Read` for full context. Reserve Explore subagents for cases where the scope is too broad for targeted Glob/Grep.

## Parallel Explore Spawning

Spawn one Explore subagent per logical segment. Each subagent receives an exclusive scope — no overlap between agents. Root-level files (`package.json`, `README`, configs) and `docs/`/`.agents/` are never assigned to a segment — the orchestrator reads them directly for the report's Project Type and Docs & In-Flight Plans sections.

```
Task 1 (Explore): "Search src/auth/ and src/middleware/ for authentication patterns.
  Owned paths: src/auth/, src/middleware/.
  Gaps: missing auth guard call sites under those paths.
  Scope every Glob/Grep call to one of those two directories.
  List every file that enforces access control with a one-line description."

Task 2 (Explore): "Search src/api/ and src/routes/ for route definitions.
  Owned paths: src/api/, src/routes/.
  Gaps: unresolved route files and auth usage under those paths.
  Scope every Glob/Grep call to one of those two directories.
  List all route files, HTTP methods, and whether they reference an auth guard."

Task 3 (Explore): "Search src/db/ and src/models/ for schema definitions.
  Owned paths: src/db/, src/models/.
  Gaps: unresolved user/session schema files under those paths.
  Scope every Glob/Grep call to one of those two directories.
  List table/collection names, primary keys, and any user/session-related fields."
```

Spawn all tasks in a single message to execute in parallel. Each agent uses Glob, Grep, and Read as needed within its assigned scope.

## Prompt Guidelines

- State the directory scope explicitly — agents must not wander outside their segment, and every Glob/Grep call must set `path` to one of the segment's directories, one scoped call per directory (an unscoped search hits the whole repo and duplicates every sibling agent's work).
- Include `ownedPaths` and `gaps` in the prompt so the agent knows both its exclusive search boundary and what prior recon still left unresolved.
- Tell each agent to run a given keyword search once — vary the pattern only when the previous search came back empty.
- Request file paths with one-line descriptions, not full file dumps.
- Ask for relationships when relevant: "which files import X", "which routes call Y".
- Set a clear output shape: bullet list of `path — description` entries.
- Keep prompts under 200 tokens; detailed context comes from Read in the next pass.

## Example Workflow

User: "Find all database migration files and the schema they modify."

Determine partitioning: the repo has `db/`, `migrations/`, `src/models/`, `config/`. Spawn three agents:

```
Task 1 (Explore): "Search db/ and migrations/ for migration files.
  Owned paths: db/, migrations/.
  Gaps: unresolved migration ownership and modified schema names under those paths.
  Scope every Glob/Grep call to one of those two directories.
  For each file list: path, migration name, and the table/schema it affects."

Task 2 (Explore): "Search src/models/ for schema definition files.
  Owned paths: src/models/.
  Gaps: unresolved model primary keys and migration matches.
  Scope every Glob/Grep call to src/models/.
  List each file, the model name, and its primary key field."

Task 3 (Explore): "Search config/ for database configuration files.
  Owned paths: config/.
  Gaps: unresolved database targets and connection definitions.
  Scope every Glob/Grep call to config/.
  List each file and which database or connection string it configures."
```

Merge results: deduplicate by path, cross-reference migration names against model names, surface any gaps (migrations with no matching model file, or vice versa).

## Aggregating Results

After all subagents complete:

1. Collect path lists from each agent.
2. Deduplicate defensively — a file appearing in two segment results means an agent searched outside its scope; note it, since recurring overlap signals the partition or prompt scoping needs tightening.
3. Cross-reference: a file that one agent found and other agents' results point to (imports, route references, schema links) is likely central to the task.
4. Fill gaps with targeted `Grep` or `Read` calls before writing the final scout report.

## Chunked File Reading

For large files identified during scouting, read in offset windows rather than loading the entire file:

```
Read path/to/large-file.ts offset=0 limit=100    # first 100 lines
Read path/to/large-file.ts offset=100 limit=100  # next 100 lines
```

See `process-internal-agents.md` for full chunked-reading patterns and partition strategy details.
