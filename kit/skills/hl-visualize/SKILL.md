---
name: hl-visualize
description: "Present data and insights as diagrams, slides, HTML pages, Excel reports, or PDF documents."
when_to_use: "Invoke when generating visual explanations, diagrams, slides, ASCII art, Excel reports, or PDFs for any topic or dataset."
user-invocable: true
argument-hint: "[path|topic] [--explain|--slides|--diagram|--ascii|--html|--diff [ref]|--plan-review [plan]|--recap [timeframe]|--mermaid [type|desc]|--excel [data]|--pdf [topic|form.pdf data.json]|--stop]"
metadata:
  category: workflow
  keywords: [visualize, diagram, chart, slides, presentation, html, ascii, mermaid, excel, pdf]
---

# hl-visualize

## Usage

```text
{skill:hl-visualize} <path>
{skill:hl-visualize} --explain <topic>
{skill:hl-visualize} --diagram <topic>
{skill:hl-visualize} --slides <topic>
{skill:hl-visualize} --ascii <topic>
{skill:hl-visualize} --html --slides <topic>
{skill:hl-visualize} --html --diff [ref]
{skill:hl-visualize} --html --plan-review [plan-file]
{skill:hl-visualize} --html --recap [timeframe]
{skill:hl-visualize} --mermaid [type or description]
{skill:hl-visualize} --excel [data or topic]
{skill:hl-visualize} --pdf [topic]
{skill:hl-visualize} --pdf <form.pdf> <data.json>
{skill:hl-visualize} --stop
```

When invoked with no arguments, use `AskUserQuestion` with header `Visualize Operation`.

## Mode Quick Reference

| Intent | Flag(s) | Output |
|---|---|---|
| Explain | `--explain <topic>` | ASCII + Mermaid + prose |
| Diagram | `--diagram <topic>` / `--mermaid <file.ts>` | Mermaid or `.mmd` |
| Slides / page | `--html --slides <topic>` / `--html --explain <topic>` | HTML |
| Diff / plan / recap | `--html --diff [ref]` / `--plan-review` / `--recap [timeframe]` | HTML review |
| Terminal-only | `--ascii <topic>` | ASCII art |
| Workbook | `--excel [data or topic]` | `.xlsx` |
| PDF | `--pdf [topic\|form.pdf]` | `.pdf` |

## Constraints

> **Required — HTML theme toggle:** Every HTML page must include a light/dark theme toggle button that switches a `data-theme` attribute on `<html>`.

> **Required — inline HTML:** All CSS and JS must be inlined in a single `.html` file. No external dependencies, no server required.

> **Required — visual self-review:** After generating any Mermaid diagram, render it with `npx mmdc -i diagram.mmd -o check.svg` or inside the HTML page, then inspect for overlap, crossed arrows, and routing issues before delivery. Revise broken diagrams before output. See `references/generation-checklist.md`.

## Process

1. **Classify input** in this order: `--stop` → `--excel` (`references/output-excel.md`) → `--pdf` (`references/output-pdf.md`) → `--html` → generation flags (`--explain`, `--slides`, `--diagram`, `--ascii`) → HTML-only flags (`--diff`, `--plan-review`, `--recap`) → existing path → clarification.
2. **Resolve topic/path** — slugify generation topics (lowercase, spaces→hyphens, max 80 chars at a word boundary). `{topic}` stays title-cased.
3. **Dispatch to mode** — use `## --html Mode`, `## --mermaid Mode`, or view mode as appropriate.
4. **Write output** — save HTML to `{plan_dir}/visuals/{slug}.html` (fallback `.agents/visuals/`) and open with `open` / `xdg-open` / `start`. Markdown saves to the report path from `## Naming`.

See `references/process-error-handling.md` for the full error-condition table.

## Code → Diagram

For a source file, select the diagram by detected structure:

| Code pattern detected | Auto-selected diagram type |
|---|---|
| State transitions, enums, event handlers | `stateDiagram-v2` |
| Function call chains, async flows, HTTP requests | `sequenceDiagram` |
| Class definitions, interfaces, inheritance | `classDiagram` |
| Router/middleware/handler chains | `flowchart TD` |
| DB models, foreign keys | `erDiagram` |
| Import graph across files | `flowchart LR` |

Read → detect → select → generate (max 10–12 nodes; summarize larger graphs) → self-review.

## --html Mode

Output: single `.html` file with inline CSS/JS. Multi-section pages (`--explain`, `--diff`, `--plan-review`, `--recap`) should include responsive side navigation. For `--slides`, prefer richer style via `{skill:hl-design}` `scripts/ui-ux/search.py --design-system`.

### HTML-Only Modes

- `--diff [ref]`: summary, KPI dashboard, architecture, comparisons, flow, file map, tests, review cards, decision log.
- `--plan-review [plan-file]`: plan summary, impact dashboard, current vs planned architecture, dependencies, risk, gaps.
- `--recap [timeframe]`: project identity, architecture snapshot, activity, decision log, KPIs, hotspots, next steps.

For Mermaid inside HTML outputs, use `references/lib-mermaid-types.md` and `references/lib-mermaid-config.md`.

## --mermaid Mode

Create standalone Mermaid.js v11 diagrams.

```bash
npx @mermaid-js/mermaid-cli -i diagram.mmd -o diagram.svg
mmdc -i input.mmd -o output.png -t dark -b transparent
```

## --excel Mode

Generate a workbook. Auto-detect:

- existing `.csv` / `.json` / `.xlsx` → transform or enhance
- inline data → create workbook
- topic string → generate a sample/template workbook

Output: `{plan_dir}/visuals/{slug}.xlsx` (fallback `.agents/visuals/`), then open with the default app.

## --pdf Mode

Generate a PDF or fill a form. Auto-detect:

- `--pdf <topic>` → render content to PDF via `weasyprint` or `wkhtmltopdf`
- `--pdf <form.pdf> <data.json>` → fill form fields via `pdftk fill_form`
- `--pdf <form.pdf>` without data → detect fields and ask the user

Output: `{plan_dir}/visuals/{slug}.pdf` (fallback `.agents/visuals/`), then open with the default app.

## Workflow Position

**Follows:** `{skill:hl-write}` — export a finished manuscript to PDF/HTML
**Used alongside:** `{skill:hc-cook}` (explain after implementing), `{skill:hc-plan}` (visualize architecture during planning)
**Auto-invoked by:** `{skill:hc-ship}` — visual diff review before PR creation

## References

| File | Content |
|---|---|
| `references/process-error-handling.md` | Error conditions, fallback actions, and user-facing messages |
| `references/lib-mermaid-types.md` | Syntax for all 24+ Mermaid diagram types |
| `references/lib-mermaid-config.md` | Config options, themes, accessibility settings |
| `references/lib-mermaid-cli.md` | CLI commands, export formats, and batch workflows |
| `references/lib-mermaid-integration.md` | JS API and HTML embedding patterns |
| `references/lib-mermaid-examples.md` | Architecture, API flows, DB schemas, state machine examples |
| `references/output-excel.md` | openpyxl patterns: workbooks, charts, tables, data formatting |
| `references/output-pdf.md` | PDF generation (weasyprint/wkhtmltopdf) and form filling (pdftk) |
| `references/generation-checklist.md` | Pre-delivery quality checklist for all output modes |
