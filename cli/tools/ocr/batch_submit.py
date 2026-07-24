"""batch_submit.py — `--batch-api` mode's escalation replacement: flagged
pages are uploaded + submitted as Gemini Batch jobs instead of called
synchronously (see `batch_api.py` for the network primitives this composes).

Deviation from the sync path (see phase-06 plan's Deviation Log): batch mode
always starts at flash, skipping the sync path's escalate:bad_image
pro-first special case — sanity-check-driven follow-up handling happens at
collect time instead (`batch_collect.py`), not here.

Extracted out of `batch.py` (rather than living inline there) to keep that
already-oversized file's growth to just the mode-switch call site — see this
phase's Deviation Log.
"""
from __future__ import annotations

import io
import logging
from typing import Any, Callable

import batch_api
import figures
import gemini_client
import job_config
import manifest as manifest_mod
import prompts

logger = logging.getLogger("ocr_engine.batch_submit")


def _find_page(manifest: dict[str, Any], page_no: int) -> dict[str, Any] | None:
    return next((p for p in manifest.get("pages") or [] if p.get("page") == page_no), None)


def _page_png_bytes(input_path: str, page_no: int) -> bytes:
    """Fresh full-color re-render for File API upload — quality_gate's
    grayscale render is metric-only and never persisted (see figures.py's
    docstring); this mirrors figures.py's own page render for cropping."""
    buffer = io.BytesIO()
    figures.load_page_image(input_path, page_no).save(buffer, format="PNG")
    return buffer.getvalue()


def run(
    *, manifest: dict[str, Any], manifest_path: str, input_path: str, job: job_config.JobConfig, attempts_max: int,
    emit_fn: Callable[[dict], None], slug: str,
) -> int:
    """Submit every page still needing escalation as batch job(s), chunked
    under the enqueued-token cap. Returns the count of jobs submitted (0 if
    no API key, no flagged pages, or nothing to do)."""
    api_key = gemini_client.resolve_api_key()
    if api_key is None:
        logger.warning("--batch-api set but no API key - skipping batch submission for %s", slug)
        return 0
    flagged = [e for e in list(manifest.get("pages") or []) if manifest_mod.needs_escalation(e, attempts_max)]
    if not flagged:
        return 0
    pages = [{"page_no": e["page"], "png_bytes": _page_png_bytes(input_path, e["page"])} for e in flagged]

    model = job.config["models"]["flash"]
    result = batch_api.submit_pages(
        pages=pages, model=model, tier="flash", api_key=api_key, prompt=prompts.PAGE_OCR_PROMPT, job_config=job.config,
    )
    for submitted_job in result["jobs"]:
        manifest_mod.add_batch_job(
            manifest, manifest_path, job_id=submitted_job["job_id"], model=submitted_job["model"],
            tier=submitted_job["tier"], page_refs=submitted_job["page_refs"],
        )
        for page_no in submitted_job["page_refs"]:
            entry = _find_page(manifest, page_no)
            flags = list((entry or {}).get("flags") or [])
            if "batch:submitted" not in flags:
                flags = [*flags, "batch:submitted"]
            manifest_mod.update_page(manifest, manifest_path, page_no, status="pending", flags=flags)
        emit_fn({
            "ev": "batch_submitted", "doc": slug, "job_id": submitted_job["job_id"],
            "model": submitted_job["model"], "pages": len(submitted_job["page_refs"]),
        })
    if not result["ok"]:
        logger.warning("batch submission partially failed for %s: %s", slug, result.get("error"))
    return len(result["jobs"])
