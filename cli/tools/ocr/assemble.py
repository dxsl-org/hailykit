"""assemble.py — slug safety, per-page Markdown writes, document.md merge.

Output layout: <out>/<doc-slug>/{document.md, pages/, figures/, manifest.json}.
`manifest` is imported eagerly (stdlib-only, no docling/cv2) unlike
local_tier/quality_gate's lazy heavy imports.
"""
from __future__ import annotations

import os
import re

import manifest as manifest_mod

_SLUG_INVALID = re.compile(r"[^A-Za-z0-9._-]+")
_RESERVED_NAMES = {
    "CON", "PRN", "AUX", "NUL",
    *(f"COM{i}" for i in range(1, 10)),
    *(f"LPT{i}" for i in range(1, 10)),
}
_MAX_SLUG_LENGTH = 100
_PAGE_FILENAME_RE = re.compile(r"^(\d{4})\.md$")


def sanitize_slug(raw_name: str) -> str:
    """Derive a filesystem-safe doc slug from an untrusted filename.

    Untrusted because job.input is user/skill-supplied and may attempt path
    traversal (`..\\..\\evil.pdf`) or collide with a Windows reserved device
    name (`CON.pdf`) — both must map to a safe slug before any directory is
    created. `safe_join` re-verifies containment as defense-in-depth.
    """
    stem = os.path.splitext(os.path.basename(raw_name))[0]
    cleaned = _SLUG_INVALID.sub("-", stem).strip("._-")
    if not cleaned:
        cleaned = "document"
    if cleaned.upper() in _RESERVED_NAMES:
        cleaned = f"{cleaned}_doc"
    return cleaned[:_MAX_SLUG_LENGTH] or "document"


def safe_join(output_root: str, slug: str) -> str:
    """Join `slug` under `output_root`, then realpath-verify containment.

    Defense-in-depth: sanitize_slug() already strips traversal characters,
    but this guards against a future caller passing a slug that skipped it.
    """
    root_real = os.path.realpath(output_root)
    joined_real = os.path.realpath(os.path.join(root_real, slug))
    if joined_real != root_real and not joined_real.startswith(root_real + os.sep):
        raise ValueError(f"slug {slug!r} escapes output root {output_root!r}")
    return joined_real


def ensure_doc_layout(doc_dir: str) -> None:
    os.makedirs(os.path.join(doc_dir, "pages"), exist_ok=True)
    os.makedirs(os.path.join(doc_dir, "figures"), exist_ok=True)


def write_page(doc_dir: str, page_no: int, markdown_text: str) -> str:
    """Write pages/NNNN.md atomically; returns the output path relative to doc_dir.

    Called BEFORE manifest.update_page(..., status="done") by ocr_engine.py —
    that ordering is the write-order contract (see manifest.py docstring).
    """
    rel_path = f"pages/{page_no:04d}.md"
    manifest_mod.atomic_write(os.path.join(doc_dir, rel_path), markdown_text)
    return rel_path


def regenerate_document(doc_dir: str) -> str:
    """Merge all current pages/NNNN.md into one document.md body with `<!-- page:N -->` markers.

    Callable as the terminal commit of every later run (phase 3's batch
    runner re-invokes this after each page settles) — always derives from
    pages/ on disk, never in-memory state, so a resumed job reproduces a
    document consistent with whatever pages are durably written.
    """
    pages_dir = os.path.join(doc_dir, "pages")
    entries: list[tuple[int, str]] = []
    if os.path.isdir(pages_dir):
        for name in os.listdir(pages_dir):
            match = _PAGE_FILENAME_RE.match(name)
            if match:
                entries.append((int(match.group(1)), name))
    entries.sort()

    parts = []
    for page_no, name in entries:
        with open(os.path.join(pages_dir, name), "r", encoding="utf-8") as fh:
            content = fh.read()
        parts.append(f"<!-- page:{page_no} -->\n{content.rstrip()}\n")
    return "\n".join(parts)


def write_document(doc_dir: str, markdown_text: str) -> None:
    manifest_mod.atomic_write(os.path.join(doc_dir, "document.md"), markdown_text)
