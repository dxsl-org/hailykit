"""batch.py — batch runtime: input discovery, output-root lock, resume/retry,
dedup, NDJSON progress. Layers on top of the phase-1/2 per-page pipeline
(quality_gate -> local_tier -> vlm_tier) without changing any of it.

`ocr_engine.py --job` routes here for both directory inputs (many docs) and
single-file inputs (one doc) — same per-document loop either way, so resume/
retry/dedup behavior is identical regardless of how many files were given.

Resume trust boundary (non-negotiable): a loaded manifest's `job.output`/
`job.input` fields are NEVER used for filesystem operations — every path here
is derived from the CURRENT job's CLI-resolved `output_root` + a freshly
computed slug. The manifest is only ever consulted for content-identity
(`file_sha256`) and per-page progress state.
"""
from __future__ import annotations

import json
import logging
import os
import sys
import time
from typing import Any, Callable

import assemble
import batch_submit
import gemini_client
import job_config
import local_tier
import manifest as manifest_mod
import quality_gate
import sanitize
import vlm_tier
from lock import acquire_lock, release_lock

logger = logging.getLogger("ocr_engine.batch")

DEFAULT_ATTEMPTS_MAX = 3
_INPUT_EXTENSIONS = quality_gate.IMAGE_EXTENSIONS | {quality_gate.PDF_EXTENSION}


# ---------------------------------------------------------------- discovery

def discover_inputs(root: str) -> list[str]:
    """One file -> itself; a directory -> every supported file under it,
    recursive, in a stable (relative-path) order so batch runs are
    reproducible across machines/filesystems."""
    if os.path.isfile(root):
        return [root]
    matches: list[str] = []
    for dirpath, _dirnames, filenames in os.walk(root):
        for name in filenames:
            if os.path.splitext(name)[1].lower() in _INPUT_EXTENSIONS:
                matches.append(os.path.join(dirpath, name))
    matches.sort(key=lambda p: os.path.relpath(p, root).replace(os.sep, "/"))
    return matches


def _unique_slug(input_path: str, used: dict[str, int]) -> str:
    base = assemble.sanitize_slug(input_path)
    count = used.get(base, 0)
    used[base] = count + 1
    return base if count == 0 else f"{base}-{count + 1}"


# ------------------------------------------------------------- progress

def emit_progress(event: dict[str, Any]) -> None:
    """The ONLY place batch progress lines are written — always via
    `json.dumps`, never hand-formatted, so a filename containing quotes or
    newlines can never break line-based NDJSON parsing on the reader side."""
    print(json.dumps(event, ensure_ascii=False), file=sys.stderr, flush=True)


# ------------------------------------------------------- per-page pipeline

def _escalation_flags(job: job_config.JobConfig, quality: dict, confidence: dict, content: list[str]) -> list[str]:
    flags = []
    if quality["bad_image"]:
        flags.append("escalate:bad_image")
    if job.is_below_escalation_grade(confidence.get("grade")):
        flags.append("escalate:low_grade")
    if job.config.get("route_tables_to_vlm") and "table" in content:
        flags.append("escalate:table")
    if "formula" in content:
        flags.append("escalate:formula")
    return flags


def _find_page(manifest: dict[str, Any], page_no: int) -> dict[str, Any] | None:
    return next((p for p in manifest.get("pages") or [] if p.get("page") == page_no), None)


def _local_needs_retry(entry: dict[str, Any] | None, attempts_max: int) -> bool:
    """Routes a `failed` page to the right retry path: if it already carries
    `escalate:*` flags, the local stage succeeded and only escalation failed
    (see vlm_tier.py's write-order contract) — that page is _escalation's_ job
    to retry, not the local loop's."""
    if entry is None:
        return True
    status = entry.get("status")
    if status == "done":
        return False
    if status == "pending":
        return True
    if status == "failed":
        has_escalate_flags = any(str(f).startswith("escalate:") for f in (entry.get("flags") or []))
        return (not has_escalate_flags) and entry.get("attempts", 0) < attempts_max
    return True


