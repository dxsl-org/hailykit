"""sanitize.py — the trust boundary between VLM output and disk.

Document content is untrusted input end-to-end: a page image can carry
adversarial text that survives OCR/transcription. Every function here is
pure (no I/O) so it's directly unit-testable, and `vlm_tier.py` MUST run
page markdown and captions through here before any `atomic_write` call —
no VLM text reaches disk unsanitized.
"""
from __future__ import annotations

import re

_SCRIPT_STYLE_RE = re.compile(r"<(script|style)\b[^>]*>.*?</\1>", re.IGNORECASE | re.DOTALL)
_HTML_TAG_RE = re.compile(r"<[^>]+>")
_LINK_RE = re.compile(r"(!?)\[([^\]]*)\]\(([^)]*)\)")
_URL_TEXT_RE = re.compile(r"(https?://|www\.)\S*", re.IGNORECASE)

_DANGEROUS_SCHEMES = ("javascript:", "data:", "vbscript:")
_REMOTE_PREFIXES = ("http://", "https://", "//", "ftp://") + _DANGEROUS_SCHEMES

DEFAULT_CAPTION_MAX_LENGTH = 200


def strip_html(text: str) -> str:
    """Remove `<script>`/`<style>` blocks (with their content) and any other raw HTML tags.

    Legitimate transcription never needs raw HTML — GFM tables and $/$$ LaTeX
    are plain text — so removing all tags is safe, not just script/style.
    """
    text = _SCRIPT_STYLE_RE.sub("", text or "")
    return _HTML_TAG_RE.sub("", text)


def _is_remote_or_dangerous(target: str) -> bool:
    lowered = target.strip().lower()
    return any(lowered.startswith(prefix) for prefix in _REMOTE_PREFIXES)


def _is_allowed_figure_target(target: str) -> bool:
    stripped = target.strip()
    return stripped.startswith("figures/") and ".." not in stripped and not _is_remote_or_dangerous(stripped)


def neutralize_links(text: str) -> str:
    """Strip markdown link/image syntax down to plain text for any target that
    is a dangerous scheme (`javascript:`, `data:`, `vbscript:`) or a remote URL.

    Images are held to a stricter allowlist: only relative `figures/...`
    paths survive as images (that's the only thing `figures.py` ever writes);
    everything else collapses to the alt text (or a placeholder if empty).
    Local, non-remote links (e.g. `[x](notes.md)`) are left intact — they
    carry no egress or script-execution risk.
    """
    def _replace(match: re.Match[str]) -> str:
        is_image = match.group(1) == "!"
        label, target = match.group(2), match.group(3)
        if is_image:
            return match.group(0) if _is_allowed_figure_target(target) else (label or "[image removed]")
        return label if _is_remote_or_dangerous(target) else match.group(0)

    return _LINK_RE.sub(_replace, text or "")


def sanitize_markdown(text: str) -> str:
    """Full sanitizer for VLM page transcription — call this before any write."""
    return neutralize_links(strip_html(text))


def sanitize_caption(text: str, max_length: int = DEFAULT_CAPTION_MAX_LENGTH) -> str:
    """Caption constraint: plain text only — no HTML, no links, no bare URLs,
    no `](` sequence, length-capped.
    """
    text = neutralize_links(strip_html(text or ""))
    text = _URL_TEXT_RE.sub("", text)
    text = text.replace("](", ") (")  # defang any residual markdown-link syntax
    text = " ".join(text.split())
    if len(text) > max_length:
        text = text[:max_length].rstrip() + "…"
    return text
