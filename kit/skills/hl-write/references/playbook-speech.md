# Speech Playbook — Persuasive · Informative · Ceremonial · Toast/Eulogy

Four variants for spoken, delivered addresses. All four share the same output shape (script-format markers,
below) and the same word-budget wiring (W8): duration drives length, not the other way around.

## Boundary

- **Spoken vs. print advocacy:** a delivered address arguing one position → this playbook's Persuasive
  variant. A published, non-delivered piece arguing one position → `playbook-article.md`'s op-ed variant
  (added in phase 07) — the differentiator is delivery, not topic or length.
- **Speech vs. lesson plan (found in planning, not one of the scout's named 5):** a scripted address meant to
  be spoken to an audience ("kịch bản thuyết trình" in the delivered-speech sense) → this playbook. A
  teacher's session/lesson plan ("bài giảng", or "kịch bản thuyết trình" in the class-session-design sense) →
  `playbook-educational-content.md` (phase 06). Both terms can name either genre in casual Vietnamese usage —
  route at Recon on what the brief actually wants delivered: advocacy/ceremony/information to a live audience,
  or instructional design for a learner.

## Track

All four variants are short-form (well under the ~8,000-word long-form threshold) — the longest, a 45-minute
speech, runs ≈5,850 words. Unit = one section/step of the skeleton below, or the whole speech when short.

## Word–Duration Table

@130 wpm is the default conversion for persuasive/informative (coached formal-delivery rate, Toastmasters
120–160 wpm range, ASHA formal-speech standard). Ceremonial speeches run slower (ritual phrasing, applause
pauses) — apply the ×0.85–0.9 modifier. Toast and eulogy have their own bands (below), never derived from
this table.

| Duration | Words (@130 wpm) | Ceremonial (×0.85–0.9) |
|---|---|---|
| 5 min | ~650w | ~550–600w |
| 10 min | ~1,300w | ~1,100–1,200w |
| 18 min (TED norm) | ~2,340w | — |
| 20 min | ~2,600w | ~2,200–2,350w |
| 45 min | ~5,850w | ~5,000–5,300w |

Toast: 150–300 words (60–120s). Eulogy: 450–1,000 words (3–10 min). Neither scales off the table above — see
the Toast/Eulogy variant.

**Word-budget wiring (W8):** at Draft, the writer derives this unit's word budget from the brief's stated
duration using the table above (applying the ceremonial modifier when relevant) and records it in `outline.md`
as an attribute, e.g. `target: 20 min → ~2,600w`. The Verify Structural pass then compares the manuscript's
actual word count against that *recorded* budget (±10%) — a structure-vs-outline comparison, the same shape
as the thesis Abstract-presence check in `review-passes.md`. The arithmetic happens once, at Draft, by the
writer; the editor only compares two already-known numbers — it does not perform wpm arithmetic itself.

## Script Format

Speech output uses script markers, not prose formatting — convergent teleprompter/production practice:

- `[PAUSE]` — a deliberate beat; placed at the exact point delivery should stop, not a paraphrased direction.
- `[SLIDE n]` — placed at the exact transition point in the line, so an operator/deck can advance without the
  speaker breaking eye contact.
- `(stage direction)` — short parentheticals (`(pause)`, `(gesture)`, `(walk to podium)`), visually distinct
  from spoken text — never narrative prose.
- Short lines, 15–20 words, generous spacing — matches how a speaker's eye tracks a page or prompter.

## Variant: Persuasive

**Skeleton:** Monroe's Motivated Sequence — Attention (hook, breaks the audience's ambient attention) → Need
(problem established, stakes specific to *this* audience) → Satisfaction (proposed solution, how it meets the
need) → Visualization (concrete future with/without the solution — contrast framing) → Call to Action (one
specific, doable-today ask).

**Mandatory evidence:** every statistic and named-person quote traceable to `research/`; the Call to Action
names one concrete action, not generic inspiration.

**Fabrication risks:** an invented statistic for applause-line effect (stat-sourced guardrail); a misattributed
quote borrowed for the Attention hook — Einstein/Twain/Lincoln/Churchill are the top "quote magnets."

