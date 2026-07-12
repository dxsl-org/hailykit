# Research-Proposal Playbook — VN Đề Cương · VN Thuyết Minh NCKH · PhD-Application · International Grant

Four variants selected by funding status × institution/language: (1) VN đề cương luận văn/luận án (academic,
no budget), (2) VN thuyết minh đề tài NCKH cấp cơ sở/bộ (funding contract, binding kinh phí/tiến độ), (3)
international PhD-application proposal, (4) international grant proposal — NIH/NSF/ERC merged into one
variant with a funder-template sub-table, since their move-level skeleton is identical and only
headings/page limits differ (DRY). All four propose future work; none report results. **Boundary:**
đề cương/proposal → here; once funded/admitted, the resulting thesis or dissertation document →
`playbook-academic-thesis.md` — do not conflate the two even though V1's content seeds the finished
thesis's Mở đầu chapter.

## Track

All four variants stay short-form — a single coherent document, not a multi-chapter long-form work.
Variants 1–3: one Build unit = the whole proposal document (no internal act structure; ≤20 pages/≤3,000
words). Variant 4: one Build unit = one separately-paginated funder-template component (NIH: Specific
Aims / Research Strategy; NSF: Project Summary / Project Description; ERC: B1 / B2) — independently
page-capped and independently reviewed (ERC Step 1 vs Step 2), mirroring the front/back-matter split in
the thesis playbook.

## Shared Skeleton

All four variants realize this same 8-move meta-skeleton differently — stated once here, per-variant
deltas below:

Problem/Significance → Gap/Novelty (lit review) → Aims/Questions/Hypotheses → Methodology/Approach →
Feasibility (team/resources) → Expected contribution/impact → Timeline → Budget (where applicable) →
References.

**Recon fork (variant disambiguation):** one question selects the variant — "Is this for funding with a
budget?" **Yes** → V2 (VN, funding contract) or V4 (international grant). **No** → V1 (VN, academic) or V3
(international PhD-application). VN vs. international resolves by language/target institution. **`--auto`
default:** when fully ambiguous, default to **V1** — the most common request shape.

**Recon gate (all variants):** exact target (university quy định for V1/V2; exact funder+mechanism+call
for V4, e.g. "NIH R01" not "NIH"); page/word limit; whether a budget section applies; citation style;
submission deadline (drives timeline realism); whether real preliminary/pilot data exists to draw from.

**PII.** Preliminary/pilot data drawn into `research/` for any variant may carry respondent identifiers —
same secret-scrub gap as the thesis playbook (targets credentials, not third-party PII): instruct
pseudonymizing/redacting human-subject identifiers at Recon, before ingest.

**Citation.** Resolves against `citation-styles.md`; V1's discipline-unknown default follows that file's
§ Style Resolution VN-academic fallback (APA 7) — V2–V4 follow the target venue's own mandated style where
one exists.

## Variant: VN Đề Cương Luận Văn/Luận Án

**Skeleton:** Lý do chọn đề tài/tính cấp thiết → Tổng quan tình hình nghiên cứu (xác định khoảng trống) →
Mục tiêu/câu hỏi/giả thuyết → Đối tượng và phạm vi → Phương pháp nghiên cứu → Đóng góp dự kiến → Kết cấu
dự kiến (chương outline) → Tiến độ thực hiện dự kiến → Tài liệu tham khảo. Everything framed as "dự kiến"
(anticipated) — no kinh phí section.

**Mandatory evidence:** tổng quan tình hình nghiên cứu establishes a real gap before mục tiêu is stated;
phương pháp nghiên cứu detailed enough that đóng góp dự kiến is plausible, not merely asserted.

**Fabrication risks:** the same three classes as the thesis playbook — reference fabrication (18–55% on
unfamiliar topics for GPT-3.5/4-class models), content misrepresentation, structural overclaiming — worse
here since đóng góp dự kiến is inherently more speculative than a finished thesis's kết luận.

**Review criteria:** (1) tính cấp thiết backed by real evidence; (2) tổng quan identifies a gap, not a
summary; (3) phương pháp ↔ đóng góp dự kiến feasibility; (4) tiến độ realistic against kết cấu dự kiến
chương count; (5) every citation resolves to Tài liệu tham khảo and vice versa.

**Length:** ~10–20 trang A4 (ThS). Luận án TS đề cương has no reliable single figure —
**flagged low-confidence**, university-delegated; confirm at Recon.

**Unit:** whole document, one Build unit — no internal act structure.

## Variant: VN Thuyết Minh Đề Tài NCKH (Cấp Cơ Sở/Bộ)

**Skeleton:** Thông tin chung → Tổng quan trong/ngoài nước → Tính cấp thiết → Mục tiêu → Cách tiếp cận/
phương pháp → Nội dung nghiên cứu và tiến độ thực hiện (bảng mốc tháng/quý) → Sản phẩm dự kiến (khoa học/
đào tạo/ứng dụng) → Khả năng ứng dụng → Dự toán kinh phí (theo mục chi) → Tổ chức thực hiện → Tài liệu
tham khảo. A funding contract, not an academic document — hội đồng xét duyệt judges fundability, not
scholarly merit alone.

**Mandatory evidence:** dự toán kinh phí figures trace to a real cost basis (NAFOSTED/institutional định
mức); labor-months in the budget match the workload in the nội dung/tiến độ table — a mismatch is a
contract defect, not a style note.

**Fabrication risks:** the same reference/content/overclaiming classes as V1, plus budget fabrication —
inventing unit costs or labor-months not grounded in an official định mức.

