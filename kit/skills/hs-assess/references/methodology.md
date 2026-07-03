# Assessment Methodology — PTES / OWASP-WSTG Alignment

Framework-level reference for `hs-assess`. Describes what class of tool applies at
each phase and what evidence to capture — not specific commands or payloads.
Ground every phase in [PTES](http://www.pentest-standard.org/) (Penetration
Testing Execution Standard) for infrastructure/network targets and
[OWASP WSTG](https://owasp.org/www-project-web-security-testing-guide/) (Web
Security Testing Guide) for web application targets. Both are public,
vendor-neutral standards — cite the relevant section when reporting a finding.

## Recon Phase (PTES: Intelligence Gathering)

Goal: map the attack surface without touching it destructively.

| Surface | Tool category | What to record |
|---|---|---|
| Network hosts/ports | Port/service scanners (e.g., nmap-class tools) | Open ports, service banners, versions |
| Web application | Content/endpoint discovery tools (e.g., ffuf-class fuzzers, spidering tools) | Reachable paths, parameters, technology fingerprint |
| DNS/subdomains | Passive + active DNS enumeration tools | In-scope subdomains only — cross-check against authorization scope |
| Cloud/infra metadata | Cloud recon tools appropriate to the provider | Exposed buckets, misconfigured metadata endpoints |

Passive techniques (OSINT, certificate transparency, public DNS) come before
active probing. Stop and re-confirm scope if recon surfaces hosts or
subdomains not named in the authorization.

## Enumeration Phase (PTES: Threat Modeling / Vulnerability Analysis)

Goal: turn the raw surface into a ranked list of candidate weaknesses.

| Surface | Tool category | What to record |
|---|---|---|
| Known-CVE matching | Vulnerability scanners (e.g., nuclei-class template scanners) | CVE ID, affected service/version, scanner confidence |
| Web app logic | OWASP WSTG test categories (auth, session mgmt, input validation, access control, business logic) | WSTG test ID, affected endpoint, expected vs. observed behavior |
| Configuration | Config/hardening checkers | Deviation from baseline (see `hs-harden` for the defensive counterpart) |

Rank candidates by likely severity (CVSS-style: exploitability × impact) before
moving to validation. Discard anything outside the authorized scope at this
stage — do not carry it forward into Build.

## Validation / Exploitation Phase (PTES: Exploitation, WSTG: Verify)

Goal: prove exploitability of the highest-priority candidates with the
least-invasive technique that produces conclusive evidence.

| Weakness class | Tool category | Validation principle |
|---|---|---|
| Injection (SQL, command, template) | Data-flow/injection testing tools | Prove data flow reaches a sink; stop at proof, do not exfiltrate beyond what demonstrates impact |
| Authentication/session | Auth-flow testing tools, manual request replay | Prove bypass or privilege escalation with a single reproducible request chain |
| Known-CVE exploitation | Public PoC / exploit framework appropriate to the CVE | Use the minimum payload that confirms the vulnerability; never a destructive payload |
| Binary/service exploitation (CTF) | Debuggers, disassemblers, exploit-dev frameworks | Build the minimal reliable exploit chain that reads the flag/target artifact |

> Every validation step stays inside the confirmed scope from `authorized-use.md`.
> A finding that requires stepping outside scope to fully prove gets reported as
> "likely, unconfirmed" rather than pursued further.

## Evidence Capture (PTES: Reporting, WSTG: Reporting)

For each confirmed finding, capture:

- **Reproduction steps** — the minimal request/command sequence that triggers it
- **Evidence artifact** — request/response pair, tool output, or output log (redact any captured credentials/PII before saving)
- **Impact statement** — what an attacker could do with this, scoped to the actual proof obtained
- **Standard reference** — OWASP Top 10 category (A01–A10) or PTES phase, plus CWE/CVE ID where applicable

Findings without reproducible evidence are reported as "unconfirmed" in a
separate section, never mixed into the severity-ranked table.

## CTF Mode Notes

CTF challenges map to the same phase structure at smaller scale:

| CTF category | Corresponding phase emphasis |
|---|---|
| Web | Enumeration + Validation per WSTG categories |
| Binary/pwn | Validation phase — static/dynamic analysis, exploit-dev tooling |
| Crypto | Enumeration phase — identify primitive and known-weakness class |
| Forensics | Evidence-capture discipline applies to extracted artifacts |

Report the flag plus the technique chain (what class of tool, what it revealed,
how the next step followed) rather than a severity table — a CTF has no
production impact to rank.
