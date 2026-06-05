# Feature Flag Rollout Workflow

Gradual production rollout using feature flags — safer than direct deploy for high-risk features. Covers flag design, rollout stages, monitoring criteria, and cleanup.

**Activation:** `{skill:hc-ship} rollout [flag-name]`

---

## When to Use Feature Flags

Use a flag when ANY of these apply:
- Feature changes user-visible behavior (UI, pricing, flow)
- Feature touches data schema or write path
- Feature cannot be safely rolled back by deploy revert alone
- Feature needs A/B testing or gradual exposure

Skip flags for: internal refactors, performance optimizations with no behavior change, bug fixes.

---

## Step 1: Flag Design

Before creating the flag, define:

| Field | Decision |
|-------|---------|
| **Flag name** | `feature.[domain].[behavior]` (e.g. `feature.checkout.new-payment-flow`) |
| **Type** | Boolean (on/off) or multivariate (variant A/B/C) |
| **Targeting** | User ID, org ID, percentage, geography, beta cohort |
| **Default** | `false` (off) for new flags — never default to enabled |
| **Kill switch** | Can this be disabled in <60 seconds if production breaks? |
| **Cleanup date** | Set in the ticket/PR — flags with no cleanup date become permanent debt |

Create the flag in your feature flag service (LaunchDarkly, Unleash, Statsig, GrowthBook, or custom).

```typescript
// Code pattern — always read flag at request time, never cache at startup
const enabled = featureFlags.isEnabled('feature.checkout.new-payment-flow', { userId });
```

---

## Step 2: Deploy with Flag Off

Deploy the code behind the flag first — feature is unreachable in production.

**Verify after deploy:**
- Flag is `false` for all users (confirm in flag service dashboard)
- No errors in logs related to the new code path
- No unexpected metric changes (the code path is not reached)

---

## Step 3: Staged Rollout

Enable the flag incrementally. Each stage: enable → monitor → decide.

| Stage | Audience | Monitor duration | Signal to advance |
|-------|---------|----------------|-------------------|
| **Internal** | Engineering team (user IDs) | 1h | No crashes, correct behavior |
| **Beta** | Beta users or 1% | 24h | Error rate baseline holds, no regressions |
| **10%** | 10% of users | 24–48h | p99 latency stable, conversion rate unchanged |
| **50%** | 50% of users | 24h | Same metrics at scale |
| **100%** | All users | 24h | Incident-free → cleanup scheduled |

Compress stages for low-risk changes. Extend or pause at any stage if signals are unclear.

---

## Step 4: Monitor at Each Stage

Define your signal before enabling the stage:

```
Success criteria for [feature.checkout.new-payment-flow]:
  Error rate: < 0.5% (baseline: 0.2%)
  Payment conversion: > 94% (baseline: 95% ± 1%)
  P99 latency: < 800ms (baseline: 650ms)
  Rollback trigger: any metric degrades > 20% from baseline for > 5 min
```

**Dashboard to watch:**
- Error rate in Sentry/Datadog
- Conversion funnel (if applicable)
- Latency percentiles (p50, p95, p99)
- Business metric (revenue, activation, retention) if applicable

---

## Step 5: Rollback Criteria

**Immediate rollback (disable flag in <60s):**
- Error rate > 2× baseline
- Critical user journey fails (checkout, login, payment)
- Data integrity issue detected

**Pause and investigate:**
- Metrics degraded 10–20% — not urgent but concerning
- Unusual support volume

**Do not rollback for:**
- Metric noise within ± 5% of baseline
- Isolated user reports without metric signal

```bash
# Emergency disable via CLI (if supported)
feature-flags disable feature.checkout.new-payment-flow

# Or via API
curl -X PATCH https://flags-api/flags/feature.checkout.new-payment-flow \
  -d '{"enabled": false}'
```

---

## Step 6: Cleanup (mandatory within 30 days of 100% rollout)

Permanent flags are technical debt. Remove the flag and the conditional code.

```bash
# Find all references to the flag
grep -rn "feature.checkout.new-payment-flow" .

# Remove: flag reads, A/B branches, dead code (the old path)
# The "new" path becomes the only path
```

**Cleanup checklist:**
- [ ] Remove flag from codebase (all `isEnabled(...)` calls)
- [ ] Remove old code path (the branch that was `!enabled`)
- [ ] Archive flag in flag service (not delete — keep for audit)
- [ ] Delete feature flag environment configurations
- [ ] Update tests that reference the flag

---

## A/B Test Variant

When running A/B experiments (not just feature rollout):

1. Define **hypothesis**: "New flow increases payment conversion by 5%"
2. Define **sample size** needed for statistical significance (use a calculator: ~1000 events per variant for 95% confidence)
3. Run **both variants simultaneously** at 50/50 (not sequential)
4. Measure for at least **2 business cycles** (e.g., 2 weeks to capture weekly patterns)
5. Declare a winner only when **p-value < 0.05** — not when you like the trend

```
A/B Result Format:
  Hypothesis: [stated hypothesis]
  Control (A): [metric] = [value] (N=[sample size])
  Treatment (B): [metric] = [value] (N=[sample size])
  Relative change: [X%]
  p-value: [0.0X]
  Decision: [ship B / keep A / extend test]
```
