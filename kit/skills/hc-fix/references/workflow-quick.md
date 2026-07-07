# Quick Workflow — Active Incident

Emergency fix for active production incidents (this workflow was activated by the old `hotfix` flag). Speed is secondary to surgical precision — a bad quick fix compounds the incident. Every step has a hard time cap.

**Activation:** `{skill:hc-fix} [description] --quick`

**Non-use:** if the issue is not causing active user impact or data loss right now, use the standard workflow instead.

---

## Pre-conditions (verify before starting)

| Check | Action if fails |
|-------|----------------|
| Issue is confirmed in production (not staging/dev) | Revert to standard fix |
| Rollback plan exists before touching code | Define rollback first, then proceed |
| On-call lead / incident commander notified | Notify before fixing |

---

## Step 1: Triage (≤5 min)

Classify severity to determine scope of bypass:

| Severity | Definition | Bypass |
|----------|-----------|--------|
| **S1** — Data loss or security breach | Full test suite skipped; direct push to main | Maximum bypass |
| **S2** — Full service outage (all users affected) | Fast test path; PR optional | High bypass |
| **S3** — Partial degradation (<50% users) | Fast test path; PR required | Moderate bypass |

State: severity, user impact estimate, rollback plan, time budget for fix.

Log `✓ Triage: S[N] — [impact] — rollback: [plan]`

---

## Step 2: Diagnose (≤10 min)

Minimum viable diagnosis. Do NOT spend more than 10 minutes here.

1. Read the error: exact message, stack trace, timestamp, frequency
2. Identify the breaking change: `git log --oneline -10` — what was deployed last?
3. Narrow to one specific `file:line` root cause
4. If not found in 10 min → consider rollback of last deploy first, diagnose offline

**Do NOT attempt a fix without a confirmed `file:line` root cause.**

Log `✓ Diagnose: [file:line] — [root cause]`

---

## Step 3: Fix (≤20 min)

**Minimum viable change principle**: the diff must be as small as possible.

- ONE commit. ONE logical change. No refactoring, no cleanup, no improvements.
- If the fix requires >50 lines changed → stop. Consider rollback instead.
- Check: does this fix introduce new risk? (new library, schema change, config change)
- Security check: `git diff --cached | grep -iE "(api[_-]?key|token|password|secret)"` — no secrets

Log `✓ Fix: [N] lines — [file:line]`

---

## Step 4: Minimal Verify (≤10 min)

Do NOT run the full test suite. Run only what directly covers the broken path.

```bash
# Run only tests in files directly touching the fix
# e.g. for Node.js:
npm test -- --testPathPattern="[affected-file]"

# Type check
npm run typecheck

# Build
npm run build
```

If smoke tests fail → **revert the fix**, execute rollback, diagnose offline.

If smoke tests pass → proceed.

Log `✓ Verify: [N] targeted tests pass — typecheck clean — build clean`

---

## Step 5: Emergency Ship

> **Required — incident confirmation before direct push:** a habitual `--quick` invocation must not silently push to `main`. Before the S1/S2 direct-push path below, confirm this is a genuine incident: interactive mode asks one `AskUserQuestion` ("Confirm S[N] incident — push directly to main, bypassing tests and review?"); `--auto` mode requires an incident link (ticket/page/Slack thread) already present in the invocation. **Without confirmation or a link, fall back to the normal branch + PR ship path (S3 below) regardless of triaged severity.**

### S1/S2 — Direct push (confirmed incident only)

```bash
git commit -m "hotfix: [description]"
git push origin main
```

Then trigger redeploy immediately.

### S3 — Fast PR

```bash
git push origin hotfix/[description]
gh pr create --base main --title "hotfix: [description]" --body "S3 incident: [link]" --draft
# Request emergency review from on-call lead (Slack/PagerDuty)
gh pr merge --auto --squash  # merge on approval
```

Log `✓ Ship: [direct push | PR #NNN]`

---

## Step 6: Monitor (10 min post-deploy)

Define the **signal** that confirms the fix worked:

| Signal | Tool | Target |
|--------|------|--------|
| Error rate drops | Sentry / Datadog | Back to baseline |
| Latency normalized | APM | P99 < threshold |
| Service restores | Health check | Returns 200 |

Watch for 10 minutes. If signal does not appear → **execute rollback immediately**.

Log `✓ Monitor: [signal observed] — incident closed`

---

## Step 7: Post-Incident (within 24h — mandatory)

A quick fix is a debt instrument. These must happen:

1. Spawn `haily-reporter` subagent → write incident report to `.agents/incidents/`
2. Open normal fix ticket for proper root-cause resolution
3. Write regression test (the smoke test from Step 4 promoted to permanent suite)
4. Review whether monitoring would have caught this earlier (observability gap?)
5. Update runbook if applicable

Log `✓ Post-incident: incident report written — follow-up ticket created`

---

## Rollback Decision Tree

```
Fix deployed →
  Signal improving within 10 min? → Continue monitoring → Incident closed
  No improvement after 10 min?  → ROLLBACK NOW → Diagnose offline
  New symptoms appear?          → ROLLBACK NOW → Diagnose offline
```

Rollback is not failure. A delayed rollback that cascades is failure.
