"""quality_gate.py — pre-OCR quality metrics: blur, skew, DPI vs pixel-dims.

These are routing signals only (feed manifest.pages[*].quality/flags); they
never block conversion — local_tier always runs. `bad_image` means "flag for
escalation review", not "skip this page".

cv2/pypdfium2 are imported lazily inside functions so this module stays
importable (and `ocr_engine.py --check` keeps working) even before those
deps are installed — mirrors the same lazy-import discipline as local_tier.py
for docling.
"""
from __future__ import annotations

import math
import os
from typing import Any, Iterator

IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".tif", ".tiff", ".webp"}
PDF_EXTENSION = ".pdf"


def iter_page_images(input_path: str) -> Iterator[tuple[int, Any, float | None]]:
    """Yield (page_no, gray_ndarray, dpi_or_None) for every page of `input_path`.

    PDFs render page-by-page via pypdfium2 (already a docling dependency) so
    quality metrics run independent of the docling conversion pass. DPI comes
    from PDF points vs rendered pixel width (a PDF point is always 1/72 inch).
    Bare images have no page/DPI concept — one page, dpi=None, and the caller
    falls back to the pixel-dims/long-edge gate instead.
    """
    ext = os.path.splitext(input_path)[1].lower()
    if ext == PDF_EXTENSION:
        yield from _iter_pdf_pages(input_path)
    elif ext in IMAGE_EXTENSIONS:
        yield 1, _load_bare_image(input_path), None
    else:
        raise ValueError(f"unsupported input extension: {ext!r}")


def _iter_pdf_pages(pdf_path: str, render_scale: float = 300 / 72) -> Iterator[tuple[int, Any, float]]:
    import pypdfium2 as pdfium

    pdf = pdfium.PdfDocument(pdf_path)
    try:
        for index in range(len(pdf)):
            page = pdf[index]
            width_pt, _height_pt = page.get_size()
            bitmap = page.render(scale=render_scale)
            gray = _pil_to_gray_array(bitmap.to_pil())
            dpi = dpi_from_pdf_page((width_pt, _height_pt), (gray.shape[1], gray.shape[0]))
            yield index + 1, gray, dpi
    finally:
        pdf.close()


def _load_bare_image(image_path: str) -> Any:
    import cv2

    image = cv2.imread(image_path, cv2.IMREAD_UNCHANGED)
    if image is None:
        raise ValueError(f"cv2 could not decode image: {image_path!r}")
    return image


def _pil_to_gray_array(pil_image: Any) -> Any:
    import cv2
    import numpy as np

    rgb = np.array(pil_image.convert("RGB"))
    return cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)


def compute_page_quality(image: Any, *, dpi: float | None, blur_min: float, long_edge_min: int) -> dict[str, Any]:
    """Return {"quality": {...}, "bad_image": bool} per the manifest schema's `quality` shape."""
    import cv2

    gray = image if image.ndim == 2 else cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    blur = _laplacian_variance(gray)
    skew_deg = _estimate_skew(gray)

    quality: dict[str, Any] = {"blur": round(blur, 2), "skew_deg": round(skew_deg, 2)}
    bad_image = blur < blur_min

    if dpi is not None:
        quality["dpi"] = round(dpi, 1)
    else:
        height, width = gray.shape[:2]
        long_edge = max(width, height)
        quality["pixel_dims"] = [int(width), int(height)]
        quality["long_edge"] = int(long_edge)
        if long_edge < long_edge_min:
            bad_image = True

    return {"quality": quality, "bad_image": bad_image}


def _laplacian_variance(gray: Any) -> float:
    import cv2

    return float(cv2.Laplacian(gray, cv2.CV_64F).var())


def _estimate_skew(gray: Any) -> float:
    """Median angle (degrees) of near-horizontal Hough lines; 0.0 when too few lines detected.

    Skew is a soft routing signal, not a hard requirement — a blank or
    near-empty page (no detected lines) yields 0.0 rather than raising.
    """
    import cv2
    import numpy as np

    edges = cv2.Canny(gray, 50, 150, apertureSize=3)
    lines = cv2.HoughLines(edges, 1, math.pi / 180, threshold=150)
    if lines is None:
        return 0.0

    angles = []
    for line in lines[:200]:
        _rho, theta = line[0]
        angle_deg = (theta * 180.0 / math.pi) - 90.0
        # keep only near-horizontal candidates (text baselines); reject
        # near-vertical Hough hits which are usually margins/noise.
        if -45.0 < angle_deg < 45.0:
            angles.append(angle_deg)

    return float(np.median(angles)) if angles else 0.0


def dpi_from_pdf_page(page_points: tuple[float, float], pixel_dims: tuple[int, int]) -> float:
    """DPI = pixel_width / (point_width / 72) — a PDF point is always 1/72 inch."""
    point_width, _ = page_points
    pixel_width, _ = pixel_dims
    if point_width <= 0:
        return 0.0
    return (pixel_width / point_width) * 72.0
