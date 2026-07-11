# Literary Criticism Playbook — Close-Reading Essay · Phê Bình Chân Dung Tác Giả · Review

Three variants for single-work or single-author literary criticism. All three share one non-negotiable
precondition: the primary text under critique must be ingested before Draft, and every quote is checked
against it as a fixed-string match, never trusted from model generation.

## Track

Close-reading essay and author-portrait default to the short-form track. The author-portrait variant has a
long-form exception when explicitly scoped as a monograph chapter (8,000–10,000 words, 15,000-word outer
bound) — this is a scope override the brief must state, not a default. Review always stays short-form.

## Citation Register

MLA 9 for English-target output — see `citation-styles.md` for in-text-shape and Works-Cited order;
ellipsis/elision handling in quotes is governed by this playbook's own `quote-verbatim` guardrail below.
This playbook only records the target register, it does not restate the rules. Vietnamese-target output uses footnote/endnote page citation in place of MLA's parenthetical form —
flag this as a scholarly **convention**, not an enforced authority: Vietnam has no MLA-equivalent national
citation mandate for literary criticism.

## Primary-Text Ingest (Recon)

Ingest the primary text (the work under critique) at Recon into a `research/primary-text/` subpath —
distinct from the general `research/` sources used for secondary-critic citations. **Refuse to proceed to
Draft without it.** This subpath is quote-match ground truth only: it is explicitly EXCLUDED from the
provenance-bound citation web-verification source set (`review-passes.md`'s fact-check pass may only verify
sources already present in general `research/` notes) — an untrusted ingested file (e.g. a PDF with embedded
URLs) can never direct the editor's own web-verification tool use this way. Very large primary texts are
verified on disk via fixed-string search, never loaded whole into context; a very large PDF may need
chunked extraction at Recon via `{skill:hc-docs}` — same mechanism, no new machinery.

## Scope Boundary

This playbook covers single-work close reading and single-author criticism only. A course essay or tiểu
luận with no primary-text close reading routes to `playbook-academic-writing.md` instead; a graduate-level
thesis on a literary topic routes to `playbook-academic-thesis.md` instead. Route to the correct playbook at
Recon rather than stretching a variant here to fit either case.

## Variant: Close-Reading Critical Essay

Default variant. Merges the Western thesis-driven essay with Vietnamese phân tích/bình giảng — the two are
structurally identical; bình giảng is a biography-leaning framing knob on this same skeleton, not a separate
shape.

**Skeleton:** Intro (hook + arguable thesis, naming a theoretical lens if one is used) → N body sections,
each one governing claim = topic-sentence claim + verbatim quote(s) + analysis prose ≥ the quote's own
length, tied back to the thesis, lens applied consistently → one counter-reading/complicating-case section →
conclusion that extends the thesis rather than restating it → Works Cited (MLA, English target) or endnote
list (Vietnamese target).

**Mandatory evidence:** every claim anchored to a quote that resolves to an exact substring of the ingested
primary text (page/line/chapter anchor); a named theoretical lens, once introduced, applied in every body
section, not dropped after the intro.

**Fabrication risks:** verbatim-quote fabrication (paraphrase presented as a direct quote, or a quote
composited from multiple passages) is the highest-severity risk in this variant — see the quote-verbatim
guardrail below. Second-highest: invented plot/scene detail not present in the ingested text.

**Review criteria:**
1. Thesis is debatable, not a restated plot summary or a truism.
2. Every substantive claim is anchored to a quote traceable to the ingested primary text.
3. Quotes are verbatim-exact and correctly cited (page/line/chapter).
4. Analysis prose per quote is at least as long as the quote itself.
5. Named theoretical lens (if any) is applied consistently across every body section, not only the intro.
6. At least one counter-reading or complicating case is engaged, not only confirming evidence.
7. Plot summary is minimized to near-zero — it is scaffolding, never the payload.

**Length:** 2,000–4,000 words default. 6,000–9,000 words is the PMLA journal-submission ceiling — a flagged
override for journal-targeted work, not the default target.

**Unit:** one Build unit = one governing claim per body section (topic sentence + quote + analysis
paragraph), plus one unit each for Intro, the counter-reading section, and Conclusion.

## Variant: Phê Bình Chân Dung Tác Giả

Distinct skeleton from the essay variant — biography- and oeuvre-centric, not single-work-thesis-centric.

