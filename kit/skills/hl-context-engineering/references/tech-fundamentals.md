---
name: tech-fundamentals
description: Context anatomy, attention mechanics, token budget allocation, and progressive disclosure. Foundation concepts for all context engineering decisions.
---

# Context Fundamentals

Context = all input provided to an LLM for a task. Treat it as a finite, high-value resource with diminishing returns as it fills.

## Context Anatomy

| Component | Purpose | Token Impact |
|-----------|---------|--------------|
| System Prompt | Identity, constraints, guidelines | Stable — cacheable |
| Tool Definitions | Action specs with params/returns | Grows with capability count |
| Retrieved Documents | Domain knowledge, just-in-time | Variable — load selectively |
| Message History | Conversation state, task progress | Accumulates — compress at ~70% |
| Tool Outputs | Results from actions | Dominates — often 80%+ of context |

## Attention Mechanics

- **U-shaped curve** — beginning and end positions receive more attention than the middle
- **Attention budget** — scales as n² for n tokens; grows expensive as context fills
- **First-token sink** — the BOS token absorbs a disproportionate share of attention
- **Position degradation** — longer contexts cause quality loss even before the window limit

## System Prompt Structure (Recommended)

Stable sections before variable content — maximizes KV-cache reuse:

```
[Role and constraints]         ← cacheable
[Tool guidance]                ← cacheable
[Current task instructions]    ← variable — inject last
```

## Progressive Disclosure Levels

1. **Metadata** (~100 tokens) — always present; skill name, category
2. **Skill body** (<5k tokens) — loaded when skill triggers
3. **Reference files** (unlimited) — loaded on demand, one per topic

## Token Budget Allocation

| Component | Typical Range | Notes |
|-----------|---------------|-------|
| System Prompt | 500–2000 | Stable — optimize once |
| Tool Definitions | 100–500 per tool | Keep tool count under 20 |
| Retrieved Documents | 1000–5000 | Selective loading only |
| Message History | Variable | Summarize when approaching 70% |
| Reserved Buffer | 10–20% | Reserve for model responses |

## Document Management

- Use descriptive filenames: `customer_pricing_rates.json` not `data/file1.json`
- Chunk at semantic boundaries (paragraphs, sections) — not arbitrary character counts
- Include metadata with each document: source, date, relevance score

## Message History Compaction

```python
# Summarize every N messages to prevent unbounded growth
if len(messages) % 20 == 0:
    summary = summarize_conversation(messages[-20:])
    messages.append({"role": "system", "content": f"Summary: {summary}"})
```

## Guidelines

1. Place critical information at attention-favored positions (beginning or end)
2. Use file-system access for large documents rather than injecting them directly
3. Pre-load stable content; just-in-time load dynamic content
4. Design with explicit token budgets per component
5. Monitor utilization; trigger compaction at 70–80%

## Related

- `tech-degradation.md` — what goes wrong as context fills
- `tech-optimization.md` — techniques to extend effective capacity
- `tech-memory-systems.md` — persistent storage beyond the window
