---
name: tech-compression
description: Long-session compression strategies — anchored iterative summarization, compression triggers, artifact trail tracking, probe-based quality evaluation.
---

# Context Compression

Strategies for sessions that approach or exceed the context window over multiple turns.

## Core Principle

Optimize **tokens-per-task** (total tokens to task completion), not tokens-per-request. Aggressive compression that causes re-fetching costs more total tokens than moderate compression with better retention.

## Compression Methods Compared

| Method | Compression Rate | Quality Score | Best For |
|--------|-----------------|---------------|----------|
| **Anchored Iterative** | ~98.6% | 3.70/5 | Best balance of size and quality |
| **Regenerative Full** | ~98.7% | 3.44/5 | Maximum readability |
| **Opaque** | ~99.3% | 3.35/5 | Maximum compression, lower quality |

## Anchored Iterative Summary Format

The recommended approach: maintain a running summary and merge new content into existing sections on each compression cycle. Do not regenerate from scratch.

```markdown
## Session Intent
Original goal: [preserved verbatim]

## Files Modified
- file.py: [what changed and why]

## Decisions Made
- [Decision]: [rationale — critical for continuation]

## Current State
[Progress summary — what is done, what remains]

## Next Steps
1. [Ordered next actions]
```

On each compression: merge new content into the existing sections rather than regenerating the full document.

## Compression Triggers

| Strategy | Trigger | Suited For |
|----------|---------|-----------|
| Fixed threshold | 70–80% utilization | General purpose sessions |
| Sliding window | Keep last N turns + summary | Conversational flows |
| Task-boundary | At logical completion point | Multi-step workflows |

## Artifact Trail Problem

The weakest dimension in compression quality (2.2–2.5/5.0). Coding agents in particular must explicitly track:
- Files created, modified, or read
- Function and variable names that were introduced
- Error messages and their resolution status

**Solution:** Keep a dedicated `## Files Modified` section in the summary that is never dropped, even under aggressive compression.

## Probe-Based Quality Evaluation

Use targeted probes to verify a compressed summary retains the needed information:

| Probe Type | Tests | Example |
|------------|-------|---------|
| Recall | Factual retention | "What was the original error message?" |
| Artifact | File tracking | "Which files were modified in this session?" |
| Continuation | Task planning | "What needs to happen next?" |
| Decision | Reasoning chain | "Why was approach X chosen over Y?" |

## Six Evaluation Dimensions

1. **Accuracy** — technical correctness of retained facts
2. **Context Awareness** — understanding of conversation state
3. **Artifact Trail** — tracking of all modified files (universally the weakest dimension)
4. **Completeness** — coverage depth of key information
5. **Continuity** — ability to continue work from the summary alone
6. **Instruction Following** — preserved constraints and requirements

## Guidelines

1. Use anchored iterative summarization for the best quality/compression balance
2. Always maintain an explicit artifact tracking section
3. Trigger compression at 70% utilization — not when the context is already degraded
4. Merge into sections; never regenerate the full summary from scratch
5. Validate compressed summaries with probes before long continuation sessions

## Related

- `tech-optimization.md` — compaction and masking for within-session optimization
- `quality-evaluation.md` — evaluation frameworks and probe design
