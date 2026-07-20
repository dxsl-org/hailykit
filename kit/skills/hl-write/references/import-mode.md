# Import Mode

Continue a novel whose chapters were written outside `hl-write`. IMPORT reconstructs a workspace's bible, outline, and open threads from existing prose, then hands off to the normal Build loop — no special-case continuation logic exists past that point.

Concept adapted from [kentjuno/ainovel-cli](https://github.com/kentjuno/ainovel-cli) (Apache-2.0)'s import feature: derive everything from source text, never invent, and never silently repair internal contradictions.

## Trigger

IMPORT fires only when **all three** signals hold:

1. First argument is a **directory** (not a file, not a URL)
2. That directory has **no valid `.hl-write.json` marker**
3. The accompanying description signals continuation — "continue", "viết tiếp", "tiếp tục" — rather than a fresh-work description or a bare reference mention

| Input shape | Route |
|---|---|
| Directory **with** a valid marker | `RESUME` (unchanged) |
| Directory with no marker + continuation intent | `IMPORT` (this file) |
| Directory with no marker + no continuation intent | Reference source, ingested at Recon like any file (unchanged) |
| File/URL + description, any intent | Reference source (unchanged) |

**The source directory is never adopted as the workspace.** It is read once, at Route/normalize, and never touched again. The workspace is a brand-new directory (default `./<slug>/`), subject to the exact same slug sanitization and collision check as `NEW` — a collision still refuses and auto-suffixes; nothing about that rule changes.

## Chapter normalization

The orchestrator (never a delegated agent — no source text has been frozen yet, so nothing is safe to hand to a sub-agent) maps the source into candidate units, using `Grep -n` for heading offsets rather than reading full file contents into reasoning context:

- **Many files** — sort filenames, map 1:1 to `unit-01`, `unit-02`, … in sort order.
- **One big file** — split on a heading pattern. Default regex set, tried in order: `^#{1,3}\s`, `^Chương\s+\d+`, `^Chapter\s+\d+`. First pattern with ≥2 matches wins; each match's line number becomes a chapter boundary, and the matched heading text becomes that unit's display title.
- **Ambiguous** (no file boundary and no regex match, or a mix of both) — do not guess an implicit mapping; the Chapter Mapping Checkpoint below is where the user supplies an explicit chapter-boundary list instead.

### Chapter Mapping Checkpoint

Fires once, **before any prose is frozen** — this is a confirmation gate, not a formality, and it is the only point where the user sees the raw import scope before the run commits disk and budget to it. Presents:

- The detected unit count and mapping table: `source → unit-NN` (filename for the many-files case; heading text + line range for the single-file case)
- For the ambiguous case: the best-effort candidate split (if any) alongside a prompt for an explicit boundary list

The user confirms, edits the mapping, or aborts. **Interactive:** `AskUserQuestion`. **`--auto`:** proceeds with the detected mapping when unambiguous; an ambiguous split still halts even in `--auto` (nothing to auto-proceed with — there is no default mapping to fall back to). This Checkpoint is also the guard against a false-positive trigger (see § Trigger): a non-manuscript directory that accidentally satisfies the three trigger signals surfaces its (nonsensical) detected mapping here, before anything is written, giving the user a natural place to notice and abort.

The confirmed unit count is recorded as `import_total: N` in `ledger.md` — this is the expected-total counter the freeze step and resume both check against (below).

## Freeze step

Runs only after the Chapter Mapping Checkpoint confirms the mapping. For each confirmed unit, in mapping order:

1. Secret-scrub the source prose (same ingestion rule as `research/`).
2. Copy it verbatim to `manuscript/unit-NN-<slug>.md`.
3. Open the ledger row as `imported (pending-extraction)` — the row exists the moment prose lands on disk, before extraction runs (same F1 discipline as `in-progress`: a crash after freezing always leaves a trace).
4. Increment `import_frozen` in `ledger.md`.

Imported prose is frozen from this point on — identical to the existing "frozen after merge" rule for `manuscript/unit-NN-<slug>.md` in `references/workspace-schema.md`. It is never edited by any agent; `haily-editor` has no Write tool in kit source, so this holds structurally, not just by convention.

**Crash mid-freeze:** freezing a large single-file import (e.g. 50 chapters) is itself a multi-step operation, not a single atomic write — a crash or context exhaustion partway through leaves `import_frozen < import_total`. Resume compares the two counters before touching extraction: if `import_frozen < import_total`, resume continues freezing from unit `import_frozen + 1` using the mapping already confirmed and recorded at the Checkpoint (the mapping is not re-derived — it was fixed once, at confirmation). Only once `import_frozen == import_total` does resume proceed to the extraction loop.

## Extraction loop

Budget-capped: each chapter's extraction counts as one unit against the run cap (default 15, brief-overridable) — normalization and freezing do not. A 20-chapter import at the default cap runs 15, halts gracefully, and resumes the remaining 5 on the next invocation; nothing about the halt requires re-reading the source directory, because extraction reads only the frozen `manuscript/` file.

Per chapter with row `imported (pending-extraction)`, in unit order:

1. Delegate to `haily-editor`'s Import Extraction mode (`kit/agents/haily-editor.md`) — pass the frozen chapter text and the current `bible/plot.md` foreshadowing registry so the editor reuses existing threads instead of minting duplicates. On a single-agent host (SKILL.md § Single-Agent Hosts), perform the extraction in the editor role — the return shape is fully specified by steps 2–4 below.
2. On return: write `summaries/unit-NN.md` from the returned summary (same 150–300-word format Build produces, so later context assembly and rollups treat imported and authored summaries identically).
3. Merge the returned canon delta into `bible/characters.md`, `world.md`, `plot.md`, `timeline.md`, `glossary.md` — same shape-validate step Build applies to `haily-writer`'s delta (`references/workspace-schema.md`'s canon-delta schema is the sole source of truth for both). **This is the only bible merge that happens per chapter — Foundation reconstruction below does not re-merge canon; by the time every row reaches `complete (imported)`, the bible already reflects all 20 chapters in order, one delta at a time, exactly as Build's per-unit merge would.**
4. Append any returned contradictions to `contradictions.md` (below) — never resolved here.
5. Flip the row to `complete (imported)`.