**Review criteria:**
1. All 5 Monroe steps present, in order, none skipped or merged
2. Need step's stakes are specific to this audience, not generic
3. Call to Action is one concrete, doable action, not vague inspiration
4. Word count within ±10% of the outline-recorded budget (W8)
5. ≥1 rhetorical repetition device present (anaphora or tricolon)
6. Spoken register holds: short sentences, contractions, dense signposting — not written prose pasted in

**Length:** per Word–Duration Table, by the brief's stated duration.

**Unit:** one Build unit = one Monroe step, or the whole speech when short (≤10 min).

## Variant: Informative

**Skeleton:** signpost-then-cover — no dedicated named model exists with the same cross-source consensus as
Monroe's sequence, so none is invented here (an absence of a framework, not a framework to name). Opening
(topic + why it matters + preview of coverage) → N body sections following one stated organizing pattern
(chronological / topical / spatial) → each section densely signposted ("first / next / finally / for
example") → closing recap matching the sections actually delivered.

**Mandatory evidence:** every statistic and example traceable to `research/`; the stated organizing pattern is
followed consistently, not switched mid-speech.

**Fabrication risks:** an unsourced statistic presented as fact; an invented example dressed as a real case.

**Review criteria:**
1. Organizing pattern stated once and followed consistently
2. Opening preview matches the sections that actually follow
3. Signposting density matches spoken register throughout
4. Word count within ±10% of the outline-recorded budget (W8)
5. ≥1 rhetorical repetition device present
6. Closing recap matches delivered sections, not a generic summary

**Length:** per Word–Duration Table.

**Unit:** one Build unit = one body section, or the whole speech when short.

## Variant: Ceremonial (Diễn Văn Khai Mạc / Bế Mạc)

**Skeleton — khai mạc (opening):** kính-thưa protocol (below) → framing of the event and its goals → welcome/
context → transition into the program. **Skeleton — bế mạc (closing):** kính-thưa protocol → summary of
results → thanks to contributors → forward direction/close. The two are a genuine content fork, not a tone
difference — do not reuse khai mạc content for a bế mạc brief or vice versa.

**Kính-thưa protocol (secondary-sourced — reported on Nghị định 154/2004, not the decree text itself;
sufficient for this craft guardrail, not for legal citation):** address ONLY the single highest-ranking
attendee present, by name/title, with "Kính thưa," then one collective phrase for everyone else (e.g. "cùng
toàn thể quý vị đại biểu"). Over-listing multiple names/titles is the exact error this rule prevents — worked
example: at an event attended by the PM, several deputy PMs, and city leaders, protocol addresses only the PM
(and, at a dual-level event, the top local official) — never the deputies individually.

**Mandatory evidence:** the kính-thưa opening resolves to exactly one named highest-ranking attendee, never a
list; khai mạc/bế mạc content matches which one the brief calls for.

**Fabrication risks:** inventing an attendee's rank/title — misrepresents a real person's position, treat with
the same caution as an invented official document; praise/lament content stated as fact without a source.

**Review criteria:**
1. Kính-thưa addresses exactly one highest-ranking attendee, one collective phrase for the rest — no name list
2. Khai mạc content = framing/goals; bế mạc content = results + thanks + forward direction — not interchanged
3. Word count within ±10% of the outline-recorded budget, using the ceremonial ×0.85–0.9 modifier (W8)
4. Recorded budget reflects the slower ceremonial pace, not the 130-wpm default
5. Protocol source flagged secondary-sourced — never cited as legal authority in the manuscript itself

**Length:** per Word–Duration Table, ceremonial-adjusted.

**Unit:** one Build unit = khai mạc or bế mạc as a whole — each is typically short enough to close as one unit.

## Variant: Toast / Eulogy

Own word-band and collapsed structure — **not** a scaled-down 130-wpm speech; merging it into the ceremonial
band would blow past its much tighter length and confuse VN protocol with Western funeral convention.

**Skeleton:** Opening (20–40s) → Who they were (60–90s) → 1–3 stories (bulk of the time) → Lesson/legacy
(60–90s) → Goodbye (20–40s). Toast collapses to one story + one toast line ("To [Name]").

**Mandatory evidence:** every story/anecdote is one the speaker can vouch for as their own real memory of the
honoree (no-invented-anecdotes guardrail — highest stakes of all 4 variants here).

**Fabrication risks:** an invented personal anecdote presented as the speaker's real memory (highest severity
in this variant); a misattributed quote used for the Lesson/legacy step.

**Review criteria:**
1. Word count within its own band — toast 150–300w, eulogy 450–1,000w — never the general 130-wpm formula
2. Toast collapses to exactly one story + one toast line; eulogy keeps all 5 structural beats
3. Every story/memory is attributed to the speaker's own relationship with the honoree, not generic
4. Any quoted material is attributed and checkable (quote-attributed guardrail)

**Length:** toast 150–300 words (60–120s); eulogy 450–1,000 words (3–10 min) — own band, not table-derived.

**Unit:** the whole toast = one Build unit; eulogy = one unit per structural beat, or the whole piece when
short.

## Anti-Fabrication Guardrail

> **Required — no-invented-anecdotes (generation-time):** every first-person story or lived-experience
> anecdote must originate from the actual speaker, never invented to fill a beat. This is a generation-time
> guardrail — the editor cannot independently verify whether a personal anecdote is the speaker's real
> experience. Enforcement lives in Recon/writer guidance (source the anecdote from the speaker's own brief;
> never fabricate one to complete a Monroe step or a toast/eulogy story slot), not in review.

> **Required — quote-attributed (editor-enforced):** any quote attributed to a named person must resolve to a
> verifiable source before Ship. Apply extra caution to "quote magnets" — Einstein, Twain, Lincoln, Churchill,
> and Monroe are the most frequently misattributed figures (e.g. the false Einstein "definition of insanity"
> line). Enforced by the fact-check pass, the same claim→source mechanism as `playbook-article.md`'s
> attribution-before-print guardrail.

> **Required — stat-sourced (editor-enforced):** any statistic used for applause-line effect must resolve to a
> matching entry in `research/`. Unsourced statistics are flagged for the writer to source or hedge, never
> silently invented or silently cut.

## Sources

Word↔duration/TED norms: help.ted.com/hc/en-us/articles/360038669354, toastmasters.org, word-timer.com/ted-
talk-script-length, amberwillo.com/public-speaking/words-per-minute. Toast/eulogy bands: funeral.com/blogs/
the-journal/how-long-should-a-eulogy-be, eulogyexpert.com/posts/how-long-should-a-eulogy-be. Spoken register:
leonardoenglish.com/blog/signposting, writers.com/the-rule-of-three, mannerofspeaking.org (tricolon). Monroe's
Motivated Sequence: gvsu.edu/speechlab/monroes-motivated-sequence-46, en.wikipedia.org/wiki/Monroe's_motivated_
sequence. Kính-thưa protocol (secondary-sourced): vanhoathoidai.vn (kinh-thua-trong-cac-nghi-le), moha.gov.vn
(kinh-thua-hoi-nghi). Script format: beverlyboy.com/filmmaking/how-to-format-a-teleprompter-friendly-script,
prompterproslive.com/how-to-write-a-teleprompter-script-for-a-live-event. Quote-magnet fabrication: snopes.com/
collections/albert-einstein-collection, history.com/articles/here-are-6-things-albert-einstein-never-said,
mediaethicsmagazine.com (speech-ghostwriting ethics).

## Deviation Log

- **Decision:** `references/scout-report.md` (named in the phase file as the format contract) does not exist
  in the repo — used `playbook-article.md` + `playbook-literary-criticism.md` as the live format contract
  instead (same six per-variant fields: Skeleton, Mandatory evidence, Fabrication risks, Review criteria,
  Length, Unit). **Why:** those two files are the actual, current shape every other playbook in this
  directory follows. **Impact:** none — output conforms to the same contract, just sourced from the correct
  file. Reversible/non-blocking.
- **Decision:** added a `## Sources` section carrying researcher-04's URLs (domain-only, no `http://` prefix,
  matching this skill's own MLA-adjacent URL convention in `citation-styles.md`), even though wave-1 playbooks
  (thesis, literary-criticism) carry no URL list in-body. **Why:** this phase file's Non-functional/Todo lines
  explicitly require "researcher-04 URLs carried," overriding the wave-1 precedent for this phase. **Impact:**
  adds ~9 lines toward the W11-permitted ~220 budget; non-blocking.
