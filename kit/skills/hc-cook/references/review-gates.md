# Code Review Cycle

Interactive review-fix cycle used in code workflows.

Artifact contract: `references/review-artifacts.md`.

## Required Review Artifacts

Before finalize, commit, ship, push, PR, or deploy, create/update:

- `context-snippets.json`
- `risk-gate.json`
- `verification.json`
- `review-decision.json`
- `adversarial-validation.json` when auto, high-risk, large-diff, or ship-like

Artifact directory:
- Plan workflow: `.agents/<plan-dir>/reports/harness/`
- No-plan workflow: `.agents/reports/harness/<timestamp-slug>/`
- Active pointer: `.agents/workflow-artifacts.json`

Run:

```bash
node claude/hooks/workflow-artifact-gate.cjs --stage finalize --artifact-dir <artifact-dir>
```

## Elevated Scrutiny Triggers

Certain conditions demand additional review layers beyond the standard haily-reviewer:

| Surface area | Extra reviewer |
|---|---|
| Autonomous execution (`--auto` flag) | adversarial challenge |
| Security-sensitive surfaces (auth flows, credential handling, payment logic) | domain risk audit |
| Data-layer mutations (schema changes, migration scripts) | domain risk audit |
| External contracts (public API shapes, exported types, env var contracts) | domain risk audit |
| Infrastructure touchpoints (CI pipelines, deploy configs, release scripts) | domain risk audit |
| Destructive operations (bulk file deletion, data wipes, irreversible writes) | domain risk audit |
| High-volume outbound actions or large diffs (ship / push / PR / deploy) | adversarial challenge |

There is no averaging or majority-vote logic. A single evidenced critical finding is sufficient to block.

## Interactive Review Loop (3-round cap)

```
rounds_left = 3

REPEAT:
  reviewer  ← spawn haily-reviewer → writes review-decision.json
  IF elevated_scrutiny_trigger:
    spawn adversarial / domain reviewer → writes adversarial-validation.json + risk-gate.json
  gate ← run artifact validator

  present: verdict, score, blockers, warnings, artifact location

  IF blockers exist:
    choice ← AskUserQuestion ["Resolve blockers", "Abort"]
    IF resolve AND rounds_left > 0:
      apply fixes → re-run tests → rounds_left -= 1 → REPEAT
    IF resolve AND rounds_left == 0:
      AskUserQuestion ["Accept remaining risks and proceed", "Abort workflow"]
  ELSE:
    choice ← AskUserQuestion ["Approve", "Address warnings", "Abort"]
    IF address warnings AND rounds_left > 0:
      apply fixes → rounds_left -= 1 → REPEAT
    IF approve → PROCEED
```

## Autonomous Review (`--auto`)

In `--auto` mode the agent operates without human pauses. It resolves what it can, and exits with a written report when it cannot.

```
budget = 3   # max self-repair attempts

REPEAT:
  spawn haily-reviewer → review-decision.json
  populate risk-gate.json
  IF elevated scrutiny required → spawn adversarial validator
  run artifact gate

  WHEN verdict == PASS AND gate clears:
    → auto-approve, continue pipeline

  WHEN blocker detected AND budget > 0:
    → select lowest-risk remediation (prefer undo over patch)
    → re-run affected tests + gate
    → budget -= 1 → REPEAT

  WHEN budget exhausted OR hard block:
    → write incident report to .agents/reports/cook-incident-{slug}.md
       (contents: root cause, attempted fixes, suggested next action)
    → terminate run — no interactive prompt
```

Score is never sufficient for approval. `score >= 9.5` is only a confidence signal.

## Adversarial Challenge Prompt

```
Stress-test the implementation of <phase> — your job is to find what breaks, not what looks nice.
Focus exclusively on: functional correctness, acceptance-criteria gaps, regression paths through shared code, and contract stability.
Out of bounds: style preferences, alternative architectures, nice-to-have suggestions.
Structured output (JSON-ready):
- verdict: CLEAR | RISKS_NOTED | BLOCKED
- falsePositives[]: review claims that don't hold under scrutiny
- gaps[]: acceptance criteria lacking proof
- evidenceNeeded[]: assertions without test or manual verification
- regressionPaths[]: call chains through modified code that could break
```

## Output Formats

- Waiting: `Step 5: Code reviewed - [decision], validator [pass|warn|block] - WAITING`
- After fix: `Step 5: Fixed [N] blockers - validator pass - Approved`
- Auto-approved: `Step 5: Review PASS - validator pass - Auto-approved`
- High-risk stop: `Step 5: High-risk auto stop - human approval required before finalize`
