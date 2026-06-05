# Review Lenses

Four adversarial lenses for red-team review. Each reviewer adopts one lens and produces evidence-backed findings only — no speculation without codebase proof.

## Lenses

| Reviewer | Lens | Targets |
|---|---|---|
| **Security Adversary** | Attacker mindset | Auth bypass, injection, data exposure, privilege escalation, supply chain risks |
| **Failure Mode Analyst** | Murphy's Law | Race conditions, data loss, cascading failures, recovery gaps, rollback holes |
| **Assumption Destroyer** | Skeptic | Unstated dependencies, false "will work" claims, missing error paths, scale and integration assumptions |
| **Complexity Critic** | YAGNI enforcer | Over-engineering, premature abstraction, unnecessary scope, missing MVP cuts |

## Verification Tier by Plan Size

Each reviewer also performs codebase verification. Tier is set by phase count, not persona.

| Phases | Tier | Verification |
|---|---|---|
| 1–2 | Light | Fact Checker only (5 claims/phase) |
| 3–4 | Standard | Fact Checker + Contract Verifier (10 claims/phase) |
| 5+ | Full | Lens-specific role (15+ claims/phase) |

| Lens | Verification Role (Full Tier) |
|---|---|
| Security Adversary | Fact Checker |
| Failure Mode Analyst | Flow Tracer |
| Assumption Destroyer | Scope Auditor |
| Complexity Critic | Contract Verifier |

See `references/verification-roles.md` for role definitions.

## Evidence Requirement

Every finding must cite a specific location in the plan AND grep/glob evidence from the codebase. A finding without `file:line` evidence is auto-rejected during adjudication.

## Reviewer Instructions

Include in every reviewer subagent prompt:

```
You are reviewing a PLAN DOCUMENT, not code. Do not lint, build, or test.
DO run grep/glob to verify the plan's factual claims against the actual codebase.

Adopt the {LENS} perspective. Find every flaw you can.

Rules:
- Cite exact phase and section for each finding
- Describe the concrete failure scenario, not just "could be a problem"
- Rate severity: Critical (blocks success) | High (significant risk) | Medium (notable concern)
- Skip style, naming, and formatting observations
- No praise. No "overall looks good". Findings only.
- 5–10 findings per reviewer. Quality over quantity.
- Every finding needs grep/glob evidence (file:line). No evidence = rejected.

Output format per finding:
### Finding N: {title}
- **Severity:** Critical | High | Medium
- **Location:** Phase X, section "{name}"
- **Flaw:** {what is wrong}
- **Failure scenario:** {concrete description of how this fails in production}
- **Evidence:** {grep result or codebase quote}
- **Fix:** {brief recommendation}
```

## Adjudication Output

After collecting findings, write to `plan.md`:

```markdown
## Red Team Review

### {YYYY-MM-DD}
Findings: N total (A accepted, R rejected)
Severity: N Critical, N High, N Medium

| # | Finding | Severity | Disposition | Applied to |
|---|---------|----------|-------------|------------|
| 1 | {title} | Critical | Accept | Phase 2 |
```
