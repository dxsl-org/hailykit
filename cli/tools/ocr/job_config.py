"""job_config.py — job schema parse + defaults (contract for phases 2-5).

Field names and defaults here are read by every later phase (VLM escalation,
batch runner, CLI). Do not rename without updating manifest.py and the
phase-01 plan's Manifest v1 contract.
"""
from __future__ import annotations

import json
import os
from dataclasses import dataclass
from typing import Any

# Ascending quality order — index comparison drives escalate_below_grade.
# Unknown/missing grades map to index 0 (worst) so they always escalate
# rather than silently passing review.
GRADE_ORDER = ["POOR", "FAIR", "GOOD", "EXCELLENT"]

DEFAULT_MODELS = {
    "flash": "gemini-3.5-flash-lite",
    "pro": "gemini-3.1-pro-preview",
}

DEFAULT_CONFIG: dict[str, Any] = {
    "blur_min": 100,
    "escalate_below_grade": "FAIR",
    "route_tables_to_vlm": True,
    "models": DEFAULT_MODELS,
    "max_tier": "flash",
    "ocr_lang": ["en"],
    # Bare-image gate substitute for DPI (no page/point concept on a raw
    # raster) — not in the phase spec's explicit default list, added because
    # the pixel-dims/long-edge branch needs a threshold. See Deviation Log.
    "long_edge_min": 1000,
}


class JobConfigError(ValueError):
    """Raised when a job file is missing required fields or is malformed."""


@dataclass
class JobConfig:
    input: str
    output: str
    config: dict[str, Any]

    def grade_index(self, grade: str | None) -> int:
        try:
            return GRADE_ORDER.index((grade or "").upper())
        except ValueError:
            return 0

    def is_below_escalation_grade(self, grade: str | None) -> bool:
        threshold = self.config.get("escalate_below_grade", "FAIR")
        return self.grade_index(grade) < self.grade_index(threshold)


def load_job(job_path: str) -> JobConfig:
    """Parse + validate a job JSON file, filling in defaults for `config`.

    Raises JobConfigError for schema problems (missing/invalid fields);
    FileNotFoundError / json.JSONDecodeError propagate as-is so the caller's
    single error-handling boundary (ocr_engine.main) reports them uniformly.
    """
    with open(job_path, "r", encoding="utf-8") as fh:
        raw = json.load(fh)

    if not isinstance(raw, dict):
        raise JobConfigError("job file must contain a JSON object")

    input_path = raw.get("input")
    output_path = raw.get("output")
    if not isinstance(input_path, str) or not input_path:
        raise JobConfigError("job.input is required and must be a non-empty string")
    if not isinstance(output_path, str) or not output_path:
        raise JobConfigError("job.output is required and must be a non-empty string")
    if not os.path.isfile(input_path):
        raise JobConfigError(f"job.input does not exist or is not a file: {input_path!r}")

    merged_config = dict(DEFAULT_CONFIG)
    user_config = raw.get("config")
    if isinstance(user_config, dict):
        merged_config.update(user_config)
        # models is itself a map — merge so a partial override doesn't drop
        # the other tier's default model.
        if isinstance(user_config.get("models"), dict):
            merged_config["models"] = {**DEFAULT_MODELS, **user_config["models"]}

    ocr_lang = merged_config.get("ocr_lang")
    if not isinstance(ocr_lang, list) or not ocr_lang or not all(isinstance(x, str) for x in ocr_lang):
        raise JobConfigError("config.ocr_lang must be a non-empty list of strings")

    return JobConfig(input=input_path, output=output_path, config=merged_config)