## Contradiction register

`contradictions.md` at the workspace root — a distinct, append-only artifact, never merged as canon and never a bible file. Per-file contract: written by the orchestrator, one entry per contradicting pair, at extraction-loop step 4 above (so it persists across a budget halt/resume exactly like any other on-disk state — nothing about it lives in memory only). Format:

```
## unit-04 vs unit-11
- unit-04: "Bob had never left the harbor town"
- unit-11: "Bob's years in the capital taught him to read contracts"
```

Entries surface at the import brief Checkpoint (below) for the user to decide — which version is canon, or both stand as an in-world inconsistency; the orchestrator and the extraction agent never silently reconcile a contradiction on their own.

## Foundation reconstruction

Runs once every row reaches `complete (imported)` — the bible's characters/world/plot/timeline/glossary content is already complete at this point (built incrementally by the extraction loop, above). This stage performs the derivations that only make sense once the *whole* import is visible, none of which the per-chapter loop could do one chapter at a time:

- **`bible/style.md` seeding** — delegate one Style Seeding invocation (output contract: `references/craft-prose-antipatterns.md` § Style seeding output contract) over the full imported prose. It returns two blocks: the **base voice profile** (POV, tense, register, diction — the field the Voice/Style pass checks every unit against, `references/review-passes.md`; importing skips Draft's normal seeding path entirely, so nothing else populates it) written to `bible/style.md`'s primary voice-profile section (immutable thereafter, same rule as any other work); and **emergent rules**, tagged `[imported]` instead of an act number, with taboos omitted (empty, not fabricated) since imported chapters were never reviewed. Apply the existing ~15-entry cap and consolidation rule at this seeding, not deferred to the first continuation act's close — an unconsolidated seed plus a first-act close could otherwise stack past the cap before Build has written a single new unit.
- **`bible/plot.md § Open Threads`** — the resumption anchor. Derive from every foreshadowing entry with no payoff and every arc in `bible/plot.md` with no resolution as of the last imported chapter. Format:

  ```
  ## Open Threads
  - [planted unit-03] Alice's missing ledger — no payoff as of unit-20
  - [arc] Bob's debt to the Guild — active, last advanced unit-17
  ```

  This section lives inside `bible/plot.md` (not a new file) — the file already holds the foreshadowing registry and arcs, and is already in context-assembly's SELECT set. **Build-loop update rule:** once continuation units start, the orchestrator's normal per-unit merge (`references/workspace-schema.md`) additionally string-matches each newly merged fact against open `§ Open Threads` entries (the same zero-dep substring/keyword matching context-assembly already uses for alias-grep — no new schema field on `haily-writer`'s canon delta). A clear match updates that entry in place (`active` → `resolved: unit-NN` or `advanced: unit-NN`, same trailing-status-tag mechanic `bible/timeline.md` already uses); an ambiguous or missed match leaves the entry open for the Verify-stage foreshadowing payoff audit to catch later. This is additive to the existing merge step, not a new pipeline stage.

- **`outline.md` reconstruction** — reverse-engineer a beat-per-unit skeleton from the chapter summaries, marking every imported unit's beat as `(imported)` so a later structural review can distinguish reconstructed beats from planner-authored ones.

## Import brief Checkpoint

Fires once all rows reach `complete (imported)` — not per chapter, and distinct from the earlier Chapter Mapping Checkpoint (which already settled the source→unit mapping before any prose was frozen). Presents:

1. The full contradiction register (`contradictions.md`)
2. Continuation scope — how many new units, target length, any brief-level overrides (e.g. a raised budget cap for a long continuation)

Only after this Checkpoint does Build begin, writing unit-(N+1) with unit-N's tail as previous-unit tail and the reconstructed bible in context — the same Build loop that runs for any other long-form work, unmodified.

`--auto`: continuation-scope auto-proceeds with the detected defaults; a non-empty contradiction register still surfaces in the completion report (never silently dropped), matching the existing `--auto` principle of halting only on structural decisions, not on every review-passes finding. The earlier Chapter Mapping Checkpoint auto-proceeds only for an unambiguous mapping (many-files, or a single-file split where one regex pattern cleanly won) — an ambiguous split has no default to fall back to and halts even in `--auto`, since nothing exists yet to auto-confirm.

## Cross-run chunking

Two independent counters gate resume, checked in order:

1. **`import_frozen < import_total`** — freezing itself did not finish (crash or context exhaustion mid-freeze on a large single-file import). Resume continues freezing from unit `import_frozen + 1`, using the mapping already fixed at the Chapter Mapping Checkpoint — the mapping is never re-derived.
2. **`import_frozen == import_total` but rows remain `imported (pending-extraction)`** — freezing finished but the run halted at the budget cap during extraction. This is not a `blocked` state, and resume must not treat a `pending-extraction` row as an orphan (see `references/workspace-schema.md`'s resume reconciliation import branch). The next invocation resumes the extraction loop exactly where the ledger left off.

In both cases the source directory is never needed again once prose is frozen — resume reads only `ledger.md` and `manuscript/`.
