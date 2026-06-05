# Validate Workflow

Interview the user with critical questions to validate assumptions, confirm decisions, and surface potential issues before coding begins.

## Plan Resolution

1. If `$ARGUMENTS` provided → use that path
2. Else check `## Plan Context` in injected context → use active plan path
3. If no plan found → ask user to specify path or run `{skill:hc-plan}` first

## Process

### Read Plan

Read `plan.md` and all `phase-XX-*.md` files. Identify: assumptions, decision points, risks, tradeoffs, and any `[UNVERIFIED]` markers.

### Verification Pass (Auto-Scaled)

Before interviewing, verify plan accuracy against the actual codebase. Load `references/verification-roles.md` for role definitions.

**Skip if:** `plan.md` already has a `## Red Team Review` section with verification evidence — limit this pass to resolving any remaining `[UNVERIFIED]` markers only.

Scale by phase count:
- 1–2 phases → Light: Fact Checker only (5 claims/phase)
- 3–4 phases → Standard: Fact Checker + Contract Verifier (10 claims/phase)
- 5+ phases → Full: all roles (15+ claims/phase)

For each active role: sample claims per phase, run grep/glob to verify file paths, symbols, and endpoints. Collect: VERIFIED | FAILED | UNVERIFIED.

FAILED findings become additional interview questions (never auto-correct). Append results to `## Validation Log` in `plan.md`:

```
### Verification Results
Claims checked: N | Verified: N | Failed: N | Unverified: N
Tier: Light | Standard | Full
Failures: [list with file:line evidence]
```

### Generate Questions

Load `references/validate-questions.md` for question categories. For each identified topic, formulate a concrete question with 2–4 options. Mark the recommended option with "(Recommended)".

Generate 3–8 questions total. Prioritize: assumptions that could invalidate the approach, risks not addressed in Risk Notes, decisions not yet confirmed.

### Interview User

Use `AskUserQuestion`. Group related questions (max 4 per call). Focus on: assumptions, risks, tradeoffs, architecture decisions.

Only ask about genuine decision points. If the plan is simple, fewer than 3 questions is fine.

### Document Answers

Append a `## Validation Log` section to `plan.md` with answers and any plan revisions agreed during the interview.

### Propagate to Phases

Update affected phase files based on interview answers. Only propagate decisions that directly change Implementation Steps, Success Criteria, or Risk Notes.

### Consistency Sweep

After all edits from propagation, run a fast scan across the plan to catch stale references. Spend ≤5 minutes.

Check for:
- File paths in `## Related Files` that were renamed or moved per interview decisions
- Symbol or function names changed during the interview — grep to confirm updated throughout the plan
- Phase dependency numbers still referencing valid phase numbers after any phase adds/removes
- Scope changes from the interview that haven't been reflected in all affected phase overviews

Tag stale claims `[STALE: reason]`. If clean: "Consistency: OK".

## Output

After validate completes:

```
Validation complete. Questions asked: N | Decisions confirmed: N | Failures resolved: N
Next: {skill:hc-cook} {plan-path} [--auto if Failed: 0]
```

If Verification Results show `Failed: 0` → recommend `--auto`. If `Failed: N > 0` → recommend interactive (no `--auto`) so Checkpoints catch unresolved issues.
