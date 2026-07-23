"""provider.py — resolves a tier ("flash"/"pro") to a bound VLM client.

Single seam every VLM call site (`vlm_tier.py`, `figures.py`, and
`batch_collect.py`'s Gemini-only Batch config) uses instead of constructing
`gemini_client.GeminiConfig` directly — swaps between the native Gemini REST
adapter, an OpenAI-compatible chat/completions adapter, or a shell-out CLI
adapter purely via job config, with zero change to the
`generate_fn(model, parts, *, config)` calling convention those call sites
already use (every adapter's `generate` matches it — see gemini_client.py,
openai_client.py, cli_client.py).

Backward-compat contract (non-negotiable): a job with no `providers`/
`tier_provider` resolves every tier to native Gemini with `models[tier]`,
`gemini_client.config_from_job`, and the caller's already-resolved API key —
byte-identical to the pre-provider-abstraction code path.
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Any, Callable

import cli_client
import gemini_client
import openai_client


class ProviderConfigError(ValueError):
    """Raised when `tier_provider` names an undefined provider, or a
    `providers` entry has an unrecognized `kind` — a job config problem, not
    a per-page runtime failure, so it is allowed to propagate and fail the
    whole job fast rather than degrade silently per page."""


@dataclass
class ProviderBinding:
    """One resolved provider: a `generate_fn` matching the Gemini call
    convention, the model name to call it with, and the config object that
    `generate_fn` expects (its exact type varies by `kind`)."""

    generate_fn: Callable[..., dict[str, Any]]
    model: str
    config: Any
    kind: str


def _provider_entry(config: dict[str, Any], name: str) -> dict[str, Any]:
    providers = config.get("providers")
    entry = providers.get(name) if isinstance(providers, dict) else None
    if not isinstance(entry, dict):
        raise ProviderConfigError(f"tier_provider names {name!r}, which is not defined in providers")
    return entry


def _tier_provider_name(tier: str, config: dict[str, Any]) -> str | None:
    tier_provider = config.get("tier_provider")
    name = tier_provider.get(tier) if isinstance(tier_provider, dict) else None
    return name if isinstance(name, str) and name else None


def provider_kind_for_tier(tier: str, config: dict[str, Any]) -> str:
    """`"gemini"` unless `tier_provider[tier]` names a configured provider of
    a different kind — used by `batch_api.flash_provider_is_gemini` to gate
    Batch-API eligibility without resolving a full binding (no API key
    needed just to answer "which kind")."""
    name = _tier_provider_name(tier, config)
    if name is None:
        return "gemini"
    return str(_provider_entry(config, name).get("kind", "gemini"))


def resolve(tier: str, config: dict[str, Any], api_key: str | None) -> ProviderBinding:
    """Resolve `tier` to its bound provider. `api_key` is the native Gemini
    key the caller already resolved (`gemini_client.resolve_api_key()`) —
    reused as the default/gemini-kind key; a non-gemini provider reads its
    OWN key via its own `api_key_env` and ignores this parameter entirely."""
    name = _tier_provider_name(tier, config)
    if name is None:
        model = config["models"][tier]
        return ProviderBinding(
            generate_fn=gemini_client.generate, model=model,
            config=gemini_client.config_from_job(config, api_key or ""), kind="gemini",
        )

    entry = _provider_entry(config, name)
    kind = entry.get("kind")
    model = str(entry.get("model") or config["models"].get(tier, ""))

    if kind == "gemini":
        key_env = entry.get("api_key_env")
        key = (os.environ.get(key_env, "") if isinstance(key_env, str) and key_env else "") or (api_key or "")
        return ProviderBinding(
            generate_fn=gemini_client.generate, model=model,
            config=gemini_client.config_from_job(config, key), kind="gemini",
        )
    if kind == "openai":
        return ProviderBinding(
            generate_fn=openai_client.generate, model=model,
            config=openai_client.config_from_job(config, entry), kind="openai",
        )
    if kind == "cli":
        return ProviderBinding(
            generate_fn=cli_client.generate, model=model,
            config=cli_client.config_from_job(config, entry), kind="cli",
        )
    raise ProviderConfigError(f"provider {name!r} has unknown kind {kind!r}")


def resolve_gemini_only(tier: str, config: dict[str, Any], api_key: str | None) -> gemini_client.GeminiConfig:
    """Like `resolve` but for Gemini-only network paths (the Batch/File API,
    see `batch_collect.py`) that can never hand a non-Gemini adapter's config
    object to `batch_api.request` — falls back to the plain default Gemini
    config if `tier`'s resolved provider isn't `kind=="gemini"`, so a
    provider-kind config drift between batch submit and a later `--collect`
    run can't crash on a missing attribute."""
    binding = resolve(tier, config, api_key)
    return binding.config if binding.kind == "gemini" else gemini_client.config_from_job(config, api_key or "")
