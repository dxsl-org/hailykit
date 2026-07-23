"""batch_collect.py — `--collect` mode: poll outstanding Gemini Batch jobs,
sanitize + write results, and reconcile manifest.batch_jobs state.

Poll/fetch network primitives live here (not batch_api.py, which owns only
the submit path — see that module's docstring) so they sit next to the
manifest bookkeeping that consumes them. Same trust boundary as vlm_tier.py:
batch results are UNTRUSTED model output — `sanitize.sanitize_markdown` runs
BEFORE any `atomic_write`, and the write-order contract (markdown before
manifest "done") holds exactly as it does for the sync escalation path.
"""
from __future__ import annotations

import os
import time
from datetime import datetime
from typing import Any, Callable

import assemble
import batch
import batch_api
import gemini_client
import manifest as manifest_mod
import provider
import sanitize
import vlm_tier

_BATCH_API_ROOT = "https://generativelanguage.googleapis.com/v1beta"

def get_job_status(job_id: str, *, config: gemini_client.GeminiConfig, request_fn: Callable[..., dict[str, Any]] = batch_api.request) -> dict[str, Any]:
    result = request_fn("GET", f"{_BATCH_API_ROOT}/{job_id}", config=config, body=None)
    if not result["ok"]:
        return {"ok": False, "error": result["error"]}
    return {"ok": True, "data": result.get("data") or {}}

def poll_batch_job(job_id: str, *, config: gemini_client.GeminiConfig, request_fn: Callable[..., dict[str, Any]] = batch_api.request) -> dict[str, Any]:
    """`state` is one of `"running" | "succeeded" | "expired" | "failed"`."""
    got = get_job_status(job_id, config=config, request_fn=request_fn)
    if not got["ok"]:
        return got
    data = got["data"]
    if not data.get("done"):
        return {"ok": True, "state": "running"}
    state = str((data.get("metadata") or {}).get("state") or "").upper()
    if "EXPIRE" in state:
        return {"ok": True, "state": "expired"}
    if "SUCCEED" in state or "SUCCESS" in state:
        return {"ok": True, "state": "succeeded"}
    return {"ok": True, "state": "failed"}

def fetch_batch_results(job_id: str, *, config: gemini_client.GeminiConfig, request_fn: Callable[..., dict[str, Any]] = batch_api.request) -> dict[str, Any]:
    """Text is UNSANITIZED model output — sanitized by `_apply_result_row`
    below before any write."""
    got = get_job_status(job_id, config=config, request_fn=request_fn)
    if not got["ok"]:
        return got
    items = ((got["data"].get("response") or {}).get("inlinedResponses") or {}).get("inlinedResponses") or []
    rows = []
    for item in items:
        key = (item.get("metadata") or {}).get("key", "")
        if "error" in item:
            rows.append({"key": key, "ok": False, "error": (item["error"] or {}).get("message", "batch item failed")})
            continue
        response = item.get("response") or {}
        candidates = response.get("candidates") or []
        parts = (candidates[0].get("content") or {}).get("parts") or [] if candidates else []
        rows.append({"key": key, "ok": True, "text": "".join(p.get("text", "") for p in parts), "usage": response.get("usageMetadata") or {}})
    return {"ok": True, "results": rows}

def _collect_job(*, job_id: str, api_key: str, job_config: dict[str, Any], request_fn: Callable[..., dict[str, Any]]) -> dict[str, Any]:
    # Collect always talks to the native Gemini Batch/File API — routed
    # through provider.py's Gemini-only helper so a flash `providers` entry's
    # custom `api_key_env` (if still gemini-kind) is honored the same as the
    # sync path, without risking a non-Gemini config object on this call.
    config = provider.resolve_gemini_only("flash", job_config, api_key)
    poll = poll_batch_job(job_id, config=config, request_fn=request_fn)
    if not poll["ok"]:
        return {"ok": False, "error": poll["error"]}
    if poll["state"] != "succeeded":
        return {"ok": True, "state": poll["state"]}
    fetch = fetch_batch_results(job_id, config=config, request_fn=request_fn)
    if not fetch["ok"]:
        return {"ok": False, "error": fetch["error"]}
    return {"ok": True, "state": "succeeded", "results": fetch["results"]}

def _find_page(manifest: dict[str, Any], page_no: int) -> dict[str, Any] | None:
    return next((p for p in manifest.get("pages") or [] if p.get("page") == page_no), None)

def _without_flag(flags: list[str], flag: str) -> list[str]:
    return [f for f in flags if f != flag]

def _with_flag(flags: list[str], flag: str) -> list[str]:
    return flags if flag in flags else [*flags, flag]

def _apply_result_row(*, manifest: dict, manifest_path: str, doc_dir: str, row: dict[str, Any], tier: str, model: str, slug: str) -> None:
    """One page's result row -> manifest update, sanitized + write-ordered.
    Never raises: a malformed key or missing page entry is skipped, not fatal."""
    try:
        page_no = int(str(row.get("key", "")).rsplit("-", 1)[-1])
    except ValueError:
        return
    entry = _find_page(manifest, page_no)
    if entry is None:
        return
    flags = _without_flag(list(entry.get("flags") or []), "batch:submitted")
    attempts = entry.get("attempts", 0) + 1

    if not row.get("ok"):
        manifest_mod.update_page(manifest, manifest_path, page_no, status="pending", flags=_with_flag(flags, "batch:item_failed"), attempts=attempts)
        return
    sanitized = sanitize.sanitize_markdown(row.get("text", ""))
    if not vlm_tier.sanity_check(sanitized):
        # Scope note (see this phase's Deviation Log): a sanity-check failure
        # always flags needs:pro rather than auto-resubmitting a follow-up
        # pro batch — a later sync or batch pass re-attempts it (escalate:*
        # flags are untouched, status stays pending).
        manifest_mod.update_page(manifest, manifest_path, page_no, status="pending", flags=_with_flag(flags, "needs:pro"), attempts=attempts)
        return

    output_rel = assemble.write_page(doc_dir, page_no, sanitized)
    cost = batch_api.compute_batch_cost_usd(tier, row.get("usage") or {})
    manifest_mod.update_page(
        manifest, manifest_path, page_no, status="done", tier=tier, engine=model, cost_usd=cost,
        attempts=attempts, flags=flags, output=output_rel, figures=entry.get("figures") or [],
    )
    batch.emit_progress({"ev": "batch_collected", "doc": slug, "page": page_no, "tier": tier, "status": "done", "cost_usd": cost})

