# Storage Schema

JSON schema and file conventions for `.agents/mindmaps/*.json` graph files.

---

## Schema

```json
{
  "meta": {
    "topic": "string — human-readable topic label",
    "created": "YYYY-MM-DD",
    "updated": "YYYY-MM-DD",
    "version": "1",
    "description": "optional free-text note",
    "sources": ["file:///path/to/doc.pdf", "https://..."]
  },
  "nodes": [
    {
      "id": "n{timestamp_ms}",
      "label": "string — display name shown in graph",
      "type": "event | concept | person | org | place | custom",
      "attrs": {}
    }
  ],
  "edges": [
    {
      "id": "e{timestamp_ms}",
      "source": "node_id",
      "target": "node_id",
      "type": "string — relationship type from vocabulary below",
      "label": "optional human-readable description",
      "confidence": "CONFIRMED | INFERRED | AMBIGUOUS",
      "source_url": "URL string or null"
    }
  ]
}
```

All fields in `nodes[]` and `edges[]` are required except `attrs`, `label` (edge), and `source_url`. Omitting `confidence` on an edge is invalid — treat as `AMBIGUOUS` when reading legacy files. `meta.sources` is optional (empty array if no documents/URLs were ingested); append new entries on each INGEST or EXTEND call.

---

## File Location

Default: `.agents/mindmaps/{slug}.json`

`{slug}` derivation:
1. Take the topic string (or filename stem if extending existing)
2. Lowercase, replace spaces and special chars with hyphens
3. Collapse consecutive hyphens
4. Truncate at 60 chars on a word boundary

Examples:
```
"Thế chiến 1 và Thế chiến 2" → "the-chien-1-va-the-chien-2"
"Công giáo, Tin lành, Bà la môn" → "cong-giao-tin-lanh-ba-la-mon"
"World War I causes" → "world-war-i-causes"
```

HTML is rendered beside the JSON with the same stem: `{slug}.html`.

---

## ID Convention

- Node IDs: `n` + current timestamp in milliseconds, e.g. `n1717305600000`
- Edge IDs: `e` + current timestamp in milliseconds, e.g. `e1717305600001`
- IDs are append-only — never reassign or recycle an ID

---

## Common Edge Type Vocabulary

Not exhaustive — agent uses best judgment based on the relationship found:

| Type | Meaning |
|------|---------|
| `CAUSES` | A is a direct cause of B |
| `CAUSED_BY` | A results from B |
| `PART_OF` | A is a component/member of B |
| `CONTAINS` | A contains B |
| `LEADS_TO` | A sequence/event leads to B |
| `RESPONDS_TO` | A is a reaction or response to B |
| `CONTRADICTS` | A and B are in opposition or conflict |
| `SUPPORTS` | A supports or enables B |
| `INFLUENCES` | A has influence on B without direct causation |
| `SCHISM_FROM` | A splits or diverges from B |
| `PRECEDED_BY` | A comes after B chronologically |
| `FOLLOWED_BY` | A comes before B chronologically |
| `BELONGS_TO` | A is affiliated with or belongs to B |
| `RELATED_TO` | Generic relationship when no specific type fits |

---

## `attrs` Field

Free-form JSON object for domain-specific metadata. Common patterns:

```json
{ "year": "1914", "location": "Sarajevo" }             // event node
{ "founded": "1054", "region": "Eastern Europe" }       // org node
{ "born": "1889", "nationality": "Austrian" }           // person node
{ "strength": "strong", "era": "medieval" }             // edge attrs
```

Agents should populate `attrs` with any structured facts discovered during research.

---

## Versioning

`meta.version` is `"1"` for all graphs written by this skill. Increment only on breaking schema changes. When reading a file with a missing or older version, apply forward-compatibility defaults:
- Missing `confidence` on edge → treat as `AMBIGUOUS`
- Missing `type` on node → treat as `custom`
- Missing `attrs` → treat as `{}`