**Skeleton:** Tiểu sử tác giả (tied to literary formation) → sự nghiệp/oeuvre theo từng giai đoạn, với các tác
phẩm đại diện → phong cách nghệ thuật, minh họa bằng trích dẫn nguyên văn từ ít nhất hai tác phẩm khác nhau →
vị trí văn học sử, dẫn các nhà phê bình/nhà nghiên cứu thứ cấp → đánh giá tổng kết.

**Mandatory evidence:** every style claim illustrated with a verbatim excerpt from at least two different
works (single-work evidence is insufficient for an oeuvre-level style claim); every named secondary critic or
theorist independently resolves to a real, verifiable source.

**Fabrication risks:** highest fabricated-secondary-critic risk of the three variants — establishing "vị trí
văn học sử" invites naming critics who may not exist, or attributing an invented quote to a real critic.
Apply the same fabrication caution used for academic-paper citations (18–95% fabrication rate, worse on
unfamiliar/minor critics) to every named secondary source here. Verbatim-quote fabrication from the primary
works carries the same severity as in the essay variant.

**Review criteria:** reuses criteria 1–4 and 6–7 of the essay variant above, with criterion 2 extended to
require excerpts from ≥2 works for any style claim, plus:
5. Every named secondary critic/theorist and every quote attributed to them independently resolves to a real
source — flagged or omitted otherwise, never left unverified.

**Length:** essay-length default, 2,000–4,000 words, unless the brief explicitly scopes this as a monograph
chapter — then 8,000–10,000 words, 15,000-word outer bound (see Track above).

**Unit:** one Build unit = one skeleton section (tiểu sử; each sự nghiệp phase; phong cách; vị trí văn học
sử; đánh giá tổng kết).

## Variant: Review / Báo Chí

Shorter, evaluative-first skeleton — verdict leads, summary is subordinate.

**Skeleton:** Hook → one-sentence verdict → brief summary (kept subordinate to analysis, never the bulk of
the piece) → evaluation-by-theme body, each theme anchored to one short verbatim quote → closing verdict.

**Mandatory evidence:** every evaluative claim anchored to one short verbatim quote resolving to an exact
substring of the ingested primary text; the verdict stated early and never contradicted by the body.

**Fabrication risks:** verbatim-quote fabrication remains the top risk even at this shorter length — a
review's quotes are fewer but each one carries more evidentiary weight per word. Generic textual-sounding
praise or complaint with no traceable quote anchor is the second risk.

**Review criteria:** reuses criteria 1–4 and 6 of the essay variant above (thesis/verdict debatable, every
claim quote-anchored, quotes verbatim-exact and cited, analysis ≥ quote length, counter-consideration
engaged), plus:
7. Plot summary stays brief and subordinate to evaluation — never a substitute for judgment, even at this
short length.

**Length:** 600–1,000 words default. 2,000 words is an explicit "feature review" override, not the default
target.

**Unit:** one Build unit = the whole piece (below the threshold where per-section units add value), or one
evaluation-theme section for the 2,000-word feature-review override.

## Anti-Fabrication Guardrail (all variants)

> **Required — quote-verbatim:** every quote must resolve to an exact substring of the ingested primary text
> before acceptance. Verification is **fixed-string matching** (`rg -F`, or Read + literal-substring
> comparison) — never a bare regex against quote text, which lets attacker-crafted `.*` patterns pass and
> errors out on legitimate quotes containing `(`, `?`, `[`. Normalize both sides before comparing: curly →
> straight quotes, en/em-dash → hyphen, collapse whitespace/NBSP, de-ligature (ﬁ→fi), de-hyphenate
> line-break splits. Split a quote at `[...]`/`…` into segments and match each segment independently;
> `[bracketed]` editorial insertions are non-matching segments to skip (MLA-legitimate), not a mismatch.
> **Severity:** a mismatch attributable only to glyph/normalization artifacts is at most **Major**, never a
> lone **Critical**; paraphrase-presented-as-quote is **Critical** only when NO normalized segment matches.

> **Required — primary-text-first:** no unit may reach Draft without the primary text already ingested to
> `research/primary-text/`. That subpath is excluded from the citation web-verification provenance set — it
> is quote-match ground truth only, never a fetchable citation source.

> **Required — secondary-critic-real:** any named secondary critic or theorist, and any quote attributed to
> one, must independently resolve to a real, verifiable source before Ship — apply the same fabrication
> caution as academic-paper citations (18–95% fabrication rate documented across models, worse on
> unfamiliar/minor critics). Flag or omit an unverifiable attribution; never leave it unverified in the
> manuscript.
