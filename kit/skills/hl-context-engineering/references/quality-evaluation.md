---
name: quality-evaluation
description: Agent evaluation frameworks — LLM-as-Judge biases, pairwise comparison, probe-based testing, stratified test sets, production monitoring.
---

# Agent Evaluation

Systematically assess agent performance and context engineering effectiveness.

## Key Finding: Token Usage Dominates

| Factor | Share of Performance Variance |
|--------|-------------------------------|
| Token usage | ~80% |
| Tool call patterns | ~10% |
| Model choice | ~5% |

**Implication:** Token budget optimization yields far more impact than upgrading to a more capable model.

## Evaluation Methods

### LLM-as-Judge

An LLM scores or ranks agent outputs. Effective but subject to systematic biases:

| Bias | Description | Mitigation |
|------|-------------|-----------|
| Position bias | First option rated higher | Swap positions across runs |
| Length bias | Longer responses rated higher | Normalize for length |
| Self-enhancement | Model rates own outputs higher | Use a different model as judge |
| Verbosity bias | Detail mistaken for quality | Add explicit rubric criteria |

### Pairwise Comparison

Compare two outputs in both orderings to detect positional bias:

```python
score_ab = judge.compare(output_a, output_b)
score_ba = judge.compare(output_b, output_a)
# Consistent verdict if both orderings agree
consistent = (score_ab > 0.5) == (score_ba < 0.5)
```

### Probe-Based Testing

Insert targeted factual probes to verify a compressed summary or long context retains needed information:

| Probe Type | Tests | Example |
|------------|-------|---------|
| Recall | Factual retention | "What was the original error message?" |
| Artifact | File tracking | "Which files were modified?" |
| Continuation | Task planning ability | "What needs to happen next?" |
| Decision | Reasoning chain retention | "Why was X chosen over Y?" |

## Multi-Dimensional Scoring Rubric

| Dimension | Weight | What It Measures |
|-----------|--------|-----------------|
| Factual Accuracy | 30% | Correctness vs. ground truth |
| Completeness | 25% | Coverage of all requirements |
| Tool Efficiency | 20% | Appropriate tool selection and call count |
| Citation Accuracy | 15% | Sources match claimed facts |
| Source Quality | 10% | Authority and credibility of references |

## Test Set Design

Stratified sampling ensures coverage across complexity levels:

```python
class StratifiedTestSet:
    def sample(self, n):
        per_tier = n // 3
        return (
            self.simple[:per_tier] +
            self.medium[:per_tier] +
            self.complex[:per_tier]
        )
```

## Production Monitoring

```python
class QualityMonitor:
    SAMPLE_RATE = 0.01        # Sample 1% of production calls
    ALERT_THRESHOLD = 0.85    # Alert if average score drops below

    def check(self, scores):
        avg = sum(scores) / len(scores)
        if avg < self.ALERT_THRESHOLD:
            self.alert(f"Quality degraded: {avg:.2f}")
```

## Guidelines

1. Evaluate task outcomes, not step-by-step process
2. Use multi-dimensional rubrics; single-metric evaluation misses important trade-offs
3. Always apply position swapping when using LLM-as-Judge
4. Sample across simple/medium/complex task tiers
5. Implement continuous monitoring in production — offline benchmarks drift from real usage
6. Focus optimization on token efficiency; it has the highest performance leverage

## Related

- `tech-compression.md` — probe-based evaluation of compressed summaries
- `tech-multi-agent.md` — evaluating agent coordination quality
