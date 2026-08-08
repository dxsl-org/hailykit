# Update Workflow

## Phase 1: Codebase Recon Reuse + Delta Scout

1. Scan the codebase and calculate the number of files with LOC in each directory (skip `.claude`, `.opencode`, `.git`, `tests`, `node_modules`, `__pycache__`, `secrets`, etc.)
2. Target directories **that actually exist** - adapt to project structure
3. Reuse-first: resolve prior recon in this order — session/explicit recon already covering the changed modules; active-plan `context-snippets.json.reconEnvelope`; active-plan root `scout-report.md`; only when no active plan exists, the most relevant root-level `.agents/*/scout-report.md`. Nested legacy `reports/scout-report.md` is `prior` context only; it cannot suppress a needed scout.
4. Activate `{skill:hc-scout}` only for uncovered gaps. Prefer `{skill:hc-scout} --quick` when the missing coverage is narrow; use full `{skill:hc-scout}` only when the docs boundary still spans unknown modules after reuse.
5. Merge reused recon plus any delta-scout findings into the context summary

## Phase 1.5: Documentation Inventory

No reader agents — `haily-docs-writer` reads every doc it edits anyway, so a pre-reading fan-out duplicates those reads. Build the inventory only:

1. Count docs: `ls docs/*.md 2>/dev/null | wc -l`
2. Get LOC: `wc -l docs/*.md 2>/dev/null | sort -rn`
3. Pass the inventory (paths + LOC, largest first) to haily-docs-writer so it prioritizes its own reading

## Phase 2: Documentation Update (haily-docs-writer Agent)

**CRITICAL:** You MUST spawn `haily-docs-writer` agent via Task tool with merged scout reports and the doc inventory.

Pass the gathered context to haily-docs-writer. Update only affected operational docs under the output policy in `init-workflow.md`; preserve detected commands, requirements, decisions and why, architecture boundaries, standards, progress, and any reused-vs-delta scout distinction that matters for freshness. Root `README.md` alone may keep one brief opening project narrative. Do not recreate `docs/README.md`, `docs/codebase-summary.md`, or a narrative project overview unless the user requests an existing compatibility stub.

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
- Keep `AGENTS.md` operational: detected tooling, conditional docs routes, and only project-specific always-on constraints when they are non-obvious. Keep `CLAUDE.md` and `GEMINI.md` as one-line `@AGENTS.md` importers.
- **Do not** start implementing.
