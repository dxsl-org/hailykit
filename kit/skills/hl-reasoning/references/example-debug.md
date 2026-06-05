---
name: example-debug
description: Worked example — applying sequential reasoning to performance debugging of a slow API endpoint.
---

# Example: Performance Debugging

**Problem:** API endpoint `GET /api/users/{id}/dashboard` responds in 2–3 seconds instead of the target <200ms.

## Sequential Reasoning Approach

```
Thought 1/5: Scope the investigation

Endpoint: GET /api/users/{id}/dashboard
Expected: < 200ms
Actual: 2–3s

Need to locate the bottleneck before attempting any fix.
Next: examine what the endpoint does

Thought 2/5: Analyze endpoint logic

Dashboard response requires:
- User profile
- Recent activities (last 50)
- Unread notifications
- Analytics summary

Each is a separate database query. N+1 is a candidate if any query loops.
Next: profile actual execution

Thought 3/6: Profiling results (total adjusted — more complexity than expected)

Profiler output:
- User profile query: 20ms
- Activities query: 1800ms  ← 90% of total time
- Notifications query: 100ms
- Analytics query: 80ms

Activities is the bottleneck. Need to examine that specific query.
Next: investigate the activities query

Thought 4/6 [BRANCH A]: Hypothesis — N+1 query

Activities table has a user_id foreign key.
Possible pattern: fetch all activities, then fetch the user for each row (N+1).
Verification: inspect whether the query uses a JOIN or a per-row lookup.

Thought 4/6 [BRANCH B]: Hypothesis — missing index

Activities table may lack an index on user_id + created_at.
Without a composite index, a sort by created_at requires a full table scan.
Verification: check the table's index list.

Thought 5/6 [VERIFICATION]: Test both hypotheses

Query inspection: uses proper JOIN — no N+1.   Branch A eliminated.
Index inspection: user_id is indexed; created_at is NOT indexed.
Query filters by user_id AND sorts by created_at — requires both for efficiency.

Branch B confirmed: the missing composite index causes a slow sort.
Root cause identified.
Next: implement the fix

Thought 6/6 [FINAL]: Fix and verify

Add composite index:
```sql
CREATE INDEX idx_activities_user_created
  ON activities(user_id, created_at DESC);
```

After index creation: endpoint now responds in 120ms — target met.

Confidence: high (verified with profiler before and after)
Result: 95% latency reduction
```

## Techniques Demonstrated

1. **Parallel branching for hypothesis testing** — N+1 and missing-index hypotheses explored simultaneously
2. **Verification before implementing** — both hypotheses tested before writing any fix
3. **Data-driven investigation** — profiler output guided which query to focus on
4. **Dynamic adjustment** — expanded from 5 to 6 thoughts when profiling revealed more complexity
5. **Explicit elimination** — Branch A ruled out cleanly before committing to Branch B
