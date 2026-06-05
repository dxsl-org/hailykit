# Multi-Metric Optimization

Guide for optimizing a primary metric while keeping secondary metrics within acceptable bounds — the most common senior dev scenario (e.g. "reduce bundle size AND keep coverage above 80%").

---

## The Pattern

Compose Guard to encode secondary metric constraints:

```
Measure: <primary metric command>
Guard: <test suite> && <secondary-metric-check>
Direction: lower   # or higher — for the PRIMARY metric only
```

The `Measure` command drives improvement. The `Guard` encodes floors and ceilings for everything else. If secondary constraints are violated, the Guard fails and the iteration is discarded.

---

## Secondary Metric Floor (minimum acceptable value)

**Coverage floor** (don't let coverage drop below 80% while reducing bundle):
```bash
# In Guard:
COVERAGE=$(npx jest --coverage --coverageReporters=json-summary 2>/dev/null | node -e "const s=require('./coverage/coverage-summary.json');console.log(s.total.lines.pct)")
[ $(echo "$COVERAGE >= 80" | bc -l) -eq 1 ] && npm test
```

**Shorter version using jq:**
```bash
Guard: npm test && npx jest --coverage --coverageReporters=json-summary 2>/dev/null | node -e "const s=require('./coverage/coverage-summary.json');process.exit(s.total.lines.pct<80?1:0)"
```

**TypeScript error ceiling** (stay at zero errors while improving performance):
```bash
Guard: npx tsc --noEmit && [ $(npx tsc --noEmit 2>&1 | grep -c 'error TS') -eq 0 ]
```

---

## Common Multi-Metric Configurations

### Bundle size + coverage floor

```
Objective: Reduce main bundle size while keeping test coverage above 75%
Scope: src/**/*.ts, src/**/*.tsx
Measure: npx vite build 2>/dev/null | grep 'dist/index' | awk '{print $2}' | sed 's/kB//'
Guard: npx tsc --noEmit && npx jest --coverage --coverageReporters=json-summary 2>/dev/null | node -e "const s=require('./coverage/coverage-summary.json');process.exit(s.total.lines.pct<75?1:0)"
Direction: lower
Min-Gain: 0.5
```

### Lint error reduction + no new TypeScript errors

```
Objective: Eliminate ESLint errors without introducing TypeScript errors
Scope: src/**/*.ts
Measure: npx eslint src --format=json 2>/dev/null | node -e "const r=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); console.log(r.reduce((a,f)=>a+f.errorCount,0))" || echo 999
Guard: npx tsc --noEmit && npm test
Direction: lower
```

### Coverage increase + latency budget

```
Objective: Increase test coverage in src/api without increasing test suite runtime above 30s
Scope: src/api/**/*.ts, tests/api/**/*.test.ts
Measure: npx jest tests/api --coverage --coverageReporters=json-summary 2>/dev/null | node -e "const s=require('./coverage/coverage-summary.json');console.log(s.total.lines.pct)"
Guard: { START=$(date +%s%N); npm test; ELAPSED=$(( ($(date +%s%N) - START) / 1000000000 )); [ $ELAPSED -lt 30 ]; }
Direction: higher
Min-Gain: 0.5
```

### API latency + no p99 regression

```
Objective: Reduce median API latency while keeping p99 < 500ms
Scope: src/api/**/*.ts
Measure: wrk -t2 -c10 -d10s http://localhost:3000/api/health 2>/dev/null | grep 'Latency' | awk '{print $2}' | sed 's/ms//'
Guard: npm test && [ $(wrk -t2 -c10 -d10s http://localhost:3000/api/health 2>/dev/null | grep '99%' | awk '{print $2}' | sed 's/ms//') -lt 500 ]
Tolerance: high
Min-Gain: 5
Direction: lower
```

---

## When to Use Multi-Metric vs Standard

| Use case | Approach |
|----------|---------|
| Single metric, no constraints | Standard — just `Measure` + optional `Guard: npm test` |
| Primary metric + hard floor on one other | Multi-metric pattern — encode floor in Guard |
| Two competing primary metrics (conflicting objectives) | Run two separate optimization sessions sequentially |
| More than 2 constraints | Split into phases: fix blocking constraints first, then optimize |

**Do not** try to optimize two primary metrics simultaneously in one loop — conflicting objectives will cause thrashing (accept in one direction, discard in the other). Run them sequentially.

---

## Interpreting Multi-Metric Results

When iterations are frequently discarded with `status=guard-failed` (not `no-op` or `regressed`):
- The primary metric and secondary constraints may be **incompatible at current scope** — some bundle reduction requires removing tests that reduce coverage
- Consider widening `Scope` to allow restructuring, or relaxing the secondary constraint slightly
- Use `git log --grep="optimize(run-"` + TSV to see whether Guard or Measure is failing

When Guard fails consistently after early improvements:
- The easy wins for the primary metric all came at the cost of secondary metrics
- This is a design signal, not an optimization failure — surface the trade-off to the user
