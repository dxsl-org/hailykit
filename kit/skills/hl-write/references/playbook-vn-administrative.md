# VN-Administrative Playbook — Công Văn · Tờ Trình · Báo Cáo · Quyết Định (NĐ 30/2020/NĐ-CP)

Four văn bản hành chính types under Nghị định 30/2020/NĐ-CP Điều 7 (administrative documents, not văn bản
quy phạm pháp luật/legislative text). All four inherit one 9-component thể thức (Điều 8) in strict top-to-
bottom order; they diverge only in tên-loại presence, Kính-gửi placement, and nội-dung shape. Output medium
is a markdown draft with explicit placeholders — this pipeline never renders final `.docx` layout (font,
margins, dấu/seal geometry), which stays a văn thư (clerical office) / Word-template concern, not a
generation-pipeline one.

**Boundary:** báo cáo hành chính (NĐ30 thể thức, nội bộ cơ quan context) routes here; a business/technical
báo cáo (findings→recommendations business context, no thể thức requirement) routes to
`playbook-business-report.md` instead — do not stretch either variant to fit the other's case.

## Track

Short-form default for all 4 types — each is well under the 8,000-word long-form threshold. Unit = one whole
văn bản per Build unit; no chương/act mechanics apply.

## Thể Thức (9 components)

Điều 8 mandatory order, shared by all 4 types (high-confidence-by-convergence: primary text at
vanban.chinhphu.vn 403'd on fetch; cross-triangulated across luatminhkhue.vn and
xaydungchinhsach.chinhphu.vn):

1. Quốc hiệu + Tiêu ngữ
2. Tên cơ quan/tổ chức ban hành
3. Số + ký hiệu văn bản — always `Số: [số]/[năm]/[ký hiệu-cơ quan]`, never a real-looking number (văn thư
   issues it at registration; any generated number is definitionally fake)
4. Địa danh + thời gian ban hành
5. Tên loại + trích yếu nội dung — CÔNG VĂN drops tên loại; the other 3 carry it (delta below)
6. Nội dung — shape diverges per type (delta below)
7. Chức vụ + họ tên + chữ ký — `[Họ và tên]` placeholder, never auto-filled with a real official's name (see
   use-boundary guardrail)
8. Dấu / chữ ký số cơ quan
9. Nơi nhận — terminal block, contains lưu-trữ code ("Lưu: VT"); agency seniority not supplied by the user →
   `[VERIFY: thứ tự cơ quan nhận]`, never invented

## Register (prompt-time guidance, not a machine gate)

Cơ quan xưng bằng tên/chức danh, không dùng "tôi/chúng tôi"; câu ngắn, mỗi ý một câu; cấm từ cảm thán, mơ hồ,
đa nghĩa; viết hoa tên cơ quan/chức danh/địa danh theo Phụ lục II. This is directive guidance for the writer,
not a review-pass gate — no VN-specific tone/register classifier exists to check it mechanically.

## Review Criteria (shared, 7 deterministic text-pattern checks — no renderer needed)

1. All 9 thể thức components present, in Điều-8 order, for the type.
2. Tên loại absent for công văn; present and correctly labeled for the other 3.
3. Trích yếu is non-empty and distinct from tên loại.
4. Kính gửi positioned per the type's rule (opens nội dung for công văn/tờ trình; absent for internal/định kỳ
   báo cáo — see § Variant: Báo Cáo caveat).
5. QUYẾT ĐỊNH only: Căn cứ block precedes "QUYẾT ĐỊNH:" precedes the first "Điều".
6. Điều/khoản/điểm nesting is valid (`Điều n.` → `1.` → `a)`), never Roman numerals at this level.
7. Nơi nhận is the terminal block and contains the lưu-trữ code.

Each variant below states only which of these 7 are its defining checks — all 7 still apply to every type.

## Variant: Công Văn

