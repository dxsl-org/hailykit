# Educational Content Playbook — Textbook/Tutorial · Lesson Plan/Bài Giảng

Two variants sharing one instructional core loop: (1) textbook-tutorial, merging giáo trình chapter and
standalone tutorial under a single variant switch, and (2) lesson-plan/bài giảng, teacher-facing. **Boundary
vs `{skill:hc-docs}` (researcher-05 verbatim):** "if removing the reference to this-repo/this-API leaves the
content valid and useful → educational content (hl-write); if it collapses without the specific codebase in
front of the reader → hc-docs."

## Boundary vs Speech

Reciprocal of `playbook-speech.md`'s boundary (found in planning, not one of the scout's named 5): a scripted
address delivered to a live audience for advocacy/ceremony/information ("kịch bản thuyết trình" in the
delivered-speech sense) → `playbook-speech.md`. A teacher's session/lesson plan ("bài giảng", or "kịch bản
thuyết trình" in the class-session-design sense) → this playbook's Lesson Plan/Bài Giảng variant. Route at
Recon on what the brief wants delivered: a one-time address, or instructional design with a practice/
assessment loop for a learner.

## Track

Textbook-tutorial: the chaptered giáo trình sub-variant is long-form once it exceeds the short-form
threshold — one Build unit = one bài, a Chương close is an act boundary (existing act-rollup/act-close
mechanics in `context-assembly.md` apply unchanged). A standalone tutorial stays short-form: one Build unit
= the whole tutorial. Lesson-plan/bài giảng defaults to short-form (one Build unit = one lesson plan); a
multi-lesson giáo án chains lesson-plan units.

## Bible Mapping

Reuses `playbook-academic-thesis.md`'s `## Bible Mapping (all variants)` mechanism unchanged (D3, no
restatement here) — see that section for how leaving `bible/characters.md`/`bible/world.md` empty makes
`context-assembly.md`'s alias-grep SELECT return an empty matched set, and how non-fiction registries
populate the fiction-shaped bible files instead. **Educational reinterpretation:** `characters.md` → concepts/
terms taught (entity cards: name + `aliases:`); `world.md` → domain/course context; `plot.md` →
prerequisite/progression threads (a concept planted in an early bài, paid off in a later one); `glossary.md`
→ terminology.

**Further-reading formatting (W13):** a further-reading list is a bibliography and follows the brief's
chosen citation style — see `references/citation-styles.md` for the style rules; this playbook only routes
to them, it does not restate them.

## Core Loop (GRR — Gradual Release of Responsibility, Pearson & Gallagher 1983)

Shared by both variants: measurable objective (one Bloom's verb, or — for VN content — one MOET tier:
nhận biết/thông hiểu/vận dụng/vận dụng cao; **moderate-confidence terminology**, sourced from
teacher-training/university-course material rather than one canonical MOET textbook-design standard) →
prerequisite statement → concept explanation → worked example (I-do) → guided practice (We-do) →
independent practice (You-do) → assessment/ôn tập.

**MOET-Bloom objective rule (checkable):** exactly one observable/behavioral verb per objective — never
"understand"/"appreciate" or similar non-observable verbs; a lesson-level verb's cognitive tier must not
exceed the course-level verb's tier.

## Variant: Textbook / Tutorial

One variant switch, two framings sharing the Core Loop above — not two separate loops.

**Giáo trình skeleton:** Chương → Bài (opens with mục tiêu bài học, one per Bài) → Mục, content sequenced
dễ→khó, cơ bản→nâng cao; each Chương closes with câu hỏi ôn tập.

**Tutorial skeleton:** problem statement (problem-first framing) → prerequisite → concept → worked example →
guided practice → independent practice → recap — no formal ôn tập section.

**Mandatory evidence:** each Bài/section's objective stated before its content; worked-example steps shown in
full, no step left for the learner to infer; any further-reading entry checkable (see Anti-Fabrication
Guardrail).

**Fabrication risks:** a worked-example answer inconsistent with its own shown steps; a fabricated or
non-existent further-reading citation. A CS-education survey found **53%** of a sampled error set were
hallucinations that could mislead students and educators — see the guardrail below for how this shapes
enforcement scope.

**Review criteria:**
1. Objective uses exactly one measurable/observable verb.
2. Worked-example steps and the stated final answer are internally consistent.
3. Practice exercises are answerable from the concept section alone — no forward reference to unexplained
   content.
4. Any further-reading citation is real/checkable or omitted, never fabricated.
5. Scaffolding fades in difficulty across the practice sequence (I-do more supported than You-do) — never
   flat or reversed.

**Length:** giáo trình bài ~800–2,000 words depending on mục count; tutorial 500–3,000 words depending on
scope — no rigid industry standard, follow the range the brief implies.

**Unit:** giáo trình — one Build unit = one bài (long-form; Chương close = act boundary, see Track). Tutorial
— one Build unit = the whole tutorial (short-form default).

## Variant: Lesson Plan / Bài Giảng

