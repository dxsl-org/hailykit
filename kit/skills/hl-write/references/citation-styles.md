# Citation Styles

Shared citation-style reference for `hl-write`'s academic playbooks. Consumers: `playbook-academic-writing.md`,
`playbook-academic-thesis.md`, `playbook-literary-criticism.md`. Each playbook's citation-style brief field
resolves against this file rather than repeating the rules — one source of truth (DRY).

> **Section-contract:** the headings below (`Style Rules`, `Check Tiers`, `Cross-Style Pitfalls`,
> `Vietnamese/East-Asian Name Order`, `Style Resolution`, `Out of Scope`) are a stable anchor contract —
> consuming playbooks link to them by name. Do not rename a heading without updating every consumer.

**Style locks at Build start.** The brief's `citation_style` field is replace-on-revision only before Build
begins; once drafting starts, changing style requires a new run — do not invent mid-run reformatting machinery.

## Style Rules

Six mechanically-checkable columns per style — no CSL processor or bibliographic database required.

| Style | In-text shape | Ref-list order | et al. threshold | Name order | n.d. | DOI/URL |
|---|---|---|---|---|---|---|
| APA 7 | `(Author, Year)` / `Author (Year)` | Alphabetical, first-author surname; same-author-same-year gets a/b/c | 3+ authors → "et al." from first citation | Surname, Initials (inverted) | `(Author, n.d.)` | DOI required if it exists, takes priority over URL |
| MLA 9 | `(Author Page)` — no comma, no year | Alphabetical, first-author surname (Works Cited) | 3+ authors → "et al." | Surname, First (inverted, first entry only) | Never uses "n.d." — omits the date entirely | No DOI mandate; URL common, no "http://" prefix |
| Chicago (Notes-Biblio) | Superscript note number, full citation in note | Bibliography alphabetical by surname | Author judgment, commonly 4+ | Surname, First (bibliography); First Surname (notes) | `n.d.`; undated online sources need an access-date instead | No blanket DOI rule; access dates required for undated online sources |
| Chicago (Author-Date) | `(Author Year)` — no comma before year | Alphabetical by surname (reference list) | Same as Notes-Biblio | Surname, First (reference list) | `n.d.` | Same as Notes-Biblio |
| IEEE | `[1]`, `[3], [5]`, or `[1]-[5]` — bracketed number, never author name | Numeric, order of first appearance | ⚠️ low-confidence: venue-dependent, commonly capped at 6 before "et al." — no single canonical IEEE style manual passage confirms this | First Initial. Surname (not inverted) | No standardized convention documented | No blanket DOI rule |
| Vancouver | Superscript or bracketed number (`[1]` / `¹`) | Numeric, order of first appearance; reused number for repeats | List all authors up to 6; 7+ → first 6 + "et al." (ICMJE rule) | Surname Initials (not inverted, no comma) | No standardized convention documented | No blanket DOI rule; ICMJE recommends DOI when available |

## Check Tiers

Copyedit checks against this table run at three severities, matched to how cheaply and reliably an LLM
copyeditor can verify each column by text pattern-matching alone:

- **Blocking** — In-text shape, Ref-list order. High-signal, cheap regex/pattern match; a violation here is
  never a false positive.
- **Warning** — et al. threshold, Name order. Verifiable once the reference list's author count is known,
  but judgment-dependent enough to warn rather than block.
- **Advisory** — n.d./no-date, DOI/URL. Verifying these correctly requires ground truth about the source the
  copyeditor doesn't have access to; flag as a suggestion, never a blocking finding.

## Cross-Style Pitfalls

- **Mixed in-text shapes** — `(Smith, 2020)` alongside `[3]` in the same manuscript signals style
  contamination; detectable by regex on citation shape alone.
- **et al. misuse** — using "et al." below a style's author-count threshold, or spelling out every author past
  it, are both mechanical checks once the reference list's author count is known.
- **n.d.-in-MLA tripwire** — MLA never writes "n.d." (it omits the date entirely); a literal "n.d." marker in
  an MLA manuscript is always a style violation, not a matter of judgment. The inverse also holds: an
  APA/Chicago manuscript missing "n.d." where a source has no year is an error.
- **Vietnamese/East-Asian name mis-inversion** — blind Western surname-inversion logic risks double-flipping
  a name that is already family-name-first in the original (e.g. re-inverting an already-correct "Nguyen,
  T. D."). See the callout below — flag, never auto-fix.

## Vietnamese/East-Asian Name Order

> **Required — vn-name-order:** Vietnamese (and other East Asian) names are cited by the person's given name
> (tên) — never mechanically surname-inverted the way a Western "Surname, First" rule would. APA and most
> style guides have no formal rule for non-Western name order; this is convention, not spec, so a mismatch is
> always flagged for the writer to confirm, never silently auto-corrected. The target institution's or
> department's style guide overrides this default when it states an explicit convention.

## Style Resolution

Resolve `citation_style` in this order:

1. **Institution/venue mandate** stated in the brief — always wins if present.
2. **Discipline map** — the genre/field named in the brief:

   | Discipline | Default style |
   |---|---|
   | Psychology / education / social science / business / nursing | APA 7 |
   | Literature / humanities / cultural studies | MLA 9 |
   | History / arts / anthropology | Chicago (Notes-Biblio; Author-Date for social-science-leaning history) |
   | Engineering / CS / IT / telecom | IEEE |
   | Medicine / biomedical / clinical | Vancouver |

3. **VN-academic → APA 7 fallback** — used *only* when the discipline is unknown and the work is a
   Vietnamese-institution tiểu luận/luận văn/luận án. Vietnam has no single national citation mandate; some
   institutions (especially STEM/engineering) require numbered styles (Vancouver/IEEE) instead — do not
   hardcode APA as a universal VN default, treat it strictly as the unknown-discipline fallback.

`citation_style: none` disables all checks in this file — for genres (fiction, blog) where citation format
isn't relevant.

## Out of Scope

Do not build any of the following — they require a reference manager (Zotero/EndNote) or a CSL processor,
neither of which fits a text-only markdown copyedit pass:

- Full CSL-JSON formatting or hanging-indent/spacing enforcement.
- Automatic DOI lookup, resolution, or validation.
- Automatic bibliography generation or sorting.
- Automatic name-order correction (Vietnamese/East-Asian names are flag-only, per `vn-name-order` above).

All checks in this file are textual pattern-matching against manuscript text — never a network call.
