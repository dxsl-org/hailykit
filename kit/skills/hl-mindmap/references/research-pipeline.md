# Research Pipeline

Detail for the Route and Build stages of `{skill:hl-mindmap}`.

---

## Intent Classification (Route stage)

Detection priority: **input shape first, then keyword scan**.

### Shape-based detection (checked before keyword scan)

| First arg shape | Second arg shape | Intent |
|----------------|-----------------|--------|
| `https?://…` | — | `INGEST_URL` |
| doc extension (`.pdf .docx .doc .epub .txt .md .mobi .odt`) | — | `INGEST_DOC` |
| `.json` | `https?://…` | `EXTEND_URL` |
| `.json` | doc extension | `EXTEND_DOC` |
| `.json` | absent | `VIEW` |
| plain text (no `.json`, no URL, no doc ext) | — | `NEW` |

### Keyword-based detection (when first arg is `.json` and second arg is a text query)

| Intent | Keyword signals |
|--------|----------------|
| `ADD_ENTITY` | "thêm", "add", "bổ sung", "thêm vào", "insert" |
| `FIND_REL` | "quan hệ", "relationship", "liên kết", "connection", "tìm mối", "between", "connect" |
| `EXPLORE` | "explore", "deep dive", "sâu hơn", "mở rộng", "expand", "more about" |
| `DELETE` | "xóa", "remove", "delete", "bỏ", "loại bỏ" |

When multiple keywords match, pick the most specific: FIND_REL > ADD_ENTITY > EXPLORE.

---

## hl-research Delegation (Build stage)

Compose search queries for each intent before calling `{skill:hl-research}`:

### NEW (full graph build)
```
queries:
  - "{topic} key entities overview"
  - "{topic} main events timeline"
  - "{topic} significant relationships"
  - "{topic} major actors causes consequences"
```
Run all queries in parallel (max 5). Extract all entity mentions and relationship statements.

### ADD_ENTITY(X)
```
queries:
  - "{X} definition overview"
  - "{X} {topic_context} connection"
  - "{X} related to {existing_top_5_node_labels}"
```

### FIND_REL(A, B)
```
queries:
  - "{A} {B} relationship"
  - "{A} influence on {B}"
  - "{A} {B} historical connection"
```

### EXPLORE(X) — 2-hop
```
Hop 1: "{X} direct connections" + "{X} {topic_context} related entities"
Hop 2: for each entity found in Hop 1 (max 5):
  "{found_entity} {topic_context} connections"
```
Cap at 5 entities in step 2 to avoid token explosion.

### INGEST_DOC / EXTEND_DOC

Extract text content from the document, then apply entity/relationship extraction (same rules as NEW):

| Format | Extraction method |
|--------|-----------------|
| `.pdf`, `.docx`, `.doc`, `.odt`, `.epub` | Delegate to `{skill:hc-docs}` — passes file to Gemini for full-text extraction |
| `.txt`, `.md` | Read file directly |
| `.mobi` | Convert to text via `ebook-convert` if available; otherwise ask user to export as PDF/TXT |

After extraction, apply the same node/edge extraction rules as `NEW`. Set `confidence: CONFIRMED` for entities stated directly in the document, `confidence: INFERRED` for relationships implied across sections. Set `source_url` to the file path (e.g. `file:///path/to/doc.pdf`).

For `EXTEND_DOC`: load existing graph first, then merge extracted content using the standard merge rules.

### INGEST_URL / EXTEND_URL

Fetch page content via the WebFetch tool, then apply entity/relationship extraction:

```
1. Fetch URL with WebFetch — capture full page text
2. If page is a structured article (Wikipedia, news, blog): extract main body only (strip nav, ads, comments)
3. Apply node/edge extraction rules (same as NEW)
4. Set confidence: CONFIRMED for directly stated facts, INFERRED for implied relationships
5. Set source_url on edges to the fetched URL
```

For `EXTEND_URL`: load existing graph first, then merge. For multi-page sites, only the provided URL is fetched — no crawling.

---

## Node/Edge Extraction (after research)

1. **Entity extraction** — scan research output for noun phrases that are distinct, nameable entities. Infer type:
   - Dates/periods/events with clear timeframe → `event`
   - Organizations, countries, institutions → `org`
   - Named individuals → `person`
   - Locations, regions → `place`
   - Ideologies, movements, theories, concepts → `concept`
   - Anything else → `custom`

2. **Relationship extraction** — identify statements of the form "A [verb phrase] B". Map verb phrase to an edge type (see `storage-schema.md` vocabulary). Capture the sentence as the edge `label`.

3. **Candidate matching** — compare each candidate node against existing graph nodes by label (lowercase, strip punctuation). Exact or near-exact match → use existing node ID (no duplicate).

4. **Confidence assignment:**
   - Research result contains a direct factual statement with source URL → `CONFIRMED`
   - Research result implies the relationship contextually → `INFERRED`
   - Only LLM reasoning with no supporting web source → `AMBIGUOUS`

---

## Merge Rules

- **Duplicate node:** same label (case-insensitive) + same type → skip, use existing ID
- **Duplicate edge:** same source + target + type → keep existing; upgrade `confidence` only if new evidence is stronger (`AMBIGUOUS` < `INFERRED` < `CONFIRMED`)
- **Isolated node:** node with no edges after build — keep it, flag in Ship output as "No connections found yet"
- **Never delete** existing nodes or edges when adding new content
