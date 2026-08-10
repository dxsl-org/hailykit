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

Research, persist, extend, and render graphs from topics, documents, URLs, or JSON.

## Usage

```
{skill:hl-mindmap} <topic|doc|url>                 # create
{skill:hl-mindmap} <file.json>                    # view
{skill:hl-mindmap} <file.json> <query|doc|url>    # extend or edit

{skill:hl-mindmap} "Thế chiến 1 và Thế chiến 2"
{skill:hl-mindmap} /docs/lich-su.pdf
{skill:hl-mindmap} the-chien.json "tìm quan hệ giữa Hitler và Stalin"
{skill:hl-mindmap} the-chien.json "xóa node Đế quốc Áo-Hung"
```

| Input | Intent |
|---|---|
| topic / document / URL | `NEW` / `INGEST_DOC` / `INGEST_URL` |
| JSON only | `VIEW` |
| JSON + add/find/explore/remove query | `ADD_ENTITY` / `FIND_REL` / `EXPLORE` / `DELETE` |
| JSON + document/URL | `EXTEND_DOC` / `EXTEND_URL` |

## Constraints

> **Required — research-before-add:** `ADD_ENTITY`, `FIND_REL`, and `EXPLORE` invoke `{skill:hl-research}` before writes; do not use model memory when web search is available.

> **Required — confidence-tagging:** Every edge has `confidence: CONFIRMED | INFERRED | AMBIGUOUS`; omission is invalid.

## Process

1. **Route** — classify `.json`, document extension (`.pdf .docx .epub .txt .md`), `https?://`, or topic; classify a second argument by type or query keywords. Use `references/research-pipeline.md`. Emit `✓ Route: intent={INTENT}`.
2. **Recon** — extract seed entities for `NEW`, or load JSON and locate touched nodes for extension. Skip `VIEW`. Emit graph/seed counts.
3. **Draft** — plan entity lookups and edge verification. Skip `VIEW` and `DELETE`.
4. **Build** — research web intents with `{skill:hl-research}`; extract documents with `{skill:hc-docs}` or direct TXT/MD read; fetch URLs. Merge deduplicated nodes/edges with confidence and sources, then write `.agents/mindmaps/{slug}.json`.
5. **Verify** — verify edge sources, resolve duplicates, and report isolated nodes without blocking. Emit confirmed/inferred/ambiguous counts.
6. **Ship** — render `references/visualization-html.md` to `.agents/mindmaps/{slug}.html` and open it. Emit node/edge counts.

## Output

- `.agents/mindmaps/{slug}.json` — persistent, versioned graph
- `.agents/mindmaps/{slug}.html` — self-contained D3.js visualization

`{slug}` is lowercase kebab-case, truncated to 60 characters at a word boundary.

## Workflow Position

**Follows:** `{skill:hl-research}` — research supplies entities and evidence
**Precedes:** `{skill:hl-visualize}` — for slides, PDF, or Mermaid export
**Used alongside:** `{skill:hl-brainstorm}`
**Related:** `{skill:hl-write}`

## References

| File | Content |
|---|---|
| `references/research-pipeline.md` | Intent rules, research delegation, extraction, merge |
| `references/storage-schema.md` | JSON schema, IDs, edge vocabulary, versioning |
| `references/visualization-html.md` | D3.js template and interactions |
