"""manifest.py — schema v1, the contract every later phase (2-5) builds on.

Field names are locked: VLM escalation, batch runner, CLI polish, and
sample-verification all read manifest.pages[*] by these exact keys. Do not
rename without updating every downstream consumer.

Write-order contract (crash consistency): `update_page` is the SOLE commit
point for a page's "done" status. Callers MUST atomic_write every artifact
the page references (markdown, figures) BEFORE calling update_page(...,
status="done") — a manifest that says "done" must always find those files
already durably present, even if the process crashes between the two calls.
"""
from __future__ import annotations

import hashlib
import json
import os
import time
from datetime import datetime, timezone
from typing import Any

MANIFEST_VERSION = 1

_RETRY_ATTEMPTS = 5
_RETRY_BACKOFF_SECONDS = 0.1


def atomic_write(path: str, content: str) -> None:
    """Write `content` to `path` durably: tmp file + os.replace, never bare rename.

    os.replace (not os.rename) because Windows os.rename raises FileExistsError
    when the target already exists; os.replace atomically overwrites on both
    platforms. Bounded retry absorbs transient PermissionError from AV/indexer
    file locks, common on Windows right after a file is created.
    """
    directory = os.path.dirname(path) or "."
    os.makedirs(directory, exist_ok=True)
    tmp_path = f"{path}.{os.getpid()}.tmp"
    with open(tmp_path, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(content)
        fh.flush()
        os.fsync(fh.fileno())

    last_error: OSError | None = None
    for attempt in range(_RETRY_ATTEMPTS):
        try:
            os.replace(tmp_path, path)
            return
        except PermissionError as exc:
            last_error = exc
            time.sleep(_RETRY_BACKOFF_SECONDS * (attempt + 1))
    raise OSError(f"atomic_write failed for {path!r} after {_RETRY_ATTEMPTS} attempts") from last_error


def sha256_file(path: str) -> str:
    digest = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _empty_totals() -> dict[str, Any]:
    return {
        "pages": 0, "done": 0, "failed": 0, "cost_usd": 0,
        "by_tier": {"local": 0, "flash": 0, "pro": 0},
        # Additive phase-2 fields — by_tier's shape (page counts) is locked,
        # so per-tier cost gets its own sibling key rather than changing it.
        "cost_by_tier": {"local": 0, "flash": 0, "pro": 0},
        "quota_exhausted": False,
    }


def load_or_init(job: Any, manifest_path: str) -> dict[str, Any]:
    """Load the manifest at `manifest_path`, or initialize a fresh v1 skeleton from `job`.

    Re-running a job against the same output dir resumes from the existing
    manifest instead of recomputing pages already marked done — idempotent
    re-entry that phase 3's batch runner relies on.
    """
    if os.path.exists(manifest_path):
        return load_manifest(manifest_path)

    return {
        "v": MANIFEST_VERSION,
        "job": {
            "input": job.input,
            "output": job.output,
            "config": job.config,
            "file_sha256": sha256_file(job.input),
            "created": datetime.now(timezone.utc).isoformat(),
        },
        "totals": _empty_totals(),
        "pages": [],
        # Additive phase-6 field (schema stays v1) — a manifest loaded from
        # before this phase simply has no "batch_jobs" key; every reader uses
        # manifest.get("batch_jobs") or [], never assumes presence.
        "batch_jobs": [],
    }


def load_manifest(manifest_path: str) -> dict[str, Any]:
    with open(manifest_path, "r", encoding="utf-8") as fh:
        manifest = json.load(fh)
    if manifest.get("v") != MANIFEST_VERSION:
        raise ValueError(f"unsupported manifest version: {manifest.get('v')!r}")
    return manifest


def save_manifest(manifest: dict[str, Any], manifest_path: str) -> None:
    atomic_write(manifest_path, json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")


def update_page(manifest: dict[str, Any], manifest_path: str, page: int, **fields: Any) -> dict[str, Any]:
    """Merge `fields` into the page-`page` entry and persist the manifest atomically.

    Precondition (caller's responsibility, not enforced here beyond the
    contract comment): if `fields` sets status="done", every artifact it
    references (`output`, `figures`) must already be durably written via
    atomic_write. This call is the sole commit point that makes "done"
    trustworthy after a crash.
    """
    pages = manifest.setdefault("pages", [])
    entry = next((p for p in pages if p.get("page") == page), None)
    if entry is None:
        entry = {
            "page": page,
            "status": "pending",
            "tier": None,
            "engine": None,
            "confidence": {"layout": 0.0, "ocr": 0.0, "grade": None},
            "quality": {},
            "content": [],
            "cost_usd": 0,
            "attempts": 0,
            "flags": [],
            "output": None,
            "figures": [],
        }
        pages.append(entry)

    entry.update(fields)
    _recompute_totals(manifest)
    save_manifest(manifest, manifest_path)
    return entry


def add_batch_job(manifest: dict[str, Any], manifest_path: str, *, job_id: str, model: str, tier: str, page_refs: list[int]) -> dict[str, Any]:
    """Append one `batch_jobs[]` entry (additive v1 field, see `load_or_init`)
    and persist atomically — called right after the pages in `page_refs` are
    flipped to `status="pending"` + `batch:submitted` in the same submission pass."""
    entry = {
        "job_id": job_id, "model": model, "tier": tier, "page_refs": list(page_refs),
        "submitted_at": datetime.now(timezone.utc).isoformat(), "state": "submitted",
    }
    manifest.setdefault("batch_jobs", []).append(entry)
    save_manifest(manifest, manifest_path)
    return entry


def update_batch_job(manifest: dict[str, Any], manifest_path: str, job_id: str, **fields: Any) -> dict[str, Any] | None:
    """Merge `fields` (typically just `state=...`) into the `batch_jobs[]`
    entry matching `job_id`; a no-op returning `None` if the job is unknown."""
    entry = next((j for j in manifest.get("batch_jobs") or [] if j.get("job_id") == job_id), None)
    if entry is None:
        return None
    entry.update(fields)
    save_manifest(manifest, manifest_path)
    return entry


class ManifestRefusalError(RuntimeError):
    """Raised when a loaded manifest cannot be trusted for resume — never
    downgraded to a warning (see phase-3 plan's Resume trust contract)."""

    code = "manifest_refused"


# Config keys that affect ROUTING/QUALITY decisions — a change here means
# pages already marked "done" may not reflect what the current config would
# have produced. This is a soft signal (warn `config_changed`, still resume),
# distinct from `file_sha256` mismatch (hard refuse) because content identity
# is what resume correctness actually depends on.
_THRESHOLD_CONFIG_KEYS = (
    "blur_min", "escalate_below_grade", "route_tables_to_vlm",
    "long_edge_min", "max_tier", "models", "ocr_lang",
)


def config_fingerprint(config: dict[str, Any]) -> str:
    subset = {key: config.get(key) for key in _THRESHOLD_CONFIG_KEYS}
    return hashlib.sha256(json.dumps(subset, sort_keys=True).encode("utf-8")).hexdigest()


def validate_resume(manifest: dict[str, Any], file_sha256: str, *, doc: str) -> None:
    """Refuse (never warn) a loaded manifest that cannot be safely resumed.

    Trust boundary: `manifest["job"]["output"]`/`input` are NEVER used for any
    filesystem operation by the caller — this function only compares content
    identity (`file_sha256`) to decide whether the SAME document is being
    resumed, not whether the stored paths look sane.
    """
    if manifest.get("v") != MANIFEST_VERSION:
        raise ManifestRefusalError(f"{doc}: unsupported manifest version {manifest.get('v')!r}")
    job_meta = manifest.get("job")
    if not isinstance(job_meta, dict) or not isinstance(job_meta.get("file_sha256"), str):
        raise ManifestRefusalError(f"{doc}: manifest.json is missing job.file_sha256 - refusing to resume")
    if job_meta["file_sha256"] != file_sha256:
        raise ManifestRefusalError(
            f"{doc}: input file content has changed since this manifest was created - "
            "refusing to resume (use a fresh output dir to reprocess as a new document)"
        )


def apply_resume_integrity(manifest: dict[str, Any], manifest_path: str, doc_dir: str) -> bool:
    """Downgrade any "done" page whose output artifact is missing/empty back
    to "pending" so the batch runner reprocesses it. Cost/output are reset
    together — the artifact backing that cost no longer exists on disk.
    """
    downgraded = False
    for entry in list(manifest.get("pages") or []):
        if entry.get("status") != "done":
            continue
        output_rel = entry.get("output")
        artifact_path = os.path.join(doc_dir, output_rel) if output_rel else None
        if artifact_path and os.path.isfile(artifact_path) and os.path.getsize(artifact_path) > 0:
            continue
        update_page(manifest, manifest_path, entry["page"], status="pending", cost_usd=0, output=None)
        downgraded = True
    return downgraded


def needs_escalation(entry: dict[str, Any], attempts_max: int) -> bool:
    """A page still needs a VLM escalation attempt: it carries an
    `escalate:*` flag (set once by the local tier), hasn't already succeeded
    at flash/pro tier, and hasn't exhausted `attempts_max`."""
    flags = entry.get("flags") or []
    if not any(str(flag).startswith("escalate:") for flag in flags):
        return False
    if entry.get("tier") in ("flash", "pro") and entry.get("status") == "done":
        return False
    if entry.get("status") == "failed" and entry.get("attempts", 0) >= attempts_max:
        return False
    return True


def has_pending_work(manifest: dict[str, Any], attempts_max: int) -> bool:
    """True if any page still needs local (re)processing, a bounded retry, or
    escalation. Doubles as: (a) the file-level dedup gate — an unchanged file
    whose manifest has no pending work is skipped whole — and (b) the
    terminal-commit gate for `document.md` regeneration."""
    for entry in manifest.get("pages") or []:
        status = entry.get("status")
        if status == "pending":
            return True
        if status == "failed" and entry.get("attempts", 0) < attempts_max:
            return True
        if needs_escalation(entry, attempts_max):
            return True
    return False


def collect_failed_pages(manifest: dict[str, Any]) -> list[dict[str, Any]]:
    return [
        {"page": p.get("page"), "error": p.get("last_error") or "failed (see manifest flags)"}
        for p in manifest.get("pages") or []
        if p.get("status") == "failed"
    ]


def build_batch_summary(
    doc_results: list[dict[str, Any]], *, wall_seconds: float, warnings: list[str] | None = None, batch_submitted: int = 0
) -> dict[str, Any]:
    """Aggregate per-document results into the batch-level summary. Each
    per-doc manifest.json stays the single source of truth for that
    document — this only sums the totals each already carries."""
    totals = _empty_totals()
    docs: list[dict[str, Any]] = []
    failed_pages: list[dict[str, Any]] = []
    quota_exhausted = False

    for doc in doc_results:
        doc_totals = doc.get("totals") or {}
        totals["pages"] += doc_totals.get("pages", 0)
        totals["done"] += doc_totals.get("done", 0)
        totals["failed"] += doc_totals.get("failed", 0)
        totals["cost_usd"] = round(totals["cost_usd"] + doc_totals.get("cost_usd", 0), 6)
        for tier in ("local", "flash", "pro"):
            totals["by_tier"][tier] += (doc_totals.get("by_tier") or {}).get(tier, 0)
            totals["cost_by_tier"][tier] = round(
                totals["cost_by_tier"][tier] + (doc_totals.get("cost_by_tier") or {}).get(tier, 0), 6
            )
        quota_exhausted = quota_exhausted or bool(doc_totals.get("quota_exhausted"))
        docs.append({
            "doc": doc.get("doc"), "input": doc.get("input"), "status": doc.get("status"),
            "pages": doc_totals.get("pages", 0), "done": doc_totals.get("done", 0),
            "failed": doc_totals.get("failed", 0), "cost_usd": doc_totals.get("cost_usd", 0),
        })
        for failed in doc.get("failed_pages") or []:
            failed_pages.append({"doc": doc.get("doc"), **failed})

    totals["quota_exhausted"] = quota_exhausted
    return {
        "v": MANIFEST_VERSION,
        "generated": datetime.now(timezone.utc).isoformat(),
        "wall_seconds": round(wall_seconds, 3),
        "totals": totals,
        "docs": docs,
        "failed_pages": failed_pages,
        "warnings": sorted(set(warnings or [])),
        "batch_submitted": batch_submitted,
    }


def write_batch_summary(output_root: str, summary: dict[str, Any]) -> str:
    path = os.path.join(output_root, "batch-summary.json")
    atomic_write(path, json.dumps(summary, indent=2, ensure_ascii=False) + "\n")
    return path


def _recompute_totals(manifest: dict[str, Any]) -> None:
    pages = manifest.get("pages", [])
    by_tier = {"local": 0, "flash": 0, "pro": 0}
    cost_by_tier = {"local": 0.0, "flash": 0.0, "pro": 0.0}
    done = failed = 0
    cost = 0.0
    quota_exhausted = False
    for p in pages:
        status = p.get("status")
        if status == "done":
            done += 1
        elif status == "failed":
            failed += 1
        tier = p.get("tier")
        page_cost = float(p.get("cost_usd") or 0)
        if tier in by_tier:
            by_tier[tier] += 1
            cost_by_tier[tier] += page_cost
        cost += page_cost
        if "quota_exhausted" in (p.get("flags") or []):
            quota_exhausted = True

    manifest["totals"] = {
        "pages": len(pages),
        "done": done,
        "failed": failed,
        "cost_usd": round(cost, 6),
        "by_tier": by_tier,
        "cost_by_tier": {tier: round(value, 6) for tier, value in cost_by_tier.items()},
        "quota_exhausted": quota_exhausted,
    }
