"""openai_client.py — stdlib-only client for an OpenAI-compatible
`/chat/completions` vision endpoint (OpenRouter, self-hosted vLLM, etc.).

Same call convention as `gemini_client.generate` (`generate(model, parts, *,
config) -> result`, where `parts` is the Gemini-shaped `[{"text": ...},
{"inlineData": {"mimeType", "data"}}]` list every VLM call site already
builds) — `provider.py` binds this as a drop-in `generate_fn` so
`vlm_tier.py`/`figures.py` never branch on provider kind.

`base_url` is a user-configured egress endpoint: the page image (base64,
inline in the request body) is sent there verbatim. This module does not
validate or restrict `base_url` — that is a deliberate trust decision the
operator makes when configuring a `kind: "openai"` provider (see the ocr
skill docs' data-egress note).

Auth is `Authorization: Bearer <key>` where `<key>` is read from
`os.environ[api_key_env]` — the config only ever stores the env var NAME
(`config_from_job` below), never a key value. Every error string is scrubbed
of the resolved key via `gemini_client.scrub_key_patterns` before it reaches
any sink, the same trust boundary the native Gemini adapter enforces.
"""
from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Any

import gemini_client

_DEFAULT_MAX_RETRIES = 5
_DEFAULT_BACKOFF_BASE_SECONDS = 2.0
_DEFAULT_TIMEOUT_SECONDS = 60.0


@dataclass
class OpenAIConfig:
    """Per-call client tuning, mirroring `gemini_client.GeminiConfig`'s
    fields so job-level `max_retries`/`timeout`/`rpm` tuning applies
    uniformly regardless of which provider kind a tier resolves to."""

    base_url: str
    api_key: str
    max_retries: int = _DEFAULT_MAX_RETRIES
    backoff_base_seconds: float = _DEFAULT_BACKOFF_BASE_SECONDS
    timeout_seconds: float = _DEFAULT_TIMEOUT_SECONDS
    rpm_limit: int | None = None


def config_from_job(config: dict[str, Any], entry: dict[str, Any]) -> OpenAIConfig:
    """Single construction point for this adapter's config, mirroring
    `gemini_client.config_from_job`'s contract. `entry` is the resolved
    `providers[name]` dict (kind=="openai"); its `api_key_env` names the env
    var this reads — never a literal key value (see provider.py)."""
    key_env = entry.get("api_key_env")
    api_key = os.environ.get(key_env, "") if isinstance(key_env, str) and key_env else ""
    return OpenAIConfig(
        base_url=str(entry.get("base_url") or "").rstrip("/"),
        api_key=api_key,
        max_retries=config.get("max_retries", _DEFAULT_MAX_RETRIES),
        backoff_base_seconds=config.get("backoff_base_seconds", _DEFAULT_BACKOFF_BASE_SECONDS),
        timeout_seconds=config.get("timeout", _DEFAULT_TIMEOUT_SECONDS),
        rpm_limit=config.get("rpm"),
    )


def _extract_prompt_and_image(parts: list[dict[str, Any]]) -> tuple[str, str | None, str]:
    """`parts` is always the Gemini-shaped list every call site builds —
    translate it to (prompt text, base64 image data, mime type) once here so
    the request builder below doesn't know about Gemini's wire format."""
    text = ""
    image_b64: str | None = None
    mime = "image/png"
    for part in parts:
        if "text" in part:
            text = part["text"]
        elif "inlineData" in part:
            inline = part["inlineData"]
            image_b64 = inline.get("data")
            mime = inline.get("mimeType", mime)
    return text, image_b64, mime


def _build_body(model: str, text: str, image_b64: str | None, mime: str) -> dict[str, Any]:
    content: list[dict[str, Any]] = [{"type": "text", "text": text}]
    if image_b64:
        content.append({"type": "image_url", "image_url": {"url": f"data:{mime};base64,{image_b64}"}})
    return {"model": model, "messages": [{"role": "user", "content": content}]}


def generate(model: str, parts: list[dict[str, Any]], *, config: OpenAIConfig) -> dict[str, Any]:
    """POST `parts` (translated to OpenAI chat/completions vision shape) to
    `{base_url}/chat/completions`. Same retry/backoff/429-classification
    rules as `gemini_client.generate`; never raises — every failure resolves
    to a typed `{"ok": False, "error": {...}, "classification": ...}` dict.

    Usage is returned as-is from the provider's own `usage` block (OpenAI's
    `prompt_tokens`/`completion_tokens` shape, NOT Gemini's `promptTokenCount`/
    `candidatesTokenCount`) — `gemini_client.compute_cost_usd` only recognizes
    Gemini's key names, so a third-party provider's usage naturally costs
    $0 rather than being priced off Gemini's table, which would be actively
    misleading for a model this pricing table knows nothing about.
    """
    text, image_b64, mime = _extract_prompt_and_image(parts)
    url = f"{config.base_url}/chat/completions"
    payload = json.dumps(_build_body(model, text, image_b64, mime)).encode("utf-8")

    last_message = "request failed"
    last_classification: str | None = None
    for attempt in range(config.max_retries):
        outcome = _do_request(url, payload, config)
        if outcome["ok"]:
            return outcome
        last_message = outcome["message"]
        last_classification = outcome["classification"]
        if not outcome["retryable"]:
            break
        if attempt < config.max_retries - 1:
            time.sleep(config.backoff_base_seconds * (2**attempt))

    return {
        "ok": False,
        "error": {"code": "OpenAIRequestFailed", "message": gemini_client.scrub_key_patterns(last_message, config.api_key)},
        "classification": last_classification,
    }


def _do_request(url: str, payload: bytes, config: OpenAIConfig) -> dict[str, Any]:
    request = urllib.request.Request(
        url, data=payload, method="POST",
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {config.api_key}"},
    )
    try:
        with urllib.request.urlopen(request, timeout=config.timeout_seconds) as response:
            raw = response.read().decode("utf-8")
        return _parse_success(raw)
    except urllib.error.HTTPError as exc:
        body_text = _read_error_body(exc) or (exc.reason or "")
        if exc.code == 429:
            classification = gemini_client.classify_429(body_text)
            return {"ok": False, "message": body_text, "classification": classification,
                     "retryable": classification == "transient"}
        if 500 <= exc.code < 600:
            return {"ok": False, "message": body_text, "classification": None, "retryable": True}
        return {"ok": False, "message": body_text, "classification": None, "retryable": False}
    except urllib.error.URLError as exc:
        return {"ok": False, "message": str(exc.reason), "classification": None, "retryable": True}
    except (TimeoutError, OSError) as exc:
        return {"ok": False, "message": str(exc), "classification": None, "retryable": True}
    except (json.JSONDecodeError, ValueError, KeyError, AttributeError) as exc:
        # A 200 with a non-JSON or unexpected-shape body must stay inside the
        # never-raise contract, not escape as a traceback to the caller.
        return {"ok": False, "message": f"malformed response: {exc}", "classification": None, "retryable": False}


def _parse_success(raw_json: str) -> dict[str, Any]:
    data = json.loads(raw_json)
    choices = data.get("choices") or []
    text = ""
    if choices:
        message = choices[0].get("message") or {}
        content = message.get("content")
        text = content if isinstance(content, str) else ""
    return {"ok": True, "text": text, "usage": data.get("usage") or {}}


def _read_error_body(exc: urllib.error.HTTPError) -> str:
    try:
        return exc.read().decode("utf-8", errors="replace")
    except Exception:
        return ""
