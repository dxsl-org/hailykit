"""cli_client.py — shell out to a user-configured CLI (e.g. `gemini -m ...
-p ... @image`) as a VLM adapter with no API key required — the command
itself owns its own auth (whatever env/config the CLI reads on its own).

Placeholder substitution: `{model}`/`{prompt}`/`{image}` in each `command[]`
entry are replaced verbatim in an ARGV LIST, never a shell string — quoting
is never a concern and `shell=True` is never needed. That is the exact
vector this design avoids: a malicious prompt or filename breaking out of a
shell string.

`generate()` matches the same call convention every VLM adapter in this
package uses (`generate(model, parts, *, config) -> result`, matching
`gemini_client.generate`'s never-raise, typed-result contract) so
`provider.py` can bind it as a drop-in `generate_fn` for `vlm_tier.py`/
`figures.py` without those call sites branching on provider kind.

No internal retry loop (unlike gemini_client/openai_client): a shelled-out
command isn't safely re-invocable on a transient failure without assumptions
about its own idempotency, so retry policy here is left to the outer job's
resume/escalation flow rather than looping inside a single call.
"""
from __future__ import annotations

import base64
import os
import shutil
import subprocess
import tempfile
from dataclasses import dataclass
from typing import Any

import gemini_client

_DEFAULT_TIMEOUT_SECONDS = 120.0


@dataclass
class CliConfig:
    command: list[str]
    timeout_seconds: float = _DEFAULT_TIMEOUT_SECONDS


def config_from_job(config: dict[str, Any], entry: dict[str, Any]) -> CliConfig:
    command = entry.get("command")
    if not isinstance(command, list) or not command or not all(isinstance(c, str) for c in command):
        raise ValueError("cli provider entry requires a non-empty command[] of strings")
    return CliConfig(
        command=[str(c) for c in command],
        timeout_seconds=float(config.get("timeout", _DEFAULT_TIMEOUT_SECONDS)),
    )


def _extract_prompt_and_image_bytes(parts: list[dict[str, Any]]) -> tuple[str, bytes | None]:
    text = ""
    image_bytes: bytes | None = None
    for part in parts:
        if "text" in part:
            text = part["text"]
        elif "inlineData" in part:
            data = part["inlineData"].get("data")
            if data:
                image_bytes = base64.b64decode(data)
    return text, image_bytes


def _substitute(args: list[str], *, model: str, prompt: str, image_path: str) -> list[str]:
    return [a.replace("{model}", model).replace("{prompt}", prompt).replace("{image}", image_path) for a in args]


def _resolve_executable(command: list[str]) -> str | None:
    """Resolve `command[0]` on PATH (or accept it as-is if it's already a
    path to an existing file) — `subprocess.run` with `shell=False` does its
    own PATH lookup on POSIX, but a resolved path is checked up front here so
    a missing command is a clean typed error instead of an `OSError` from
    deep inside `subprocess.run`."""
    if not command:
        return None
    first = command[0]
    if os.path.isfile(first):
        return first
    return shutil.which(first)


def generate(model: str, parts: list[dict[str, Any]], *, config: CliConfig) -> dict[str, Any]:
    """Run the configured command with `{model}`/`{prompt}`/`{image}`
    substituted; the image (if the caller's `parts` carried one) is written
    to a temp PNG passed as `{image}`. Stdout (decoded UTF-8) becomes the
    page markdown. Never raises: a missing executable, non-zero exit, or
    timeout all resolve to a typed error dict; stderr is scrubbed the same
    as every other adapter's error path.
    """
    text, image_bytes = _extract_prompt_and_image_bytes(parts)
    executable = _resolve_executable(config.command)
    if executable is None:
        return {
            "ok": False,
            "error": {"code": "CliExecutableNotFound", "message": f"{config.command[0]!r} not found on PATH"},
            "classification": None,
        }

    image_path = None
    try:
        if image_bytes is not None:
            fd, image_path = tempfile.mkstemp(suffix=".png", prefix="hailykit-ocr-cli-")
            with os.fdopen(fd, "wb") as fh:
                fh.write(image_bytes)
        argv = _substitute([executable, *config.command[1:]], model=model, prompt=text, image_path=image_path or "")

        try:
            completed = subprocess.run(argv, capture_output=True, timeout=config.timeout_seconds, shell=False)
        except subprocess.TimeoutExpired:
            return {
                "ok": False,
                "error": {"code": "CliTimeout", "message": f"command timed out after {config.timeout_seconds}s"},
                "classification": "transient",
            }
        except OSError as exc:
            return {"ok": False, "error": {"code": "CliExecError", "message": gemini_client.scrub_key_patterns(str(exc))}, "classification": None}

        if completed.returncode != 0:
            stderr_text = completed.stderr.decode("utf-8", errors="replace")
            return {
                "ok": False,
                "error": {"code": "CliNonZeroExit", "message": gemini_client.scrub_key_patterns(stderr_text or f"exit code {completed.returncode}")},
                "classification": gemini_client.classify_429(stderr_text),
            }
        return {"ok": True, "text": completed.stdout.decode("utf-8", errors="replace"), "usage": {}}
    finally:
        if image_path and os.path.exists(image_path):
            try:
                os.remove(image_path)
            except OSError:
                pass
