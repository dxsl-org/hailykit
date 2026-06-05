---
name: hl-visualize
description: "Present data and insights as diagrams, slides, HTML pages, Excel reports, or PDF documents."
when_to_use: "Invoke when generating visual explanations, diagrams, slides, ASCII art, Excel reports, or PDFs for any topic or dataset."
user-invocable: true
argument-hint: "[path] | [--html] --explain|--slides|--diagram|--ascii <topic> | --html --diff|--plan-review|--recap | --excel [data/topic] | --pdf [content|form.pdf]"
metadata:
  category: dev-tools
  keywords: [visualize, diagram, architecture, slides, HTML, explain, excel, xlsx, pdf, report, presentation]
---

# hl:visualize — Presentation & Visual Generator

Universal output generator. View files and directories, or produce any presentation-ready format: diagrams, slides, HTML pages, Excel reports, or PDFs.

## Usage

```
{skill:hl-visualize} <file.md>                         # view markdown in novel-reader UI
{skill:hl-visualize} <directory/>                       # browse directory contents
{skill:hl-visualize} --explain <topic>                  # visual explanation (ASCII + Mermaid + prose)
{skill:hl-visualize} --diagram <topic>                  # focused diagram (ASCII + Mermaid)
{skill:hl-visualize} --slides <topic>                   # presentation slides
{skill:hl-visualize} --ascii <topic>                    # ASCII-only, terminal-friendly
{skill:hl-visualize} --html --explain <topic>           # self-contained HTML explanation
{skill:hl-visualize} --html --slides <topic>            # magazine-quality HTML slide deck
{skill:hl-visualize} --html --diagram <topic>           # HTML diagram with zoom controls
{skill:hl-visualize} --html --diff [ref]                # visual diff review
{skill:hl-visualize} --html --plan-review [plan-file]   # plan vs codebase comparison
{skill:hl-visualize} --html --recap [timeframe]         # project context snapshot
{skill:hl-visualize} --mermaid [type or description]    # standalone Mermaid v11 diagram
{skill:hl-visualize} --excel [data or topic]            # Excel report with charts/tables (.xlsx)
{skill:hl-visualize} --pdf [topic]                      # generate PDF from content
{skill:hl-visualize} --pdf <form.pdf> <data.json>       # fill PDF form fields
{skill:hl-visualize} --stop                             # stop running preview server
```

When invoked with no arguments, use `AskUserQuestion` (header: "Visualize Operation") to present the mode table above.

## Mode Quick Reference

Pick the row that matches your intent:

| I want to… | Flag(s) | Output |
|---|---|---|
| Explain a concept visually | `--explain <topic>` | ASCII + Mermaid + prose |
| Focused diagram only | `--diagram <topic>` | ASCII + Mermaid |
| Presentation-quality slides | `--html --slides <topic>` | HTML slide deck |
| Architecture diagram from code | `--diagram <file.ts>` or `--mermaid <file.ts>` | Mermaid diagram |
| State machine from code | `--mermaid <file.ts>` | Mermaid stateDiagram-v2 |
| Sequence diagram from code | `--mermaid <file.ts>` | Mermaid sequenceDiagram |
| Terminal-friendly (no HTML) | `--ascii <topic>` | Plain ASCII art |
| Self-contained HTML page | `--html --explain <topic>` | HTML with zoom/nav |
| What changed in this PR/branch | `--html --diff [ref]` | Visual diff review |
| Review plan against codebase | `--html --plan-review` | Plan vs reality |
| Project snapshot / handoff | `--html --recap [timeframe]` | Project context |
| Standalone Mermaid v11 diagram | `--mermaid [type or desc]` | `.mmd` or inline |
| Excel report with charts | `--excel [data or topic]` | `.xlsx` workbook |
| PDF document or form fill | `--pdf [topic\|form.pdf]` | `.pdf` |

## Constraints

> **Required — HTML theme toggle:** Every HTML output page MUST include a light/dark theme toggle button. Pages missing the toggle are incomplete. Implement with a `<button>` that toggles a `data-theme` attribute on `<html>`, with CSS variables switching between light/dark palettes.

> **Required — inline HTML:** All CSS and JS must be inlined in the single `.html` output file. No external dependencies, no server required.

> **Required — visual self-review:** After generating any Mermaid diagram, render it (via `npx mmdc -i diagram.mmd -o /tmp/check.svg` or in the HTML page itself) and inspect for node overlap, crossed arrows, and layout issues before delivering. A diagram that cannot be rendered or has obvious routing problems must be revised before output. See `references/generation-checklist.md`.

## Process

1. **Classify input** — resolve in priority order:
   - `--stop` → stop server, exit
   - `--excel` → Excel output mode; load `references/output-excel.md`
   - `--pdf` → PDF output mode; load `references/output-pdf.md`
   - `--html` present → set HTML output mode flag, continue
   - Generation flags (`--explain`, `--slides`, `--diagram`, `--ascii`) → generation mode
   - HTML-only flags (`--diff`, `--plan-review`, `--recap`) → auto-set HTML mode, then generation mode
   - Argument resolves to an existing path → view mode
   - Argument unresolvable → ask user to clarify

2. **Resolve topic/path** — for generation: convert topic to slug (lowercase, spaces→hyphens, max 80 chars at word boundary). Placeholder `{topic}` is replaced with original input in title case (not slug).

3. **Dispatch to mode** — see `## --html Mode` for HTML generation, `## --mermaid Mode` for Mermaid, or view mode for file/directory rendering.

