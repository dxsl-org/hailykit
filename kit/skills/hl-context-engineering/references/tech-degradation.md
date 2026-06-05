---
name: tech-degradation
description: Context degradation patterns — lost-in-middle, poisoning, confusion, clash. Detection heuristics, thresholds, and recovery strategies.
---

# Context Degradation Patterns

Degradation is a continuum, not a binary failure. Performance declines gradually as context grows and as noise accumulates.

## Degradation Pattern Taxonomy

| Pattern | Root Cause | Signal |
|---------|-----------|--------|
| **Lost-in-Middle** | U-shaped attention — middle positions starved | Critical info recall drops 10–40% |
| **Context Poisoning** | Errors compound through self-reference | Persistent hallucinations despite correction |
| **Context Distraction** | Irrelevant content overwhelms signal | Single off-topic block degrades accuracy |
| **Context Confusion** | Multiple tasks interleaved | Wrong tool calls, mixed requirements |
| **Context Clash** | Contradictory information present | Inconsistent outputs, conflicting reasoning |

## Lost-in-Middle

Information in the middle of a long context receives 10–40% lower recall than content at either end. This gets worse as total context length increases.

**Mitigation — structure for attention:**

```
[CURRENT TASK]              ← high attention (beginning)
- Critical requirements

[SUPPORTING DETAIL]         ← lower attention (middle)
- Background context

[KEY CONCLUSIONS]           ← high attention (end)
- Findings to act on
```

## Context Poisoning

**Common entry points:**
- Tool outputs containing errors or unexpected formats
- Retrieved documents with stale or incorrect information
- Model-generated summaries that introduced hallucinations

**Detection signals:**
- Quality drop on tasks that previously succeeded
- Tool calls with wrong parameters or wrong tool selected
- Fact contradictions that persist even after explicit correction

**Recovery options:**
- Truncate history to before the poisoning point
- Add an explicit correction note before re-attempting
- Restart with a clean context, preserving only verified information

## Degradation Onset

Degradation begins well before the context window limit. Severity varies by model architecture. General thresholds to plan around:

- **Warning zone**: 60–70% of context window — begin planning compaction
- **Compaction trigger**: 80% — execute compaction before further degradation
- **Critical**: 90%+ — immediate action required; quality is already compromised

## Detection Heuristic

A simple health score for monitoring:

```python
def context_health(utilization, degradation_risk, poisoning_risk):
    """Returns 1.0 (healthy) to 0.0 (critical)"""
    score = 1.0
    score -= utilization * 0.5 if utilization > 0.7 else 0
    score -= degradation_risk * 0.3
    score -= poisoning_risk * 0.2
    return max(0.0, score)

# Thresholds: healthy >0.8 | warning >0.6 | degraded >0.4 | critical ≤0.4
```

## Four-Bucket Mitigation

| Bucket | Addresses |
|--------|-----------|
| Write | Save outputs externally before they age into the middle |
| Select | Filter retrieved content; avoid loading low-relevance documents |
| Compress | Summarize old turns; compact before degradation onset |
| Isolate | Spawn sub-agents with clean contexts for independent subtasks |

## Guidelines

1. Place task-critical information at beginning or end — never bury it in the middle
2. Validate retrieved documents for freshness before injecting them
3. Trigger compaction before the 80% threshold, not after quality drops
4. Use versioning or timestamps to prevent stale-information clash
5. Segment distinct tasks across separate turns or sub-agents to prevent confusion

## Related

- `tech-optimization.md` — compaction and masking strategies
- `tech-multi-agent.md` — context isolation via sub-agents
