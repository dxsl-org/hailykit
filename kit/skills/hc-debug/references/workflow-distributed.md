# Distributed System Debugging Workflow

Diagnose failures that span multiple services, queues, or databases. The challenge: the symptom appears in service C but the cause lives in service A. Evidence must be correlated across service boundaries before drawing conclusions.

**Activation:** `{skill:hc-debug} --trace [trace-id | symptom]`

---

## Step 1: Anchor on a Trace ID

Every distributed investigation should start with a single trace ID if available. A trace ID ties together all spans across all services for one user request.

```bash
# Find trace ID from user report or error log
grep "trace_id" /var/log/app.log | grep "[error-timestamp]"

# Pull all spans for this trace from APM (Datadog, Jaeger, Zipkin)
# Or from structured logs:
grep '"trace_id":"abc123"' /var/log/*.log | sort -k timestamp
```

If no trace ID: establish the **time window** from the symptom (error timestamp ± 30s) and the **affected user ID / request ID** as the correlation anchor.

---

## Step 2: Map the Request Path

Before diving into logs, draw the call graph for the affected request type:

```
Client → API Gateway → Auth Service → Order Service → Payment Service → Notification Queue → Email Worker
```

**Identify:**
- Which services are on the **critical path** (latency from all of them adds up)
- Which are **async** (failure appears delayed)
- Where **data is persisted** (DB writes that could leave inconsistent state)
- Where **retries** are configured (a failure might not be visible if retried successfully)

---

## Step 3: Correlate Logs Across Services

Collect logs from all services in the path for the time window. Look for the **first failure** — not the last symptom.

```bash
# Grep for trace ID across multiple log files
grep "abc123def" service-a.log service-b.log service-c.log | sort

# If using structured JSON logs:
jq 'select(.trace_id == "abc123def")' *.log | sort_by(.timestamp)

# For Kubernetes:
kubectl logs --since=10m deployment/order-service | grep "abc123def"
```

**Correlation checklist:**
- Which service logs the **first error**?
- Is the first error at the **same timestamp** as the user-visible failure, or earlier?
- Are there **timeout patterns** (one service waiting too long for another)?
- Are there **retry storms** (the same call attempted many times)?

---

## Step 4: Identify Failure Category

| Pattern | Likely Cause |
|---------|-------------|
| Service A succeeds, Service B fails immediately | B has a configuration error or dependency down |
| Service A responds, B never receives the request | Network / load balancer / service discovery issue |
| All spans succeed but total latency is high | A gap between spans — queue wait, lock, or GC pause |
| Request fails, retried, succeeds — but data is wrong | Partial write before failure; retry wrote duplicate |
| Service A shows success, downstream shows failure | A's "success" is async — the actual work failed later |
| Failure only under load | Resource exhaustion (connection pool, thread pool, memory) |

---

## Step 5: Isolate the Fault Domain

Once you identify the service with the **first failure**:

1. Read that service's logs in detail for the failure window
2. Check its **downstream dependencies** (DB query latency, cache hit rate, external API response times)
3. Check its **resource utilization** at the time (CPU, memory, connection pool, thread pool)
4. Check for recent **deployments** in that service or its dependencies

```bash
# Check deployment timeline
kubectl rollout history deployment/order-service
gh release list --limit 20

# Check database query latency at failure time
# (Query your APM or slow-query log)

# Check connection pool exhaustion
grep "connection pool" service.log | grep "[failure-timestamp]"
```

---

## Step 6: Confirm Causality (Not Just Correlation)

Symptoms appearing at the same time does not mean causality. Before concluding:

1. **Timeline check:** Does the cause precede the effect by the expected propagation time?
2. **Blast radius check:** Does the failure pattern match what you'd expect from the identified cause? (If auth service is down, ALL requests should fail — not just orders from one region)
3. **Eliminate alternatives:** What else could produce this symptom? Have you ruled it out?

---

## Step 7: Data Consistency Check

If the failure involved writes, verify data consistency:

```sql
-- Check for orphaned records (order without payment, payment without order)
SELECT o.id FROM orders o LEFT JOIN payments p ON o.id = p.order_id WHERE p.id IS NULL;

-- Check for duplicate records (if retries caused double-writes)
SELECT user_id, COUNT(*) FROM orders GROUP BY user_id HAVING COUNT(*) > 1;
```

---

## Output Format

```
## Distributed Debug Report — [trace-id or symptom] — [date]

**Symptom:** [user-visible failure]
**Trace ID:** [if available]
**Time window:** [start] → [end]
**Affected scope:** [N users / N% of requests / specific region]

### Service Map
[Call graph with failure point marked]

### Root Cause
- **Fault domain:** [service name]
- **First failure:** [timestamp, service, error]
- **Cause:** [specific root cause with file:line if applicable]
- **Propagation:** [how it caused downstream failures]

### Data Consistency
- **Affected records:** [count and type]
- **State:** [consistent / inconsistent / partial writes]
- **Remediation needed:** [yes/no — specific steps if yes]

### Fix Recommendation
[Specific change in the fault domain + any consistency remediation]
```
