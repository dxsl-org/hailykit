---
name: tech-multi-agent
description: Multi-agent coordination patterns — supervisor, peer-to-peer, hierarchical architectures. Token economics, context isolation, consensus mechanisms, failure recovery.
---

# Multi-Agent Patterns

Distribute work across multiple context windows for isolation, parallelism, and scale.

## Core Principle

Sub-agents exist to **isolate context** — not to anthropomorphize roles. The benefit is a clean, focused context window per task; the cost is ~15× the token usage of a single agent.

## Token Economics

| Architecture | Token Multiplier | When Justified |
|--------------|-----------------|----------------|
| Single agent | 1× | Task fits comfortably in one window |
| Single agent + tools | ~4× | Moderate complexity, tool-heavy work |
| Multi-agent | ~15× | Context isolation required; parallelizable work |

Token usage explains ~80% of agent performance variance. Don't reach for multi-agent without justifying the cost.

## Coordination Patterns

### Supervisor / Orchestrator

Central coordinator decomposes work and aggregates results. Each worker receives a clean context with only its subtask.

```python
class Supervisor:
    def execute(self, task):
        subtasks = self.decompose(task)
        results = [worker.run(st, clean_context=True) for st in subtasks]
        return self.aggregate(results)
```

**Advantages:** direct control, human-in-loop checkpoints
**Trade-offs:** single bottleneck, telephone-game risk when context is forwarded

### Peer-to-Peer / Handoff

Agents pass work to the next agent via structured state. No central coordinator.

```python
def process_with_handoff(agent, task):
    result = agent.process(task)
    if "handoff" in result:
        return process_with_handoff(select_agent(result["to"]), result["state"])
    return result
```

**Advantages:** no single point of failure, scales naturally
**Trade-offs:** coordination complexity, harder to debug

### Hierarchical

Strategy → Planning → Execution layers. Each layer operates at a different abstraction level.

**Advantages:** clean separation of concerns
**Trade-offs:** coordination overhead between layers

## Context Isolation Patterns

| Pattern | Isolation Level | Use Case |
|---------|----------------|----------|
| Full delegation | Clean context | Independent subtasks with no shared state |
| Instruction passing | High | Simple tasks; coordinator passes only what the worker needs |
| File coordination | Medium | Shared mutable state; agents read/write files as the coordination channel |

## Consensus Mechanisms

For decisions requiring agreement across multiple agents:

```python
def weighted_consensus(responses):
    scores = {}
    for r in responses:
        weight = r["confidence"] * r["expertise_score"]
        scores[r["answer"]] = scores.get(r["answer"], 0) + weight
    return max(scores, key=scores.get)
```

## Failure Recovery

| Failure Mode | Mitigation |
|-------------|------------|
| Coordinator bottleneck | Use output schemas; add checkpointing |
| Coordination overhead | Define clear handoff contracts; batch small tasks |
| Agent divergence | Set explicit scope boundaries; add convergence checks |
| Cascading errors | Validate each agent's output before passing downstream; use circuit breakers |

## Guidelines

1. Use multi-agent for context isolation — not for role-play or anthropomorphization
2. Accept the ~15× token cost only when the isolation benefit is clear
3. Implement circuit breakers to prevent cascading failures
4. Use files as the shared-state channel between agents
5. Design clear handoff contracts before spawning the first agent
6. Validate agent outputs between stages

## Related

- `tech-optimization.md` — context partitioning within a single agent
- `quality-evaluation.md` — measuring agent performance and output quality