def _run_local_page(
    *, job: job_config.JobConfig, manifest: dict, manifest_path: str, doc_dir: str, docling_result: Any,
    docling_ver: str, page_no: int, image: Any, dpi: float | None, prior_attempts: int,
    emit_fn: Callable[[dict], None], slug: str,
) -> None:
    """One page through the local tier. Never raises past this boundary — a
    single bad page must not abort the rest of the document (see phase-3
    plan's partial-success contract)."""
    try:
        quality = quality_gate.compute_page_quality(
            image, dpi=dpi, blur_min=job.config["blur_min"], long_edge_min=job.config["long_edge_min"]
        )
        confidence = local_tier.page_confidence(docling_result, page_no)
        content = local_tier.page_content_types(docling_result, page_no)
        # docling output is untrusted document content end-to-end (same trust
        # boundary vlm_tier.py and batch_collect.py already enforce for VLM
        # text) — a page image can carry adversarial text that OCR faithfully
        # transcribes, so it must never reach disk unsanitized.
        markdown_text = sanitize.sanitize_markdown(local_tier.page_markdown(docling_result, page_no))
        flags = _escalation_flags(job, quality, confidence, content)

        # Artifact BEFORE manifest "done" — write-order contract (manifest.py).
        output_rel = assemble.write_page(doc_dir, page_no, markdown_text)
        manifest_mod.update_page(
            manifest, manifest_path, page_no, status="done", tier="local",
            engine=f"docling-{docling_ver}", confidence=confidence, quality=quality["quality"],
            content=content, cost_usd=0, attempts=prior_attempts + 1, flags=flags,
            output=output_rel, figures=[],
        )
        emit_fn({"ev": "page", "doc": slug, "page": page_no, "tier": "local", "status": "done", "cost_usd": 0})
    except Exception as exc:  # noqa: broad - one page's failure must not abort the document
        scrubbed = gemini_client.scrub_key_patterns(str(exc))
        manifest_mod.update_page(
            manifest, manifest_path, page_no, status="failed", attempts=prior_attempts + 1, last_error=scrubbed,
        )
        emit_fn({"ev": "page", "doc": slug, "page": page_no, "tier": "local", "status": "failed", "cost_usd": 0})
        logger.warning("page %d local tier failed: %s", page_no, scrubbed)


def _escalate_with_retry_budget(
    *, manifest: dict, manifest_path: str, doc_dir: str, docling_result: Any, input_path: str,
    job: job_config.JobConfig, api_key: str, state: vlm_tier.EscalationState, entry: dict[str, Any],
    emit_fn: Callable[[dict], None], slug: str,
) -> None:
    """`vlm_tier.escalate_page` reports attempts for THIS call only (it has no
    notion of prior resumed attempts) — fold the prior count in afterward so
    `attempts_max` gating holds across multiple batch/resume invocations,
    without touching vlm_tier.py (owned by phase 2, out of this phase's file
    ownership)."""
    prior_attempts = entry.get("attempts", 0)
    page_no = entry["page"]
    updated = vlm_tier.escalate_page(
        manifest=manifest, manifest_path=manifest_path, doc_dir=doc_dir, page_no=page_no, page_entry=entry,
        docling_result=docling_result, input_path=input_path, job=job, api_key=api_key, state=state,
    )
    if prior_attempts:
        updated = manifest_mod.update_page(
            manifest, manifest_path, page_no, attempts=prior_attempts + updated.get("attempts", 0),
        )
    if updated.get("status") == "failed" and not updated.get("last_error"):
        # vlm_tier's public contract doesn't surface the raw API error text to
        # its caller (only status/flags/attempts) - see this phase's Deviation
        # Log; this is a best-effort synthesized message, not the real cause.
        updated = manifest_mod.update_page(
            manifest, manifest_path, page_no, last_error="vlm escalation failed after retries (see flags)",
        )
    emit_fn({
        "ev": "page", "doc": slug, "page": page_no, "tier": updated.get("tier"),
        "status": updated.get("status"), "cost_usd": updated.get("cost_usd", 0),
    })


def _run_escalation(
    *, manifest: dict, manifest_path: str, doc_dir: str, docling_result: Any, input_path: str,
    job: job_config.JobConfig, attempts_max: int, emit_fn: Callable[[dict], None], slug: str,
) -> bool:
    max_tier = job.config.get("max_tier", "flash")
    if max_tier == "local":
        return False
    api_key = gemini_client.resolve_api_key()
    if api_key is None:
        logger.warning("max_tier=%r but no API key set - skipping VLM escalation for %s", max_tier, slug)
        return False

    state = vlm_tier.EscalationState(breaker_threshold=job.config.get("quota_breaker_threshold", 3))
    for entry in list(manifest.get("pages") or []):
        if not manifest_mod.needs_escalation(entry, attempts_max):
            continue
        _escalate_with_retry_budget(
            manifest=manifest, manifest_path=manifest_path, doc_dir=doc_dir, docling_result=docling_result,
            input_path=input_path, job=job, api_key=api_key, state=state, entry=entry, emit_fn=emit_fn, slug=slug,
        )
    return state.quota_exhausted


