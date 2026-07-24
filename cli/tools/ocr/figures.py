"""figures.py — crop figure regions from a page image, caption via Gemini
flash-lite, sanitize the caption, and save `figures/pNNNN-fN.png`.

Phase-1 never persists a rendered page PNG (`quality_gate.iter_page_images`
renders in-memory GRAYSCALE only, for blur/skew metrics, and discards it).
Cropping figures needs a full-color render, so this module re-renders the
page itself rather than reusing that buffer or modifying quality_gate.py
(outside this phase's file ownership) — see phase file Deviation Log.

Bbox contract: `crop_bbox()` takes FRACTIONAL page coordinates (0.0-1.0,
top-left origin) — decoupled from docling's own bbox coordinate system
(PDF-point space, origin depends on `coord_origin`), which is UNVERIFIED
against a real docling install (same caveat `local_tier.py` already flags
for other docling API surface). `docling_bbox_to_fractional()` is the single
conversion seam to fix once verified against a real install.
"""
from __future__ import annotations

import base64
import io
import os
from typing import Any, Callable

import gemini_client
import prompts
import provider
import sanitize

_FIGURE_CAPTION_MAX_LENGTH = 160


def load_page_image(input_path: str, page_no: int) -> Any:
    """Full-color PIL Image of `page_no` (1-based) — PDF via pypdfium2 render,
    bare image loaded directly. Lazy-imported (pypdfium2/PIL) so this module
    stays importable without those deps, mirroring quality_gate.py's pattern.
    """
    ext = os.path.splitext(input_path)[1].lower()
    if ext == ".pdf":
        return render_pdf_page(input_path, page_no)
    from PIL import Image

    return Image.open(input_path).convert("RGB")


def render_pdf_page(pdf_path: str, page_no: int, scale: float = 300 / 72) -> Any:
    import pypdfium2 as pdfium

    pdf = pdfium.PdfDocument(pdf_path)
    try:
        bitmap = pdf[page_no - 1].render(scale=scale)
        return bitmap.to_pil().convert("RGB")
    finally:
        pdf.close()


def page_size_points(input_path: str, page_no: int) -> tuple[float, float] | None:
    """PDF page size in points for bbox conversion; `None` for non-PDF input
    (bare images have no figure regions distinct from the page itself)."""
    if os.path.splitext(input_path)[1].lower() != ".pdf":
        return None
    import pypdfium2 as pdfium

    pdf = pdfium.PdfDocument(input_path)
    try:
        return pdf[page_no - 1].get_size()
    finally:
        pdf.close()


def image_to_base64_png(image: Any) -> str:
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return base64.b64encode(buffer.getvalue()).decode("ascii")


def docling_bbox_to_fractional(
    bbox: Any, page_width_pt: float, page_height_pt: float
) -> tuple[float, float, float, float]:
    """ASSUMPTION (unverified, mirrors local_tier.py's docling-API caveats):
    bbox exposes `.l/.t/.r/.b` in native PDF points, bottom-left origin.
    Fix only this function if the installed docling_core differs — callers
    only ever see the returned fractional tuple.
    """
    if page_width_pt <= 0 or page_height_pt <= 0:
        return (0.0, 0.0, 1.0, 1.0)
    left = float(getattr(bbox, "l", 0.0)) / page_width_pt
    right = float(getattr(bbox, "r", page_width_pt)) / page_width_pt
    top_pdf = float(getattr(bbox, "t", page_height_pt))
    bottom_pdf = float(getattr(bbox, "b", 0.0))
    top = 1.0 - (top_pdf / page_height_pt)
    bottom = 1.0 - (bottom_pdf / page_height_pt)
    clamp = lambda v: max(0.0, min(1.0, v))  # noqa: E731 — tiny, local, self-explanatory
    return (clamp(left), clamp(top), clamp(right), clamp(bottom))


def crop_bbox(page_image: Any, bbox: tuple[float, float, float, float]) -> Any:
    width, height = page_image.size
    left, top, right, bottom = bbox
    box = (int(left * width), int(top * height), int(right * width), int(bottom * height))
    return page_image.crop(box)