4. **Write output** — HTML: save to `{plan_dir}/visuals/{slug}.html` (falls back to `.agents/visuals/`), then open in browser (`open`/`xdg-open`/`start`). Markdown: save to report path from session `## Naming` injection.

See `references/process-error-handling.md` for the full error-condition table.

## Code → Diagram Workflow

When the argument resolves to an existing source file, read its content and auto-detect the most appropriate diagram type:

| Code pattern detected | Auto-selected diagram type |
|---|---|
| State transitions, enums, event handlers | `stateDiagram-v2` |
| Function call chains, async flows, HTTP requests | `sequenceDiagram` |
| Class definitions, interfaces, inheritance | `classDiagram` |
| Router/middleware/handler chains | `flowchart TD` |
| DB models, foreign keys | `erDiagram` |
| Import graph across files | `flowchart LR` (dependency graph) |

```
{skill:hl-visualize} --diagram src/auth/flow.ts      # flowchart of auth logic
{skill:hl-visualize} --mermaid src/store/reducer.ts  # stateDiagram for state transitions
{skill:hl-visualize} --mermaid src/api/routes.ts     # sequenceDiagram for request flow
```

**Protocol:** read file → identify primary pattern → select diagram type → generate (max 10–12 nodes, summarize if larger) → visual self-review before output.

## --html Mode

**Output:** single `.html` file, all CSS/JS inline. No server needed.
**Browser open:** `open` (macOS) / `xdg-open` (Linux) / `start` (Windows).
**Style:** 6 curated presets; vary palette and font pair between consecutive outputs. For `--slides`, prefer richer style via `{skill:hl-design}` `scripts/ui-ux/search.py --design-system`.

For Mermaid syntax in HTML outputs: load `references/lib-mermaid-types.md` (24+ diagram types) and `references/lib-mermaid-config.md` (themes, accessibility). Multi-section pages (`--explain`, `--diff`, `--plan-review`, `--recap`) should include responsive side navigation.

### HTML-Only Modes

**`--diff [ref]`** — visual diff review. Scope: branch name, commit hash, HEAD, PR number, commit range (default: main).
Data: `git diff --stat`, `--name-status`, changed files, new API surface, CHANGELOG.
Output: executive summary, KPI dashboard, module architecture (Mermaid), feature comparisons, flow diagrams, file map, test coverage, code review cards, decision log, re-entry context.

**`--plan-review [plan-file]`** — plan vs codebase comparison. Input: plan file path or active plan context.
Data: read plan, read referenced files, map blast radius, cross-reference assumptions.
Output: plan summary, impact dashboard, current vs planned architecture (paired Mermaid), change breakdown, dependency analysis, risk assessment, review cards, understanding gaps.
Visual language: blue=current, green=planned, amber=concern, red=gap.

**`--recap [timeframe]`** — project context snapshot. Time window: shorthand (`2w`, `30d`, `3m`) or default `2w`.
Data: project identity, git log, git status, decision context, architecture scan.
Output: project identity, architecture snapshot (Mermaid), recent activity, decision log, state KPIs, mental model essentials, cognitive debt hotspots, next steps.

## --mermaid Mode

Create standalone Mermaid.js v11 diagrams (flowchart, sequence, ER, Gantt, state, class, journey, and 24+ more).

```
{skill:hl-visualize} --mermaid [diagram-type or description]
```

```bash
npx @mermaid-js/mermaid-cli -i diagram.mmd -o diagram.svg
mmdc -i input.mmd -o output.png -t dark -b transparent
```

## --excel Mode

Generate a structured Excel workbook from data or a topic. See `references/output-excel.md` for full patterns.

**Auto-detect input:**
- Existing `.csv` / `.json` / `.xlsx` file → transform/enhance it
- Data inline (array, table) → create new workbook from it
- Topic string → generate sample/template workbook for that domain

**Output:** `{plan_dir}/visuals/{slug}.xlsx` (falls back to `.agents/visuals/`), then open with default app.

## --pdf Mode

Generate a PDF document or fill an existing PDF form. See `references/output-pdf.md` for full patterns.

**Auto-detect input:**
- `--pdf <topic>` → generate PDF (render HTML internally → convert via `weasyprint` or `wkhtmltopdf`)
- `--pdf <form.pdf> <data.json>` → fill form fields via `pdftk fill_form`
- `--pdf <form.pdf>` with no data → detect form fields and prompt user for values

**Output:** `{plan_dir}/visuals/{slug}.pdf` (falls back to `.agents/visuals/`), then open with default app.

## Workflow Position

**Used alongside:** `{skill:hc-cook}` (explain after implementing), `{skill:hc-plan}` (visualize architecture during planning)
**Auto-invoked by:** `{skill:hc-ship}` — visual diff review before PR creation

## References

| File | Content |
|------|---------|
| `references/process-error-handling.md` | Error conditions, fallback actions, and user-facing messages |
| `references/lib-mermaid-types.md` | Syntax for all 24+ Mermaid diagram types |
| `references/lib-mermaid-config.md` | Config options, themes, accessibility settings |
| `references/lib-mermaid-cli.md` | CLI commands, export formats, and batch workflows |
| `references/lib-mermaid-integration.md` | JS API and HTML embedding patterns |
| `references/lib-mermaid-examples.md` | Architecture, API flows, DB schemas, state machine examples |
| `references/output-excel.md` | openpyxl patterns: workbooks, charts, tables, data formatting |
| `references/output-pdf.md` | PDF generation (weasyprint/wkhtmltopdf) and form filling (pdftk) |
| `references/generation-checklist.md` | Pre-delivery quality checklist for all output modes |
