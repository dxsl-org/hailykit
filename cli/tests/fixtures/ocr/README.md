# OCR fixtures

Used by `cli/tools/ocr/` smoke tests (phase-01) and later VLM-escalation /
batch-runner tests (phases 2-3).

## Present

- `born-digital-2page.pdf` — 2-page text-layer PDF, hand-built minimal PDF
  syntax (no reportlab/fpdf in the skills venv). Verified via an independent
  reader (`pypdfium2.PdfDocument` + `get_textpage().get_text_range()`) to
  round-trip exact page count and text: page 1 = "Hello page one born
  digital", page 2 = "Hello page two born digital". Exercises the
  born-digital / `tier:"local"` / cost-0 path — no OCR should be needed.
- `scanned-blurry.png` — synthetic bare-image fixture (PIL-drawn text +
  Gaussian blur, no external PDF). Exercises the bare-image branch of
  `quality_gate.iter_page_images` (no DPI, pixel-dims/long-edge gate) and is
  intentionally blurred to trip `escalate:bad_image` once opencv is
  installed and the blur-variance threshold is calibrated against it.

## Needed, not yet generated

- **Multi-column PDF with a page-spanning table.** Requires a real PDF-layout
  library (reportlab/fpdf2/weasyprint) or a source document with genuine
  multi-column reading order and a table crossing a page break — hand-rolling
  raw PDF syntax cannot produce authentic multi-column layout or table
  structure docling would recognize, and faking one would produce a
  misleading fixture rather than a useful one. Needed to validate the
  phase-01 plan's Assumption #4 (per-page Markdown slicing preserves reading
  order; page-spanning tables assign to their starting page) once docling is
  installed — see `cli/tools/ocr/local_tier.py` `page_markdown()`.
- **Fixture with equations** for the formula-detection assumption (plan
  Assumption #3) — same blocker, needs a real authoring tool.

Both are deferred until a PDF-authoring dependency is available or a small
real-world sample document is sourced; do not fabricate table/formula
content by hand to fill this gap.