def _submitted_epoch(submitted_at: str | None) -> float:
    if not submitted_at:
        return time.time()
    try:
        return datetime.fromisoformat(submitted_at).timestamp()
    except ValueError:
        return time.time()

def _collect_document(*, manifest: dict, manifest_path: str, doc_dir: str, api_key: str, job_config: dict[str, Any], attempts_max: int, slug: str, request_fn: Callable[..., dict[str, Any]], warnings: list[str]) -> None:
    for job_entry in list(manifest.get("batch_jobs") or []):
        if job_entry.get("state") not in ("submitted", "running"):
            continue
        job_id = job_entry["job_id"]
        result = _collect_job(job_id=job_id, api_key=api_key, job_config=job_config, request_fn=request_fn)
        if not result["ok"]:
            warnings.append(f"batch:poll_failed {job_id}: {result['error']}")
            continue

        state = result["state"]
        if state == "running":
            manifest_mod.update_batch_job(manifest, manifest_path, job_id, state="running")
            age = time.time() - _submitted_epoch(job_entry.get("submitted_at"))
            batch.emit_progress({"ev": "batch_state", "doc": slug, "job_id": job_id, "state": "running", "age_seconds": round(age)})
            continue

        if state in ("failed", "expired"):
            for page_no in job_entry.get("page_refs") or []:
                entry = _find_page(manifest, page_no)
                if entry and "batch:submitted" in (entry.get("flags") or []):
                    flags = _with_flag(_without_flag(list(entry["flags"]), "batch:submitted"), "batch:expired")
                    manifest_mod.update_page(manifest, manifest_path, page_no, status="pending", flags=flags)
            manifest_mod.update_batch_job(manifest, manifest_path, job_id, state=state)
            warnings.append(f"batch:{state} job {job_id} ({len(job_entry.get('page_refs') or [])} pages returned to pending)")
            batch.emit_progress({"ev": "batch_state", "doc": slug, "job_id": job_id, "state": state})
            continue

        for row in result.get("results") or []:
            _apply_result_row(manifest=manifest, manifest_path=manifest_path, doc_dir=doc_dir, row=row, tier=job_entry.get("tier", "flash"), model=job_entry.get("model", ""), slug=slug)
        manifest_mod.update_batch_job(manifest, manifest_path, job_id, state="collected")

    if not manifest_mod.has_pending_work(manifest, attempts_max):
        assemble.write_document(doc_dir, assemble.regenerate_document(doc_dir))

def run_collect(job_path: str, *, request_fn: Callable[..., dict[str, Any]] = batch_api.request) -> dict[str, Any]:
    """Top-level `--collect` entry point (`ocr_engine.py` routes here before
    the normal local+escalation pipeline runs). Same lock as a normal run —
    collect and submit must never race on the same output root. Reuses
    `batch._load_batch_spec` (dir-or-file job parsing) rather than
    duplicating it — see this phase's Deviation Log."""
    spec = batch._load_batch_spec(job_path)
    inputs = batch.discover_inputs(spec["input"])
    attempts_max = int(spec["config"].get("attempts_max", batch.DEFAULT_ATTEMPTS_MAX))
    api_key = gemini_client.resolve_api_key()
    lock_path = batch.acquire_lock(spec["output"])
    used_slugs: dict[str, int] = {}
    docs: list[dict[str, Any]] = []
    warnings: list[str] = []
    try:
        for input_path in inputs:
            slug = batch._unique_slug(input_path, used_slugs)
            doc_dir = assemble.safe_join(spec["output"], slug)
            manifest_path = os.path.join(doc_dir, "manifest.json")
            if not os.path.exists(manifest_path):
                continue
            manifest = manifest_mod.load_manifest(manifest_path)
            # Same content-identity check `batch.process_document` runs before
            # resuming a manifest (batch.py's Resume trust boundary) — collect
            # re-reads `input_path` here (for its sha256), so it must refuse
            # the same way a sync resume would if the file changed underneath.
            try:
                manifest_mod.validate_resume(manifest, manifest_mod.sha256_file(input_path), doc=slug)
            except manifest_mod.ManifestRefusalError as exc:
                warnings.append(str(exc))
                continue
            if not manifest.get("batch_jobs"):
                continue
            if api_key is None:
                warnings.append(f"{slug}: no API key set - cannot collect outstanding batch jobs")
                continue
            _collect_document(
                manifest=manifest, manifest_path=manifest_path, doc_dir=doc_dir, api_key=api_key,
                job_config=spec["config"], attempts_max=attempts_max, slug=slug, request_fn=request_fn, warnings=warnings,
            )
            docs.append({"doc": slug, "totals": manifest.get("totals", {})})
    finally:
        batch.release_lock(lock_path)
    return {"ok": True, "docs_collected": len(docs), "docs": docs, "warnings": warnings}
