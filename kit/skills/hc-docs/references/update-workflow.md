# Update Workflow

## Phase 1: Parallel Codebase Scouting

1. Scan the codebase and calculate the number of files with LOC in each directory (skip `.claude`, `.opencode`, `.git`, `tests`, `node_modules`, `__pycache__`, `secrets`, etc.)
2. Target directories **that actually exist** - adapt to project structure
3. Reuse-first: if the session already holds a scout report or recon covering the changed modules, or `.agents/*/scout-report.md` from an active plan does, use it. Otherwise activate `{skill:hc-scout}` to explore the codebase and return summary reports
4. Merge scout reports into context summary

## Phase 1.5: Documentation Inventory

No reader agents — `haily-docs-writer` reads every doc it edits anyway, so a pre-reading fan-out duplicates those reads. Build the inventory only:

1. Count docs: `ls docs/*.md 2>/dev/null | wc -l`
2. Get LOC: `wc -l docs/*.md 2>/dev/null | sort -rn`
3. Pass the inventory (paths + LOC, largest first) to haily-docs-writer so it prioritizes its own reading

## Phase 2: Documentation Update (haily-docs-writer Agent)

**CRITICAL:** You MUST spawn `haily-docs-writer` agent via Task tool with merged scout reports and the doc inventory.

Pass the gathered context to haily-docs-writer agent to update documentation:
- `README.md`: Update README (keep it under 300 lines)
- `docs/project-overview-pdr.md`: Update project overview and PDR
- `docs/codebase-summary.md`: Update codebase summary
- `docs/code-standards.md`: Update codebase structure and code standards
- `docs/system-architecture.md`: Update system architecture
- `docs/project-roadmap.md`: Update project roadmap
- `docs/deployment-guide.md` [optional]: Update deployment guide
- `docs/design-guidelines.md` [optional]: Update design guidelines

## Additional requests
<additional_requests>
  $ARGUMENTS
</additional_requests>

## Phase 3: Size Check (Post-Update)

After haily-docs-writer completes:
1. Run `wc -l docs/*.md 2>/dev/null | sort -rn` to check LOC
2. Use `docs.maxLoc` from session context (default: 800)
3. For files exceeding limit: report and ask user

## Phase 4: Documentation Validation (Post-Update)

Grep-verify to detect potential hallucinations (non-blocking):
1. Re-run the Accuracy Protocol grep checks (code references, internal links, config keys) against every symbol/path just documented
2. Display findings as a report
3. Fix or remove anything that no longer resolves

## Important
- Use `docs/` directory as the source of truth.
- **Do not** start implementing.
