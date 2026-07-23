"""batch_api.py — stdlib-only client for the Gemini File API + Batch submit path.

Same trust boundary as `gemini_client.py`: auth is the `x-goog-api-key`
HEADER (never a query string), every error string is scrubbed of key
patterns before it reaches any sink, network failures never raise past
this module's public functions.

Poll/fetch (the collect-side primitives) live in `batch_collect.py` next to
the manifest bookkeeping they feed — this module owns only the submit path
(upload, JSONL build, chunking, submit) to stay under the file's line cap.

ASSUMPTION (medium confidence, see phase-06 plan's Assumptions section):
the Batch API accepts image inputs via File-API references embedded in a
JSONL request file and returns per-request results keyed by the JSONL
`key` field. UNVERIFIED against a live call (none made here — mocked
endpoints only per this phase's test contract); if a live smoke test shows
inline `fileData` isn't accepted, only `build_batch_jsonl` needs to change.

File API objects expire (~48h) — callers must not assume an uploaded page
or JSONL file is retrievable after that window; collect promptly or resubmit.
"""
from __future__ import annotations

import json
import time
import urllib.error
import urllib.request
from typing import Any, Callable

import gemini_client

_FILE_UPLOAD_BASE = "https://generativelanguage.googleapis.com/upload/v1beta/files"
_MODEL_BASE = "https://generativelanguage.googleapis.com/v1beta/models"

# Conservative floor of Google's published 3-10M enqueued-token range per
# batch job — the lower bound keeps every model tier safely under cap
# without per-model tuning (config-first override via `token_cap`).
DEFAULT_ENQUEUED_TOKEN_CAP = 3_000_000
# Per-page enqueued-token proxy (prompt text + one inline-image page at
# default tiling) — a research baseline for chunk sizing, not an exact
# count and not used for billing.
TOKENS_PER_PAGE_ESTIMATE = 1290
BATCH_PRICE_MULTIPLIER = 0.5  # Batch Mode is 50% of synchronous per-token pricing.


def compute_batch_cost_usd(tier: str, usage: dict[str, Any]) -> float:
    return round(gemini_client.compute_cost_usd(tier, usage) * BATCH_PRICE_MULTIPLIER, 6)


def request(
    method: str, url: str, *, config: gemini_client.GeminiConfig, body: bytes | None = None,
    extra_headers: dict[str, str] | None = None,
) -> dict[str, Any]:
    """Generic retrying HTTP call for File/Batch endpoints — same auth header,
    exponential backoff, and key-scrub rules as `gemini_client.generate`,
    generalized beyond its fixed generateContent request/response shape.
    Shared with `batch_collect.py`'s poll/fetch calls (public, not `_`-prefixed)."""
    headers = {"x-goog-api-key": config.api_key, **(extra_headers or {})}
    last_message = "request failed"
    for attempt in range(config.max_retries):
        req = urllib.request.Request(url, data=body, method=method, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=config.timeout_seconds) as response:
                raw = response.read().decode("utf-8")
                resp_headers = dict(response.headers.items())
            return {"ok": True, "data": json.loads(raw) if raw.strip() else {}, "headers": resp_headers}
        except urllib.error.HTTPError as exc:
            try:
                last_message = exc.read().decode("utf-8", errors="replace") or (exc.reason or "")
            except Exception:
                last_message = exc.reason or "http error"
            if not (exc.code == 429 or 500 <= exc.code < 600):
                break
        except (urllib.error.URLError, TimeoutError, OSError) as exc:
            last_message = str(exc)
        if attempt < config.max_retries - 1:
            time.sleep(config.backoff_base_seconds * (2**attempt))
    return {"ok": False, "error": gemini_client.scrub_key_patterns(last_message, config.api_key)}


def upload_file(
    data: bytes, *, mime_type: str, display_name: str, config: gemini_client.GeminiConfig,
    request_fn: Callable[..., dict[str, Any]] = request,
) -> dict[str, Any]:
    """Two-step resumable upload (start -> upload+finalize) -> `{"ok", "file_uri"}`."""
    start_headers = {
        "X-Goog-Upload-Protocol": "resumable", "X-Goog-Upload-Command": "start",
        "X-Goog-Upload-Header-Content-Length": str(len(data)),
        "X-Goog-Upload-Header-Content-Type": mime_type, "Content-Type": "application/json",
    }
    start_body = json.dumps({"file": {"display_name": display_name}}).encode("utf-8")
    start = request_fn("POST", _FILE_UPLOAD_BASE, config=config, body=start_body, extra_headers=start_headers)
    if not start["ok"]:
        return {"ok": False, "error": start["error"]}
    upload_url = next((v for k, v in (start.get("headers") or {}).items() if k.lower() == "x-goog-upload-url"), None)
    if not upload_url:
        return {"ok": False, "error": "file upload did not return an upload URL"}

    finalize_headers = {"X-Goog-Upload-Command": "upload, finalize", "X-Goog-Upload-Offset": "0", "Content-Length": str(len(data))}
    finalize = request_fn("PUT", upload_url, config=config, body=data, extra_headers=finalize_headers)
    if not finalize["ok"]:
        return {"ok": False, "error": finalize["error"]}
    file_uri = ((finalize.get("data") or {}).get("file") or {}).get("uri")
    if not file_uri:
        return {"ok": False, "error": "file upload response missing file.uri"}
    return {"ok": True, "file_uri": file_uri}


