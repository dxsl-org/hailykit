---
name: hl-context-engineering
description: "Context engineering for LLM tasks: optimize token usage, debug context failures, design memory systems, build multi-agent pipelines. Covers fundamentals, degradation patterns, KV-cache, compression, and runtime monitoring."
when_to_use: "Invoke when optimizing context windows, agent memory, or LLM prompt architecture."
user-invocable: true
argument-hint: "[topic or question]"
metadata:
  category: thinking
  keywords: [context, tokens, limits, memory, optimization, multi-agent, evaluation]
---

# Context Engineering

Curates the smallest high-signal token set for LLM tasks — maximizing reasoning quality while minimizing token usage. Load only the reference(s) relevant to the question (progressive disclosure).

## Usage

```
{skill:hl-context-engineering} [topic or question]
```

```
{skill:hl-context-engineering} "why is my agent losing track of earlier decisions?"
{skill:hl-context-engineering} "how should I structure memory for a multi-session agent?"
{skill:hl-context-engineering} "my context is at 80%, what do I do?"
```

If no argument: consult the Reference Map below and ask the user which topic applies.

## Constraints

> **Required — progressive disclosure:** Load only the reference file(s) relevant to the question. Do not load all references upfront.

> **Required — consult only:** Provide architectural guidance. Do not start implementing unless the user explicitly asks.

## Reference Map

| Topic | Load when | Reference |
|-------|-----------|-----------|
| Fundamentals — context anatomy, attention mechanics | Understanding context structure, token budgets | `references/tech-fundamentals.md` |
| Degradation — lost-in-middle, poisoning, confusion | Debugging quality drops, hallucinations | `references/tech-degradation.md` |
| Optimization — compaction, masking, caching, partitioning | Approaching limits, reducing cost | `references/tech-optimization.md` |
| Compression — long sessions, summarization strategies | Sessions exceeding context window | `references/tech-compression.md` |
| Memory — cross-session persistence, knowledge graphs | Building persistent agent memory | `references/tech-memory-systems.md` |
| Multi-Agent — coordination patterns, context isolation | Distributing work across agents | `references/tech-multi-agent.md` |
| Evaluation — LLM-as-Judge, metrics, test design | Measuring agent performance | `references/quality-evaluation.md` |
| Tool Design — consolidation, description engineering | Reducing tool count, improving reliability | `references/tech-tool-design.md` |
| Pipelines — project development, batch processing | Building LLM-powered pipelines | `references/tech-pipelines.md` |
| Runtime — usage limits, context window monitoring | Current session budget, hook behavior | `references/tech-runtime.md` |

## Core Principles

1. **Context quality > quantity** — high-signal tokens beat exhaustive content
2. **Attention is finite** — U-shaped curve favors beginning/end positions
3. **Progressive disclosure** — load information just-in-time
4. **Isolation prevents degradation** — partition work across sub-agents
5. **Measure before optimizing** — know your baseline

## Four-Bucket Strategy

| Bucket | Action |
|--------|--------|
| Write | Save context externally (scratchpads, files) |
| Select | Pull only relevant context (retrieval, filtering) |
| Compress | Reduce tokens while preserving information |
| Isolate | Split work across sub-agents (partitioning) |

## Key Metrics

| Metric | Value |
|--------|-------|
| Token utilization warning | 70% |
| Compaction trigger | 80% |
| Token variance → performance | Explains ~80% of variance |
| Multi-agent cost overhead | ~15× single agent |
| Compaction target | 50–70% reduction, <5% quality loss |
| Cache hit target (stable workloads) | 70%+ |

## Anti-Patterns

- Exhaustive context over curated context
- Critical information in middle positions
- No compaction triggers before context limits
- Single agent for parallelizable work
- Tools without clear, specific descriptions

## Scripts

- `scripts/context_analyzer.py` — context health analysis and degradation detection
- `scripts/compression_evaluator.py` — compression quality evaluation

## Workflow Position

**Used alongside:** `{skill:hl-brainstorm} --architect` — general architecture advice; context-engineering for LLM-specific context optimization
**Related:** `{skill:hc-plan}`
