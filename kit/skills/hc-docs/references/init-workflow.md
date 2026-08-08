# Init Workflow

## Phase 1: Codebase Recon Reuse + Delta Scout

1. Scan the codebase and calculate the number of files with LOC in each directory (skip credentials, cache or external modules directories, such as `.claude`, `.opencode`, `.git`, `tests`, `node_modules`, `__pycache__`, `secrets`, etc.). If the caller already passed verified inventory or recon, reuse it instead of recomputing broad coverage.
2. Target directories **that actually exist** - adapt to project structure, don't hardcode paths
3. Resolve prior recon in this order:
   - explicit verified handoff or ReconEnvelope from the caller
   - active-plan `context-snippets.json.reconEnvelope`
   - active-plan root `scout-report.md`
   - only when no active plan exists, the most relevant root-level `.agents/*/scout-report.md`
   - nested legacy `reports/scout-report.md` is `prior` context only; it cannot suppress a needed scout
4. Activate `{skill:hc-scout}` only for uncovered gaps in the docs surface. Prefer `{skill:hc-scout} --quick` when the missing coverage is narrow; use full `{skill:hc-scout}` only when the docs boundary still spans unknown modules after reuse.
5. Merge reused recon plus any delta-scout findings into the context summary

## Phase 2: Documentation Creation (haily-docs-writer Agent)

**CRITICAL:** You MUST spawn `haily-docs-writer` agent via Task tool with merged reports. Do not wait for user input.

Pass the gathered context to haily-docs-writer agent to create initial documentation:
- `README.md`: May open with one brief purpose, strengths, and differentiation paragraph; keep the remainder operational (under 300 lines)
- `docs/product-requirements.md`: Goals, requirements, constraints, decisions, and acceptance criteria
- `docs/tech-stack.md`: Operational technology choices, key dependencies, and why they exist
- `docs/code-standards.md`: Codebase structure, standards, and repeatable conventions
- `docs/system-architecture.md`: Boundaries, directory map, major flows, and integration surfaces
- `docs/quick-start.md`: Required environment, first-run commands, and primary API or CLI entrypoints (under 50 lines)
- `docs/project-roadmap.md`: Current priorities, milestones, and near-term sequencing
- `docs/project-changelog.md`: Significant shipped changes and doc-worthy fixes
- `docs/deployment-guide.md` [optional]: Deployment/runtime operations if the project has a deploy surface
- `docs/design-guidelines.md` [optional]: Design system or UX rules if the project has a UI surface

Preserve the reused scout findings, any delta-scout findings, inventory, detected commands, and explanatory why in the handoff. Do not ask the writer to create `docs/README.md`, `docs/codebase-summary.md`, or a duplicated narrative overview.

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

Always create all three files. `AGENTS.md` is canonical; one-line `CLAUDE.md` and `GEMINI.md` imports prevent rule drift across providers.

Detect tooling commands from project files (`package.json`, `pyproject.toml`, `Makefile`, `Cargo.toml`, etc.) using the scout reports from Phase 1. Directory structure belongs in `docs/system-architecture.md`, not here.

**If `AGENTS.md` does NOT exist** → create it:

```markdown
## Tooling
- Build: [detected command]
- Test:  [detected command]
- Lint:  [detected command, omit if none]

## Docs
- [quick-start.md](docs/quick-start.md) — environment and first-run commands
- [code-standards.md](docs/code-standards.md) — structure, standards, patterns
- [system-architecture.md](docs/system-architecture.md) — boundaries, flows, directory map
- [project-roadmap.md](docs/project-roadmap.md) — current phase and priorities
```

Keep detected `## Tooling`. Keep `## Docs`. Add only project-specific always-on constraints that are non-obvious from repo defaults or global rules. Do not add a `## Project` narrative section, generic duplicated safety rules, directory structure, workflow chains, YAGNI/KISS/DRY, file-size rules, or comment style — they live in `docs/` or global instructions.

**If `AGENTS.md` EXISTS** → ask user:
- (a) Append a `## Docs` section listing the newly created docs files
- (b) Skip — leave `AGENTS.md` untouched

**Always create (or update) `CLAUDE.md` and `GEMINI.md`** as thin importers — skip if they already import `AGENTS.md`:

```markdown
@AGENTS.md
```
