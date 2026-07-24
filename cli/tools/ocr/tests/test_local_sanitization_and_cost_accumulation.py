"""test_local_sanitization_and_cost_accumulation.py — regression coverage for
two production-readiness findings the mocked/live-API-free suite could not
catch on its own (docling and the live Gemini API are both absent here):

1. batch.py's local tier (docling output) must be sanitized before it's
   written to pages/NNNN.md and folded into document.md — the same trust
   boundary vlm_tier.py/batch_collect.py already enforce for VLM output.
2. vlm_tier.py's flash-then-pro promotion must sum both tiers' cost into the
   page's recorded cost_usd — a flash call that succeeds (and is billed)
   must not be silently dropped when sanity_check fails and pro is tried.

Run standalone (stdlib `unittest` only, no pytest/docling/opencv/pypdfium2
needed — every external boundary below is faked): from the repo root,

    <venv-python> -m unittest discover -s cli/tools/ocr/tests -p "test_*.py" -v

using whichever python has this tool on its import path (any python3 works;
this suite needs none of docling/opencv/pypdfium2 since local_tier.py and
quality_gate.py both lazy-import those inside functions, not at module
level). NOT wired into `npm test` — that runs the Node/TS suite only.
"""
from __future__ import annotations

import json
import os
import sys
import tempfile
import unittest
from unittest import mock

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import assemble  # noqa: E402
import batch  # noqa: E402
import job_config  # noqa: E402
import vlm_tier  # noqa: E402


class LocalTierSanitizationTest(unittest.TestCase):
    """CRITICAL finding: batch.py's local-tier write path had no sanitize call
    (only the VLM tiers were guarded), so docling output reached disk raw."""

    def test_malicious_docling_output_is_neutralized_before_write(self) -> None:
        malicious = (
            "<script>alert(1)</script>\n\n"
            "![beacon](http://evil.example/x.png)\n\n"
            "Safe transcribed text."
        )
        job = job_config.JobConfig(input="in.pdf", output="out", config=dict(job_config.DEFAULT_CONFIG))

        with tempfile.TemporaryDirectory() as tmp:
            doc_dir = os.path.join(tmp, "doc")
            assemble.ensure_doc_layout(doc_dir)
            manifest_path = os.path.join(doc_dir, "manifest.json")
            manifest: dict = {"pages": [], "totals": {}}

            with mock.patch("batch.quality_gate.compute_page_quality", return_value={"quality": {}, "bad_image": False}), \
                 mock.patch("batch.local_tier.page_confidence", return_value={"layout": 0.9, "ocr": 0.9, "grade": "GOOD"}), \
                 mock.patch("batch.local_tier.page_content_types", return_value=[]), \
                 mock.patch("batch.local_tier.page_markdown", return_value=malicious):
                batch._run_local_page(
                    job=job, manifest=manifest, manifest_path=manifest_path, doc_dir=doc_dir,
                    docling_result=object(), docling_ver="9.9.9", page_no=1, image=None, dpi=None,
                    prior_attempts=0, emit_fn=lambda _e: None, slug="doc",
                )

            with open(os.path.join(doc_dir, "pages", "0001.md"), "r", encoding="utf-8") as fh:
                page_text = fh.read()

            self.assertNotIn("<script", page_text)
            self.assertNotIn("evil.example", page_text)
            self.assertIn("beacon", page_text)  # alt text survives as plain text, not as a live image tag

            document_text = assemble.regenerate_document(doc_dir)
            self.assertNotIn("<script", document_text)
            self.assertNotIn("evil.example", document_text)