**Review criteria:** (1)–(4) same as V1's tính cấp thiết/tổng quan/phương pháp/tiến độ criteria, plus
(5) dự toán kinh phí traces to a real cost basis and matches tiến độ workload; (6) sản phẩm dự kiến stated
as concrete, falsifiable deliverables.

**Length:** template-fixed by the thuyết minh mẫu; page count is institution/Thông tư-delegated —
**flagged low-confidence**, confirm the exact mẫu at Recon.

**Unit:** whole document, one Build unit.

## Variant: International PhD-Application Proposal

**Skeleton:** Title → Background/Literature Review → Research Questions/Aims and Objectives →
Methodology/Design → Timeline → Bibliography. Purely prospective — no results section, no preliminary
findings presented as already achieved.

**Mandatory evidence:** literature review establishes a real gap; methodology detailed enough that a
review panel can judge feasibility with no reported results to lean on.

**Fabrication risks:** the same reference-fabrication/content-misrepresentation classes as the thesis
playbook; no results-fabrication class exists here because none are permitted — presenting any result as
already obtained is itself a fabrication-class violation, not a formatting error.

**Review criteria:** (1) research questions answerable within the stated timeline/methodology; (2)
literature review identifies a gap; (3) methodology is replicable/feasible as described; (4) no result or
finding is presented as already obtained; (5) every citation resolves to the bibliography and vice versa.

**Length:** 1,500–3,000 words; some institutions cap lower (Greenwich: 1,500) — confirm the target
institution's own limit at Recon.

**Unit:** whole document, one Build unit.

## Variant: International Grant Proposal (NIH / NSF / ERC)

One 8-move skeleton (Shared Skeleton above), realized through a funder-specific template — no single
grant template exists across funders; guessing the wrong one produces an administratively non-compliant
submission even with good content.

| Funder | Components (each independently page-capped) | Page limits | Review note |
|---|---|---|---|
| NIH R01 | Specific Aims (separate) + Research Strategy (Sig/Innov/Approach headers) | 1p + 12p | 2025 Simplified Review Framework: Factor 1 Importance, Factor 2 Rigor/Feasibility scored 1–9; Factor 3 Investigator/Environment pass/fail |
| NSF | Project Summary (Overview + Intellectual Merit + Broader Impacts) + Project Description | 1p + ≤15p | Intellectual Merit and Broader Impacts weighted equally — Broader Impacts must appear as its own heading |
| ERC (StG/CoG/AdG) | B1: synopsis + CV/Track Record (Step 1) + B2: implementation + budget (Step 2) | 5p+4p / 7p+budget | Sole criterion: excellence; B1 is evaluated alone before B2 is reviewed |

**Mandatory evidence:** preliminary/pilot data, if any, is real project data the brief supplies — never
invented to strengthen Approach/Feasibility; every dollar figure in the budget component traces to a
stated cost basis (NIH salary cap, quoted equipment cost).

**Fabrication risks:** the same reference/content classes as the thesis playbook, plus (a) fabricated
preliminary/pilot data — the single highest-stakes fabrication class in this genre, see the
no-fake-preliminary-data guardrail below (funders treat this as misconduct, not a quality defect); (b)
undisclosed AI-drafted reasoning — see ai-disclosure-aware below.

**Review criteria:** the shared 7 cross-variant criteria — significance backed by real evidence,
innovation vs. cited prior work, methodology soundness/replicability, feasibility matching claimed scope,
timeline realism, budget-to-workload alignment, expected products as falsifiable deliverables — plus
funder-template compliance (exact component page limits and required headings honored).

**Length:** per-funder, see table above — no single figure across funders.

**Unit:** one Build unit = one separately-paginated funder-template component (see Track above) — never
the whole submission as a single unit.

## Anti-Fabrication Guardrail

> **Required — no-fake-preliminary-data (editor-enforced):** preliminary/pilot results appear only if the
> brief supplies them as real project data — never invented numbers, effect sizes, or p-values. Highest-
> severity fabrication class in this genre: funders treat invented preliminary data as research misconduct,
> not a quality defect. The fact-check pass verifies every reported figure traces to a source in `research/`.

> **Required — budget-grounded (editor-enforced):** every kinh phí/dollar figure traces to a cost basis
> the brief supplies (NAFOSTED/institutional định mức, NIH salary cap, quoted equipment cost) — never a
> typical-grant prior. The fact-check pass verifies claim → source the same way it verifies any other figure.

> **Required — timeline-grounded (editor-enforced):** tiến độ/timeline built from per-task duration
> estimates the brief confirms; months/weeks sum to the approved project duration, not a
> compressed-to-look-impressive schedule. The fact-check pass verifies each milestone traces to a stated
> duration.

> **Required — funder-template-confirmed (generation-time):** exact funder/program/call (e.g. "NIH R01",
> not "NIH") or university quy định confirmed at Recon before drafting — page limits and required headings
> are administratively binding; guessing produces a rejected submission, not a weak one. Recon gate only —
> no editor pass re-verifies the template choice after Draft.

> **Required — ai-disclosure-aware (generation-time, V4 only):** flag at Recon that some funders (NIH, per
> NOT-OD-25-132, effective Sept 2025) penalize undisclosed AI-drafted reasoning independent of accuracy — no
> bright-line word-count test, enforced via an originality lens. For V4, constrain the pipeline's role to
> **assist-mode**: outline, literature-review verification, structure/copyedit on user-authored content —
> never wholesale authoring of the Specific Aims / Research Strategy (or the NSF/ERC equivalents) as if it
> were the applicant's own reasoning. Mirrors the legal-drafting outline-only refusal pattern. Recon/writer
> guidance only — no editor pass enforces this.
