---
name: review-adversarial
description: Stage 3 Stress Probe that actively tries to break code — finds security holes, false assumptions, failure modes, race conditions. Spawns adversarial haily-reviewer subagent. Includes scope gate for trivial changes.
---

# Adversarial Review (Stage 3 — Stress Probe)

Runs after every Stage 2 (Quality) pass. Subject to the scope gate below.

## Scope Gate

Skip when ALL of the following are true:
- Changed files ≤ 2
- Lines changed ≤ 30
- No security-sensitive files touched (auth, crypto, input parsing, SQL, env, migration)
- No new dependencies added

When skipped, emit: `Adversarial: skipped (below threshold)` in review output.

**Never skip when any file is in:** `auth/`, `middleware/`, `security/`, `crypto/`; or when `package.json` / lockfile changed; or when environment variables, database schema, or API routes are added/changed.

## What to Attack

### Security Holes
- Injection vectors (SQL, command, XSS, template)
- Auth bypass paths (missing checks, privilege escalation)
- Secret exposure (logs, error messages, stack traces)
- Input trust boundaries (user input treated as safe)
- SSRF, path traversal, deserialization attacks

### False Assumptions
- "This will never be null" — find the case where it can be
- "This list always has elements" — find the empty case
- "Users always call A before B" — find the out-of-order path
- "This config value exists" — find the missing env var
- "This third-party API always returns 200" — find the failure mode
- "This API shape won't change" — find the breaking caller

### Failure Modes & Resource Exhaustion
- Full disk, network timeout mid-operation, database connection drop during transaction
- Unbounded allocations from user-controlled input
- Missing timeouts on external calls
- Event loop blocking (sync operations in async context)
- Connection/handle leaks on error paths
- Regex catastrophic backtracking (ReDoS)

### Race Conditions
- Shared mutable state without locks
- Time-of-check-to-time-of-use (TOCTOU)
- Async operations with implicit ordering assumptions
- Cache invalidation during concurrent writes

### Data Corruption
- Partial writes on failure (no transaction/rollback)
- Type coercion surprises (string `"0"` as falsy)
- Floating point comparison for equality
- Timezone-naive datetime operations

### Supply Chain & Dependencies
- New dependencies: postinstall scripts, maintainer reputation, bundle size
- Lockfile changes: version drift, removed integrity hashes
- Transitive deps pulling in known-vulnerable packages

### Observability Blind Spots
- Swallowed errors (`catch {}` with no log)
- Missing structured context in error logs
- PII in log output

## Process

### Spawn Adversarial Reviewer

Dispatch `haily-reviewer` subagent with this prompt template:

```
Adversarial code review. Find every way this code can fail, be exploited, or produce incorrect results.

DO NOT praise the code. DO NOT note what works well.
Report problems only. If you find nothing, say "No findings" — but exhaust all attack vectors first.

Focus on ADDED/MODIFIED lines (+ prefix in diff). Pre-existing code is out of scope
unless the change makes it newly exploitable.

Context (read for understanding, do NOT review):
{CONTEXT_FILES}

Runtime: {RUNTIME}
Framework: {FRAMEWORK}

Diff:
{DIFF}

Changed files: {FILES}

Attack vectors to check:
1. Security holes (injection, auth bypass, secret exposure)
2. False assumptions (null, empty, ordering, config, API contracts)
3. Failure modes + resource exhaustion (timeouts, leaks, unbounded input)
4. Race conditions (shared state, TOCTOU, async ordering)
5. Data corruption (partial writes, type coercion, encoding)
6. Supply chain (new deps, lockfile changes, transitive vulns)
7. Observability (swallowed errors, missing logs, PII in output)

For each finding:
- SEVERITY: Critical / Medium / Low
- CATEGORY: Security / Assumption / Failure / Race / Data / Supply / Observability
- LOCATION: file:line
- ATTACK: how to trigger
- IMPACT: what happens when triggered
- FIX: describe the approach (do not write implementation code)
```

If the adversarial reviewer returns >10 findings on <100 lines changed: likely over-aggressive. Deep-review Critical/Medium only; batch-reject noise.

### Adjudicate Findings

| Verdict | Meaning | Action |
|---------|---------|--------|
| **Accept** | Valid flaw, reproducible or clearly reasoned | Must fix before merge |
| **Reject** | False positive, already handled, or impossible path | Document why, no action |
| **Defer** | Valid but low-risk, tracked for later | Create GitHub issue |

Every finding gets a verdict — no silent dismissals. Critical findings: Accept unless you can prove false positive. Benefit of doubt goes to the adversary; safer to fix than dismiss.

**Calibration:**

