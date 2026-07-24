"""gemini_client.py — stdlib-only REST client for Gemini `generateContent`.

No SDK, no `requests` — `urllib.request` only (repo-wide zero-runtime-dep
rule). Auth is the `x-goog-api-key` HEADER, never the query string, so the
key never lands in a URL that could be logged by a proxy/CDN.

`generate()` never raises to its caller: every failure path (HTTP error,
network error, timeout) resolves to a typed `{"ok": False, "error": {...},
"classification": ...}` dict, because one page's VLM failure must never
abort the batch (see vlm_tier.py). Every error message is scrubbed of
API-key patterns at this boundary — the last point before an error string
reaches any sink (manifest, batch-summary, stderr, envelope).
"""
from __future__ import annotations

import json
import os
import re
import threading
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Any

_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models"

# Google API key shape (AIza + 35 chars) — matched even when the actual key
# value is unknown to us, e.g. a fake key embedded in a mocked error string.
_KEY_PATTERN = re.compile(r"AIza[0-9A-Za-z_\-]{35}")
_REDACTED = "[REDACTED]"

# Real quota exhaustion ("exceeded your current quota, check billing/plan")
# vs transient rate limiting ("retry in Ns") share the same 429 status and
# RESOURCE_EXHAUSTED reason — only the message text tells them apart.
_QUOTA_MARKERS = ("quota", "billing", "plan")

# USD per 1M tokens — approximate 2026-07-23 research baseline (see phase-02
# plan Cost math). Not billing-accurate; good enough for cost *tracking*,
# not invoicing. Update when Google republishes pricing.
_PRICE_PER_1M_TOKENS = {
    "flash": {"input": 0.10, "output": 0.40},
    "pro": {"input": 1.25, "output": 5.00},
}

_throttle_lock = threading.Lock()
_last_call_monotonic = 0.0


@dataclass
class GeminiConfig:
    """Per-call client tuning. `rpm_limit=None` disables throttling."""

    api_key: str
    max_retries: int = 5
    backoff_base_seconds: float = 2.0
    timeout_seconds: float = 60.0
    rpm_limit: int | None = None


def config_from_job(config: dict[str, Any], api_key: str) -> GeminiConfig:
    """Single construction point for every Gemini call site's `GeminiConfig` —
    a job's `rpm`/`max_retries`/`timeout` config values only take effect if
    every caller builds its config here instead of `GeminiConfig(api_key=...)`
    directly (see vlm_tier.py, figures.py, batch_api.py, batch_collect.py).
    Any key the job doesn't set falls back to the dataclass's own default.
    """
    defaults = GeminiConfig(api_key=api_key)
    return GeminiConfig(
        api_key=api_key,
        max_retries=config.get("max_retries", defaults.max_retries),
        timeout_seconds=config.get("timeout", defaults.timeout_seconds),
        rpm_limit=config.get("rpm", defaults.rpm_limit),
    )


def resolve_api_key() -> str | None:
    """`GOOGLE_API_KEY` takes precedence over `GEMINI_API_KEY` per spec."""
    return os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY")


def scrub_key_patterns(text: str, known_key: str | None = None) -> str:
    """Redact API-key-shaped substrings, plus a literal known key if given.

    Applied to every error string this module returns — the trust boundary
    between "whatever a server/DNS/proxy error happened to say" and any sink
    that might persist or display it (manifest, stderr, batch summary).
    """
    text = text or ""
    if known_key:
        text = text.replace(known_key, _REDACTED)
    return _KEY_PATTERN.sub(_REDACTED, text)


def classify_429(body_text: str) -> str:
    """`"quota_exhausted"` (stop, don't retry) vs `"transient"` (backoff + retry).

    Defaults to transient when markers are absent — the safer failure mode
    is one extra retry, not giving up on a merely-throttled request.
    """
    lowered = (body_text or "").lower()
    if any(marker in lowered for marker in _QUOTA_MARKERS):
        return "quota_exhausted"
    return "transient"


