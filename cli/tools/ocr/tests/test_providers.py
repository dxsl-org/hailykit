"""test_providers.py — regression coverage for the multi-provider VLM tier
abstraction (`provider.py`, `openai_client.py`, `cli_client.py`): the seam
that lets a tier resolve to a native Gemini, OpenAI-compatible, or shell-out
CLI adapter without changing `vlm_tier.py`/`figures.py`'s call sites.

Run standalone (stdlib `unittest` only): from the repo root,

    <venv-python> -m unittest discover -s cli/tools/ocr/tests -p "test_*.py" -v
"""
from __future__ import annotations

import base64
import json
import os
import sys
import unittest
import urllib.error
from unittest import mock

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import cli_client  # noqa: E402
import gemini_client  # noqa: E402
import job_config  # noqa: E402
import openai_client  # noqa: E402
import provider  # noqa: E402


class OpenAIClientTest(unittest.TestCase):
    def test_builds_chat_completions_request_and_bearer_auth(self) -> None:
        os.environ["TEST_OPENAI_KEY"] = "sk-test-key-value"
        try:
            entry = {"base_url": "https://api.example.com/v1", "api_key_env": "TEST_OPENAI_KEY"}
            config = openai_client.config_from_job({}, entry)
            captured: dict = {}

            class FakeResponse:
                def __enter__(self):
                    return self

                def __exit__(self, *_a):
                    return False

                def read(self):
                    body = {"choices": [{"message": {"content": "hello"}}], "usage": {"prompt_tokens": 5}}
                    return json.dumps(body).encode("utf-8")

            def fake_urlopen(request, timeout=None):
                del timeout
                captured["url"] = request.full_url
                captured["headers"] = {k.lower(): v for k, v in request.headers.items()}
                captured["body"] = json.loads(request.data.decode("utf-8"))
                return FakeResponse()

            parts = [{"text": "describe"}, {"inlineData": {"mimeType": "image/png", "data": "Zm9v"}}]
            with mock.patch("openai_client.urllib.request.urlopen", fake_urlopen):
                result = openai_client.generate("gpt-vision", parts, config=config)

            self.assertTrue(result["ok"])
            self.assertEqual(result["text"], "hello")
            self.assertEqual(captured["url"], "https://api.example.com/v1/chat/completions")
            self.assertEqual(captured["headers"]["authorization"], "Bearer sk-test-key-value")
            self.assertEqual(captured["body"]["model"], "gpt-vision")
            content = captured["body"]["messages"][0]["content"]
            self.assertEqual(content[0], {"type": "text", "text": "describe"})
            self.assertEqual(content[1]["image_url"]["url"], "data:image/png;base64,Zm9v")
        finally:
            del os.environ["TEST_OPENAI_KEY"]

    def test_key_scrubbed_from_error(self) -> None:
        os.environ["TEST_OPENAI_KEY_2"] = "sk-should-not-leak"
        try:
            entry = {"base_url": "https://api.example.com/v1", "api_key_env": "TEST_OPENAI_KEY_2"}
            config = openai_client.config_from_job({"max_retries": 1}, entry)

            def fake_urlopen(request, timeout=None):
                del request, timeout
                raise urllib.error.URLError("connection refused sk-should-not-leak")

            with mock.patch("openai_client.urllib.request.urlopen", fake_urlopen):
                result = openai_client.generate("m", [{"text": "x"}], config=config)

            self.assertFalse(result["ok"])
            self.assertNotIn("sk-should-not-leak", result["error"]["message"])
        finally:
            del os.environ["TEST_OPENAI_KEY_2"]


