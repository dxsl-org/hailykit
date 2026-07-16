# Init Workflow

## Phase 1: Parallel Codebase Scouting

1. Scan the codebase and calculate the number of files with LOC in each directory (skip credentials, cache or external modules directories, such as `.claude`, `.opencode`, `.git`, `tests`, `node_modules`, `__pycache__`, `secrets`, etc.)
2. Target directories **that actually exist** - adapt to project structure, don't hardcode paths
3. Activate `{skill:hc-scout}` skill to explore the code base and return detailed summary reports to the main agent
4. Merge scout reports into context summary

## Phase 2: Documentation Creation (haily-docs-writer Agent)

**CRITICAL:** You MUST spawn `haily-docs-writer` agent via Task tool with merged reports. Do not wait for user input.

Pass the gathered context to haily-docs-writer agent to create initial documentation:
- `README.md`: Update README with initial documentation (keep it under 300 lines)
- `docs/project-overview-pdr.md`: Project overview and PDR (Product Development Requirements)
- `docs/codebase-summary.md`: Codebase summary
- `docs/code-standards.md`: Codebase structure and code standards
- `docs/system-architecture.md`: System architecture
- `docs/project-roadmap.md`: Project roadmap
- `docs/deployment-guide.md` [optional]: Deployment guide
- `docs/design-guidelines.md` [optional]: Design guidelines

## Phase 3: Size Check (Post-Generation)

After haily-docs-writer completes:
1. Run `wc -l docs/*.md 2>/dev/null | sort -rn` to check LOC
2. Use `docs.maxLoc` from session context (default: 800)
3. For files exceeding limit:
   - Report which files exceed and by how much
   - haily-docs-writer should have already split proactively
   - If still oversized, ask user: split now or accept as-is?

## Phase 4: Project Rules File Creation/Update

After docs are written, handle the project rules file at the project root.

### 4a — Assistant Profile (optional)

Use `AskUserQuestion` (header: "Haily — Assistant Profile") to offer personalization:

```
Would you like to set Haily's communication style for this project?
  - Vietnamese preset  → xưng em / gọi bạn · language: vi · comments: English
  - English preset     → I/you · language: en · comments: English
  - Skip               → Claude auto-adapts (no config written)
```

If Vietnamese or English preset chosen, write `.claude/haily.json` (create or merge):

```json
{
  "assistant": {
    "name": "Haily",
    "addressStyle": "em/bạn",
    "language": "vi",
    "codeComments": "en",
    "documentation": "en"
  }
}
```

Adjust `addressStyle`/`language` per choice. Skip → do not write `haily.json`.
The profile is auto-injected by the session bootstrap — no CLAUDE.md section needed.

### 4b — Project rules files write

Always create all three files. `AGENTS.md` is the canonical source — `CLAUDE.md` and `GEMINI.md` import it with one line each. This is the [officially recommended pattern](https://code.claude.com/docs/en/memory#agents-md) by Anthropic for multi-provider repos.

Detect tooling commands from project files (`package.json`, `pyproject.toml`, `Makefile`, `Cargo.toml`, etc.) using the scout reports from Phase 1. Directory structure belongs in `docs/system-architecture.md`, not here.

**If `AGENTS.md` does NOT exist** → create it:

```markdown
## Project
[name from codebase scan] — [1-sentence: purpose + primary tech stack]

## Tooling
- Build: [detected command]
- Test:  [detected command]
- Lint:  [detected command, omit if none]

## Safety Rules
- NEVER commit secrets (.env, API keys, credentials)
- NEVER force-push to main/master without explicit user confirmation
- NEVER drop tables or run destructive migrations without user approval
- NEVER ignore failing tests to make CI green

## Docs
- [code-standards.md](docs/code-standards.md) — structure, standards, patterns
- [system-architecture.md](docs/system-architecture.md) — architecture + directory map
- [project-roadmap.md](docs/project-roadmap.md) — current phase and priorities
```

**Do NOT add** directory structure, workflow chains, YAGNI/KISS/DRY, file-size rules, or comment style — they live in `docs/` and are loaded on demand.

**If `AGENTS.md` EXISTS** → ask user:
- (a) Append a `## Docs` section listing the newly created docs files
- (b) Skip — leave `AGENTS.md` untouched

**Always create (or update) `CLAUDE.md` and `GEMINI.md`** as thin importers — skip if they already import `AGENTS.md`:

```markdown
@AGENTS.md
```
