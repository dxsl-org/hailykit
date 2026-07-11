# Academic Writing Playbook — Essay/Tiểu Luận · Academic Paper

Two named skeletons. Essay/tiểu luận splits into two locale variants selected by request language (Vietnamese → Tiểu Luận structure with a mandatory references section, English or unspecified → Western Essay); the brief can override this default. Academic/scientific paper always uses IMRaD. All three variants share the same #1 risk: fabricated or misattributed citations.

## Language Selection

Detect the request's language at Route. A Vietnamese request defaults to the Tiểu Luận variant below; an English (or unspecified-language) request defaults to the Western Essay variant. The brief can override this default explicitly during Recon — do not silently switch structure mid-draft once the outline is approved.

## Track

Western Essay and the IMRaD paper default to the short-form track — both length norms below typically sit under the long-form threshold. Tiểu Luận defaults to the long-form track (see its length norm below) — this is the one essay/tiểu luận pairing where the locale variant alone changes the track.

## Citation Style

Capture the target citation style in the brief's `citation_style` field at Recon (default resolved by genre/discipline, or `none` to disable checks). The rules, per-style table, check-severity tiers, and resolution precedence all live in `references/citation-styles.md` — this playbook only records the brief's choice, it does not restate the rules.

## Scope Boundary

This playbook covers essay/tiểu luận and IMRaD scientific papers only. A single-work literary analysis (close reading of one poem, novel, or play) routes to `playbook-literary-criticism.md` instead; a graduate-level thesis or dissertation (luận văn/luận án) routes to `playbook-academic-thesis.md` instead. Route to the correct playbook at Recon rather than stretching a variant here to fit either case.

## Variant: Western Academic Essay

**Skeleton:** Intro (hook + debatable thesis) → Body paragraphs (topic sentence → evidence → analysis, one claim per paragraph) → Conclusion (synthesis, no new claims).

**Mandatory evidence:** a cited source for every factual claim; literature grounding for the argument's premises.

**Fabrication risks:** fabricated or misattributed citations — GPT-3.5-class models fabricate 39.6–55% of citations on unfamiliar topics. Treat every AI-suggested citation as unverified until checked against a real source.

**Review criteria:**
1. Thesis is specific and debatable, not a restated prompt
2. Every paragraph opens with a topic sentence tied back to the thesis
3. Citation format matches the required style
4. Conclusion introduces no new claims

**Length:** course essay 1,500–3,000 words.

**Unit:** one Build unit = one skeleton section (Intro, each body-argument group, Conclusion).

## Variant: Tiểu Luận (Vietnamese)

**Skeleton:** Mở bài (đề tài, lý do chọn, phạm vi, mục đích) → Thân bài, multi-chương (cơ sở lý luận → thực trạng → đánh giá/giải pháp) → Kết luận (tổng kết + hạn chế + hướng nghiên cứu) → Tài liệu tham khảo.

> **Required — references-mandatory:** Tài liệu tham khảo is a mandatory closing section for this variant, unlike some short-form Western essay conventions — never drop it, even for a shorter tiểu luận.

**Mandatory evidence:** cited sources for every factual claim; cơ sở lý luận (literature grounding) established before thực trạng/đánh giá is written.

**Fabrication risks:** the same citation-fabrication risk as the Western essay — fabricated or misattributed sources in Tài liệu tham khảo are the highest-likelihood failure mode for this variant.

**Review criteria:**
1. Mở bài states đề tài, lý do chọn, phạm vi, and mục đích explicitly
2. Cơ sở lý luận precedes thực trạng, never the reverse
3. Every claim in thực trạng/đánh giá traces to a cited source
4. Tài liệu tham khảo is present, formatted, and complete
5. Kết luận states hạn chế and hướng nghiên cứu, not just a summary

**Length:** typically 15–30 formatted pages (~5,000–10,000 words including front matter) — this crosses the long-form threshold; route to the long-form track.

**Unit:** one Build unit = one chương within Thân bài, or Mở bài/Kết luận as their own units.

## Variant: Academic / Scientific Paper (IMRaD)

**Skeleton:** Abstract (structured — Background/Methods/Results/Conclusions — when the brief specifies it, otherwise a single unstructured paragraph; 200–250 words default, brief-configurable; no citations inside the abstract) + Keywords (3–6 terms, brief-configurable) → Introduction (gap → question) → Methods (replicable detail) → Results (report only) → Discussion (interpret, compare to prior work, limitations) → References. This is the dominant norm for original-research journal articles.

> **Required — abstract-draft-last:** Abstract renders FIRST in the document but drafts LAST in the Build sequence — it needs the completed Introduction/Methods/Results/Discussion to summarize accurately. The outline places Abstract+Keywords as the final Build unit; at Ship, assemble the front matter (Abstract, Keywords) ahead of the Introduction in `manuscript/full-<slug>.md` even though it was drafted last. Verify confirms the Abstract unit is present in both the outline and the assembled manuscript before the manuscript is accepted.

**Mandatory evidence:** a literature review establishing the gap; methodology detailed enough to replicate; every claim traceable to a real citation.

**Fabrication risks:** the highest of all genres researched for this skill — roughly 1 in 2,828 papers already contained fabricated references as of 2023, rising through 2025; even peer-reviewed venues have confirmed hallucinated citations in ~1% of accepted work. Treat every AI-generated citation as unverified until checked against a real database.

**Review criteria:**
1. Results reports findings only; Discussion is where interpretation happens — never blur this boundary
2. Every citation is verifiable; none fabricated
3. Methodology is reproducible from the Methods section alone
4. Limitations section is present and specific
5. Abstract contains no citations and summarizes only what Introduction/Methods/Results/Discussion actually establish — never introduces a claim the body doesn't support

**Length:** field-dependent, typically 3,000–8,000 words main text excluding references/abstract; some journals cap at 2,000 (clinical) or allow up to 10,000 (online-only) — confirm the target venue's norm rather than assuming one.

**Unit:** one Build unit = one IMRaD section (Introduction, Methods, Results, Discussion each close as a unit), plus one lighter final unit for Abstract+Keywords together.

## Anti-Fabrication Guardrail (all variants)

> **Required — verify-before-cite:** every citation is checked against a real, retrievable source before Ship — none reach the manuscript unverified. This is the headline guardrail for academic writing: citation fabrication is the dominant LLM failure mode in this genre, measured far above any other risk category researched for this skill.