| Verdict | Example | Reasoning |
|---------|---------|-----------|
| Accept | SQL injection via string interpolation in query builder | Clearly exploitable, concrete path shown |
| Reject | Missing null check on `config.apiUrl` | Config loaded at startup with schema validation (config.ts:12), cannot be null at runtime |
| Defer | No rate limiting on `POST /api/upload` | Valid concern but internal tool; track for public exposure |

## --deep: Refuter Votes

Under `--deep`, single-verdict adjudication is not the last word for Critical findings or for Medium findings the adjudicator marks Accept — "benefit of doubt goes to the adversary" (above) is explicitly overridden for these two categories only. Low findings, and any finding marked Reject or Defer, keep the normal single-pass adjudication unchanged.

### Skeptic Contract

For each Critical finding, and each Medium finding marked Accept, spawn 2–3 independent `haily-reviewer` subagents as refuters. Each refuter prompt:

```
Refute this code review finding. Your default posture is REFUTE — argue the finding is a false
positive, already handled, or an impossible path. Only concede the finding stands if you cannot
construct a refutation after checking the code.

Finding:
SEVERITY: {SEVERITY}
CATEGORY: {CATEGORY}
LOCATION: {file:line}
ATTACK: {ATTACK}
IMPACT: {IMPACT}

Read the code at {file:line} and any file it references. Evidence is required — a grep result, a
line citation, or a reproduction path. An unsupported assertion does not count as a refutation.

Verdict: REFUTED (cite the evidence) or STANDS (explain what you checked and why the finding survives).
```

### Survival Table

Spawn `haily-judge` with the finding, the refuters' verdicts (REFUTED/STANDS + evidence), and this table as the decision package to make the survives/demotes call. If the ultra spawn is unavailable or errors, fall back to the session model with the notice `⚠ apex judge unavailable — verdict by session model` (best-effort: a skill cannot deterministically detect Task-spawn failure).

Defined once here — every other reference to refuter-vote thresholds in this skill points back to this table, never restates the numbers.

| Refuters spawned | Survives (blocks) iff | Demotes to advisory iff |
|---|---|---|
| 2 | 0 successful refutations | ≥1 successful refutation |
| 3 | ≤1 successful refutation | ≥2 successful refutations |

A successful refutation is a `REFUTED` verdict backed by evidence (grep/code citation). A `REFUTED` verdict with no evidence does not count as successful; a `STANDS` verdict with no evidence still counts as a non-refutation (finding keeps surviving).

### Demotion

Findings that fail to survive votes demote from Accept (block) to advisory — never silently dropped. Attach the refutation text (which refuter, what evidence, which finding) to the demoted entry in the report so the developer can override if the refuter is wrong.

### Logging

Survivors log `refutation-resistant`; demotions log the refuter count and a one-line evidence summary:

```
✓ Refuter votes: [N] findings checked — [S] survived (refutation-resistant), [D] demoted to advisory
```

### Report Format

```
## Adversarial Review — Stress Probe

### Summary
- Findings: N total (X Critical, Y Medium, Z Low)
- Accepted: A (must fix)
- Rejected: B (false positive)
- Deferred: C (tracked via GitHub issues)

### Accepted Findings (Must Fix)

#### [1] SEVERITY — CATEGORY — file:line
**Attack:** how to trigger
**Impact:** what happens
**Fix:** approach description
**Verdict:** Accept — [reason]

### Rejected Findings

#### [N] SEVERITY — CATEGORY — file:line
**Attack:** claimed vector
**Verdict:** Reject — [reason this is a false positive]

### Deferred Findings

#### [N] SEVERITY — CATEGORY — file:line
**Attack:** how to trigger
**Verdict:** Defer — [reason] → GitHub issue #X
```

### Fix Accepted Findings

- Critical: block merge; fix immediately via `{skill:hc-fix}` or manual edit
- Medium: fix before merge if feasible; defer only with explicit user approval
- Low: track; fix in follow-up if the pattern repeats

**Re-review optimization:** on fix cycles, pass only the fix diff to the adversarial reviewer — not the full original diff. Verify accepted findings are resolved and the fix introduced no new issues.

## Pipeline Position

```
Stage 1 (Spec) → PASS
  ↓
Stage 2 (Quality) → PASS
  ↓
Scope gate → below threshold? → skip (emit note)
  ↓ (above threshold)
Stage 3 (Stress Probe) → findings adjudicated
  ├─ 0 Accepted → PASS → proceed
  ├─ Accepted Critical → BLOCK → fix → re-run Stage 3 (fix diff only)
  └─ Accepted Medium/Low only → fix or defer → proceed

Under --deep, insert before BLOCK:
Accepted Critical / accepted Medium → Refuter Votes (## --deep: Refuter Votes)
  ├─ Survives per Survival Table → BLOCK (logged "refutation-resistant")
  └─ Refuted per Survival Table → demote to advisory (refutation text attached) → proceed
```
