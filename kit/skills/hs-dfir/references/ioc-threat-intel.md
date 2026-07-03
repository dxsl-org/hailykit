# IOC & Threat-Intel Correlation

Indicators of compromise (IOCs) turn a timeline into an incident by tying observed events to known-bad infrastructure, tooling, or behavior. Correlation is a matching exercise: pull IOCs from feeds/reports, match them against the timeline and evidence, and record every hit with its source and confidence.

## IOC Types

| Type | Examples | Where it shows up in the timeline |
|------|----------|-----------------------------------|
| Network | IP, domain, URL, JA3/JA3S TLS fingerprint | `target` column on `http-request`, `dns-query`, `connection` events |
| File | SHA-256/SHA-1/MD5 hash, filename, file size | `target` on `file-write`/`file-create` events; malware triage artifacts |
| Host | Registry key, scheduled task, service name, mutex | `target` on `process-create`/`persistence` events |
| Behavioral | TTP (MITRE ATT&CK technique ID), command-line pattern | `raw_line`/`action` pattern match, not exact-value match |
| Identity | Compromised account, anomalous login pattern | `actor`/`host` combination in the timeline |

Prefer hash and network IOCs for high-confidence exact matches; treat behavioral IOCs (ATT&CK TTPs) as leads that need corroborating evidence, not standalone proof.

## Feeds

Use whichever feeds the engagement already has access to — this skill does not bundle or require a specific vendor. Common sources:

- **Open**: MISP communities, AlienVault OTX, abuse.ch (URLhaus, MalwareBazaar, ThreatFox), CISA AIS
- **Commercial**: vendor threat-intel platforms the client already subscribes to (out of scope to name/require here)
- **Internal**: prior incident reports, SOC watchlists, EDR/SIEM alert exports

Import feed IOCs into a `case-*-timeline.sqlite` `iocs` table (type, value, source, confidence, first_seen) so correlation is a SQL join against `events`, consistent with the timeline technique in `references/log-timeline.md`:

```sql
CREATE TABLE iocs (
  id INTEGER PRIMARY KEY, type TEXT NOT NULL, value TEXT NOT NULL,
  source TEXT NOT NULL, confidence TEXT NOT NULL, first_seen TEXT
);

-- Exact-match correlation: which events touched a known-bad target?
SELECT e.ts_utc, e.host, e.actor, e.action, i.value, i.source
FROM events e JOIN iocs i ON e.target = i.value
ORDER BY e.ts_utc;
```

## Correlation Workflow

1. Normalize every IOC to a consistent form before matching — lowercase domains, defang/refang consistently, hash format uppercase/lowercase agreement.
2. Join IOCs against the timeline on the relevant column (`target` for network/file IOCs, `actor`/`host` for identity IOCs).
3. For behavioral IOCs, pattern-match `raw_line`/`action` rather than expecting exact equality; log the match as lower-confidence unless corroborated by a second signal.
4. Record every hit — matched IOC, event, source feed, confidence — so the incident report cites where each indicator came from, not just that it matched.
5. Flag IOCs with no timeline hits as "checked, not observed" in the report; absence of a match is itself useful scoping information.

## Malware Triage (Static Only)

Triage suspected malware artifacts by indicator, never by running them:

- **Hash reputation** — look up SHA-256 against MalwareBazaar/VirusTotal-class services or an internal allowlist/denylist.
- **Static strings** — `strings <artifact>` for embedded URLs, IPs, mutex names, or known packer/loader markers.
- **YARA** — run community or case-specific rule sets via the external `yara` CLI against the artifact copy, never the original:
  ```
  yara -r rules/known-loaders.yar ./evidence-copy/suspect.bin
  ```
- **Metadata** — PE/ELF headers, compile timestamp, import table, signing certificate (or absence of one).

> **Required — no execution:** Every step above is static analysis on a copy of the artifact. Do not run, open, or detonate a suspected sample — not in a sandbox invoked from this skill, not "just to see." If dynamic analysis is genuinely needed, that is a separate, explicitly scoped exercise outside this skill's boundary.

## Output of Correlation

Feed the Verify stage's IOC-match count and triage results directly into the Ship stage's incident report: a table of matched IOCs (type, value, source, confidence, first/last timeline sighting) and a short static-triage verdict per suspicious artifact (benign / suspicious / confirmed-malicious, with the indicators that justify the verdict).
