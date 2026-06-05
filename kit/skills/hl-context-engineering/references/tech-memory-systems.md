---
name: tech-memory-systems
description: Memory architectures for persistent context beyond the window — layered memory model, vector stores, temporal knowledge graphs, file-system patterns.
---

# Memory Systems

Architectures for agent memory that persists beyond the current context window.

## Memory Layer Model

| Layer | Scope | Persistence | Primary Use |
|-------|-------|-------------|-------------|
| L1 — Working | Current window | None | Active reasoning |
| L2 — Short-Term | Session | Session-scoped | Task continuity within a session |
| L3 — Long-Term | Cross-session | Persistent | User preferences, project state |
| L4 — Entity | Per-entity | Persistent | Consistency across references to the same entity |
| L5 — Temporal Graph | Time-aware | Persistent | Facts that change over time |

## Retrieval Accuracy Benchmarks (DMR)

| System | Accuracy | Approach |
|--------|----------|----------|
| Zep | 94.8% | Temporal knowledge graphs |
| MemGPT | 93.4% | Hierarchical memory management |
| GraphRAG | 75–85% | Knowledge graph retrieval |
| Vector RAG | 60–70% | Embedding similarity search |

## Vector Store with Entity Indexing

Hybrid approach: semantic search plus entity-scoped retrieval for consistency.

```python
class EntityAwareVectorStore:
    def store(self, text, embedding, entities, timestamp):
        doc = {"text": text, "embedding": embedding,
               "entities": entities, "timestamp": timestamp}
        self._index_by_entity(doc)

    def retrieve_by_entity(self, entity, k=5):
        return self.entity_index.get(entity, [])[:k]
```

## Temporal Knowledge Graph

Tracks facts with validity ranges — handles evolving information without corrupting past state.

```python
class TemporalKnowledgeGraph:
    def add_fact(self, subject, predicate, obj, valid_from, valid_to=None):
        self.facts.append({
            "triple": (subject, predicate, obj),
            "valid_from": valid_from,
            "valid_to": valid_to or "current"
        })

    def query_at(self, subject, predicate, timestamp):
        return next(
            (f["triple"][2] for f in self.facts
             if f["triple"][:2] == (subject, predicate)
             and f["valid_from"] <= timestamp <= f["valid_to"]),
            None
        )
```

## Retrieval Patterns

| Pattern | Query Strategy | Use Case |
|---------|---------------|----------|
| Semantic | Embedding similarity | General recall |
| Entity-based | Lookup by entity ID | Consistency across references |
| Temporal | Valid-at timestamp | Evolving or historical facts |
| Hybrid | Combine all three | Production systems |

## File-System-as-Memory (Simplest Start)

```
memory/
├── sessions/{id}/summary.md   # Compressed session history
├── entities/{id}.json          # Per-entity facts
└── facts/{timestamp}_{id}.json # Timestamped fact store
```

This pattern is idempotent, debuggable, and requires no external dependencies — start here.

## Guidelines

1. Start with file-system-as-memory; add complexity only when scale demands it
2. Add vector search when semantic retrieval is needed beyond simple lookup
3. Use entity indexing when the same entity is referenced across many sessions
4. Add temporal awareness when facts change over time
5. Measure retrieval accuracy against known ground truth before relying on the system

## Related

- `tech-fundamentals.md` — context anatomy and token budgets
- `tech-multi-agent.md` — shared memory across agent teams