Teacher-facing — a real audience-shape difference, not decoration: fields a learner-facing tutorial never
carries.

**Skeleton:** Mục tiêu bài học → Chuẩn bị (materials list) → Tiến trình dạy học (per-segment timing/pacing:
mở đầu, hình thành kiến thức, luyện tập, vận dụng) → Dự kiến khó khăn/sai lầm thường gặp
(anticipated-misconception call-outs, each paired with a correction strategy) → Đánh giá/câu hỏi kiểm tra.

**Mandatory evidence:** per-segment timing sums to the stated class-period length; each misconception
call-out pairs with a correction strategy, not a bare "watch out" note; any embedded worked example or
citation meets the same bar as the Textbook/Tutorial variant.

**Fabrication risks:** an invented timing budget not matched to a real period length; the same
worked-example/citation risks as the Textbook/Tutorial variant where a lesson plan embeds one.

**Review criteria:**
1. MOET-Bloom objective rule (single verb).
2. Per-segment timing sums to the stated class-period length.
3. Each misconception call-out is paired with a correction strategy.
4. Materials list is complete and actionable.
5. Any embedded worked example/citation passes Textbook/Tutorial criteria 2 and 4.

**Length:** one class period's worth (~45–90 minutes, VN period-length convention) — confirm the target
period length at Recon rather than defaulting silently.

**Unit:** one Build unit = one lesson plan (short-form default); a multi-lesson giáo án chains lesson-plan
units, each its own unit.

## Anti-Fabrication Guardrail

> **Required — worked-example-verified:** two distinct obligations under one name — do not conflate them.
> (i) **Further-reading/citation existence `(editor-enforced)`** — the fact-check pass confirms every cited
> source is real and resolvable (rides the existing claim→source check; an unresolvable citation is flagged
> for the writer to fix or cut, never silently kept). (ii) **Worked-example correctness is NOT
> editor-enforced in that sense** — neither `haily-writer` nor `haily-editor` has an execution tool (no
> Bash), so recomputing math or running code is out of scope for both. Instead: the **writer carries a
> self-check obligation** — recompute the math or trace the code by hand before emitting the example — and
> the **editor performs only a best-effort internal-consistency read** (does the stated final answer match
> the shown steps), which is explicitly **NOT a verification guarantee** — no pass here runs or recomputes
> anything. The 53% education-hallucination stat (see Fabrication risks above) is the reason the writer-side
> obligation is mandatory, not optional: no downstream pass can catch a wrong-but-internally-consistent
> worked example.

> **Required — objective-observable (editor-enforced, structural):** every objective (mục tiêu bài học
> included) states exactly one measurable/observable verb — a non-observable verb ("understand"/
> "appreciate") fails this check, and a lesson-level verb must not exceed the course-level verb's cognitive
> tier.

## Sources

Bloom's/GRR: tips.uark.edu/using-blooms-taxonomy, en.wikipedia.org/wiki/Gradual_release_of_responsibility,
odu.edu/facultydevelopment/teaching-toolkit/gradual-release-responsibility-framework. Giáo trình/MOET
(moderate-confidence): tnc.edu.vn (trao-doi-kinh-nghiem-viet-muc-tieu-bai-giang-khi-soan-giao-an),
moet.gov.vn (chương trình môn Tiếng Việt PDF). Worked-example/further-reading fabrication:
arxiv.org/pdf/2507.11543, web.hypothes.is/blog/what-are-ai-hallucinations-in-education.

## Deviation Log

- **Decision:** `references/scout-report.md` (named in the phase file's Context Links as the format
  contract) does not exist in the repo — confirmed via Glob of `kit/skills/hl-write/references/`. Used
  `playbook-academic-thesis.md` + `playbook-business-report.md` as the live format contract instead (same
  per-variant fields: Skeleton, Mandatory evidence, Fabrication risks, Review criteria, Length, Unit).
  **Why:** those are the actual, current shape every other playbook in this directory follows; this matches
  the identical resolution already logged in `playbook-speech.md`'s Deviation Log for the same nonexistent
  path. **Impact:** none — output conforms to the same contract, just sourced from the correct file.
  Reversible/non-blocking.
- **Decision:** W6 re-grep of `^## Bible Mapping` in `playbook-academic-thesis.md` performed before writing
  the reference (per the phase file's Assumptions section). **Result:** heading confirmed as
  `## Bible Mapping (all variants)` at `playbook-academic-thesis.md:30` — matches the phase file's pinned
  high-confidence claim exactly, no drift. **Impact:** none — linked the heading as-is.
- **Decision:** added a `## Sources` section carrying researcher-05's URLs (domain-only, no `http://` prefix),
  matching the convention `playbook-speech.md` already established for the same requirement. **Why:** this
  phase file's Non-functional/Todo lines explicitly require "researcher-05 §B URLs carried." **Impact:** adds
  ~5 lines toward the line budget; non-blocking, main content stays under 200 lines excluding this log.