**Skeleton:** thể thức 1–4 unchanged → (5) trích yếu only, **no tên loại** → (6) nội dung: "Kính gửi: [cơ
quan/cá nhân]" opens the nội dung, then thân bài → (7–8) chức vụ/ký/dấu → (9) nơi nhận (repeats the Kính-gửi
recipients + "Lưu: VT").

**Mandatory evidence:** any văn bản cited mid-thân-bài follows the same căn cứ-must-be-real rule as quyết
định; no invented recipient hierarchy in nơi nhận.

**Fabrication risks:** recipient-hierarchy invention in nơi nhận; a mid-body citation to a decree/thông tư
that doesn't exist.

**Review criteria:** shared 7 above; defining checks here are #2 (tên loại absent) and #4 (Kính gửi opens
nội dung).

**Length:** typically 1 page (~150–400 words); confirm the brief's stated length before drafting rather than
assuming a page count.

**Unit:** one Build unit = the whole văn bản.

## Variant: Tờ Trình

**Skeleton:** thể thức 1–4 unchanged → (5) tên loại "TỜ TRÌNH" + trích yếu → (6) nội dung: căn cứ/lý do đề
xuất → nội dung đề xuất (phân tích, phương án) → kiến nghị, closing "kính đề nghị… xem xét, quyết định" →
(7–8) chức vụ/ký/dấu → (9) nơi nhận (cấp trên nhận + "Lưu: VT").

**Mandatory evidence:** every căn cứ/lý do line cites a real basis (decree, thông tư, hoặc tình hình thực tế
đã nêu); the kiến nghị traces back to the đề xuất, not a new unsupported ask.

**Fabrication risks:** invented căn cứ pháp lý opening the nội dung (same class as quyết định, lower
frequency); kiến nghị overreach not grounded in the đề xuất analysis.

**Review criteria:** shared 7 above; defining checks here are #2 (tên loại present) and content-order (căn
cứ → đề xuất → kiến nghị, checked as sequence presence rather than a numbered criterion of its own).

**Length:** 1–3 pages (~300–900 words) is typical; confirm against the brief.

**Unit:** one Build unit = the whole văn bản.

## Variant: Báo Cáo

**Skeleton:** thể thức 1–4 unchanged → (5) tên loại "BÁO CÁO" + trích yếu (often "Báo cáo [kỳ] về…") → (6)
nội dung: tình hình/đặc điểm chung → kết quả thực hiện (số liệu, đánh giá ưu/khuyết điểm) → phương hướng/
nhiệm vụ tiếp theo → kiến nghị (optional) → (7–8) chức vụ/ký/dấu → (9) nơi nhận.

**Kính-gửi caveat (single-sourced — flag, don't hard-fail):** internal/định-kỳ báo cáo carries no in-body
Kính gửi; a superior-bound báo cáo mirrors công văn/tờ trình's Kính-gửi convention instead. Researcher-02
flagged this rule as single-source (403s blocked independent re-confirmation) — treat as convention, and flag
rather than fail when a báo cáo's addressee context is ambiguous.

**Mandatory evidence:** every số liệu/kết quả claim traces to real data the user supplied or that exists in
`research/`; đánh giá ưu/khuyết điểm is not invented to fill the shape.

**Fabrication risks:** invented số liệu/kết quả; phương hướng stated as already-achieved fact.

**Review criteria:** shared 7 above; defining check here is #4 (Kính gửi absent for internal, present for
superior-bound — per the caveat above).

**Length:** highly context-dependent (định kỳ báo cáo ~1–3 pages; tổng kết năm may run longer) — state the
range the brief implies rather than assuming one.

**Unit:** one Build unit = the whole văn bản.

## Variant: Quyết Định

