"""prompts.py — VLM prompt text, isolated so wording can change without
touching `vlm_tier.py`/`figures.py` call sites.
"""
from __future__ import annotations

PAGE_OCR_PROMPT = """You are transcribing a scanned document page to Markdown.

First, identify the page's columns/sections and reading order before
transcribing — do not transcribe left-to-right, top-to-bottom blindly if the
layout is multi-column or has sidebars/callouts.

Rules:
- Output Markdown only, no commentary, no code fences around the whole page.
- Preserve reading order exactly as a human would read the page.
- Render every table as a GitHub-Flavored-Markdown (GFM) pipe table.
- Render inline math as `$...$` and display/block math as `$$...$$`.
- Do not invent content: if a region is illegible, write `[illegible]` rather
  than guessing.
- Do not include any HTML tags, scripts, or hyperlinks — plain Markdown text
  and GFM tables/math only.
"""

FIGURE_CAPTION_PROMPT = """Describe this figure/image in ONE plain-text
sentence (no more). Do not include any URL, filename, or Markdown link
syntax — caption text only.
"""