class EscalationCostAccumulationTest(unittest.TestCase):
    """MAJOR finding: a flash attempt that is billed, fails sanity_check, and
    promotes to pro previously left only pro's cost on the page - flash's
    real spend was silently dropped from totals.cost_usd."""

    def test_page_cost_sums_flash_and_pro_when_flash_fails_sanity_check(self) -> None:
        job = job_config.JobConfig(
            input="in.pdf", output="out",
            config={**dict(job_config.DEFAULT_CONFIG), "models": {"flash": "flash-model", "pro": "pro-model"}, "max_tier": "pro"},
        )
        page_entry = {"page": 1, "flags": [], "confidence": {"grade": "FAIR"}, "content": [], "attempts": 0}
        manifest: dict = {"pages": [dict(page_entry)], "totals": {}}

        def fake_generate(model, _parts, *, config):
            del config
            if model == "flash-model":
                # Below sanity_check's minimum usable length -> triggers pro promotion.
                return {"ok": True, "text": "x", "usage": {"promptTokenCount": 1000, "candidatesTokenCount": 1000}}
            if model == "pro-model":
                return {"ok": True, "text": "A" * 50, "usage": {"promptTokenCount": 2000, "candidatesTokenCount": 2000}}
            raise AssertionError(f"unexpected model {model!r}")

        with tempfile.TemporaryDirectory() as tmp:
            doc_dir = os.path.join(tmp, "doc")
            assemble.ensure_doc_layout(doc_dir)
            manifest_path = os.path.join(doc_dir, "manifest.json")
            state = vlm_tier.EscalationState()

            with mock.patch("vlm_tier.figures.load_page_image", return_value="fake-image"), \
                 mock.patch("vlm_tier.figures.image_to_base64_png", return_value="ZmFrZQ=="):
                result = vlm_tier.escalate_page(
                    manifest=manifest, manifest_path=manifest_path, doc_dir=doc_dir, page_no=1,
                    page_entry=page_entry, docling_result=None, input_path="unused.pdf", job=job,
                    api_key="test-key", state=state, generate_fn=fake_generate,
                )

        self.assertEqual(result["status"], "done")
        self.assertEqual(result["tier"], "pro")
        flash_cost = round(0.10 * (1000 / 1_000_000) + 0.40 * (1000 / 1_000_000), 6)
        pro_cost = round(1.25 * (2000 / 1_000_000) + 5.00 * (2000 / 1_000_000), 6)
        self.assertAlmostEqual(result["cost_usd"], flash_cost + pro_cost, places=6)
        self.assertGreater(result["cost_usd"], pro_cost)  # would fail pre-fix: only pro's cost was recorded


class ConfidenceMappingTest(unittest.TestCase):
    """Live-docling smoke test surfaced two mapping bugs the mocked suite hid:
    docling's `grade` is a QualityGrade enum (`str()` → 'QualityGrade.GOOD',
    which no longer matches GRADE_ORDER and collapses to POOR → spurious
    escalate:low_grade), and `ocr_score` is NaN for born-digital pages (invalid
    JSON). Both are pure mapping and testable without docling installed."""

    def test_grade_enum_normalized_to_bare_name(self) -> None:
        import local_tier

        class _Grade:
            name = "GOOD"

            def __str__(self) -> str:
                return "QualityGrade.GOOD"

        self.assertEqual(local_tier._grade_name(_Grade()), "GOOD")
        self.assertEqual(local_tier._grade_name("QualityGrade.EXCELLENT"), "EXCELLENT")
        self.assertEqual(local_tier._grade_name("fair"), "FAIR")

    def test_nan_score_becomes_none_not_nan(self) -> None:
        import local_tier

        self.assertIsNone(local_tier._finite_score(float("nan")))
        self.assertIsNone(local_tier._finite_score(None))
        self.assertEqual(local_tier._finite_score(0.63582), 0.6358)

    def test_page_confidence_maps_enum_and_nan(self) -> None:
        import local_tier

        class _Score:
            layout_score = 0.6358
            ocr_score = float("nan")
            grade = "QualityGrade.GOOD"

        class _Report:
            pages = {1: _Score()}

        class _Result:
            confidence = _Report()

        conf = local_tier.page_confidence(_Result(), 1)
        self.assertEqual(conf["grade"], "GOOD")
        self.assertIsNone(conf["ocr"])  # NaN → null, keeps manifest JSON valid
        self.assertEqual(conf["layout"], 0.6358)
        json.dumps(conf)  # must not raise (no NaN token)


class EscalationCeilingTest(unittest.TestCase):
    """A flagged page can never be serviced at max_tier=local, so it must not
    count as pending work — otherwise document.md never commits and the doc
    never dedup-skips on re-run."""

    def test_local_ceiling_does_not_block_completion(self) -> None:
        import manifest as manifest_mod

        entry = {"page": 1, "status": "done", "tier": "local", "flags": ["escalate:low_grade"]}
        self.assertFalse(manifest_mod.needs_escalation(entry, 3, "local"))
        self.assertTrue(manifest_mod.needs_escalation(entry, 3, "flash"))
        manifest = {"pages": [entry]}
        self.assertFalse(manifest_mod.has_pending_work(manifest, 3, "local"))
        self.assertTrue(manifest_mod.has_pending_work(manifest, 3, "pro"))


if __name__ == "__main__":
    unittest.main()
