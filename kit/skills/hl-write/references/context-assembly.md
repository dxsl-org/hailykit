# Context Assembly

The formula the orchestrator runs before every `haily-writer` invocation to build one unit's context package. Long-form only — short-form units are small enough to hand the writer `brief.md` + `outline.md` beat + `facts.md` + the previous-unit tail directly, no SELECT/overflow/rollup needed.

## SELECT

Assemble, in this set:

- `bible/style.md` — full, always (small by design, universally relevant to every unit)
- The unit's beat from `outline.md`
- Bible entries alias-matched in (the beat text ∪ the last 2–3 unit summaries) — grep entity names and their `aliases:` fields in `bible/characters.md` / `bible/world.md`; matched entities form the candidate set for both bible injection and timeline filtering, below
- Active arcs from `bible/plot.md` touching a matched entity
- `bible/timeline.md` Active Snapshot facts, filtered to matched entities only — not the full snapshot
- Bound research notes — notes whose stable ID is referenced by the beat or by a matched bible entry, not the full `research/` corpus
- Summaries — flat per-unit summaries for units ≤20; beyond that, act rollups plus the last 5 individual unit summaries (see Rollup, below)
- Previous-unit tail — the last ~500–800 words of the immediately preceding unit's manuscript file

## Alias matching mechanics

Matching is case-insensitive substring/word-boundary grep of each `bible/characters.md` and `bible/world.md` entry's `name` and `aliases: []` fields against the beat text and the last 2–3 unit summaries — no embeddings, no fuzzy matching (zero-dep rule). A hit on any alias counts as a match on the entity. The matched set is reused twice: once to select which bible entries enter the package (below) and once to filter which `bible/timeline.md` Active Snapshot facts are relevant enough to include.

**Known limitation:** alias-grep matches only literal name/alias occurrences and will miss pronoun-only references ("she," "the old man") — accepted for v1. `haily-editor`'s continuity pass (`references/review-passes.md`) is the safety net: it reads the full unit text, not the pre-filtered context package, so a pronoun-only reference that slips past SELECT still gets checked against the bible at review time.

## Bible overflow rule (F4)

An ensemble cast can alias-match more entries than any prompt should carry in full. Rank matched entries by beat-proximity (how directly the beat text names them) and POV relevance (the unit's POV character outranks a background mention); give full cards to the top-N (default 6) and a one-line digest to the rest — name plus the single attribute most relevant to this beat, e.g. `- Priest (harbor constable, owes Bob a favor)`. This bounds bible injection regardless of how many entities the grep match returns.

## ORDER — fighting lost-in-the-middle

```
FIRST:  style.md (full) + this unit's beat
MIDDLE: bible entries (post-overflow) + timeline facts + summaries
LAST:   previous-unit tail
```

The current instruction (style + beat) sits where attention is highest at the start; the previous-unit tail — the material generation continues from directly — sits closest to the generation point at the end. Background material (bible/facts/summaries) occupies the position models attend to least, which is where it belongs: reference, not directive.

## BUDGET

Soft caps per section, enforced by the rules above rather than a raw token count:

- `style.md`: full, uncapped (small by construction)
- Beat: full (a single outline beat is inherently short)
- Bible: top-N full cards (default 6) + digests for the rest — capped by the overflow rule, not a separate limit
- Research notes: bound to this unit's beat/entities only, never the whole corpus
- Previous-unit tail: fixed at ~500–800 words
- Summaries: soft cap ~20% of the total package. When flat summaries would exceed that share, trigger the rollup below rather than truncating summaries arbitrarily

## Rollup

- Flat through 20 units: every unit gets its own 150–300-word summary in the assembled package.
- Beyond 20 units, or whenever summaries alone would exceed ~20% of budget: roll every closed act (5–10 units) into one 150–300-word act summary, and keep the last 5 individual unit summaries flat (most recent, highest relevance to the unit being written).
- Rollup replaces older individual summaries **in the assembled prompt only** — the originals stay untouched on disk in `summaries/unit-NN.md` for `haily-editor`'s retrieval-on-demand and for the Ship-stage full assembly.
- Act summaries are generated once, when an act closes, and reused for every subsequent unit's context package until the next act closes — not recomputed per unit.

## Resume protocol

Context state is never cached across a session boundary. After resume reconciliation (`references/workspace-schema.md`) completes, the next unit's context package is rebuilt from disk exactly as if freshly computed: alias-grep runs fresh against the current `outline.md`/bible/summaries, act rollups are recomputed only if a new act boundary was crossed, and the previous-unit tail is re-read from the last `complete` unit's manuscript file.

## Worked example — chapter 17 of a 30-chapter ensemble novel

30 units exceeds the 20-unit flat threshold, so summaries are act-rolled in acts of ~6 chapters: act-01 (ch1–6) and act-02 (ch7–12) are each a single 150–300-word act summary; chapters 12–16 stay flat (the last-5 rule) alongside them; chapter 16's manuscript supplies the previous-unit tail.

Chapter 17's beat names 9 characters once the alias grep runs against the beat text plus the last 2–3 summaries — more than the default top-N of 6. Ranking by beat-proximity and POV relevance selects 6 for full cards; the remaining 3 get one-line digests, e.g. `- Priest (harbor constable, owes Bob a favor)`. The Active Snapshot pull is filtered to only the facts touching those 9 matched entities, not the whole timeline.

Assembled order: `style.md` + chapter 17 beat first; the 6 full character cards + 3 digests + filtered Active Snapshot facts + act-01/act-02 summaries + chapters 12–16 flat summaries in the middle; chapter 16's manuscript tail last, immediately before generation begins.

If chapter 17 were instead chapter 3, the flat-summary path applies unchanged (3 units, no rollup) and the bible overflow rule only engages if the beat itself alias-matches more than 6 entities — a small early cast typically will not trigger it.
