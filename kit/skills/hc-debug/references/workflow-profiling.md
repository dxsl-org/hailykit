# Performance Profiling Workflow

Read and interpret profiling artifacts (heap dumps, flame graphs, CPU profiles, memory traces) to identify the exact bottleneck. Distinct from `hc:optimize` (metric-driven iteration) — profiling starts with an artifact, not a target metric.

**Activation:** `{skill:hc-debug} --profile [artifact-path-or-description]`

---

## Artifact Types & Reading Strategy

### Flame Graph (CPU)

A flame graph shows call stacks sampled over time. Width = time spent.

**Reading approach:**
1. Find the **widest bar at any level** — that function consumes the most CPU
2. Trace upward to find the caller chain that triggers it
3. Look for **plateaus** (wide top of a stack with narrow children) — the wide bar IS the bottleneck
4. Look for **tall stacks** — deep recursion or many layers of abstraction with no real work at the bottom

**Key questions:**
- What is the widest frame at the leaf level?
- Is it in userland code (our code) or a library? If library: is the call frequency the problem, or the library itself?
- Is the bottleneck on the **hot path** (every request) or **cold path** (infrequent but slow)?

```
gemini -y -p "Analyze this flame graph: identify the top 3 CPU bottlenecks,
show the call chain for each, and suggest specific code changes" < flamegraph.svg
```

### Heap Dump (Memory)

Identifies retained objects causing memory leaks or excessive allocation.

**Reading approach:**
1. Sort objects by **retained size** (not shallow size) — finds the actual memory holder
2. Look for **unexpected object counts** — 10,000 instances of a class that should have 10 is a leak
3. Follow the **dominator tree** — who holds the reference chain to retained memory?
4. Compare two snapshots if available (baseline vs. after leak reproduced)

**Key questions:**
- Which object type has the highest retained size?
- What is holding a reference to it (preventing GC)?
- Is this a **cache that never evicts**, an **event listener not removed**, a **closure capturing a large object**?

### CPU Profile (Sampling)

Similar to flame graph but shows time in each function as a percentage.

**Reading approach:**
1. Sort by **self time** (time in function, not children) — identifies the actual work
2. Sort by **total time** to find the highest-impact call tree
3. Compare hot functions against call frequency — a function called 10M times with 0.1ms each = 1000s total

### Trace / Timeline (APM)

Distributed or single-service traces show latency breakdown across operations.

**Reading approach:**
1. Identify the **critical path** (the sequence of spans that determines total latency)
2. Find **gaps between spans** — time where nothing is happening (blocking I/O, queue wait, lock contention)
3. Find **unexpectedly wide spans** (operations taking longer than expected)
4. Look for **sequential calls that could be parallel** (N spans at the same depth instead of parallel)

---

## Analysis Protocol

1. **Categorize bottleneck type:**
   - CPU-bound → function doing too much computation
   - I/O-bound → waiting on DB, network, filesystem
   - Memory-bound → allocation rate too high, GC pressure
   - Lock/contention → threads waiting for each other

2. **Quantify the impact:**
   - What % of total time does this bottleneck consume?
   - Under what conditions? (all requests / only large payloads / only concurrent load)

3. **Identify the fix surface:**
   - Can we reduce **call frequency**? (cache the result, batch calls)
   - Can we reduce **work per call**? (algorithmic improvement, lazy evaluation)
   - Can we **parallelize**? (async I/O, worker threads, batching)
   - Can we **defer**? (move off the hot path to background job)

4. **Estimate improvement ceiling:**
   - If this bottleneck is 60% of total time, removing it entirely saves at most 60%
   - If it's 5%, addressing it won't meaningfully change user-perceived latency

---

## Output Format

```
## Profiling Analysis — [artifact type] — [date]

**Artifact:** [path or description]
**Environment:** [prod/staging/load-test]
**Load conditions:** [concurrent users, RPS, or "N/A"]

### Top Bottleneck: [function/operation name]
- **Type:** CPU / Memory / I/O / Lock
- **Impact:** [X]% of total [CPU/latency/memory]
- **Location:** [file:line]
- **Call chain:** [caller → caller → bottleneck]
- **Root cause:** [why it's slow — algorithmic, frequency, or I/O]
- **Fix:** [specific approach: cache / batch / async / algorithm change]
- **Estimated improvement:** [X]% reduction (theoretical ceiling)

### Secondary Bottleneck (if any):
[same structure]

### Recommendation:
[Priority order for fixes; which bottleneck to address first for maximum ROI]
```
