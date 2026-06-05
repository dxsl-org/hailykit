---
name: hl-mindmap
description: "Build, extend, and visualize domain-agnostic knowledge graphs. Agent researches entities and relationships from topics, web sources, or documents. Stores as JSON, renders as interactive HTML. Supports any domain: events, concepts, people, organizations."
when_to_use: "Invoke when mapping relationships between entities, events, concepts, or people — especially when the agent should discover connections automatically."
user-invocable: true
category: thinking
keywords: [knowledge-graph, mindmap, entities, relationships, research, visualization]
argument-hint: "<topic|doc|url|file.json> [doc|url|query]"
---

# hl-mindmap — Knowledge Graph Builder

Build domain-agnostic knowledge graphs via agent research. Give it a topic string, a local document (PDF, DOCX, EPUB, …), a URL, or an existing graph file; the agent discovers entities and relationships, persists them as JSON, and renders an interactive HTML visualization.

## Usage

```
{skill:hl-mindmap} <topic>                          # build from topic string
{skill:hl-mindmap} <doc.pdf|.docx|.epub|...>        # build from local document
{skill:hl-mindmap} <https://...>                    # build from URL
{skill:hl-mindmap} <file.json>                      # view/render existing graph
{skill:hl-mindmap} <file.json> "<query>"            # extend graph via research
{skill:hl-mindmap} <file.json> <doc|url>            # extend graph from document/URL
```

Examples:
```
{skill:hl-mindmap} "Thế chiến 1 và Thế chiến 2"
{skill:hl-mindmap} /docs/lich-su-chien-tranh.pdf
{skill:hl-mindmap} https://en.wikipedia.org/wiki/World_War_I
{skill:hl-mindmap} the-chien.json
{skill:hl-mindmap} the-chien.json "thêm Đế quốc Nga"
{skill:hl-mindmap} the-chien.json "tìm quan hệ giữa Hitler và Stalin"
{skill:hl-mindmap} the-chien.json /docs/them-tai-lieu.pdf
{skill:hl-mindmap} the-chien.json https://example.com/article
{skill:hl-mindmap} the-chien.json "xóa node Đế quốc Áo-Hung"
```

| Input pattern | Intent |
|---------------|--------|
| `<topic>` (plain text, no `.json`) | `NEW` — build graph via web research |
| `<doc>` (`.pdf .docx .epub .txt .md`) | `INGEST_DOC` — extract entities from document |
| `<https://...>` | `INGEST_URL` — fetch URL, extract entities |
| `<file.json>` (no second arg) | `VIEW` — render existing graph |
| `<file.json> "thêm X"` / `"add X"` | `ADD_ENTITY` — research X, find connections |
| `<file.json> "tìm quan hệ A và B"` | `FIND_REL` — research A↔B relationship |
| `<file.json> "explore X"` / `"sâu hơn X"` | `EXPLORE` — 2-hop expansion from X |
| `<file.json> "xóa X"` / `"remove X"` | `DELETE` — remove node + orphaned edges |
| `<file.json> <doc>` | `EXTEND_DOC` — extend existing graph from document |
| `<file.json> <https://...>` | `EXTEND_URL` — extend existing graph from URL |

## Constraints

> **Required — research-before-add:** Every `ADD_ENTITY`, `FIND_REL`, and `EXPLORE` intent MUST invoke `{skill:hl-research}` before writing to the graph. Never add nodes from LLM knowledge alone when web search is available.

> **Required — confidence-tagging:** Every edge MUST carry a `confidence` field: `CONFIRMED` (web source found), `INFERRED` (LLM-derived), or `AMBIGUOUS` (weak or speculative). Omitting this field is invalid.

## Process

1. **Route** — classify first arg: `.json` → existing graph; doc extension (`.pdf .docx .epub .txt .md`) → `INGEST_DOC`; `https?://` prefix → `INGEST_URL`; plain text → `NEW`. If first arg is `.json`, classify second arg the same way for `EXTEND_DOC`/`EXTEND_URL`, or classify query keywords for other intents (full rules in `references/research-pipeline.md`). Emit `✓ Route: intent={INTENT}`.

2. **Recon** — for `NEW`: extract seed entities from topic string. For `extend` intents: load existing JSON; identify which nodes the query touches. Skip for `VIEW`. Emit `✓ Recon: {N} seed entities / graph has {M} nodes, {K} edges`.

3. **Draft** — plan research queries: which entities need lookup, which edges need verification. Skip for `VIEW` and `DELETE`.

4. **Build** — for `NEW`/`ADD_ENTITY`/`FIND_REL`/`EXPLORE`: invoke `{skill:hl-research}` with planned queries. For `INGEST_DOC`/`EXTEND_DOC`: extract content via `{skill:hc-docs}` (PDF/DOCX/EPUB) or direct read (TXT/MD). For `INGEST_URL`/`EXTEND_URL`: fetch page content via WebFetch. Extract candidate nodes and edges from results (rules in `references/research-pipeline.md`). Assign confidence tags. Merge into graph. Write/update JSON to `.agents/mindmaps/{slug}.json`. Emit `✓ Build: +{N} nodes, +{M} edges added`.

5. **Verify** — flag isolated nodes (no edges) in output without blocking. Verify edge sources. Resolve duplicates. Emit `✓ Verify: {K} confirmed, {L} inferred, {J} ambiguous edges`.

6. **Ship** — render interactive HTML from graph JSON (template in `references/visualization-html.md`). Save to `.agents/mindmaps/{slug}.html`. Open in browser. Emit `✓ Ship: {slug}.html opened — {N} nodes, {M} edges`.

## Output

- **JSON:** `.agents/mindmaps/{slug}.json` — persistent graph, loadable in future calls
- **HTML:** `.agents/mindmaps/{slug}.html` — D3.js force-directed graph, inline CSS/JS, opens in browser without a server

`{slug}` = topic lowercased, spaces→hyphens, truncated at 60 chars on a word boundary.

## Workflow Position

**Follows:** `{skill:hl-research}` — feeds initial research findings into graph building
**Precedes:** `{skill:hl-visualize}` — for non-HTML export (slides, PDF, Mermaid diagrams)
**Used alongside:** `{skill:hl-brainstorm}` — map explored concepts as a navigable graph

## References

| File | Content |
|------|---------|
| `references/research-pipeline.md` | Intent keyword rules, `{skill:hl-research}` delegation pattern, node/edge extraction and merge rules |
| `references/storage-schema.md` | Full JSON schema, ID convention, common edge type vocabulary, versioning |
| `references/visualization-html.md` | D3.js inline HTML template, node/edge color coding, interaction patterns |