class CliClientTest(unittest.TestCase):
    def test_substitutes_placeholders_and_returns_stdout(self) -> None:
        script = "import sys; print('MODEL=' + sys.argv[1]); print('PROMPT=' + sys.argv[2])"
        entry = {"command": [sys.executable, "-c", script, "{model}", "{prompt}"]}
        config = cli_client.config_from_job({}, entry)
        parts = [
            {"text": "hello world"},
            {"inlineData": {"mimeType": "image/png", "data": base64.b64encode(b"fake-png").decode("ascii")}},
        ]

        result = cli_client.generate("my-model", parts, config=config)

        self.assertTrue(result["ok"])
        self.assertIn("MODEL=my-model", result["text"])
        self.assertIn("PROMPT=hello world", result["text"])

    def test_nonzero_exit_scrubs_stderr(self) -> None:
        fake_key = "AIza" + "0" * 35
        script = f"import sys; sys.stderr.write('token {fake_key}'); sys.exit(1)"
        entry = {"command": [sys.executable, "-c", script]}
        config = cli_client.config_from_job({}, entry)

        result = cli_client.generate("m", [{"text": "x"}], config=config)

        self.assertFalse(result["ok"])
        self.assertNotIn(fake_key, result["error"]["message"])
        self.assertIn("[REDACTED]", result["error"]["message"])

    def test_missing_executable_is_a_typed_error_not_a_raise(self) -> None:
        entry = {"command": ["hailykit-ocr-definitely-not-a-real-binary"]}
        config = cli_client.config_from_job({}, entry)

        result = cli_client.generate("m", [{"text": "x"}], config=config)

        self.assertFalse(result["ok"])
        self.assertEqual(result["error"]["code"], "CliExecutableNotFound")


class ProviderResolveTest(unittest.TestCase):
    def test_default_config_uses_gemini_and_models_tier(self) -> None:
        """No `providers`/`tier_provider` configured -> identical to the
        pre-abstraction code path: native Gemini, `models[tier]`, caller's key."""
        config = dict(job_config.DEFAULT_CONFIG)
        binding = provider.resolve("flash", config, "test-api-key")
        self.assertEqual(binding.kind, "gemini")
        self.assertIs(binding.generate_fn, gemini_client.generate)
        self.assertEqual(binding.model, job_config.DEFAULT_MODELS["flash"])
        self.assertEqual(binding.config.api_key, "test-api-key")

    def test_tier_provider_routes_to_openai(self) -> None:
        os.environ["TEST_PROV_KEY"] = "sk-abc"
        try:
            config = {
                **dict(job_config.DEFAULT_CONFIG),
                "providers": {"or": {"kind": "openai", "model": "vision-1", "base_url": "https://x/v1", "api_key_env": "TEST_PROV_KEY"}},
                "tier_provider": {"flash": "or"},
            }
            binding = provider.resolve("flash", config, "unused-gemini-key")
            self.assertEqual(binding.kind, "openai")
            self.assertIs(binding.generate_fn, openai_client.generate)
            self.assertEqual(binding.model, "vision-1")
            self.assertEqual(binding.config.api_key, "sk-abc")
        finally:
            del os.environ["TEST_PROV_KEY"]

    def test_tier_provider_routes_to_cli(self) -> None:
        config = {
            **dict(job_config.DEFAULT_CONFIG),
            "providers": {"local-cli": {"kind": "cli", "model": "m", "command": [sys.executable, "-c", "print(1)"]}},
            "tier_provider": {"pro": "local-cli"},
        }
        binding = provider.resolve("pro", config, None)
        self.assertEqual(binding.kind, "cli")
        self.assertIs(binding.generate_fn, cli_client.generate)
        self.assertEqual(binding.model, "m")

    def test_unmapped_tier_falls_back_to_gemini(self) -> None:
        config = {
            **dict(job_config.DEFAULT_CONFIG),
            "providers": {"or": {"kind": "openai", "base_url": "https://x/v1", "api_key_env": "K"}},
            "tier_provider": {"flash": "or"},
        }
        binding = provider.resolve("pro", config, "gemini-key")
        self.assertEqual(binding.kind, "gemini")
        self.assertEqual(binding.model, job_config.DEFAULT_MODELS["pro"])

    def test_unknown_provider_kind_raises_config_error(self) -> None:
        config = {
            **dict(job_config.DEFAULT_CONFIG),
            "providers": {"bad": {"kind": "not-a-real-kind"}},
            "tier_provider": {"flash": "bad"},
        }
        with self.assertRaises(provider.ProviderConfigError):
            provider.resolve("flash", config, "key")


if __name__ == "__main__":
    unittest.main()
