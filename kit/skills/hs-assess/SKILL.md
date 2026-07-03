---
name: hs-assess
description: "Offensive assessment of a running, explicitly authorized target — attack-surface recon, vulnerability assessment, exploitation validation, and CTF challenge solving via external tools. Authorized penetration testing, CTF, and security research only; refuses targets without documented written authorization."
when_to_use: "Invoke for authorized penetration testing, red-team engagements, CTF challenges, or security research against a target you own or hold explicit written authorization to test. Do not invoke for unauthorized targets, third-party systems without documented scope, or appsec code audit — use `hc-security` for that."
user-invocable: true
category: security
keywords: [pentest, red-team, recon, exploit, vulnerability, ctf, nmap, nuclei]
argument-hint: "<target> [--ctf] [--auto]"
---

# Security Assessment — Authorized Red-Team

Offensive assessment of a running, explicitly authorized target: attack-surface recon, enumeration, prioritized vulnerability assessment, and authorized exploitation validation. Orchestrates external CLI tools (nmap, nuclei, ffuf, sqlmap, netcat, CTF frameworks) — never bundles them. CTF mode solves a challenge instead of a live-system target.

## Usage

```
{skill:hs-assess} <target> [--ctf] [--auto]
```

| Flag | Behavior |
|------|----------|
| *(none)* | Full pipeline against a live authorized target — recon through severity-ranked report |
| `--ctf` | Challenge-solving mode: target is a CTF binary/service/archive, not a production system |
| `--auto` | Autonomous mode — proceeds through Checkpoints without pausing; halts on Critical severity or scope ambiguity |

```
{skill:hs-assess} 10.0.5.20 --auto
{skill:hs-assess} https://staging.internal.example.com
{skill:hs-assess} ./chall.tar.gz --ctf
{skill:hs-assess} api.internal.example.com --auto --ctf
```

## Constraints

> **Required — authorized-use:** Proceed only when the user confirms explicit written authorization or scope for the target (a pentest engagement letter, a bug-bounty program scope, an owned lab/CTF environment). Refuse targets outside the confirmed scope, mass-targeting of unrelated hosts, denial-of-service techniques, and evasion aimed at concealing unauthorized activity. If authorization is unclear, ask before Recon begins — see `references/authorized-use.md`.

> **Required — recon-first:** Enumerate the attack surface (open services, exposed endpoints, technology fingerprint) before any exploitation or validation attempt. Never jump straight to exploit tooling on an unscanned target.

## Process

1. **Route** — classify target (host/IP, URL, CTF archive) and mode (`--ctf`, `--auto`); confirm authorization per the guardrail above. Emit `✓ Route: target classified — mode=<mode>, authorized=<yes/no>`
2. **Recon** — enumerate attack surface: ports/services, exposed endpoints, technology stack, subdomains where in scope. Emit `✓ Recon: N services/endpoints found`
3. **Draft** — prioritize candidate weaknesses by likely severity and exploitability against `references/methodology.md`; drop anything outside confirmed scope
4. **Build** — for CTF mode, work the challenge (binary analysis, service interaction, flag extraction) per `references/methodology.md`; for live targets, validate each prioritized finding with the least-invasive authorized technique that proves exploitability
5. **Verify** — confirm each validated finding with reproducible evidence (request/response, output, screenshot reference); discard unconfirmed leads. Emit `✓ Verify: X findings confirmed, Y unconfirmed`
6. **Ship** — assemble severity-ranked report with evidence citations; save to `.agents/reports/assess-YYMMDD-HHMM-{slug}.md`. Route any code-level root cause to `{skill:hc-fix}`

Emit: `✓ Assess: N findings — X critical, Y high, Z medium, W low`

## --ctf Mode

Target is a challenge archive, binary, or exposed service rather than a production system — authorization is implicit in participating in the CTF. Recon becomes challenge triage (category, hints, exposed service fingerprint); Build applies the relevant technique class (binary exploitation, web, crypto, forensics) per `references/methodology.md`; Ship reports the flag plus the technique chain that produced it instead of a severity table.

## Output

Severity-ranked findings report with evidence citations, saved to `.agents/reports/assess-YYMMDD-HHMM-{slug}.md`. CTF mode reports the flag and the reproducing technique chain.

## Workflow Position

**Follows:** `{skill:hc-plan}` — when the engagement scope came out of a planning session
**Precedes:** `{skill:hc-fix}` — code-level root causes found during assessment get patched here; `{skill:hs-harden}` — close configuration-level findings
**Related:** `{skill:hc-security}` — appsec audit of code you own, not a running-system assessment; `{skill:hs-dfir}` — post-incident investigation when the target has already been compromised

## References

| File | Content |
|------|---------|
| `references/methodology.md` | PTES/OWASP-WSTG-aligned recon-to-report flow, tool-category matrix per phase, evidence capture practices |
| `references/authorized-use.md` | Scope/authorization checklist, rules of engagement, legal framing |
