---
name: hs-dfir
description: "Digital forensics and incident response over already-collected evidence — log-timeline reconstruction, IOC/threat-intel correlation, static malware triage. Produces an incident report with root cause, scope of compromise, and containment/recovery recommendations."
when_to_use: "Invoke for authorized incident response or forensic investigation of evidence you already hold (logs, disk artifacts, memory captures) to determine what happened, when, and how far it spread. Do not invoke for live offensive testing — use `hs-assess` — or for code-level bug fixes — use `hc-fix`."
user-invocable: true
category: security
keywords: [dfir, forensics, incident-response, timeline, ioc, threat-intel, malware-triage, sqlite]
argument-hint: "<evidence-path|case> [--timeline] [--ioc]"
---

# DFIR — Digital Forensics & Incident Response

Reconstructs what happened from already-collected evidence and correlates it against threat intel to scope a security incident. Read-only investigation over logs, disk artifacts, and memory captures — never live exploitation, never sample execution.

## Usage

```
{skill:hs-dfir} <evidence-path|case> [--timeline] [--ioc]
```

`evidence-path` is a directory of collected artifacts; `case` is an existing case identifier pointing at a prior evidence set.

| Flag | Behavior |
|------|----------|
| *(none)* | Full pipeline: inventory + hash → timeline → IOC correlation → incident report |
| `--timeline` | Build/query the log timeline only; skip IOC correlation and report assembly |
| `--ioc` | Correlate an existing timeline/evidence set against IOCs only; skip timeline rebuild |

```
{skill:hs-dfir} ./evidence/case-2114/
{skill:hs-dfir} ./evidence/case-2114/ --timeline
{skill:hs-dfir} case-2114 --ioc
{skill:hs-dfir} /mnt/forensics/host-web01/
```

## Constraints

> **Required — evidence-integrity:** Source evidence is read-only, always. Compute a SHA-256 hash of every artifact before touching it, work off copies for parsing/timeline building, and re-hash originals before closing the case to confirm nothing was mutated. Never write to the source evidence path.

> **Required — authorized-use:** Proceed only within an authorized incident-response engagement or an investigation the requester owns or has explicit access rights to. Malware triage stays static and indicator-based — hashes, strings, YARA rules, metadata — never execute or detonate a suspected sample.

## Process

1. **Recon** — resolve `<evidence-path|case>` to its artifact set (logs, disk images, memory captures); compute a SHA-256 hash of every artifact before touching it. Emit `✓ Recon: N artifacts hashed`
2. **Draft** — parse in-scope logs into the `node:sqlite` timeline schema (`references/log-timeline.md`); for disk/memory artifacts, invoke external Plaso/`log2timeline` and merge its output into the same timeline; normalize every timestamp to UTC. Emit `✓ Draft: timeline built — N events, <start>–<end>`
3. **Verify** — query the timeline for anomalies; correlate hosts, hashes, IPs, and domains against IOC feeds (`references/ioc-threat-intel.md`); triage suspected malware by static indicators only — never execute a sample. Emit `✓ Verify: N IOC matches, M artifacts triaged`
4. **Ship** — assemble the incident report (timeline excerpt, root cause, scope of compromise, IOC list, containment/recovery recommendations); save to `.agents/reports/dfir-YYMMDD-HHMM-{slug}.md`; re-hash every source artifact and confirm it matches the Recon hash before closing. Emit `✓ Ship: report saved — evidence integrity confirmed`

## --timeline Mode

Runs Recon + Draft only. Skips IOC correlation and report assembly. Leaves the queryable SQLite timeline in place (`.agents/reports/dfir-YYMMDD-HHMM-{slug}.sqlite`) for ad hoc SQL exploration per `references/log-timeline.md` — useful when the investigator wants to reason interactively before committing to a report.

## --ioc Mode

Skips Draft — assumes a timeline or evidence set from a prior run already exists. Runs Verify + Ship against the supplied IOC list or feed only. Use when new threat intel arrives for a case already timelined.

## Output

Incident report saved to `.agents/reports/dfir-YYMMDD-HHMM-{slug}.md`: timeline, root cause, scope of compromise, IOC list, containment/recovery recommendations. Full pipeline and `--timeline` runs also leave the queryable SQLite timeline at `.agents/reports/dfir-YYMMDD-HHMM-{slug}.sqlite`.

## Workflow Position

**Follows:** `{skill:hs-assess}` — when an assessment or alert surfaces signs of a completed compromise
**Precedes:** `{skill:hs-harden}` — apply hardening/recovery once root cause and scope are known
**Related:** `{skill:hc-debug}` — hand off application-level root cause once the incident narrows to a specific service/code path

## References

| File | Content |
|------|---------|
| `references/log-timeline.md` | `node:sqlite` timeline schema + SQL reasoning patterns (adapted from google/sec-gemini `logs_reasoning`, Apache-2.0); external Plaso/log2timeline option |
| `references/ioc-threat-intel.md` | IOC types, feeds, correlation workflow, YARA via external CLI |
| `references/methodology.md` | NIST SP 800-61 IR lifecycle + evidence-integrity rules |
