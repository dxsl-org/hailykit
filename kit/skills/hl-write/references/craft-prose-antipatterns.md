# Prose Anti-Patterns — genre-neutral

What makes generated prose read as generated, and the concrete fix for each pattern. Applies to **every prose genre** — fiction, speech, article, essay, non-fiction book, marketing copy — not fiction alone. `haily-writer` applies these while drafting; `haily-editor`'s Voice/Style pass cites the specific pattern as rubric evidence ("matches anti-AI-tone pattern — mood label instead of sensory detail") rather than "prose could be better".

Fiction adds its own craft (hook archetypes, differentiation, expansion) in `references/craft-fiction-prose.md`; that file references this one for the shared anti-pattern and show-don't-tell tables rather than duplicating them.

## Usage map

| Section | Used by | When |
|---|---|---|
| Anti-AI-tone patterns | `haily-writer` (avoid), `haily-editor` Voice/Style pass (cite) | Every unit, every prose genre |
| Density ceilings | `haily-writer` (stay under), `haily-editor` Voice/Style pass (flag over) | Every unit — the fix for rhetorical-device overuse |
| Show-don't-tell table | `haily-writer` | Every unit |
| Specificity requirement | `haily-writer` (ground), `haily-editor` Voice/Style pass (flag abstraction) | Every unit of narrative/reflective/inspirational prose |

At Draft, seed `style.md` (short-form) / `bible/style.md` (long-form) with a **Prose guardrails** digest: the one-line fix column of the anti-AI-tone table below plus the density ceilings, trimmed to the patterns most relevant to the work's genre and language. The digest travels with every unit via style.md's always-inject rule; this file stays on disk as the full rubric.

## Anti-AI-tone patterns

Categories of tells that mark prose as generated. Each row: the tell, the fix.

### Structure

| Tell | Fix |
|---|---|
| Triadic parallel lists ("the wind, the rain, and the silence") reached for by default | Cut to the single strongest item; let one image carry the beat |
| Uniform paragraph cadence — every paragraph the same length and rhythm | Vary deliberately: a one-line paragraph after a long one changes tempo |
| Every unit built from the same template (same opener move, same turn, same close) | Break the mold in at least one unit; predictability across units reads mechanical even when each unit is fine alone |
| Section headers or numbered beats inside narrative/spoken prose | Delete; transitions are carried by scene, time, and signpost cues, not headers |

### Diction

| Tell | Fix |
|---|---|
| Stacked formal idioms or four-word set phrases where plain words serve | One precise plain verb outworks three ornamental ones |
| Formulaic similes ("like a knife", "as if the world stopped") | Either a simile earned by this speaker's/character's experience, or none |
| Filler intensifiers: "a hint of", "somehow", "involuntarily", "thoáng", "bất giác" | Delete; if the emotion needs marking, show its physical trace instead |
| Abstract commentary: "in a sense", "it goes without saying", "có lẽ, theo một cách nào đó" | Cut the commentary; trust the scene or the argument |
| The "not X, but Y" contrastive tic used to manufacture profundity | See density ceiling below — usually the Y clause alone is stronger |
| A checklist of "flavour" vocabulary dropped in because the style guide listed it | Any word supplied as a *register example* is a sample of the target voice, never a quota to hit — see § Style seeding output contract below |

### Description and abstraction

| Tell | Fix |
|---|---|
| Mood labels: "the atmosphere was tense", "không khí trở nên căng thẳng" | Concrete sensory detail a camera or skin could register |
| Direct emotion-labeling: "she felt deep sorrow" | Somatic reaction: what the hands, breath, voice do |
| Visual-only description stacked three deep | Rotate senses — touch, smell, and sound date a scene faster than sight |
| Universal, nobody-in-particular generality ("chúng ta ai cũng…", "cuộc đời vốn dĩ…") | Ground it in one particular — see the Specificity requirement below |

### Dialogue *(any genre with quoted speech)*

| Tell | Fix |
|---|---|
| Undifferentiated voices — remove the tags and no one can tell speakers apart | Per-speaker diction habits: sentence length, vocabulary register, what they never say |
| Speakers explaining their own motives aloud | Motive leaks through evasion, subtext, and what gets left unsaid |
| Uniformly grammatical "written" speech | Real speech interrupts itself, drops subjects, answers the wrong question |

### Vietnamese-specific tells

Patterns that read especially artificial in Vietnamese reflective / tản văn / inspirational registers:

