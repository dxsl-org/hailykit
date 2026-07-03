# DFIR Methodology — NIST SP 800-61 + Evidence Integrity

This skill's Process stages map onto the incident-response lifecycle defined in [NIST SP 800-61, Computer Security Incident Handling Guide](https://csrc.nist.gov/pubs/sp/800/61/r2/final). This file documents that mapping and the evidence-handling rules that govern every stage.

## NIST SP 800-61 Lifecycle → Skill Stages

| NIST Phase | What it covers | Skill stage |
|------------|-----------------|-------------|
| Preparation | Tooling, playbooks, authorization already in place before an incident | Precondition — the `authorized-use` guardrail; not a stage this skill performs |
| Detection & Analysis | Identify indicators, determine scope, establish what happened | Recon + Draft + Verify |
| Containment, Eradication & Recovery | Stop the bleeding, remove the cause, restore service | Recommendations only — the Ship stage's report; actual containment/recovery execution is `{skill:hs-harden}`'s job |
| Post-Incident Activity | Lessons learned, retained evidence, updated detections | Ship stage's report becomes this artifact; retained per the case's evidence-retention policy |

This skill operates entirely inside **Detection & Analysis** plus the reporting hand-off into **Containment/Recovery** — it investigates and recommends; it does not execute remediation. That boundary is intentional: DFIR determines what happened and how far it spread, `hs-harden` closes the gap.

## Detection & Analysis, in Skill Terms

- **Recon** = evidence inventory. Every artifact that will inform the investigation gets identified and hashed before analysis touches it. This is the forensic equivalent of NIST's "identify precursors and indicators" — except the indicators here are artifacts you already collected, not live telemetry.
- **Draft** = timeline construction (`references/log-timeline.md`). NIST's "determine scope" starts with an accurate sequence of events; a timeline built from unreliable or timezone-mixed data produces a wrong scope determination, which cascades into every later stage.
- **Verify** = IOC correlation and static malware triage (`references/ioc-threat-intel.md`). This is where "what happened" becomes "why it matters" — tying timeline events to known-bad indicators and confirming or ruling out compromise on suspicious artifacts.
- **Ship** = the incident report itself, which doubles as the Post-Incident Activity record.

## Evidence-Integrity Rules

These rules implement the skill's `evidence-integrity` guardrail and apply to every stage, not just Recon:

1. **Hash before touching anything.** SHA-256 every artifact at first contact, before any parsing, copying, or viewing. Record the hash, the artifact path, and the timestamp of hashing.
2. **Work off copies.** Parsing, timeline building, and YARA scanning operate on a copy of the evidence, never the original. The original evidence path is read-only for the entire engagement.
3. **Re-hash before closing.** At the Ship stage, re-hash every original artifact and confirm it matches the Recon-stage hash. A mismatch means the chain of custody is broken — halt and report the discrepancy rather than shipping a report built on compromised evidence.
4. **Cite, don't paraphrase.** Every claim in the incident report traces back to a specific artifact, timeline row, or IOC match (`raw_line` from the timeline schema exists for this reason). A finding without a citation is a hypothesis, not a fact — mark it as such.
5. **No dynamic execution.** Malware triage stays static (hash, strings, YARA, metadata). Executing or detonating a sample is a categorically different, explicitly scoped activity and is out of bounds for this skill.

## Scope of Compromise

"Scope" in the incident report means: which hosts, accounts, and data were touched, over what time window, and by what method. Derive it directly from the timeline (`references/log-timeline.md` lateral-movement query pattern) and IOC correlation results — never estimate scope from a single host's logs alone when the timeline shows the same actor or indicator elsewhere.

## Containment & Recovery Recommendations

The Ship-stage report recommends containment and recovery actions but does not execute them. Recommendations should be specific enough to hand directly to `{skill:hs-harden}`: which accounts to disable, which hosts to isolate, which configurations enabled the initial access, and which indicators to add to detection going forward. Vague recommendations ("improve monitoring") are not actionable — tie each one to a specific finding from Verify.
