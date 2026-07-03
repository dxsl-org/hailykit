# Fiction Prose Craft

Prose-quality knowledge for the fiction playbook: what makes generated fiction read like generated fiction, and the concrete fix for each pattern. `haily-writer` applies these while drafting; `haily-editor`'s Voice/Style pass uses the anti-pattern tables as rubric evidence ("matches anti-AI-tone pattern D2" beats "prose could be better").

Adapted from the reference material of [kentjuno/ainovel-cli](https://github.com/kentjuno/ainovel-cli) (Apache-2.0), generalized beyond CJK web-novel conventions for Vietnamese and English long-form fiction.

## Usage map

| Section | Used by | When |
|---|---|---|
| Anti-AI-tone patterns | `haily-writer` (avoid), `haily-editor` Voice/Style pass (cite) | Every unit |
| Show-don't-tell table | `haily-writer` | Every unit |
| Hook craft | `haily-writer` (chapter endings), `haily-editor` structural pass | Novel track units |
| Differentiation checklist | Orchestrator + `{skill:hl-brainstorm}` | Draft stage, concept development |
| Expansion techniques | `haily-writer` | A unit lands short of its length target |

At Draft, seed `bible/style.md` with a **Prose guardrails** digest: the one-line fix column of the anti-AI-tone table below, trimmed to the patterns most relevant to the work's genre and language. The digest travels with every unit via style.md's always-inject rule; this file stays on disk as the full rubric.

## Anti-AI-tone patterns

Five categories of tells that mark prose as generated. Each row: the tell, why it reads artificial, the fix.

### Structure

| Tell | Fix |
|---|---|
| Triadic parallel lists ("the wind, the rain, and the silence") reached for by default | Cut to the single strongest item; let one image carry the beat |
| Uniform paragraph cadence — every paragraph 3–4 sentences, same rhythm | Vary deliberately: a one-line paragraph after a long one changes tempo |
| Section headers or numbered beats inside narrative prose | Delete; transitions are carried by scene and time cues, not headers |

### Diction

| Tell | Fix |
|---|---|
| Stacked formal idioms or four-word set phrases where plain words serve | One precise plain verb outworks three ornamental ones |
| Formulaic similes ("like a knife", "as if the world stopped") | Either a simile earned by this POV character's experience, or none |
| Filler intensifiers: "a hint of", "somehow", "involuntarily", "thoáng", "bất giác" | Delete; if the emotion needs marking, show its physical trace instead |
| Abstract narrator commentary: "in a sense", "it goes without saying", "có lẽ, theo một cách nào đó" | Cut the commentary; trust the scene |
| The "not X, but Y" contrastive tic used to manufacture profundity | Allowed once per act at most; usually the Y clause alone is stronger |

### Description

| Tell | Fix |
|---|---|
| Mood labels: "the atmosphere was tense", "không khí trở nên căng thẳng" | Concrete sensory detail a camera or skin could register |
| Direct emotion-labeling: "she felt deep sorrow" | Somatic reaction: what her hands, breath, voice do |
| Visual-only description stacked three deep | Rotate senses — touch, smell, and sound date a scene faster than sight |

### Dialogue

| Tell | Fix |
|---|---|
| Undifferentiated voices — remove the tags and no one can tell speakers apart | Per-character diction habits: sentence length, vocabulary register, what they never say |
| Characters explaining their own motives aloud | Motive leaks through evasion, subtext, and what gets left unsaid |
| Uniformly grammatical "written" speech | Real speech interrupts itself, drops subjects, answers the wrong question |

### Pacing and emotion

| Tell | Fix |
|---|---|
| Every causal link explained — nothing left for the reader to assemble | Cut the connective tissue; readers enjoy inferring |
| Chapter endings forced upward into thematic "elevation" | End on a concrete image, action, or choice — the theme is the reader's to name |

## Show-don't-tell substitutions

| Telling | Showing |
|---|---|
| He was very angry | He set the cup down slowly, knuckles white around the handle |
| She was exhausted | She read the same line three times before giving up on the page |
| The room was creepy | Something had gnawed the chair legs, and the dust held no footprints but hers |
| They were in love | He kept her bus ticket from the day they met, folded behind his ID |
| Time passed slowly | The kettle's tick toward boiling was the loudest thing in the house |

Pattern: replace the verdict-word (angry, exhausted, creepy) with evidence a witness could report.

## Hook craft — chapter endings (novel track)

Ten hook archetypes. Vary across the work — three "revelation" endings in a row reads mechanical:

1. **Revelation** — a fact recontextualizes what the reader believed
2. **Imminent crisis** — danger visible, impact not yet landed
3. **Interrupted action** — cut mid-gesture, mid-sentence, mid-fight
4. **Identity reversal** — someone is not who they appeared to be
5. **Dilemma** — two options, both costly, choice not yet made
6. **Mysterious object** — a thing whose meaning is deferred
7. **Deadline** — a clock starts
8. **Promise or threat** — a character commits to something the reader must see attempted
9. **Disappearance** — someone or something expected is gone
10. **Hidden implication** — an innocuous detail the reader can sense matters

**Intensity scale** — curiosity → anxiety → urgency → survival → ultimate. Escalate across an *act*, not per chapter; opening every chapter at "survival" leaves nowhere to go and numbs the reader.

**Hook anti-patterns** (structural findings, not style nits):

- *Fake hook* — a cliffhanger resolved next chapter by mundane misunderstanding; spends reader trust for nothing
- *Unearned rescue* — the crisis dissolves via a device the story never planted
- *Thread flood* — so many open hooks at once that none carries weight
- *No-stakes hook* — the question posed costs no character anything

## Differentiation — concept stage

When the brief names only a genre, do not default to the genre's highest-frequency premise. Run this at Draft before the outline Checkpoint:

- **Five axes** — protagonist, central conflict, world, key relationship, pacing profile. The concept must depart from genre default on at least 2 of the 5.
- **Anti-tropes** — name 2–3 tropes of this genre the work explicitly will not use; record them in `brief.md` so the outline Checkpoint reviews them.
- **Self-check** — with character and place names removed, would the synopsis still be distinguishable from ten other books in the genre? If not, iterate the concept before outlining.

## Expansion techniques

When a unit lands short of its length target, expand with material that serves tension — never padding:

1. Setting detail that characterizes (what this POV character notices reveals them)
2. Interiority — reaction beats between actions
3. Dialogue subtext — lengthen the distance between what is said and meant
4. Full-sense description at emotionally loaded moments
5. Subplot interleaving — advance a B-story thread inside the chapter
6. Slow motion at the beat's peak — expand the decisive seconds, not the walk to the door
7. Mood through environment — weather, light, and sound doing emotional work

> **Required — expansion-serves-tension:** every added passage must raise a question, deepen a character, or advance a thread. If a passage can be cut without the chapter losing tension, it is padding — the word count was the wrong target, not the prose.
