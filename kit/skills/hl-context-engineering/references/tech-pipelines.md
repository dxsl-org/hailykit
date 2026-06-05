---
name: tech-pipelines
description: LLM-powered pipeline design — task-model fit, five-stage pipeline architecture, file-system state tracking, structured output parsing, cost estimation, single vs. multi-agent decision.
---

# LLM-Powered Pipelines

Design and build reliable LLM pipelines from prototype to production.

## Task-Model Fit

Before building, verify the task is suited to LLM processing:

**LLM-suited:** synthesis, subjective judgment, natural language output, error-tolerant batch processing

**Not LLM-suited:** precise arithmetic, real-time requirements, perfect deterministic output, safety-critical exact computation

## Manual Prototype First

Run one example manually with the target model before automating. This surfaces prompt issues, output format problems, and edge cases before they appear at scale.

## Five-Stage Pipeline

```
acquire → prepare → process → parse → render
(fetch)  (prompt)   (LLM)   (extract) (output)
```

| Stage | Characteristic | Cost |
|-------|---------------|------|
| 1. Acquire | Deterministic | Cheap |
| 2. Prepare | Deterministic | Cheap |
| 3. Process | Non-deterministic (LLM) | Expensive |
| 4. Parse | Deterministic | Cheap |
| 5. Render | Deterministic | Cheap |

Design all deterministic stages to be cheap and fast; invest optimization effort in stage 3.

## File-System State Tracking

Track pipeline progress via files — this makes the pipeline idempotent and resumable:

```
data/{id}/
├── raw.json       ← acquire complete
├── prompt.md      ← prepare complete
├── response.md    ← process complete
└── parsed.json    ← parse complete
```

```python
def get_stage(id):
    if exists(f"{id}/parsed.json"):  return "render"
    if exists(f"{id}/response.md"):  return "parse"
    if exists(f"{id}/prompt.md"):    return "process"
    if exists(f"{id}/raw.json"):     return "prepare"
    return "acquire"
```

Benefits: safe to re-run, debuggable at each stage, no lost work on crash.

## Structured Output

Design prompts with explicit section markers to make parsing deterministic:

```markdown
## SUMMARY
[One paragraph overview]

## KEY_FINDINGS
- Finding 1
- Finding 2

## SCORE
[1-5]
```

```python
def parse_response(response):
    return {
        "summary": extract_section(response, "SUMMARY"),
        "findings": extract_list(response, "KEY_FINDINGS"),
        "score": extract_int(response, "SCORE")
    }
```

## Cost Estimation

Estimate before running at scale:

```python
def estimate_cost(item_count, tokens_per_item, price_per_1k_tokens):
    base = item_count * tokens_per_item / 1000 * price_per_1k_tokens
    return base * 1.1  # Add 10% buffer for variance

# Example: 1000 items × 2000 tokens × $0.01/1k = ~$22
```

## Single vs. Multi-Agent Decision

| Factor | Use Single Agent | Use Multi-Agent |
|--------|-----------------|-----------------|
| Context | Fits in window | Exceeds window |
| Tasks | Sequential | Parallel |
| Token budget | Constrained | Can absorb ~15× overhead |
| Coordination complexity | Prefer simple | Justified by isolation benefit |

## Guidelines

1. Always validate manually before automating
2. Use the five-stage pipeline; keep stages 1, 2, 4, 5 deterministic
3. Track state via files for idempotency and debuggability
4. Design structured output formats to make parsing reliable
5. Estimate cost before running at scale
6. Start with a single agent; add multi-agent only when context isolation is required

## Related

- `tech-optimization.md` — reducing token usage within each pipeline run
- `tech-multi-agent.md` — when and how to distribute pipeline stages across agents
