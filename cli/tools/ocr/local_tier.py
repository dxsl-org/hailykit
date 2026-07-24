"""local_tier.py — docling tier-1 conversion wrapper.

docling is imported lazily inside functions, never at module level, so this
module — and therefore `ocr_engine.py --check` — stays importable when
docling isn't installed yet (user-installed external dep, never auto-installed
here; see requirements.txt).

The API surface below follows the phase-01 plan's Assumptions section
(confidence: medium/low) — UNVERIFIED until docling is actually installed and
run against a fixture (deferred; see this phase's Deviation Log). If the
installed API differs, only this module's mapping functions need to change —
callers only ever see the dict shapes returned here.
"""
from __future__ import annotations

import math
from typing import Any


def _finite_score(value: Any) -> float | None:
    """Round a docling score to 4dp, or None if it is absent/non-finite.

    docling reports `ocr_score` as NaN for pages it never OCR'd (born-digital
    text layers) — NaN is not valid JSON and would break the manifest for any
    strict parser (the TypeScript reader among them), so it becomes null.
    """
    try:
        num = float(value)
    except (TypeError, ValueError):
        return None
    return round(num, 4) if math.isfinite(num) else None


def _grade_name(grade: Any) -> str:
    """Normalize docling's QualityGrade enum to a bare uppercase name.

    `str(QualityGrade.GOOD)` is `"QualityGrade.GOOD"`, which no longer matches
    the GRADE_ORDER table in job_config and silently collapses to POOR — so a
    clean page gets a spurious `escalate:low_grade` flag. Take the enum name
    (or the segment after the last dot) instead.
    """
    name = getattr(grade, "name", None) or str(grade).rsplit(".", 1)[-1]
    return name.upper()


def docling_version() -> str | None:
    """Installed docling version, or None if the package isn't importable."""
    try:
        import docling
    except ImportError:
        return None
    return getattr(docling, "__version__", "unknown")


def convert_document(input_path: str, ocr_lang: list[str]) -> Any:
    """Run docling's DocumentConverter over `input_path`, OCR options wired from `ocr_lang`.

    Raises ImportError if docling isn't installed; the caller (ocr_engine.py)
    surfaces that as a structured `{"ok": false, ...}` result, never a bare
    traceback on stdout.
    """
    from docling.datamodel.base_models import InputFormat
    from docling.datamodel.pipeline_options import PdfPipelineOptions, RapidOcrOptions
    from docling.document_converter import DocumentConverter, PdfFormatOption

    # RapidOCR (ONNX) is the bundled OCR backend: it installs cleanly on the
    # Python 3.14 target venv and ships no NC-licensed weights, unlike docling's
    # EasyOCR default (which is not installed) or Surya. Table + formula
    # enrichment are on so tables reach the manifest as `table` content and
    # equations get flagged for VLM escalation. do_ocr stays on so scanned
    # pages are read; born-digital pages still extract their text layer.
    pipeline_options = PdfPipelineOptions(
        do_ocr=True,
        do_table_structure=True,
        do_formula_enrichment=True,
        ocr_options=RapidOcrOptions(lang=ocr_lang),
    )
    converter = DocumentConverter(
        format_options={InputFormat.PDF: PdfFormatOption(pipeline_options=pipeline_options)}
    )
    return converter.convert(input_path)


def page_confidence(result: Any, page_no: int) -> dict[str, Any]:
    """Map docling's per-page confidence scores to the manifest `confidence` shape.

    `ocr` here is engine SELF-confidence, not correctness — a language
    mismatch (e.g. Vietnamese text read with an English `ocr_lang`) can still
    score high and never trip escalation. `ocr_lang` config is the guard
    against that, not this score; phase-5 sample-verify is the net.
    """
    report = getattr(result, "confidence", None)
    pages = getattr(report, "pages", None) or {}
    score = pages.get(page_no)
    if score is None:
        return {"layout": 0.0, "ocr": 0.0, "grade": "POOR"}

    layout = _finite_score(getattr(score, "layout_score", 0.0))
    ocr = _finite_score(getattr(score, "ocr_score", 0.0))
    grade = getattr(score, "grade", None) or getattr(score, "mean_grade", "POOR")
    return {"layout": layout, "ocr": ocr, "grade": _grade_name(grade)}


def page_content_types(result: Any, page_no: int) -> list[str]:
    """Distinct element kinds (text/table/formula/figure) present on `page_no`.

    Relies only on docling_core's stable `iterate_items()` + element
    provenance — independent of the markdown-export assumption in
    `page_markdown`, so this mapping stays correct even if that one doesn't.
    """
    document = getattr(result, "document", None)
    if document is None:
        return []

    types: set[str] = set()
    for item, _level in document.iterate_items():
        prov = getattr(item, "prov", None) or []
        if any(getattr(p, "page_no", None) == page_no for p in prov):
            types.add(_normalize_label(str(getattr(item, "label", "text"))))
    return sorted(types)


def _normalize_label(label: str) -> str:
    label = label.lower()
    if "table" in label:
        return "table"
    if "formula" in label or "equation" in label:
        return "formula"
    if "picture" in label or "figure" in label or "image" in label:
        return "figure"
    return "text"


def page_markdown(result: Any, page_no: int) -> str:
    """Slice per-page Markdown via docling_core's `export_to_markdown(page_no=...)`.

    Assumption (plan § Assumptions #4, confidence low): this kwarg exists and
    preserves reading order per page, including page-spanning tables assigned
    to their starting page. If the installed docling_core lacks it, this
    raises rather than silently emitting duplicated or wrong-page content —
    fix the mapping here once verified against a real install (deferred; see
    Deviation Log).
    """
    document = getattr(result, "document", None)
    if document is None:
        return ""

    try:
        return document.export_to_markdown(page_no=page_no)
    except TypeError as exc:
        raise RuntimeError(
            "docling_core.export_to_markdown has no page_no support in the "
            "installed version — local_tier.page_markdown needs updating "
            "against the real API (see phase-01 plan Assumptions #4)"
        ) from exc