def extract_figure_bboxes(docling_result: Any, page_no: int) -> list[Any]:
    """Bboxes of figure/picture items on `page_no`, via docling_core's stable
    `iterate_items()` + provenance — mirrors `local_tier.page_content_types()`'s
    traversal but is isolated here rather than added to local_tier.py, which is
    outside phase-2's file ownership (see Deviation Log).
    """
    document = getattr(docling_result, "document", None)
    if document is None:
        return []

    bboxes = []
    for item, _level in document.iterate_items():
        label = str(getattr(item, "label", "")).lower()
        if not any(k in label for k in ("picture", "figure", "image")):
            continue
        for prov in getattr(item, "prov", None) or []:
            if getattr(prov, "page_no", None) == page_no:
                bbox = getattr(prov, "bbox", None)
                if bbox is not None:
                    bboxes.append(bbox)
    return bboxes


def save_figure_png(image: Any, doc_dir: str, page_no: int, figure_index: int) -> str:
    """Save a cropped figure to `figures/pNNNN-fN.png`; returns the path
    relative to `doc_dir` for the manifest `figures[]` list."""
    rel_path = f"figures/p{page_no:04d}-f{figure_index}.png"
    abs_path = os.path.join(doc_dir, rel_path)
    os.makedirs(os.path.dirname(abs_path), exist_ok=True)
    image.save(abs_path, format="PNG")
    return rel_path


def caption_figure(
    image: Any,
    *,
    api_key: str,
    job_config: dict[str, Any],
    generate_fn: Callable[..., dict[str, Any]] = gemini_client.generate,
) -> str:
    """Caption a cropped figure via the flash tier's resolved provider
    (native Gemini by default, or whatever `tier_provider["flash"]` names —
    see provider.py), sanitized before return: VLM output never reaches the
    caller unsanitized. `generate_fn` is injectable so tests substitute a
    fake client — a non-default override (identity-checked against
    `gemini_client.generate`) is called in place of the resolved adapter, but
    the resolved model/config are still used (same contract as
    `vlm_tier._attempt_tier`). `job_config` is the job's config dict —
    threaded through so this call's rpm/retry/timeout tuning matches every
    other VLM call site.
    """
    binding = provider.resolve("flash", job_config, api_key)
    fn = binding.generate_fn if generate_fn is gemini_client.generate else generate_fn
    parts = [
        {"text": prompts.FIGURE_CAPTION_PROMPT},
        {"inlineData": {"mimeType": "image/png", "data": image_to_base64_png(image)}},
    ]
    result = fn(binding.model, parts, config=binding.config)
    if not result.get("ok"):
        return ""
    return sanitize.sanitize_caption(result.get("text", ""), max_length=_FIGURE_CAPTION_MAX_LENGTH)


def build_figures(
    *,
    doc_dir: str,
    page_no: int,
    page_image: Any,
    docling_figures: list[Any],
    page_size_pt: tuple[float, float],
    job_config: dict[str, Any],
    api_key: str,
    generate_fn: Callable[..., dict[str, Any]] = gemini_client.generate,
) -> tuple[list[str], list[str]]:
    """Crop every figure bbox on `page_no`, caption + sanitize, save PNGs.

    Returns `(figure_paths, embed_lines)` — `figure_paths` feeds the manifest
    `figures[]` list, `embed_lines` are `![caption](figures/...)` strings
    `vlm_tier.py` appends to the page markdown. `job_config` is the job's
    config dict (carries `models` plus any rpm/retry/timeout tuning).
    """
    figure_paths: list[str] = []
    embed_lines: list[str] = []
    page_width_pt, page_height_pt = page_size_pt

    for index, bbox in enumerate(docling_figures, start=1):
        fractional = docling_bbox_to_fractional(bbox, page_width_pt, page_height_pt)
        cropped = crop_bbox(page_image, fractional)
        rel_path = save_figure_png(cropped, doc_dir, page_no, index)
        caption = caption_figure(
            cropped, api_key=api_key, job_config=job_config, generate_fn=generate_fn,
        )
        figure_paths.append(rel_path)
        embed_lines.append(f"![{caption or 'figure'}]({rel_path})")

    return figure_paths, embed_lines
