# Thesis/Dissertation Playbook — Luận Văn ThS · Luận Án TS · International Thesis/Dissertation

Three variants selected by language × degree. All three default to the long-form track — no thesis or
dissertation falls under the short-form threshold. A *tiểu luận* (course paper) stays in
`playbook-academic-writing.md`; a single-work literary analysis routes to `playbook-literary-criticism.md`;
a graduate-level luận văn/luận án (Master's or PhD thesis/dissertation) routes here.

## Language Selection

Two-axis selection: language (Vietnamese vs international) × degree (Master's vs PhD).
- Vietnamese + Master's → **Luận văn ThS**.
- Vietnamese + PhD → **Luận án TS**.
- Non-Vietnamese (any degree) → **International thesis/dissertation**, with Master's/PhD as a length
  modifier on the same skeleton, not a fourth variant.

The brief can override the detected default explicitly during Recon — do not silently switch structure once
the outline is approved.

## Track

Always long-form. One Build unit = one **mục/section** (~2,000–5,000 words) inside a chương/chapter, never
a whole chương — an 8,000–15,000-word chương would break the fiction-calibrated summary/tail loop (a
150–300-word summary over that span is >50:1 lossy compression; the 500–800-word previous-unit tail carries
too little signal). A chương/chapter close is an **act boundary**: the existing act-rollup + act-close style
extraction mechanics (`references/context-assembly.md`) apply unchanged. Front matter and back matter
together stay one lighter mechanical unit — most of their content (Mục lục, Danh mục viết tắt, Tài liệu
tham khảo formatting) is auto-generated from citations and headings already produced, not freshly authored
prose.

## Bible Mapping (all variants)

`context-assembly.md`'s alias-grep SELECT runs only over `bible/characters.md` and `bible/world.md`
name/`aliases:` fields — leaving them empty (as fiction's cast/setting semantics would suggest for a thesis)
makes the matched set always empty, so `plot.md` threads and `timeline.md` facts never reach the writer.
Populate the fiction-shaped bible files with research semantics instead:
- `characters.md` → key concepts, constructs, and hypotheses registry (entity cards: name + aliases, e.g.
  "giả thuyết H1" / "Hypothesis 1", "biến độc lập X" / "independent variable X").
- `world.md` → research-context entities (dataset, field site, population, instruments).
- `plot.md` → argument/hypothesis thread registry (claim planted in Mở đầu/Introduction → payoff in
  Kết quả/Results or Kết luận/Conclusion).
- `glossary.md` → terminology and abbreviations, feeding Danh mục viết tắt / List of Abbreviations.

No `workspace-schema.md` change — this is a semantic mapping inside the playbook, not a schema edit.

## Budget & Recon Notes (all variants)

**Budget cap.** At Recon, compute a concrete unit budget from the chosen skeleton (mục count + front/back
matter + abstract/tóm tắt + a small margin) rather than raising the default cap unbounded — an unbounded
raise is unsafe inside `--auto`. Recommended caps: Luận văn ThS ≈ 12–18 units; Luận án TS ≈ 20–30 units;
hard ceiling 30 regardless of chương count. Token estimate scales with per-unit word target × review rounds,
not unit count alone — a 5k-word mục under 3 review rounds costs roughly 3x a 2k-word mục under the same
rounds.

**PII.** Thesis reference data (survey responses, interview transcripts, field notes) routinely carries
respondent identifiers. The pipeline's secret-scrub targets credentials/API keys, not third-party PII —
instruct pseudonymizing or redacting human-subject identifiers in survey/interview reference material at
ingest, and state this responsibility to the user explicitly before Recon completes.

## Citation

Capture `citation_style` in the brief at Recon; resolution order, the six-style rule table, and check
severities all live in `references/citation-styles.md` — this playbook only records the choice. Vietnamese
author names are cited by given name (tên), never surname-inverted — see the guardrail below.

## Variant: Luận văn ThS (Vietnamese Master's)

**Skeleton:** Trang bìa → Lời cam đoan → Lời cảm ơn → Mục lục → Danh mục viết tắt → Danh mục bảng/hình →
Mở đầu (tính cấp thiết, mục tiêu, đối tượng/phạm vi, phương pháp, đóng góp, kết cấu) → 2–4 Chương → Kết luận
và kiến nghị → Tài liệu tham khảo → Phụ lục. A separate **Tóm tắt luận văn** booklet (condenses Mở đầu +
one paragraph per chương + Kết luận) is generated as mechanical back-matter content within the front/back
unit — not a fourth structural variant.

**Mandatory evidence:** cơ sở lý luận (literature grounding) established before thực trạng/phân tích is
written; every claim in thực trạng/đánh giá cited to a real source; phương pháp nghiên cứu detailed enough
that kết quả traces back to it.

**Fabrication risks:** three distinct classes, ranked by evidence volume — (1) reference fabrication:
GPT-3.5/GPT-4-class models fabricate 18–55% of literature-review citations on unfamiliar topics; (2) content
misrepresentation: a citation to a real paper that misstates its actual finding, passing a naive
existence-check while still being false; (3) structural overclaiming: đóng góp mới sections default toward
sweeping novelty claims the training distribution over-represents. All three worsen on niche subtopics —
exactly where a student's original contribution should be.

**Review criteria:**
1. Mở đầu mục tiêu ↔ Kết luận answers each stated objective 1:1
2. Phương pháp ↔ Kết quả — every result traces to a described method/data source, no orphan findings
3. Tổng quan/cơ sở lý luận identifies a gap, not just summarizes prior work
4. Đóng góp mới stated as a specific, falsifiable claim, not a vague "cải thiện hiệu quả"
5. Format/citation-style compliance (font, section order, reference format)
6. Every in-text citation resolves to Tài liệu tham khảo and vice versa — no orphan citations either direction

**Length:** ~60–120 trang A4 excluding phụ lục (~18,000–25,000+ words depending on school); confirm the
target university's own "Quy định trình bày" guide at Recon — exact format is university-delegated, not a
single national standard.

**Unit:** one mục/section per Build unit (~2,000–5,000 words); a chương close is an act boundary.

## Variant: Luận án TS (Vietnamese PhD)

**Skeleton:** same as Luận văn ThS, plus a mandatory **Danh mục công trình đã công bố** section (published
works list) between Kết luận và kiến nghị and Tài liệu tham khảo. A **Tóm tắt luận án** booklet is required
alongside the full text, generated the same way as the ThS Tóm tắt (mechanical back-matter, not a separate
variant).

**Mandatory evidence:** same as Luận văn ThS, plus each entry in Danh mục công trình đã công bố must be a
real, verifiable publication (journal/conference name, year, DOI/ISSN where available) — never a placeholder
or an inferred-plausible title.

**Fabrication risks:** same three classes as Luận văn ThS; Danh mục công trình đã công bố adds a fourth
narrow risk — fabricating a publication that does not exist to satisfy the section's expectation of prior
output.

**Review criteria:** same 6-item checklist as Luận văn ThS, plus: every entry in Danh mục công trình đã công
bố is independently verifiable (resolves to a real venue/DOI).

**Length:** no reliable single VN figure for Luận án TS exists in current guidance — **flagged
low-confidence** — use the international PhD band below as a proxy (60,000–100,000+ words, discipline
adjusted) until the target university's own guide is confirmed at Recon.

**Unit:** one mục/section per Build unit, same as Luận văn ThS; act boundaries follow the (typically more
numerous) chương count.

## Variant: International thesis/dissertation

**Skeleton:** Title page → Abstract → Acknowledgements → Table of Contents → List of Figures/Tables →
Ch.1 Introduction → Ch.2 Literature Review → Ch.3 Methodology → Ch.4 Results → Ch.5 Discussion →
Ch.6 Conclusion → References → Appendices — the IMRaD monograph, the global default. A 7–9-chapter thesis
repeats Results+Discussion once per study rather than using a different skeleton. Master's vs PhD is a
length modifier on this same skeleton, not a separate structure. **Out of scope:** thesis-by-publication
("stapler" thesis) — a supervisor-negotiated, discipline-gated structural choice, not something this
playbook auto-selects (YAGNI).

**Mandatory evidence:** a literature review establishing the gap; methodology detailed enough to replicate;
every Results claim traceable to a real citation or the thesis's own reported data.

**Fabrication risks:** same three classes as the VN variants — reference fabrication (18–55% on unfamiliar
topics across studied models), content misrepresentation (real citation, misstated finding), and structural
overclaiming in the Conclusion — all worsen on niche subtopics.

**Review criteria:**
1. Objectives/research questions ↔ Conclusion answers each 1:1
2. Methodology ↔ Results — every finding traces to a described method/data source
3. Literature Review identifies a gap, not just summarizes prior work
4. Contribution stated as a specific, falsifiable claim
5. Format/citation-style compliance for the target venue/institution
6. Every in-text citation resolves to References and vice versa

**Length:** Master's 15,000–50,000 words (UK trends lower at 20k–30k, AU 40k–60k); PhD 60,000–100,000+ words,
discipline-adjusted (STEM 40k–70k; humanities/social science 70k–100k+). Confirm the target institution's
guideline at Recon — these are soft-consensus bands, not a verified regulatory figure.

**Unit:** one Build unit = one IMRaD section within a chapter (mirrors the VN mục/section rule); a chapter
close is an act boundary; front/back matter stays one lighter mechanical unit.

## Anti-Fabrication Guardrail (all variants)

> **Required — cite-exists:** every citation resolves to a real, retrievable reference-list entry (DOI/URL/
> ISBN) before Ship — none reach the manuscript unverified. Closes the highest-volume risk class (reference
> fabrication).

> **Required — claim-traceable:** no claim attributed to a source without that source's actual content
> available in the writer's context — an existing-but-misrepresented citation is functionally worse than a
> fake one, since it passes a naive existence-check while still being false.

> **Required — conclusion-bounded:** no claim in Kết luận/Conclusion or đóng góp mới/Contribution that isn't
> demonstrated earlier in Kết quả/Results — a thesis conclusion may not introduce new evidence.

> **Required — vn-name-order:** Vietnamese author citations use given name (tên), not surname — see
> `references/citation-styles.md` § Vietnamese/East-Asian Name Order for the full rule and its institution
> override.