# ------------------------------------------------------------- per-document

def process_document(
    job: job_config.JobConfig, *, attempts_max: int, emit_fn: Callable[[dict], None], used_slugs: dict[str, int],
) -> dict[str, Any]:
    slug = _unique_slug(job.input, used_slugs)
    doc_dir = assemble.safe_join(job.output, slug)
    assemble.ensure_doc_layout(doc_dir)
    manifest_path = os.path.join(doc_dir, "manifest.json")
    file_sha256 = manifest_mod.sha256_file(job.input)
    warnings: list[str] = []

    if os.path.exists(manifest_path):
        try:
            manifest = manifest_mod.load_manifest(manifest_path)
        except (ValueError, OSError, json.JSONDecodeError) as exc:
            raise manifest_mod.ManifestRefusalError(f"{slug}: cannot resume - {exc}") from exc
        manifest_mod.validate_resume(manifest, file_sha256, doc=slug)
        if manifest_mod.config_fingerprint(manifest.get("job", {}).get("config") or {}) != manifest_mod.config_fingerprint(job.config):
            warnings.append("config_changed")
        manifest_mod.apply_resume_integrity(manifest, manifest_path, doc_dir)
        if manifest.get("pages") and not manifest_mod.has_pending_work(manifest, attempts_max, job.config.get("max_tier", "flash")):
            emit_fn({"ev": "doc_skipped", "doc": slug, "reason": "unchanged_complete"})
            return _doc_summary(slug, job.input, doc_dir, manifest_path, manifest, status="skipped", warnings=warnings)
    else:
        manifest = manifest_mod.load_or_init(job, manifest_path)

    docling_ver = local_tier.docling_version()
    if docling_ver is None:
        raise RuntimeError("docling is not installed - run: pip install -r requirements.txt")

    docling_result = local_tier.convert_document(job.input, job.config["ocr_lang"])
    for page_no, image, dpi in quality_gate.iter_page_images(job.input):
        entry = _find_page(manifest, page_no)
        if not _local_needs_retry(entry, attempts_max):
            continue
        prior_attempts = entry.get("attempts", 0) if entry else 0
        _run_local_page(
            job=job, manifest=manifest, manifest_path=manifest_path, doc_dir=doc_dir, docling_result=docling_result,
            docling_ver=docling_ver, page_no=page_no, image=image, dpi=dpi, prior_attempts=prior_attempts,
            emit_fn=emit_fn, slug=slug,
        )

    # --batch-api and sync escalation are mutually exclusive per run — batch
    # wins (see this phase's Hard Contracts); local tier above always runs.
    if job.config.get("batch_api"):
        batch_submitted = batch_submit.run(
            manifest=manifest, manifest_path=manifest_path, input_path=job.input, job=job,
            attempts_max=attempts_max, emit_fn=emit_fn, slug=slug,
        )
        quota_exhausted = False
    else:
        batch_submitted = 0
        quota_exhausted = _run_escalation(
            manifest=manifest, manifest_path=manifest_path, doc_dir=doc_dir, docling_result=docling_result,
            input_path=job.input, job=job, attempts_max=attempts_max, emit_fn=emit_fn, slug=slug,
        )

    # Terminal commit — gated on no page pending/in-flight; permanently-failed
    # pages (attempts exhausted) don't block it, but a batch:submitted page's
    # "pending" status correctly blocks it until --collect runs.
    if not manifest_mod.has_pending_work(manifest, attempts_max, job.config.get("max_tier", "flash")):
        document_markdown = assemble.regenerate_document(doc_dir)
        assemble.write_document(doc_dir, document_markdown)

    totals = manifest.get("totals", {})
    emit_fn({
        "ev": "doc_done", "doc": slug, "pages": totals.get("pages", 0), "done": totals.get("done", 0),
        "failed": totals.get("failed", 0), "cost_usd": totals.get("cost_usd", 0), "quota_exhausted": quota_exhausted,
        "batch_submitted": batch_submitted,
    })
    return _doc_summary(slug, job.input, doc_dir, manifest_path, manifest, status="done", warnings=warnings, batch_submitted=batch_submitted)


def _doc_summary(
    slug: str, input_path: str, doc_dir: str, manifest_path: str, manifest: dict, *, status: str, warnings: list[str],
    batch_submitted: int = 0,
) -> dict[str, Any]:
    return {
        "doc": slug, "input": input_path, "doc_dir": doc_dir, "manifest_path": manifest_path,
        "status": status, "totals": manifest.get("totals", {}),
        "failed_pages": manifest_mod.collect_failed_pages(manifest), "warnings": warnings,
        "batch_submitted": batch_submitted,
    }


