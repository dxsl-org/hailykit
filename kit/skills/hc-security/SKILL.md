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

Structured security audit on a given scope. Produces a severity-ranked findings report. With `--fix`, applies patches iteratively against a guard (tests or lint) per finding.

## Usage

```
{skill:hc-security} [<scope>] [--quick] [--deep] [--fix] [--iterations N] [--cross]
```

`scope` is a file glob or `full` — defaults to `full` when omitted.

| Flag | Behavior |
|------|----------|
| *(none)* | Full STRIDE + OWASP audit → severity-ranked report |
| `--quick` | Secrets + deps + common vuln patterns only. No STRIDE. ~2 min. |
| `--deep` | Every Critical finding gets refuter votes before it can block — pointer to `{skill:hc-review}` `references/review-adversarial.md` → `## --deep: Refuter Votes` (survival table, skeptic contract; do not duplicate here). Mutually exclusive with `--quick` — `--deep` wins if both are given. Auto-on via `haily.json` `deep.auto`; an explicit `--quick` overrides it. See `--deep Mode` below for the cross-review egress rule. |
| `--fix` | Audit then apply fixes iteratively (default 10 iterations) |
| `--iterations N` | Cap fix loop at N iterations; only meaningful with `--fix` |
| `--cross` | Send the finished findings report through `hailykit cross-review --stage code` for an external second opinion. Only meaningful combined with `--deep` (see `--deep Mode`) — standalone it has no effect. Never auto-activates; `haily.json crossReview.auto` is the config equivalent. |

```
{skill:hc-security}                              # Full codebase audit
{skill:hc-security} src/api/**/*.ts              # Audit API layer only
{skill:hc-security} --quick                      # Pre-commit fast scan
{skill:hc-security} --deep --cross               # Max-scrutiny audit + refuter votes + external second opinion
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
6. **Categorize** — rank findings Critical → High → Medium → Low → Info; assign `file:line` citations. **Under `--deep`:** run refuter votes on every Critical finding before it can appear as blocking (see `--deep Mode`).
7. **Report** — produce findings table; save to `.agents/reports/security-YYMMDD-HHMM-{slug}.md`. **Under `--deep` with `--cross`/`crossReview.auto`:** run the Cross Review pass on the finished report (see `--deep Mode`) before finalizing.

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

## --deep Mode

Every Critical finding gets refuter votes before it can appear as blocking in the report — 2–3 independent `haily-reviewer` subagents check each Critical finding, same skeptic contract and survival table as `{skill:hc-review}` `references/review-adversarial.md` → `## --deep: Refuter Votes` (pointer, not a copy — vote thresholds live there). A finding that fails to survive votes demotes to advisory, attached with the refutation evidence, never silently dropped. `--quick` and `--deep` are mutually exclusive — `--deep` wins if both are given. Auto-on via `haily.json` `deep.auto`; an explicit `--quick` overrides the config default.

**Cross Review (egress-gated):** an audit report describes exploitable vulnerabilities, so sending it externally matters twice as much as an ordinary diff — `--deep` alone never authorizes this. Only when `--cross` is also passed, or `haily.json crossReview.auto` is true, run `hailykit cross-review --stage code` on the finished report for an external second opinion; findings merge as confidence-raising, tagged `[cross: <cli>/<model>]`. Skips silently when no eligible reviewer CLI is installed.

**Parity hint:** on an `ultra`-tier session the default audit already runs at high scrutiny, but `--deep` still spawns refuter votes when explicitly requested — a parity hint informs the user's choice, it never substitutes for the flag (never-auto-escalate).

## Session Model

Judgment agents (`haily-planner`, `haily-implementor`, `haily-reviewer`, `haily-brainstormer`, `haily-debugger`, ...) inherit the session model — running on `{model:ultra}` passes that model through automatically. Mechanical agents stay capped at their `model_max` tier and never escalate. Depth tiers use the canonical vocabulary (`fast|medium|thinking|ultra`, compared by ordinal rank — never the literal string) and are surfaced to every subagent via `HL_MODEL_TIER`; see `docs/engineering-standards.md` → Depth Tiers.

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
