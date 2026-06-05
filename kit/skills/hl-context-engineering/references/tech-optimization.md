---
name: tech-optimization
description: Context optimization strategies — compaction, observation masking, KV-cache optimization, context partitioning. Decision framework for choosing the right technique.
---

# Context Optimization

Extend effective context capacity through four core strategies. Apply in order: compaction → masking → caching → partitioning.

## Strategy Overview

| Strategy | Target | Typical Reduction | When to Apply |
|----------|--------|-------------------|---------------|
| **Compaction** | Full context | 50–70% | Approaching 80% utilization |
| **Observation Masking** | Tool outputs | 60–80% | Tool outputs dominate (>80% of context) |
| **KV-Cache Optimization** | Repeated prefixes | 70%+ hit rate | Stable prompts across many requests |
| **Context Partitioning** | Work distribution | Eliminates growth | Parallelizable tasks with clean subtask boundaries |

## Compaction

Summarize accumulated context when approaching the limit. Preserve decisions and commitments; discard supporting detail.

**Compaction priority** (compress first → compress last):
`Tool outputs → Old conversation turns → Retrieved documents → (never compress) System prompt`

```python
if context_tokens / context_limit > 0.8:
    context = compact_context(context)
```

**What to preserve:** key findings, decisions made, commitments, current task state
**What to remove:** reasoning chains that reached a conclusion, redundant tool output detail, already-summarized content

## Observation Masking

Replace verbose tool outputs with compact references. Apply when a tool result is too long to keep in full but may be referenced later.

```python
if len(observation) > max_length:
    ref_id = store_observation(observation)
    return f"[Obs:{ref_id}. Key point: {extract_key(observation)}]"
```

**Always mask:** repeated outputs, boilerplate, content already incorporated into a summary
**Never mask:** the current task's most critical result, the most recent tool turn, active reasoning in progress

## KV-Cache Optimization

Reuse cached key/value tensors for identical prefixes. Cache hits are free — the model reprocesses only the new tokens.

```python
# Cache-stable ordering: fixed content first, variable content last
context = [system_prompt, tool_definitions]  # These are cached
context += [retrieved_docs, message_history]  # Variable content appended
```

**Tips for cache stability:**
- Avoid timestamps or random IDs in the stable prefix
- Use consistent formatting across requests
- Structure system prompt so stable rules come before variable instructions

## Context Partitioning

Split work across sub-agents, each starting with a clean context. The coordinator receives only the essential result summary.

```python
result = await sub_agent.process(subtask, clean_context=True)
coordinator.integrate(result.summary)  # Only essentials return to coordinator
```

Best for: tasks with clearly independent subtasks (parallel file processing, independent research branches, concurrent code generation).

## Decision Framework

| Dominant context component | Apply |
|---------------------------|-------|
| Tool outputs | Observation masking |
| Retrieved documents | Summarization or partitioning |
| Message history | Compaction + summarization |
| Multiple components at limit | Combine strategies |

## Guidelines

1. Measure utilization before applying any strategy
2. Apply compaction before masking — compaction is lower-risk
3. Design for cache stability from the start
4. Partition work before context becomes a problem, not after
5. Monitor strategy effectiveness over time; don't assume one-size-fits-all

## Related

- `tech-compression.md` — long-session summarization approaches
- `tech-memory-systems.md` — external storage for compacted content
