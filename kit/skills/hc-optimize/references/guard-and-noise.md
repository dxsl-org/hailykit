# Guard Pattern & Noise-Aware Verification

## Guard Pattern (Regression Prevention)

The `Measure` command tells you if the target metric improved.
The `Guard` command confirms nothing else broke.

**Separation of concerns:**
- `Measure` = "did the target metric improve?"
- `Guard` = "did anything else break?"

### How It Works

1. **Before loop starts:** Guard command must exit 0 (establishes clean baseline — if it fails, fix it first)
2. **After each `accept` decision:** run Guard command
3. **If Guard exits non-zero:** trigger recovery flow

### Guard Recovery Flow

```
Guard fails →
  revert to previous commit (git revert HEAD --no-edit) →
  rework attempt 1 (different approach, same file) →
    if guard fails again →
  rework attempt 2 (minimal change, avoid guard files) →
    if guard fails again →
  discard — log accept=no, status=guard-failed
```

**Rules:**
- If guard cannot pass at baseline, fix the guard baseline before starting — never relax the guard mid-loop
- Guard files are **READ-ONLY** — never modify test files, spec files, or guard scripts as part of an optimization attempt
- Guard failure means the optimization approach is wrong, not that the guard is wrong

### Common Guard Commands

| Stack | Guard Command | Notes |
|-------|--------------|-------|
| Node.js | `npm test` | Runs Jest/Vitest suite |
| Python | `pytest` | Full test suite |
| Go | `go test ./...` | All packages |
| Rust | `cargo test` | Unit + integration |
| TypeScript | `npx tsc --noEmit && npm test` | Type check then tests |
| Any | `npm run lint && npm test` | Lint + test combined |

### Guard Command Selection

- Optimizing **runtime code** → guard = full test suite
- Optimizing **build/bundle** → guard = `tsc --noEmit` + smoke test
- Optimizing **performance** → guard = test suite + latency sanity check
- Optimizing **ML pipeline** → guard = test suite + data schema validation
- Unsure → `npm test` / `pytest` / `go test ./...`

---

## Noise-Aware Verification

Noisy metrics produce false positives. A "5% improvement" that falls within measurement variance leads to keeping bad changes and burning iterations.

### Noise Levels (map to `Tolerance` field)

| `Tolerance` | Description | Strategy |
|-------------|-------------|----------|
| `low` | Deterministic output: LOC, type errors, lint count | Single run, trust result |
| `medium` | Slight variance: build time ±5%, unit test timing | 2 runs, use the **worse** result |
| `high` | High variance: API latency, benchmark, ML accuracy | 3–5 runs, use **median** |

### Multi-Run Median (high Tolerance)

```
runs = []
repeat 3–5 times:
  result = run Measure command
  runs.append(result)
metric = median(runs)   ← use median, not mean (resistant to single outlier spikes)
```

### Min-Gain Threshold by Tolerance Level

Only keep an attempt if improvement exceeds:
- `Tolerance: low` — `Min-Gain: 0` (any improvement counts)
- `Tolerance: medium` — `Min-Gain: 1–2% of baseline`
- `Tolerance: high` — `Min-Gain: 3–5% of baseline`

When in doubt, set `Min-Gain` higher rather than lower. Keeping marginal changes from noise wastes future iterations.

### Confirmation Run (high-stakes decisions)

For the final 3 iterations or when improvement > 20%, re-verify before committing:

```
candidate looks good →
  run Measure command one more time →
  compare to initial measurement this iteration →
  if within 2% → confirm accept
  if outside 2% → treat as medium noise, average the two
```

### Environment Pinning (user responsibility)

hc-optimize cannot control the environment. For stable measurements ensure:
- Fixed random seeds for ML workloads
- Consistent cache state (warm or cold — choose one, stick with it)
- No background processes competing for CPU during measurement
- Same input data across all runs in a session

### Config Examples by Domain

**Low noise (lint errors):**
```
Measure: npx eslint src --format=json 2>/dev/null | node -e "const r=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); console.log(r.reduce((a,f)=>a+f.errorCount,0))" || echo 999
Tolerance: low
Min-Gain: 0
Direction: lower
Guard: npm test
```

**Medium noise (build time):**
```
Measure: { start=$(date +%s%N); npm run build 2>/dev/null; echo $(( ($(date +%s%N) - start) / 1000000 )); }
Tolerance: medium
Min-Gain: 200
Direction: lower
Guard: npx tsc --noEmit
```

**High noise (API latency via wrk):**
```
Measure: wrk -t2 -c10 -d10s http://localhost:3000/api/health 2>/dev/null | grep 'Latency' | awk '{print $2}' | sed 's/ms//'
Tolerance: high
Min-Gain: 5
Direction: lower
Guard: npm test
```