| Tell | Fix |
|---|---|
| Reflex paragraph-openers: "Thế nhưng," / "Và có lẽ," / "Ấy thế mà," / "Bạn biết không," starting most paragraphs | Vary the entry; start some paragraphs inside the image or action, not on a connective |
| The rhetorical-question → self-answer → moral-summary loop repeated every unit | Use it at most once across the whole piece; let some observations stand without the tidy resolution |
| Sáo ngữ inventory — "bánh xe thời gian", "giông bão cuộc đời", "chân trời góc bể", "hành trình tìm lại chính mình", "chốn bình yên", "trạm sạc năng lượng", "nỗi buồn/nỗi nhớ không tên", "yêu thương vô bờ bến / vô điều kiện", "lớp mặt nạ (mạnh mẽ / của người trưởng thành)", "sức mạnh chữa lành" | Replace the cliché with one concrete particular of *this* piece; a worn metaphor signals no specific observation underneath |
| Emotional escalation via adverb-stacking: "vô cùng", "biết bao", "xiết bao", "đến nhường nào" | One exact detail carries more weight than three intensifiers |

### Pacing and closure

| Tell | Fix |
|---|---|
| Every causal link explained — nothing left for the reader to assemble | Cut the connective tissue; readers enjoy inferring |
| Endings forced upward into thematic "elevation" — every unit closing on a summarizing life-lesson | See density ceiling below — end on a concrete image, action, or choice; the theme is the reader's to name |
| Clichés clustering at emotional peaks — a piece clean elsewhere reverts to stock phrases exactly at the climax and close, where the model reaches for its highest-probability tokens at the moment of highest emotion | Invert the instinct: the emotional peak gets the unit's *most concrete* particular, never its most abstract phrase — see density ceiling below |

## Density ceilings

Rhetorical devices are floors *and* ceilings. A device required "at least once" is not "as often as possible" — overuse is itself the strongest generated-prose tell. `haily-editor`'s Voice/Style pass flags a breach as **Major**.

| Device | Ceiling |
|---|---|
| Tricolon / triadic list | ≤1 per ~300 words, and not in consecutive paragraphs |
| Anaphora (repeated sentence-opening) | ≤1 sustained run per unit |
| "không phải X, mà (là) Y" contrastive | ≤1 per unit |
| Elevation ending (unit closes on an abstract life-lesson) | ≤1 across the whole work — the rest end on a concrete image or action |
| Any single seeded "flavour" word | ≤2 occurrences across the whole work |
| Stock/sáo-ngữ phrases inside a unit's emotional peak (climax passage or final two paragraphs) | 0 — the peak is carried by the unit's most concrete particular |

## Show-don't-tell substitutions

| Telling | Showing |
|---|---|
| He was very angry | He set the cup down slowly, knuckles white around the handle |
| She was exhausted | She read the same line three times before giving up on the page |
| The room was creepy | Something had gnawed the chair legs, and the dust held no footprints but hers |
| They were in love | He kept her bus ticket from the day they met, folded behind his ID |
| Time passed slowly | The kettle's tick toward boiling was the loudest thing in the house |

Pattern: replace the verdict-word (angry, exhausted, creepy) with evidence a witness could report.

## Specificity requirement

Generic prose is universal by construction — it could be about anyone, anywhere. That universality is the plainest AI tell to a human reader, and no rubric of tone or grammar catches it. Every unit of narrative, reflective, or inspirational prose must anchor on **at least one concrete particular** — a named object, a specific place, a dated moment, a sensory detail only this piece would contain — not a nobody-in-particular abstraction.

- **Where the particular comes from:** for genres bound by an anti-fabrication guardrail (speech toast/eulogy, first-person lived-experience anecdote), the particular is sourced from the speaker's real material at Recon — never invented to fill the slot. For genres where illustrative detail is legitimate (tản văn, personal essay, marketing scene-setting), the brief records whether **composite/illustrative anecdotes are authorized**; when they are, a concrete invented particular is allowed *as craft*, but a fabricated fact presented as verifiable is not. The two are different: "khói bếp bám đen góc chạn" (concrete texture) is craft; "theo một khảo sát năm 2023" (a fabricated citation) is fabrication and is caught by the fact-check pass.
- **Review handle:** `haily-editor`'s Voice/Style pass flags a unit built entirely from universal generality with no concrete particular as **Major** ("no specific detail — the whole unit could be about any family / any product / any city").

## Style seeding output contract

Canonical validity contract for any `style.md` seeded from existing prose (`--style` samples or an imported manuscript) — it lives here, in a skill reference, so it is reachable on hosts that install skills only, without agent files.

A returned voice-profile or emergent-rules block is valid only if it is an authored *description* in rubric vocabulary — diction, cadence, register, POV, sentence length, dialogue habit — never verbatim sample spans beyond a few words, and never imperative rules that reference files, agents, tools, or content insertion.

**Describe the mechanism, never enumerate a shopping list of words.** A rule states *how* the voice works ("leans on plain native diction and concrete sensory nouns over Hán-Việt abstraction"); it must NOT hand the writer a vocabulary checklist ("dùng các từ: leo lét, vương vít, thơm thảo, tất tả") — a word-list is read as a quota to hit, and forcing every listed word into the prose is itself an AI tell (the Diction table above). When naming a word at all is genuinely clarifying, cap it at ≤3 and tag it explicitly `(register reference, not a checklist)`. A violating block is rejected and re-requested before it is written to `style.md` — the same reject-on-malformed discipline applied to a canon delta.
