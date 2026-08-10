---
name: hc-security
description: "STRIDE + OWASP audit with severity-ranked findings report. --quick for fast secret/dep scan; --deep for refuter-voted Critical findings; --fix to apply remediation iteratively."
when_to_use: "Invoke when running a STRIDE/OWASP audit, secret scan, or vulnerability check."
user-invocable: true
argument-hint: "[<scope glob | 'full'>] [--quick] [--deep] [--fix] [--iterations N] [--cross]"
metadata:
  attribution: "Security audit pattern adapted from autoresearch by Udit Goenka (MIT)"
  category: security
  keywords: [security, STRIDE, OWASP, audit, secrets, vulnerabilities, scan]
---

# Security Audit — STRIDE + OWASP

Run a scoped security audit and produce a severity-ranked findings report. With `--fix`, remediate iteratively behind a guard.

## Usage

```
{skill:hc-security} [<scope>] [--quick] [--deep] [--fix] [--iterations N] [--cross]
```

`scope` is a file glob or `full`; omitted means `full`.

- *(none)* Full STRIDE + OWASP audit.
- `--quick` Secrets, deps, and common vuln patterns only.
- `--deep` Every Critical finding gets refuter votes before it can block. Mutually exclusive with `--quick`; `--deep` wins if both are given. `haily.json` `deep.auto` can enable it by default, but explicit `--quick` still wins.
- `--fix` Audit then apply fixes iteratively (default 10 iterations).
- `--iterations N` Cap the fix loop.
- `--cross` Run `hailykit cross-review --stage code` on the finished deep-audit report only.

## Constraints

> **Required — recon-first:** Expand and read all in-scope files before analysis. Do not report findings for files not read.

## Process

1. Expand scope, read every in-scope file, and report `✓ Scope: N files`.
2. Run STRIDE against `references/quality-stride-owasp.md`.
3. Map findings to OWASP A01-A10.
4. Run dependency audit for the detected stack.
5. Run secret detection with `references/tech-secret-patterns.md`; redact actual values.
6. Rank findings Critical → High → Medium → Low → Info with `file:line` evidence.
7. Save `.agents/reports/security-YYMMDD-HHMM-{slug}.md`.

Emit `✓ Audit: N files — X critical, Y high, Z medium, W low, V info`.

Critical means exploitable now or breach/RCE risk and must block release. High is significant and this-sprint; Medium next-sprint; Low backlog defense-in-depth; Info optional best practice.

## --quick Mode

Skip STRIDE/OWASP mapping. Run `hailykit secrets <scope> --json`, dependency audit, `hailykit vuln-scan <scope> --json`, and tracked-`.env` check. Patterns: `references/tech-secret-patterns.md`, `references/tech-vulnerability-patterns.md`.

Emit: `✓ Quick scan: N files — X findings`

## --fix Mode

Sort by severity. For each: patch via `{skill:hc-fix}`, run the guard, halt on failure, commit `security(fix): <desc>`. `--iterations N` caps cycles; quick/full modes both support `--fix`.

## --deep Mode

Every Critical finding gets refuter votes before it can block. Reuse `{skill:hc-review}` `references/review-adversarial.md` → `## --deep: Refuter Votes`. A finding that fails to survive votes demotes to advisory with refutation evidence, never disappears. `--deep` wins over simultaneous `--quick`; explicit `--quick` overrides configured `deep.auto`.

**Cross Review (egress-gated):** `--deep` never authorizes egress. Only `--cross` or `crossReview.auto` permits `hailykit cross-review --stage code` on the final report. Tag merged notes `[cross: <cli>/<model>]`. Skips silently when no eligible reviewer CLI is installed.

On an `ultra` session, requested `--deep` still runs votes; only note the smaller marginal gain. See `docs/engineering-standards.md` § Depth Tiers.

## Workflow Position

**Follows:** `{skill:hc-plan}`; `{skill:hl-brainstorm} --debate`
**Precedes:** `{skill:hc-ship}` — resolve Critical/High first
**Related:** `{skill:hc-review}`, `{skill:hl-brainstorm} --debate`

## References

| File | Content |
|------|---------|
| `references/quality-stride-owasp.md` | STRIDE checklist + OWASP Top 10 reference + dependency audit commands |
| `references/tech-secret-patterns.md` | Regex patterns for hardcoded secret detection |
| `references/tech-vulnerability-patterns.md` | Grep patterns for common vulnerability categories |
