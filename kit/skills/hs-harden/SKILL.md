---
name: hs-harden
description: "Config audit against CIS/DISA STIG benchmarks and misconfiguration remediation for running systems — orchestrates lynis, kube-bench, docker bench, openscap. --fix applies guarded, reversible config changes."
when_to_use: "Invoke to audit or harden the security configuration of a host, container, Kubernetes cluster, or cloud resource you are authorized to modify against a compliance benchmark."
user-invocable: true
category: security
keywords: [hardening, cis, stig, compliance, misconfiguration, benchmark, remediation]
argument-hint: "<target> [--fix]"
---

# System Hardening — Benchmark Audit & Remediation

Audits a running host, container, Kubernetes cluster, or cloud resource's configuration against CIS/DISA STIG benchmarks and produces a prioritized hardening report. With `--fix`, applies safe remediations against a guard with a rollback path.

**Scope:** OS, service, container, and cloud **configuration** — not application code. `{skill:hc-devops}` builds and operates the infrastructure; `hs-harden` audits its security posture. "Set up my k8s cluster" routes to `{skill:hc-devops}`. "Audit my running cluster against CIS" routes here. Findings rooted in application code or a vulnerable dependency delegate to `{skill:hc-fix}`.

## Usage

```
{skill:hs-harden} <target> [--fix]
```

`target` identifies the system to audit: a hostname/IP, or a prefixed resource like `docker://<container>`, `k8s://<cluster>`, `aws://<account-id>`.

| Flag | Behavior |
|------|----------|
| *(none)* | Audit only — produces a prioritized hardening report |
| `--fix` | Audit, then apply safe remediations against a guard; halts on guard failure |

```
{skill:hs-harden} prod-web-01                  # audit a Linux host against CIS
{skill:hs-harden} k8s://staging-cluster --fix  # audit + guarded remediation of a k8s cluster
{skill:hs-harden} docker://api-container       # audit a container's config
{skill:hs-harden} aws://123456789012 --fix     # audit + fix cloud account config
```

## Constraints

> **Required — authorized-use:** Operate only on systems you are authorized to modify. Confirm ownership/authorization scope before Recon begins.

> **Required — guard-before-apply:** Never apply a remediation without a passing guard (config validation, health check, or scanner re-run) and a documented rollback path.

## Process

1. **Recon** — inventory the target: detect platform (Linux host, container, k8s, cloud account), select the applicable benchmark family (CIS Benchmark, DISA STIG) from `references/benchmarks.md`, confirm authorization. Emit `✓ Recon: platform=<x> benchmark=<y> controls=<n>`
2. **Verify** — run the mapped external scanner (lynis, kube-bench, docker bench, openscap) per `references/benchmarks.md`; parse results against baseline controls. Emit `✓ Verify: N controls checked — X pass, Y fail, Z n/a`
3. **Prioritize** — rank failing controls by benchmark severity; map each finding → control ID → remediation from `references/remediation-playbook.md`. Flag any finding rooted in application code or a vulnerable dependency for delegation to `{skill:hc-fix}` instead of remediating it here.
4. **Ship** — produce the prioritized hardening report (finding → control → remediation); save to `.agents/reports/harden-YYMMDD-HHMM-{slug}.md`. Emit `✓ Ship: N findings — X critical, Y high, Z medium, W low`

## --fix Mode

For each failing control, ordered by severity: apply the remediation pattern from `references/remediation-playbook.md`, run the guard, and roll back immediately on guard failure — halt and report rather than continuing to the next control. On guard pass, log the change and continue. Irreversible remediations (e.g. encryption migrations) are flagged for manual review instead of auto-applied.

## Output

Saves the hardening report to `.agents/reports/harden-YYMMDD-HHMM-{slug}.md`. In `--fix` mode, appends an applied-remediation log (control ID, change, guard result, rollback status) to the same report.

## Workflow Position

**Follows:** `{skill:hs-assess}` — closes weaknesses hs-assess identified, at the system/config layer
**Precedes:** `{skill:hc-fix}` — code-layer findings (vulnerable dependencies, insecure application logic) delegate here
**Related:** `{skill:hc-devops}` — builds/operates the infrastructure that hs-harden audits; `{skill:hc-security}` — appsec code audit, distinct from system/config hardening; `{skill:hs-dfir}` — post-incident hardening closes gaps surfaced during forensics

## References

| File | Content |
|------|---------|
| `references/benchmarks.md` | CIS/STIG control families mapped to external scanner tools per platform (Linux, container, Kubernetes, cloud) |
| `references/remediation-playbook.md` | Safe remediation patterns, guard checks, and rollback mechanics by platform |
