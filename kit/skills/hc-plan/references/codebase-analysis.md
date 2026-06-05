# Codebase Analysis

**Skip when:** scout reports are already provided.

## Process

### Read Project Docs First

Before touching source files, read the project's own documentation:

- `./docs/codebase-summary.md` — architecture overview, component relationships, current status
- `./docs/code-standards.md` — naming conventions, language-specific patterns, error handling approach
- `./docs/design-guidelines.md` — UI/UX conventions, component library usage (if exists)
- `CLAUDE.md` — project-specific constraints injected into context

Skip files that don't exist; continue without blocking.

### Scout the Codebase

Use `{skill:hc-scout}` to locate relevant files for the task. Run scouts in parallel for different aspects:

```
{skill:hc-scout} "auth module and middleware"
{skill:hc-scout} "database models and migrations"
{skill:hc-scout} --graph    # for large codebases needing cross-file analysis
```

Wait for all scouts to report before proceeding to analysis.

### Analyze Patterns

From scout output, extract:

- **Naming conventions:** how files, functions, and variables are named in this codebase
- **Architectural patterns:** how components communicate, where business logic lives
- **Error handling approach:** what error types exist, how they propagate
- **Testing patterns:** test file location, naming, what is and isn't tested
- **Existing utilities:** helpers, services, or abstractions the plan should reuse

### Map Blast Radius

Identify:
- Which existing modules the planned change will touch
- Which public contracts (APIs, types, events) must stay stable
- Which tests cover the affected areas

This feeds directly into the Scope Contract — specifically the Blast Radius section.

## Output

Brief written summary (≤150 lines) covering:
1. Relevant files and their roles
2. Patterns the implementation must follow
3. Blast Radius: modules and contracts at risk
4. Inconsistencies or technical debt the plan should note but not fix

Pass this summary to the Solution Design stage.