def compute_cost_usd(tier: str, usage: dict[str, Any]) -> float:
    """Cost from `usageMetadata` token counts; 0.0 for unknown tier/empty usage."""
    pricing = _PRICE_PER_1M_TOKENS.get(tier)
    if not pricing or not usage:
        return 0.0
    prompt_tokens = float(usage.get("promptTokenCount", 0) or 0)
    output_tokens = float(usage.get("candidatesTokenCount", 0) or 0)
    cost = (prompt_tokens / 1_000_000) * pricing["input"] + (output_tokens / 1_000_000) * pricing["output"]
    return round(cost, 6)


def generate(
    model: str,
    parts: list[dict[str, Any]],
    *,
    config: GeminiConfig,
    generation_config: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """POST `parts` (text + inlineData) to `{model}:generateContent`.

    Retries transient failures (5xx, network errors, transient 429) with
    exponential backoff (base `backoff_base_seconds`, doubling) up to
    `max_retries` attempts total; a quota-exhausted 429 stops immediately
    (retrying it wastes the retry budget on a call that cannot succeed).

    Returns `{"ok": True, "text": str, "usage": dict}` on success, or
    `{"ok": False, "error": {"code": str, "message": str}, "classification":
    str | None}` on failure — never raises.
    """
    url = f"{_API_BASE}/{model}:generateContent"
    body: dict[str, Any] = {"contents": [{"parts": parts}]}
    if generation_config:
        body["generationConfig"] = generation_config
    payload = json.dumps(body).encode("utf-8")

    last_message = "request failed"
    last_classification: str | None = None

    for attempt in range(config.max_retries):
        _throttle(config)
        outcome = _do_request(url, payload, config)
        if outcome["ok"]:
            return outcome

        last_message = outcome["message"]
        last_classification = outcome["classification"]
        if not outcome["retryable"]:
            break
        if attempt < config.max_retries - 1:
            time.sleep(config.backoff_base_seconds * (2**attempt))

    return _error_result("GeminiRequestFailed", last_message, last_classification, config.api_key)


def _do_request(url: str, payload: bytes, config: GeminiConfig) -> dict[str, Any]:
    request = urllib.request.Request(
        url,
        data=payload,
        method="POST",
        headers={"Content-Type": "application/json", "x-goog-api-key": config.api_key},
    )
    try:
        with urllib.request.urlopen(request, timeout=config.timeout_seconds) as response:
            raw = response.read().decode("utf-8")
        return _parse_success(raw)
    except urllib.error.HTTPError as exc:
        body_text = _read_error_body(exc) or (exc.reason or "")
        if exc.code == 429:
            classification = classify_429(body_text)
            return {"ok": False, "message": body_text, "classification": classification,
                     "retryable": classification == "transient"}
        if 500 <= exc.code < 600:
            return {"ok": False, "message": body_text, "classification": None, "retryable": True}
        return {"ok": False, "message": body_text, "classification": None, "retryable": False}
    except urllib.error.URLError as exc:
        return {"ok": False, "message": str(exc.reason), "classification": None, "retryable": True}
    except (TimeoutError, OSError) as exc:
        return {"ok": False, "message": str(exc), "classification": None, "retryable": True}


def _parse_success(raw_json: str) -> dict[str, Any]:
    data = json.loads(raw_json)
    candidates = data.get("candidates") or []
    text_parts: list[str] = []
    if candidates:
        content = candidates[0].get("content") or {}
        for part in content.get("parts") or []:
            if "text" in part:
                text_parts.append(part["text"])
    return {"ok": True, "text": "".join(text_parts), "usage": data.get("usageMetadata") or {}}


def _read_error_body(exc: urllib.error.HTTPError) -> str:
    try:
        return exc.read().decode("utf-8", errors="replace")
    except Exception:
        return ""


def _error_result(code: str, message: str, classification: str | None, api_key: str | None) -> dict[str, Any]:
    return {
        "ok": False,
        "error": {"code": code, "message": scrub_key_patterns(message, api_key)},
        "classification": classification,
    }


def _throttle(config: GeminiConfig) -> None:
    """Best-effort RPM limiter shared across calls in this process (module-level
    state because callers construct a fresh `GeminiConfig` per request)."""
    global _last_call_monotonic
    if not config.rpm_limit:
        return
    min_interval = 60.0 / config.rpm_limit
    with _throttle_lock:
        now = time.monotonic()
        wait = _last_call_monotonic + min_interval - now
        if wait > 0:
            time.sleep(wait)
        _last_call_monotonic = time.monotonic()