**Skeleton:** thể thức 1–4 unchanged → (5) tên loại "QUYẾT ĐỊNH" + trích yếu ("Về việc…") → (6) nội dung:
stacked "Căn cứ…" block (thẩm-quyền basis first, then nội-dung basis, each line ending in a semicolon except
the last, ending "Theo đề nghị của…") → "QUYẾT ĐỊNH:" on its own line → Điều 1./Điều 2./…/Điều n (last Điều =
hiệu lực thi hành + đối tượng thi hành) → (7–8) chức vụ/ký/dấu → (9) nơi nhận ("Như Điều n; Lưu: VT").

**Mandatory evidence:** every "Căn cứ [văn bản]" line cites a decree/circular/law the user supplied or the
model verified exists and applies — this is the highest-stakes evidence requirement in the whole playbook
(see Anti-Fabrication Guardrail below).

**Fabrication risks:** invented Căn cứ pháp lý (plausible-sounding nghị định/thông tư number + date) is the
critical, high-likelihood failure mode here — LLMs readily invent one because the format reward ("looking
official") is strong and decoupled from factual grounding (Stanford RegLab legal-hallucination analogy; no
VN-specific study exists, but the failure class transfers directly).

**Review criteria:** shared 7 above; defining check here is #5 (Căn cứ block → "QUYẾT ĐỊNH:" → first "Điều",
in that exact order) plus #6 (Điều/khoản/điểm nesting inside each Điều).

**Length:** 1–2 pages for a single-subject quyết định (~200–600 words); longer for quyết định ban hành kèm
quy chế/phụ lục — confirm against the brief.

**Unit:** one Build unit = the whole văn bản (a very long quyết định with an attached quy chế treats the quy
chế as a separate unit, not part of this one).

## Out of Scope (layout, not this playbook's concern)

Font family/size/color (Times New Roman, TCVN 6909:2001, body 13–14pt), page margins (mm), quốc hiệu/tiêu
ngữ exact pt+bold spec, page-number suppression on page 1, physical dấu (seal) placement, chữ-ký-số box
geometry — these render only in a `.docx`/Word-template pipeline and are văn thư concerns, never a
markdown-generation concern.

## Anti-Fabrication Guardrail (all variants)

> **Required — căn cứ-must-be-real (editor-enforced):** every "Căn cứ [văn bản]" line cites a decree/
> circular/law the user supplied or the model verified exists and applies; unverified → `[VERIFY: căn cứ
> pháp lý chưa xác minh]`, never a fabricated number/date. **Severity: Critical, not Major** — the
> `review-passes.md` W1a load-bearing-claim carve-out applies to this guardrail: an Unsourced căn cứ escalates
> past the fact-check pass's normal Major default to Critical, because `--auto` halts only on Critical, and a
> quyết định built on a fabricated legal basis must never auto-ship.

> **Required — use-boundary (generation-time):** drafts are scoped to the user's OWN organization's internal
> workflow only. `[Họ và tên]` / chữ ký / dấu placeholders are never auto-filled with a real official's name,
> and the pipeline never presents a draft as an issued/authentic document of an agency the user does not
> represent. Forging official documents is criminal in Vietnam — this is a use-boundary the writer must
> respect, not a formatting nicety.

> **Required — số-văn-bản-is-placeholder (editor-enforced):** never generate a real-looking document number;
> always `Số: [số]/[năm]/[ký hiệu-cơ quan]`. A real-looking number is a flaggable structural/copyedit pattern
> regardless of whether a matching decree happens to exist.

> **Required — nơi-nhận-hierarchy-flagged (generation-time):** if agency seniority/order in Nơi nhận isn't
> supplied by the user, mark `[VERIFY: thứ tự cơ quan nhận]` rather than inventing a plausible hierarchy.

**`--auto` linkage (no extra halt item needed):** vn-administrative needs no additional `--auto` halt item of
its own — the W1a severity carve-out above already makes an Unsourced căn cứ Critical, and `--auto` halts on
any Critical finding, so a quyết định with a fabricated legal basis blocks the run instead of auto-shipping.
