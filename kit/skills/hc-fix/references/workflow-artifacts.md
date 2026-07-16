# Workflow Review Artifacts

`{skill:hc-fix}` and `{skill:hc-cook}` use these JSON artifacts to make Verify-stage Checkpoints deterministic. Scores are advisory. Approval comes from structured proof plus the validator.

## Artifact Directory

- Plan workflow: `.agents/<plan-dir>/reports/harness/`
- No-plan workflow: `.agents/reports/harness/<timestamp-slug>/`
- Active pointer: `.agents/workflow-artifacts.json`

The pointer stores only metadata:

```json
{
  "artifactDir": ".agents/example/reports/harness",
  "planPath": ".agents/example",
  "skill": "hc:fix",
  "mode": "auto",
  "updatedAt": "2026-05-26T00:00:00.000Z"
}
```

**Write the pointer before writing any artifact files** — the hook uses it to locate artifacts at every gate. For no-plan workflows use `".agents/reports/harness/<timestamp-slug>"` for `artifactDir` and `null` for `planPath`.

Do not commit generated pointer files or artifact contents unless a plan explicitly calls for archived evidence.

## Required Files

### `context-snippets.json`

```json
{
  "skill": "hc:fix",
  "mode": "auto",
  "task": "Fix null check in auth.ts",
  "acceptanceCriteria": ["login succeeds with valid token", "401 returned for missing token"],
  "touchpoints": ["src/auth/auth.ts", "src/auth/middleware.ts"],
  "publicContracts": ["POST /api/login returns 200 with valid credentials"],
  "blastRadius": ["all routes using auth middleware"],
  "scoutSummary": "Auth middleware used in 8 routes. Token check added in v2.1.0 commit abc1234."
}
```

Invalid: missing `mode`, empty `acceptanceCriteria`, or no `touchpoints`.

### `risk-gate.json`

```json
{
  "highRisk": true,
  "reasons": ["auth middleware touched"],
  "autoStopRequired": true,
  "humanApproved": false,
  "largeDiff": false
}
```

High-risk means auth, secrets, payments, DB schema, public API contracts, CI/deploy/release, migrations, destructive filesystem operations, or production config. In `--auto`, `autoStopRequired: true` blocks finalize/commit/ship until `humanApproved: true`.

### `verification.json`

```json
{
  "commands": [
    {
      "command": "npm test",
      "status": "pass",
      "exitCode": 0,
      "timestamp": "2026-05-26T00:00:00.000Z",
      "summary": "All 42 tests passed including new auth regression test."
    }
  ],
  "beforeAfter": {
    "before": "401 not returned on missing Authorization header",
    "after": "401 returned correctly, login flow unaffected"
  }
}
```

Invalid: raw command logs, missing command summaries, or failed commands without a blocking review decision.

### `review-decision.json`

```json
{
  "decision": "PASS",
  "score": 9.6,
  "criticalCount": 0,
  "acceptanceCoverage": ["all acceptance criteria mapped to tests or manual proof"],
  "regressionProof": ["npm test passed"],
  "contractStatus": "OK",
  "blockingReasons": []
}
```

Valid decisions: `PASS`, `PASS_WITH_RISK`, `BLOCKED`. Any critical issue, blocking reason, or `BLOCKED` decision blocks hard stages.

### `adversarial-validation.json`

```json
{
  "decision": "PASS",
  "disprovenClaims": [],
  "unverifiedClaims": [],
  "missingProof": [],
  "reachableRegressions": []
}
```

Low-risk finalize may warn when this file is absent. High-risk, large-diff, auto, ship, push, PR, and deploy flows must produce it. Any disproven claim or reachable regression blocks hard stages.

## Redaction Policy

Artifacts must not contain raw secrets, API keys, bearer tokens, cookies, authorization headers, private keys, or dotenv lines. Command output must be summarized. If a snippet is needed, redact first:

```json
{
  "summary": "Request failed with Authorization header redacted.",
  "redacted": true
}
```

The validator reports only artifact field paths for secret-like content, never the value.

## Approval Rules

- Score never approves by itself.
- Any evidenced critical issue blocks.
- `PASS_WITH_RISK` may continue only on soft stages with the risk surfaced.
- Hard stages (`ship`, `push`, `pr`, `deploy`) require all five artifacts and `PASS`.
- High-risk `--auto` requires explicit human approval before finalize/commit/ship.
- If artifact generation fails, retry once. If it still fails, escalate to the user instead of bypassing.
