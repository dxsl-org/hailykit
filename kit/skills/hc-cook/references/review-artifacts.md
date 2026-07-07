# Workflow Review Artifacts

`hc:fix` and `hc:cook` use these JSON artifacts to make review and finalize gates deterministic. Scores are advisory. Approval comes from structured proof plus the validator.

## Artifact Directory

- Plan workflow: `.agents/<plan-dir>/reports/harness/`
- No-plan workflow: `.agents/reports/harness/<timestamp-slug>/`
- Active pointer: `.agents/workflow-artifacts.json`

The pointer stores only metadata:

```json
{
  "artifactDir": ".agents/example/reports/harness",
  "planPath": ".agents/example",
  "skill": "hc:cook",
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
  "skill": "hc:cook",
  "mode": "auto",
  "task": "Add user authentication to the app",
  "acceptanceCriteria": ["login succeeds with valid token", "401 returned for missing token"],
  "touchpoints": ["src/auth/auth.ts", "src/routes/login.ts"],
  "publicContracts": ["POST /api/login returns 200 with valid credentials"],
  "blastRadius": ["all routes using auth middleware"],
  "scoutSummary": "Auth module has 3 files. Pattern follows middleware chain in src/middleware/."
}
```

Invalid: missing `mode`, empty `acceptanceCriteria`, or no `touchpoints`.

### `risk-gate.json`

```json
{
  "highRisk": true,
  "reasons": ["auth system introduced"],
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
      "summary": "All 58 tests passed including new auth suite."
    }
  ],
  "beforeAfter": {
    "before": "no auth — all routes open",
    "after": "JWT auth on protected routes, public routes unaffected"
  }
}
```

Invalid: raw command logs, missing command summaries, or failed commands without a blocking review decision.

### `review-decision.json`

```json
{
  "decision": "PASS",
  "score": 9.4,
  "criticalCount": 0,
  "acceptanceCoverage": ["all acceptance criteria mapped to tests or manual proof"],
  "regressionProof": ["npm test passed", "existing routes still return 200"],
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

## Conditional Files

### `execution-evidence.json`

Required only when the Scope Contract set the `evidence` marker on `context-snippets.json` (i.e. the run declared a runtime surface via the Verify-by-Execution substep — see `references/process-steps.md`). Legacy artifact dirs without the marker do not need it and pass unaffected.

```json
{
  "phase": "phase-02-login-flow",
  "criteria": [
    { "criterion": "login succeeds with valid token", "command": "curl -s localhost:3000/api/login -d @creds.json", "evidenceRef": "200 OK, {\"token\":\"<redacted>\"}", "pass": true }
  ]
}
```

For phases with no runtime surface (docs, pure refactor), state it explicitly instead of listing criteria:

```json
{ "phase": "phase-05-readme", "noRuntimeSurface": "documentation-only phase, no executable flow" }
```

Validation is shape + non-empty only (a non-empty `noRuntimeSurface` satisfies it on its own); the redaction policy below applies to captured `evidenceRef` output.

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