# --------------------------------------------------------------- entry points

def _load_batch_spec(job_path: str) -> dict[str, Any]:
    """Load a batch job root whose `input` may be a directory.
    `job_config.load_job` is scoped to single-file jobs (its `isfile` check is
    phase-1/2 contract) and job_config.py is out of this phase's file
    ownership to extend — this mirrors its config-merge behavior for the
    directory case instead (see this phase's Deviation Log)."""
    with open(job_path, "r", encoding="utf-8") as fh:
        raw = json.load(fh)
    if not isinstance(raw, dict):
        raise job_config.JobConfigError("job file must contain a JSON object")
    input_path, output_path = raw.get("input"), raw.get("output")
    if not isinstance(input_path, str) or not input_path:
        raise job_config.JobConfigError("job.input is required and must be a non-empty string")
    if not isinstance(output_path, str) or not output_path:
        raise job_config.JobConfigError("job.output is required and must be a non-empty string")
    if not os.path.exists(input_path):
        raise job_config.JobConfigError(f"job.input does not exist: {input_path!r}")

    merged_config = dict(job_config.DEFAULT_CONFIG)
    user_config = raw.get("config")
    if isinstance(user_config, dict):
        merged_config.update(user_config)
        if isinstance(user_config.get("models"), dict):
            merged_config["models"] = {**job_config.DEFAULT_MODELS, **user_config["models"]}
    return {"input": input_path, "output": output_path, "config": merged_config}


def run_single(job: job_config.JobConfig, *, emit_fn: Callable[[dict], None] = emit_progress) -> dict[str, Any]:
    """Single-file entry point — same per-document pipeline as a 1-doc batch,
    returned in ocr_engine.py's legacy result shape for existing callers."""
    return _run(job.output, [job.input], job.config, single=True, emit_fn=emit_fn)


def run_batch(job_path: str, *, emit_fn: Callable[[dict], None] = emit_progress) -> dict[str, Any]:
    spec = _load_batch_spec(job_path)
    inputs = discover_inputs(spec["input"])
    return _run(spec["output"], inputs, spec["config"], single=False, emit_fn=emit_fn)


def _run(
    output_root: str, inputs: list[str], config: dict[str, Any], *, single: bool, emit_fn: Callable[[dict], None],
) -> dict[str, Any]:
    lock_path = acquire_lock(output_root)
    started = time.monotonic()
    attempts_max = int(config.get("attempts_max", DEFAULT_ATTEMPTS_MAX))
    used_slugs: dict[str, int] = {}
    doc_results: list[dict[str, Any]] = []
    warnings: list[str] = []
    try:
        for input_path in inputs:
            job = job_config.JobConfig(input=input_path, output=output_root, config=config)
            try:
                result = process_document(job, attempts_max=attempts_max, emit_fn=emit_fn, used_slugs=used_slugs)
            except manifest_mod.ManifestRefusalError as exc:
                logger.error(str(exc))
                warnings.append(str(exc))
                continue
            doc_results.append(result)
            warnings.extend(result.get("warnings") or [])

        wall_seconds = time.monotonic() - started
        batch_submitted_total = sum(doc.get("batch_submitted", 0) for doc in doc_results)
        summary = manifest_mod.build_batch_summary(
            doc_results, wall_seconds=wall_seconds, warnings=warnings, batch_submitted=batch_submitted_total,
        )
        summary_path = manifest_mod.write_batch_summary(output_root, summary)
        emit_fn({
            "ev": "summary", **summary["totals"], "wall_seconds": summary["wall_seconds"], "docs": len(doc_results),
            "batch_submitted": batch_submitted_total,
        })
    finally:
        release_lock(lock_path)

    if single:
        doc = doc_results[0] if doc_results else {}
        doc_totals = doc.get("totals") or {}
        return {
            "ok": True, "doc_dir": doc.get("doc_dir"), "pages": doc_totals.get("pages", 0),
            "manifest": doc.get("manifest_path"), "quota_exhausted": doc_totals.get("quota_exhausted", False),
            "warnings": warnings, "batch_submitted": doc.get("batch_submitted", 0),
        }
    return {
        "ok": True, "batch_summary": summary_path, "docs": len(doc_results), "warnings": warnings,
        "batch_submitted": batch_submitted_total,
    }
