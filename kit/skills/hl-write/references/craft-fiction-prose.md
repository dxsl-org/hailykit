# Fiction Prose Craft

Fiction-specific prose craft: hook archetypes, concept differentiation, and short-unit expansion. The genre-neutral tells — anti-AI-tone patterns, density ceilings, show-don't-tell, the specificity requirement — live in `references/craft-prose-antipatterns.md` and apply to fiction unchanged; this file does not restate them.

Adapted from the reference material of [kentjuno/ainovel-cli](https://github.com/kentjuno/ainovel-cli) (Apache-2.0), generalized beyond CJK web-novel conventions for Vietnamese and English long-form fiction.

## Usage map

| Section | Used by | When |
|---|---|---|
| Anti-AI-tone, density ceilings, show-don't-tell, specificity | see `references/craft-prose-antipatterns.md` | Every unit |
| Hook craft | `haily-writer` (chapter endings), `haily-editor` structural pass | Novel track units |
| Differentiation checklist | Orchestrator + `{skill:hl-brainstorm}` | Draft stage, concept development |
| Expansion techniques | `haily-writer` | A unit lands short of its length target |

At Draft, seed `bible/style.md` with the **Prose guardrails** digest from `references/craft-prose-antipatterns.md`, trimmed to fiction's most relevant patterns and the work's language. The digest travels with every unit via style.md's always-inject rule.

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
