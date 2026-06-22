---
name: hc-security
description: "STRIDE + OWASP audit with severity-ranked findings report. --quick for fast secret/dep scan; --fix to apply remediation iteratively."
when_to_use: "Invoke when running a STRIDE/OWASP audit, secret scan, or vulnerability check."
user-invocable: true
argument-hint: "[<scope glob | 'full'>] [--quick] [--fix] [--iterations N]"
metadata:
  attribution: "Security audit pattern adapted from autoresearch by Udit Goenka (MIT)"
  category: security
  keywords: [security, STRIDE, OWASP, audit, secrets, vulnerabilities, scan]
---

# Security Audit — STRIDE + OWASP

Structured security audit on a given scope. Produces a severity-ranked findings report. With `--fix`, applies patches iteratively against a guard (tests or lint) per finding.

## Usage

```
{skill:hc-security} [<scope>] [--quick] [--fix] [--iterations N]
```

`scope` is a file glob or `full` — defaults to `full` when omitted.

| Flag | Behavior |
|------|----------|
| *(none)* | Full STRIDE + OWASP audit → severity-ranked report |
| `--quick` | Secrets + deps + common vuln patterns only. No STRIDE. ~2 min. |
| `--fix` | Audit then apply fixes iteratively (default 10 iterations) |
| `--iterations N` | Cap fix loop at N iterations; only meaningful with `--fix` |

```
{skill:hc-security}                              # Full codebase audit
{skill:hc-security} src/api/**/*.ts              # Audit API layer only
{skill:hc-security} --quick                      # Pre-commit fast scan
{skill:hc-security} src/ --fix --iterations 15   # Audit + bounded fix loop
```

## Constraints

> **Required — recon-first:** Expand and read all in-scope files before analysis. Do not report findings for files not read.

## Process

1. **Scope** — expand `<scope>` glob or `full` into file list; read all in-scope files. Emit: `✓ Scope: N files`
2. **STRIDE scan** — check each dimension against `references/quality-stride-owasp.md`: Spoofing, Tampering, Repudiation, Information Disclosure, DoS, Elevation of Privilege
3. **OWASP mapping** — map each finding to A01–A10; check full checklist in `references/quality-stride-owasp.md`
4. **Dependency audit** — run `npm audit` / `pip-audit` / `govulncheck` / `cargo audit` per detected stack
5. **Secret detection** — grep in-scope files with patterns from `references/tech-secret-patterns.md`; redact actual values in report
6. **Categorize** — rank findings Critical → High → Medium → Low → Info; assign `file:line` citations
7. **Report** — produce findings table; save to `.agents/reports/security-YYMMDD-HHMM-{slug}.md`

Emit: `✓ Audit: N files — X critical, Y high, Z medium, W low, V info`

### Finding Severity

| Severity | Description | Fix Priority |
|----------|-------------|-------------|
| Critical | Exploitable now, data breach or RCE risk | Immediate — block release |
| High | Exploitable with moderate effort, significant impact | This sprint |
| Medium | Limited exploitability or impact | Next sprint |
| Low | Theoretical risk, defense-in-depth improvement | Backlog |
| Info | Best practice suggestion, no direct risk | Optional |

## --quick Mode

Skips STRIDE and OWASP mapping. Runs:

- **Secret detection** — `hailykit secrets <scope> --json` (redacted, exits non-zero on findings). Native, zero-dep, gitignore-aware. For deep/historical git-history scans use `gitleaks` instead.
- **Dependency audit** — for detected stack
- **Common vuln patterns** — `hailykit vuln-scan <scope> --json` (SQL injection, XSS, command injection, path traversal, `eval()`, unsafe deserialization, disabled TLS). A fast regex complement — treat findings as leads; use `semgrep` for data-flow/AST-grade analysis.
- **`.env` exposure check** — verify no tracked `.env` files in git

Pattern packs ship in the CLI (`cli/commands/scan/patterns-*.ts`); `references/tech-secret-patterns.md` and `references/tech-vulnerability-patterns.md` document them and remain the source for manual/extended grep audits.

Emit: `✓ Quick scan: N files — X findings`

## --fix Mode

After audit, sort findings Critical → Low then for each:

1. Apply patch via `{skill:hc-fix}`
2. Run guard — tests or lint; if guard fails, halt and report; do not continue
3. Commit `security(fix): <desc>`

`--iterations N` caps total fix cycles (default: 10). Both `--quick` and full audit modes support `--fix`.

## Session Model

Judgment agents (`haily-planner`, `haily-implementor`, `haily-reviewer`, `haily-brainstormer`, `haily-debugger`) inherit the session model — running on `{model:ultra}` passes that model to these agents automatically. Mechanical agents (`haily-tester`, `haily-git-manager`, `haily-stats`, etc.) are capped at their `model_max` tier and never escalate.

## Workflow Position

**Follows:** `{skill:hc-plan}` — integrate as a verification step before shipping; `{skill:hl-brainstorm} --debate` — when security persona flags concerns
**Precedes:** `{skill:hc-ship}` — resolve Critical/High findings before release
**Related:** `{skill:hc-review}`, `{skill:hl-brainstorm} --debate` — deeper auth/authorization edge case coverage via 12-dimension sweep

## References

| File | Content |
|------|---------|
| `references/quality-stride-owasp.md` | STRIDE checklist + OWASP Top 10 reference + dependency audit commands |
| `references/tech-secret-patterns.md` | Regex patterns for hardcoded secret detection |
| `references/tech-vulnerability-patterns.md` | Grep patterns for common vulnerability categories |
