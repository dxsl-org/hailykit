---
name: hc-docs
description: "Manage project docs, extract from external PDFs/Office/images using native multimodal reading, generate llms.txt for AI-friendly site indexes."
when_to_use: "Invoke when generating or updating project documentation, codebase summaries, PDRs, or generating llms.txt for AI consumption."
user-invocable: true
argument-hint: "init|update|summarize|extract|llms"
metadata:
  category: workflow
  keywords: [documentation, init, update, summarize, pdf-extract, ocr, llms-txt, ai-context]
---

# Docs — Documentation Management & Extraction

Two responsibilities: (1) generate and update project docs in `./docs/`; (2) extract content from external PDFs, Office docs, and images using native multimodal reading.

## Usage

```
{skill:hc-docs} <subcommand> [args]
```

| Subcommand | Purpose |
|---|---|
| `init` | Analyze codebase, create initial docs |
| `update` | Analyze changes, update existing docs |
| `summarize` | Quick codebase summary update |
| `extract <file>` | Extract content from PDF/Office/image → markdown |
| `llms [path] [--full]` | Generate `llms.txt` AI-friendly site index |
| _(empty)_ | Present options via `AskUserQuestion` |

## Constraints

> **Required — docs only:** This skill produces documentation artifacts. Do not write or modify implementation code from this skill.

## Routing

Parse `$ARGUMENTS` first word:

| Subcommand | Reference | Purpose |
|------------|-----------|---------|
| `init` | `references/init-workflow.md` | Analyze codebase, create initial docs |
| `update` | `references/update-workflow.md` | Analyze changes, update existing docs |
| `summarize` | `references/summarize-workflow.md` | Quick codebase summary update |
| `extract <file>` | (see below) | Extract content from PDF/Office/image |
| `llms [path] [--full]` | (see below) | Generate llms.txt for AI-friendly site index |
| _(empty)_ | `AskUserQuestion` | Present options — do not auto-run `init` |

## External Document Extraction (`extract`)

Converts external documents (not project docs) to structured markdown using native multimodal reading:

Read PDF/Office/image files directly using the native Read tool. For PDFs: specify the `pages` parameter for large documents (e.g., `pages: "1-10"`). For images: Read the file to extract visual content. For Office docs: see `references/extract-office-docs.md` for format-specific tools.

**Use cases:** invoices, contracts, reports (PDF → structured markdown) · OCR scanned documents · Office docs → markdown · multi-page layout-aware parsing.

For extracting content from Word/PDF/PowerPoint/Excel: see `references/extract-office-docs.md`.

## llms.txt Generation (`llms`)

Generates `llms.txt` / `llms-full.txt` per the [llmstxt.org](https://llmstxt.org) spec — an AI-friendly documentation index (like `sitemap.xml` but for LLMs). Used by AI tools (including `{skill:hc-lookup}` via context7) to understand a project's doc structure.

```bash
# Basic — scan ./docs and generate llms.txt at project root
{skill:hc-docs} llms

# With base URL (for published sites)
{skill:hc-docs} llms --url https://example.com/docs

# Also generate llms-full.txt (inline content, larger)
{skill:hc-docs} llms --full

# Custom output location
{skill:hc-docs} llms /path/to/docs --output /path/to/output
```

```bash
# Script
python scripts/generate-llms-txt.py --source <path> --output <output-path> --base-url <url> [--full]
```

See `references/llms-txt-specification.md` for full format spec and validation rules.

## Docs Directory

```
./docs/
├── project-overview-pdr.md
├── code-standards.md
├── codebase-summary.md
├── design-guidelines.md
├── deployment-guide.md
├── system-architecture.md
└── project-roadmap.md
```

## Workflow Position

**Follows:** `{skill:hc-cook}` — document after implementing
**Follows:** `{skill:hc-ship}` — update docs before releasing
**Setup:** `init` subcommand runs at project start, before any implementation
**Related:** `{skill:hc-review}`, `{skill:hc-new}`