def estimate_page_tokens(page_count: int) -> int:
    return page_count * TOKENS_PER_PAGE_ESTIMATE


def chunk_pages(pages: list[dict[str, Any]], *, token_cap: int = DEFAULT_ENQUEUED_TOKEN_CAP) -> list[list[dict[str, Any]]]:
    """Split `pages` into groups that stay under `token_cap` enqueued tokens."""
    chunks: list[list[dict[str, Any]]] = []
    current: list[dict[str, Any]] = []
    for page in pages:
        if current and estimate_page_tokens(len(current) + 1) > token_cap:
            chunks.append(current)
            current = []
        current.append(page)
    if current:
        chunks.append(current)
    return chunks


def build_batch_jsonl(pages: list[dict[str, Any]], *, prompt: str) -> str:
    """One line per page: `{"key": "page-<n>", "request": {...}}`. `pages[i]`
    is `{"page_no", "file_uri", "mime_type"}` — image already uploaded."""
    lines = []
    for page in pages:
        req_body = {"contents": [{"parts": [
            {"text": prompt}, {"fileData": {"mimeType": page["mime_type"], "fileUri": page["file_uri"]}},
        ]}]}
        lines.append(json.dumps({"key": f"page-{page['page_no']}", "request": req_body}, ensure_ascii=False))
    return "\n".join(lines) + "\n"


def submit_batch_job(
    model: str, jsonl_file_uri: str, *, config: gemini_client.GeminiConfig, display_name: str,
    request_fn: Callable[..., dict[str, Any]] = request,
) -> dict[str, Any]:
    url = f"{_MODEL_BASE}/{model}:batchGenerateContent"
    body = json.dumps({"batch": {"displayName": display_name, "inputConfig": {"fileName": jsonl_file_uri}}}).encode("utf-8")
    result = request_fn("POST", url, config=config, body=body, extra_headers={"Content-Type": "application/json"})
    if not result["ok"]:
        return {"ok": False, "error": result["error"]}
    job_id = (result.get("data") or {}).get("name")
    if not job_id:
        return {"ok": False, "error": "batch submit response missing job name"}
    return {"ok": True, "job_id": job_id}


def submit_pages(
    *, pages: list[dict[str, Any]], model: str, tier: str, api_key: str, prompt: str, job_config: dict[str, Any],
    token_cap: int = DEFAULT_ENQUEUED_TOKEN_CAP, request_fn: Callable[..., dict[str, Any]] = request,
) -> dict[str, Any]:
    """Upload + chunk + submit every page in `pages` (`{"page_no", "png_bytes"}`).
    Stops at the first failing chunk but returns jobs already submitted —
    partial success is surfaced, never silently dropped (caller records what
    succeeded and leaves the rest for a later run). `job_config` is the job's
    config dict, threaded into `gemini_client.config_from_job` so this path's
    rpm/retry/timeout tuning matches every other Gemini call site."""
    config = gemini_client.config_from_job(job_config, api_key)
    jobs: list[dict[str, Any]] = []
    for chunk in chunk_pages(pages, token_cap=token_cap):
        uploaded = []
        upload_error = None
        for page in chunk:
            upload = upload_file(page["png_bytes"], mime_type="image/png", display_name=f"hailykit-ocr-page-{page['page_no']}", config=config, request_fn=request_fn)
            if not upload["ok"]:
                upload_error = upload["error"]
                break
            uploaded.append({"page_no": page["page_no"], "file_uri": upload["file_uri"], "mime_type": "image/png"})
        if upload_error:
            return {"ok": False, "jobs": jobs, "error": upload_error}

        jsonl_bytes = build_batch_jsonl(uploaded, prompt=prompt).encode("utf-8")
        jsonl_upload = upload_file(jsonl_bytes, mime_type="application/jsonl", display_name=f"hailykit-ocr-batch-{model}-{int(time.time())}", config=config, request_fn=request_fn)
        if not jsonl_upload["ok"]:
            return {"ok": False, "jobs": jobs, "error": jsonl_upload["error"]}

        submit = submit_batch_job(model, jsonl_upload["file_uri"], config=config, display_name=f"hailykit-ocr-{model}", request_fn=request_fn)
        if not submit["ok"]:
            return {"ok": False, "jobs": jobs, "error": submit["error"]}
        jobs.append({"job_id": submit["job_id"], "model": model, "tier": tier, "page_refs": [p["page_no"] for p in chunk]})
    return {"ok": True, "jobs": jobs, "error": None}
