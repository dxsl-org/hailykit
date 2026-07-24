#!/usr/bin/env python3
"""ocr_engine.py — entry point for the local-tier OCR pipeline.

Usage:
    python ocr_engine.py --job <path/to/job.json>
    python ocr_engine.py --check

Contract: exactly one line of JSON is written to stdout — the final result.
All human-readable progress/diagnostics go to stderr via `logging`, so stdout
stays parseable by callers (the TypeScript `ocr` command) regardless of how
much docling/cv2 chatter lands on stderr.
"""
from __future__ import annotations

import argparse
import importlib
import json
import logging
import os
import sys

import batch
import batch_collect
import gemini_client
import job_config
import local_tier

logging.basicConfig(stream=sys.stderr, level=logging.INFO, format="%(levelname)s %(message)s")
logger = logging.getLogger("ocr_engine")


def run_check() -> dict:
    """Report python/docling/opencv/key availability + model-cache state.

    Never prints API key VALUES — presence booleans only (security contract).
    `docling_installed` and `models_cached` are reported as distinct states:
    a fresh docling install has no models downloaded yet (first run pulls
    ~500MB) — that is a different, non-error condition from "not installed".
    """
    docling_ver = local_tier.docling_version()
    return {
        "ok": True,
        "python": sys.version.split()[0],
        "docling_installed": docling_ver is not None,
        "docling_version": docling_ver,
        "models_cached": _docling_models_cached() if docling_ver else False,
        "opencv_installed": _probe_import("cv2"),
        "pypdfium2_installed": _probe_import("pypdfium2"),
        "keys": {
            "GEMINI_API_KEY": bool(os.environ.get("GEMINI_API_KEY")),
            "GOOGLE_API_KEY": bool(os.environ.get("GOOGLE_API_KEY")),
        },
    }


def _probe_import(module_name: str) -> bool:
    try:
        importlib.import_module(module_name)
        return True
    except ImportError:
        return False


def _docling_models_cached() -> bool:
    """Best-effort check for docling's downloaded model artifacts.

    Heuristic, not authoritative: docling fetches models into a local cache
    on first run (path configurable via DOCLING_ARTIFACTS_PATH, default under
    the user cache dir). UNVERIFIED against a real install — see this
    phase's Deviation Log; adjust once docling is actually installed here.
    """
    candidates = []
    custom_path = os.environ.get("DOCLING_ARTIFACTS_PATH")
    if custom_path:
        candidates.append(custom_path)
    candidates.append(os.path.join(os.path.expanduser("~"), ".cache", "docling"))
    return any(os.path.isdir(path) and os.listdir(path) for path in candidates)


def _peek_job(job_path: str) -> tuple[str, dict]:
    """Read `job.input`/`job.config` to decide routing, without
    `job_config.load_job`'s isfile-only validation — a directory input needs
    to reach `batch.py` before that check would reject it. job_config.py is
    out of this phase's file ownership to extend (see batch.py's module
    docstring / this phase's Deviation Log).
    """
    with open(job_path, "r", encoding="utf-8") as fh:
        raw = json.load(fh)
    input_path = raw.get("input") if isinstance(raw, dict) else None
    if not isinstance(input_path, str) or not input_path:
        raise job_config.JobConfigError("job.input is required and must be a non-empty string")
    config = raw.get("config") if isinstance(raw.get("config"), dict) else {}
    return input_path, config


def run_job(job_path: str) -> dict:
    """Directory input -> `batch.run_batch` (many documents); single-file
    input -> `batch.run_single` (one document, same per-page pipeline and
    resume/retry/lock semantics as a 1-document batch). `config.collect`
    (phase 6) routes to `batch_collect.run_collect` instead, entirely
    bypassing the local+escalation pipeline — collect and submit are
    distinct top-level modes, never both in the same invocation."""
    raw_input, config = _peek_job(job_path)
    if config.get("collect"):
        return batch_collect.run_collect(job_path)
    if os.path.isdir(raw_input):
        return batch.run_batch(job_path)
    job = job_config.load_job(job_path)
    return batch.run_single(job)


def main() -> int:
    parser = argparse.ArgumentParser(description="hailykit OCR engine — local tier + manifest")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--job", metavar="PATH", help="path to a job JSON file")
    group.add_argument("--check", action="store_true", help="report dependency/key availability")
    # Skip-done/retry-failed/dedup-skip are always-on in batch.py (making them
    # opt-in would make a plain re-run double-spend VLM cost) — this flag is
    # accepted for CLI-layer forward compatibility, not a behavior gate.
    parser.add_argument("--resume", action="store_true", help="accepted for interface compatibility; no-op")
    args = parser.parse_args()

    try:
        result = run_check() if args.check else run_job(args.job)
    except Exception as exc:  # noqa: broad — this boundary must never let a bare traceback hit stdout
        logger.exception("ocr_engine failed")
        code = getattr(exc, "code", None) or exc.__class__.__name__
        # This is the top-level catch-all — any exception message (including
        # ones that never passed through gemini_client's own scrub boundary)
        # reaches stdout from here, so scrub defensively at this last exit too.
        result = {"ok": False, "error": {"code": code, "message": gemini_client.scrub_key_patterns(str(exc))}}

    print(json.dumps(result))
    return 0 if result.get("ok") else 1


if __name__ == "__main__":
    sys.exit(main())
