# Observability Review Checklist

Overlay for changes that introduce, modify, or remove logging, metrics, tracing, alerting, or error tracking.
Load alongside `checklists/base.md` — does not replace it.

**Trigger:** diff touches logging libraries (winston, pino, structlog, zap), metrics clients (prometheus, statsd, datadog), tracing (opentelemetry, jaeger), error tracking (sentry, bugsnag), health-check endpoints, or feature flag evaluation paths.

---

## Logging

| # | Check | Severity |
|---|-------|---------|
| OB-01 | Log entries include correlation ID / trace ID — distributed logs are searchable across services | HIGH |
| OB-02 | Sensitive data not logged: PII, passwords, tokens, card numbers, SSNs — even in debug level | CRITICAL |
| OB-03 | Log level is appropriate: DEBUG (local only), INFO (normal operations), WARN (recoverable), ERROR (needs human action) | MEDIUM |
| OB-04 | Errors logged with stack trace and context (request ID, user ID, operation) — not just message | HIGH |
| OB-05 | No log pollution: fast paths (health checks, readiness probes) are not logged at INFO level | LOW |
| OB-06 | Structured logging (JSON) used, not unformatted strings — fields are consistent across services | MEDIUM |

## Metrics

| # | Check | Severity |
|---|-------|---------|
| OB-07 | New business operation has a metric (counter or histogram) — latency/error rate can be alerted on | HIGH |
| OB-08 | Metric names follow existing convention (prefix, snake_case, units in name: `_seconds`, `_bytes`) | MEDIUM |
| OB-09 | Cardinality safe: no high-cardinality label values (user ID, request ID, free-form strings) in metric labels | HIGH |
| OB-10 | Error paths increment an error counter — silent failures are not hidden from dashboards | HIGH |
| OB-11 | Histogram buckets appropriate for the operation's expected latency range | LOW |

## Tracing

| # | Check | Severity |
|---|-------|---------|
| OB-12 | Spans created for non-trivial operations (DB queries, external HTTP calls, async jobs) | MEDIUM |
| OB-13 | Span names are stable identifiers, not dynamic values (no user input in span name) | HIGH |
| OB-14 | Errors recorded on the span (`span.recordException()` or equivalent) — not just logged | MEDIUM |
| OB-15 | Context propagated across async boundaries and service calls | HIGH |

## Error Tracking

| # | Check | Severity |
|---|-------|---------|
| OB-16 | Exceptions captured by error tracker (Sentry, Bugsnag, etc.) with meaningful context — not swallowed | CRITICAL |
| OB-17 | Expected errors (user validation, 404s) not sent to error tracker — noise reduces signal | MEDIUM |
| OB-18 | `try/catch` blocks do not silently swallow errors without logging or re-throwing | CRITICAL |

## Health Checks & Readiness

| # | Check | Severity |
|---|-------|---------|
| OB-19 | New dependency (DB, cache, external API) included in health check if it's critical for startup | HIGH |
| OB-20 | Health check does not perform expensive operations (no full table scans, no external calls per probe) | HIGH |

## Alerting Surface

| # | Check | Severity |
|---|-------|---------|
| OB-21 | New error conditions have a defined severity — someone on-call will know if this fires at 3am | MEDIUM |
| OB-22 | Removed or renamed metric/log fields — existing dashboards and alerts updated or noted in PR description | HIGH |

---

## Output Format

```
Observability Review: N issues (X critical, Y high, Z medium)

**CRITICAL** (blocking):
- [OB-NN] file:line — finding
  Fix: suggested fix

**HIGH** (should fix before ship):
- [OB-NN] file:line — finding
```
