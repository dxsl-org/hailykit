"""vlm_tier.py — tier-2/3 Gemini escalation for pages the local tier flagged.

Flash runs first; output is sanity-checked; a failing flash result promotes
to pro when `max_tier` allows. Circuit breaker: N consecutive quota-exhausted
results stop escalating entirely — remaining flagged pages go `pending` so a
resumed run picks them back up (resume semantics live in manifest.py).

Write-order contract (see manifest.py docstring): page markdown (and any
figure PNGs) are written via `assemble.write_page` / `figures.save_figure_png`
BEFORE `manifest.update_page(..., status="done")` commits. Cost is recorded
ONLY on the call that produces the page's final "done" state — a page that
ends up `pending`/`failed` records no cost_usd, so a later retry never
double-counts spend already reflected in a prior partial attempt. Within a
SINGLE `escalate_page` call, a flash attempt that fails `sanity_check` and
promotes to pro really did spend money at both tiers — that cost is summed
into the one recorded `cost_usd`, which does not conflict with the
resume rule above: it prevents re-billing the SAME work across separate
invocations, not summing two attempts that both genuinely ran once.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any, Callable

import assemble
import figures
import gemini_client
import job_config
import manifest as manifest_mod
import prompts
import provider
import sanitize

logger = logging.getLogger("ocr_engine.vlm_tier")

_TIER_ORDER = ["local", "flash", "pro"]
_DEFAULT_BREAKER_THRESHOLD = 3
_REFUSAL_MARKERS = ("i cannot assist", "i can't assist", "i'm unable to", "as an ai language model")
_MIN_USABLE_LENGTH = 20


@dataclass
class EscalationState:
    """Batch-scoped state shared across every flagged-page call in one run."""

    breaker_threshold: int = _DEFAULT_BREAKER_THRESHOLD
    consecutive_quota_failures: int = 0
    quota_exhausted: bool = False


def _tier_allowed(tier: str, max_tier: str) -> bool:
    return _TIER_ORDER.index(tier) <= _TIER_ORDER.index(max_tier)


def _add_flag(flags: list[str], flag: str) -> list[str]:
    return flags if flag in flags else [*flags, flag]


def sanity_check(markdown_text: str) -> bool:
    """Heuristic pass/fail for flash output — a fail triggers pro promotion.

    Catches: near-empty output, refusal text, unbalanced GFM table pipes, and
    unbalanced $/$$ LaTeX delimiters. Deliberately conservative (may promote
    some pages pro doesn't actually need to fix) — see plan Assumptions.
    """
    stripped = (markdown_text or "").strip()
    if len(stripped) < _MIN_USABLE_LENGTH:
        return False
    lowered = stripped.lower()
    if any(marker in lowered for marker in _REFUSAL_MARKERS):
        return False
    for line in stripped.splitlines():
        line = line.strip()
        if line.startswith("|") and line.count("|") < 2:
            return False
    without_display_math = stripped.replace("$$", "")
    return without_display_math.count("$") % 2 == 0


def _record_quota_result(outcome: dict[str, Any], state: EscalationState) -> None:
    if outcome["classification"] == "quota_exhausted":
        state.consecutive_quota_failures += 1
        if state.consecutive_quota_failures >= state.breaker_threshold:
            state.quota_exhausted = True
    elif outcome["ok"]:
        state.consecutive_quota_failures = 0


def _attempt_tier(
    tier: str, *, page_b64: str, job: job_config.JobConfig, api_key: str, generate_fn: Callable[..., dict[str, Any]]
) -> dict[str, Any]:
    """One tier attempt. `generate_fn` already retries transient errors
    internally and returns only its FINAL outcome, so `cost_usd` here is
    already "final attempt only" by construction. Model/config/adapter come
    from `provider.resolve` (native Gemini + `models[tier]` when no
    `providers`/`tier_provider` is configured — byte-identical to before).
    `generate_fn` stays test-injectable: a non-default override (identity-
    checked against `gemini_client.generate`) replaces only the call, not the
    resolved model/config, so existing tests keep working unmodified."""
    binding = provider.resolve(tier, job.config, api_key)
    fn = binding.generate_fn if generate_fn is gemini_client.generate else generate_fn
    parts = [
        {"text": prompts.PAGE_OCR_PROMPT},
        {"inlineData": {"mimeType": "image/png", "data": page_b64}},
    ]
    result = fn(binding.model, parts, config=binding.config)
    cost = gemini_client.compute_cost_usd(tier, result.get("usage") or {}) if result.get("ok") else 0.0
    return {
        "ok": result.get("ok", False),
        "classification": result.get("classification"),
        "markdown": result.get("text", ""),
        "cost_usd": cost,
        "tier": tier,
        "model": binding.model,
    }


def _crop_and_embed_figures(
    *, doc_dir: str, page_no: int, page_entry: dict[str, Any], page_image: Any, docling_result: Any,
    input_path: str, job: job_config.JobConfig, api_key: str, generate_fn: Callable[..., dict[str, Any]],
) -> tuple[list[str], list[str]]:
    """Best-effort figure crop+caption — never raises past this boundary; a
    crop/caption failure must not fail an otherwise-successful page."""
    if "figure" not in (page_entry.get("content") or []):
        return [], []
    page_size_pt = figures.page_size_points(input_path, page_no)
    if page_size_pt is None:
        return [], []
    try:
        bboxes = figures.extract_figure_bboxes(docling_result, page_no)
        if not bboxes:
            return [], []
        return figures.build_figures(
            doc_dir=doc_dir, page_no=page_no, page_image=page_image, docling_figures=bboxes,
            page_size_pt=page_size_pt, job_config=job.config, api_key=api_key, generate_fn=generate_fn,
        )
    except Exception as exc:  # noqa: broad — figure step is best-effort, never fails the page
        logger.warning("page %d: figure crop/caption failed (%s)", page_no, exc)
        return [], []


def escalate_page(
    *, manifest: dict[str, Any], manifest_path: str, doc_dir: str, page_no: int, page_entry: dict[str, Any],
    docling_result: Any, input_path: str, job: job_config.JobConfig, api_key: str, state: EscalationState,
    generate_fn: Callable[..., dict[str, Any]] = gemini_client.generate,
) -> dict[str, Any]:
    """Escalate one flagged page through flash -> pro. Sole write path for
    escalated pages (atomic_write then manifest.update_page — write-order
    contract above). Never raises: any VLM/IO failure resolves to a manifest
    status, so one bad page never aborts the batch."""
    flags = list(page_entry.get("flags") or [])

    if state.quota_exhausted:
        return manifest_mod.update_page(
            manifest, manifest_path, page_no, status="pending", flags=_add_flag(flags, "quota_exhausted"),
        )

    max_tier = job.config.get("max_tier", "flash")
    try:
        page_image = figures.load_page_image(input_path, page_no)
        page_b64 = figures.image_to_base64_png(page_image)
    except Exception as exc:  # noqa: broad — image load failure must not abort the batch
        logger.warning("page %d: could not load page image for VLM (%s)", page_no, exc)
        return manifest_mod.update_page(manifest, manifest_path, page_no, status="failed", flags=flags)

    want_pro_first = "escalate:bad_image" in flags and (page_entry.get("confidence") or {}).get("grade") == "POOR"
    start_tier = "pro" if want_pro_first and _tier_allowed("pro", max_tier) else "flash"

    outcome = _attempt_tier(start_tier, page_b64=page_b64, job=job, api_key=api_key, generate_fn=generate_fn)
    _record_quota_result(outcome, state)
    attempts = 1

    if outcome["classification"] == "quota_exhausted":
        return manifest_mod.update_page(
            manifest, manifest_path, page_no, status="pending",
            flags=_add_flag(flags, "quota_exhausted"), attempts=attempts,
        )

    promoted = False
    # Real spend at the first tier's attempt — kept even if `outcome` is
    # replaced by the pro attempt below, so a flash call that succeeded (and
    # was billed) is never dropped from the page's recorded cost.
    accumulated_cost = outcome["cost_usd"]
    if outcome["ok"] and start_tier == "flash" and not sanity_check(outcome["markdown"]):
        if not _tier_allowed("pro", max_tier):
            return manifest_mod.update_page(
                manifest, manifest_path, page_no, status="pending",
                flags=_add_flag(flags, "needs:pro"), attempts=attempts,
            )
        pro_outcome = _attempt_tier("pro", page_b64=page_b64, job=job, api_key=api_key, generate_fn=generate_fn)
        _record_quota_result(pro_outcome, state)
        attempts += 1
        if pro_outcome["classification"] == "quota_exhausted":
            return manifest_mod.update_page(
                manifest, manifest_path, page_no, status="pending",
                flags=_add_flag(flags, "quota_exhausted"), attempts=attempts,
            )
        accumulated_cost += pro_outcome["cost_usd"]
        outcome = pro_outcome
        promoted = pro_outcome["ok"]

    if not outcome["ok"]:
        return manifest_mod.update_page(manifest, manifest_path, page_no, status="failed", flags=flags, attempts=attempts)

    sanitized_markdown = sanitize.sanitize_markdown(outcome["markdown"])
    figure_paths, embed_lines = _crop_and_embed_figures(
        doc_dir=doc_dir, page_no=page_no, page_entry=page_entry, page_image=page_image, docling_result=docling_result,
        input_path=input_path, job=job, api_key=api_key, generate_fn=generate_fn,
    )
    if embed_lines:
        sanitized_markdown = sanitized_markdown.rstrip() + "\n\n" + "\n".join(embed_lines) + "\n"

    output_rel = assemble.write_page(doc_dir, page_no, sanitized_markdown)
    result_flags = _add_flag(flags, "promoted:pro") if promoted else flags
    return manifest_mod.update_page(
        manifest, manifest_path, page_no, status="done", tier=outcome["tier"], engine=outcome["model"],
        cost_usd=accumulated_cost, attempts=attempts, flags=result_flags, output=output_rel, figures=figure_paths,
    )


def run_escalation_pass(
    *, manifest: dict[str, Any], manifest_path: str, doc_dir: str, docling_result: Any, input_path: str,
    job: job_config.JobConfig, api_key: str, generate_fn: Callable[..., dict[str, Any]] = gemini_client.generate,
) -> dict[str, Any]:
    """Escalate every `escalate:*`-flagged page. Returns `{"escalated": int,
    "quota_exhausted": bool}` for ocr_engine.py's summary."""
    state = EscalationState(breaker_threshold=job.config.get("quota_breaker_threshold", _DEFAULT_BREAKER_THRESHOLD))
    escalated = 0
    for entry in list(manifest.get("pages", [])):
        flags = entry.get("flags") or []
        if not any(flag.startswith("escalate:") for flag in flags):
            continue
        escalate_page(
            manifest=manifest, manifest_path=manifest_path, doc_dir=doc_dir, page_no=entry["page"], page_entry=entry,
            docling_result=docling_result, input_path=input_path, job=job, api_key=api_key, state=state,
            generate_fn=generate_fn,
        )
        escalated += 1
    return {"escalated": escalated, "quota_exhausted": state.quota_exhausted}
