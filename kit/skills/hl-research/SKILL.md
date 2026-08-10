---
name: hl-research
description: "Deep technical, academic, and market research — technology evaluation, security review, migration planning, architecture decisions, literature review, market/competitor analysis. Supports --quick (5 min sanity check) and --deep (20 min production-grade evaluation)."
when_to_use: "Invoke when researching a technical topic, library, or best practice before deciding, or when the ask is a scholarly literature review or market/competitive research (\"nghiên cứu thị trường\"). Use --quick for fast validation, --deep for architecture decisions."
user-invocable: true
argument-hint: "<topic> [--quick | --deep] [--type eval|security|migration|arch|academic|market]"
metadata:
  category: thinking
  keywords: [research, evaluation, analysis, solutions, security, migration, architecture, academic, scholarly, literature-review, market, competitor]
---

# hl-research

## Usage

```text
{skill:hl-research} <topic> [--quick | --deep] [--type eval|security|migration|arch|academic|market]
```

| Flag | Depth | Searches | Cost | Use when |
|---|---|---|---|---|
| `--quick` | Skip cross-validation and follow-up leads | 2 parallel | Cheapest, ~5 min | Fast sanity check |
| *(none)* | Standard evaluation depth | 5 parallel | Baseline, ~10 min | Normal decision support |
| `--deep` | Maximum scrutiny: more streams, one-hop follow-up, active refutation | 8–10 parallel | 3–5× baseline, ~20 min | Architecture decision, production migration, security audit |

| `--type` flag | Output template | Use when |
|---|---|---|
| `eval` (default) | Comparison matrix + ranked recommendation | Choosing between options |
| `security` | CVEs + affected versions + patch status + mitigations | Security review or audit |
| `migration` | From/to state + gotchas + order of operations | Upgrade or migration planning |
| `arch` | Case studies + trade-offs + when NOT to use | Pattern evaluation |
| `academic` | Findings by theme + evidence strength + citations + gaps | Scholarly research |
| `market` | Market size + segments + competitor matrix + trends + risks | Market or competitive research |

## Constraints

> **Required — parallel searches:** Run independent search calls concurrently.

> **Required — recency first:** Prioritize the last 12 months unless historical context is required. For security topics, always check recent CVEs and advisories. For `--type academic` and `--type market`, use the recency override in `references/research-protocol.md`.

> **Required — source credibility weighting:** Official docs and maintainer blogs outrank tutorials; production case studies outrank theory. `academic` and `market` use their own ladders from `references/research-protocol.md`.

> **Required — read by tier (token discipline):** Use snippets for breadth. Full-fetch only the 1–3 highest-credibility Tier 1–2 sources via `{skill:hc-lookup}` or WebFetch. Never full-read low-tier pages.

> **Required — sufficiency gate:** Stop gathering once every evaluation criterion has at least one Tier 1–2 source. If forward search leaves a criterion unmet, dry, or contradictory, switch to the inversion pass in `references/research-protocol.md` instead of padding with low-tier sources.

## Process

1. **Scope** — decompose the topic into sub-questions and search angles. Set recency, criteria, and depth limits. If `--type` is omitted, infer it from topic signals such as `paper`, `study`, `meta-analysis`, `literature`, `scholarly`, `arxiv`, `clinical`, `peer-reviewed`, `market size`, `competitor`, `TAM`, `pricing`, `G2`, `Crunchbase`, `industry report`, or `nghiên cứu thị trường`. If the question is already inverted (`why avoid`, `origin of`, `is X actually`, `why is there no`), start with inversion.
2. **Gather** — use the session's native search tool with Query Fan-Out. Each search covers a distinct angle. Read by tier:
   - `--quick`: 2 searches
   - default: 5 searches
   - `--deep`: 8–10 searches and follow at most 2 one-hop leads
   - blocked Tier 1–2 fetch (`403`, challenge page, empty body): retry once via `{skill:hc-browser}` before treating the criterion as unmet
   - once every criterion has a Tier 1–2 source, stop; if a criterion stays dry or contradictory, run a bounded inversion pass (2–3 reverse queries)
3. **Synthesize** — identify patterns, maturity, trade-offs, compatibility, and consensus vs controversy. For up to 3 high-stakes or contested claims in default/deep mode, run active refutation and tag each claim `VERIFIED`, `UNVERIFIED`, or `CONTESTED`.
4. **Report** — save to `.agents/reports/research-YYMMDD-HHMM-{slug}.md`. Use the template matching `--type` and cite a source inline for every non-obvious claim. Never fabricate evidence, dates, citations, or support levels.

## Output Templates

| Type | Required sections |
|---|---|
| `eval` | Verdict · Comparison Matrix · Ranked Recommendation · Common Pitfalls · Resources & References · Unresolved Questions |
| `security` | Verdict · CVE Summary · Current Status · Mitigations · References · Unresolved Questions |
| `migration` | Verdict · Migration Map · Gotchas · Order of Operations · Rollback Strategy · Real-world Examples · Unresolved Questions |
| `arch` | Verdict · When to use · When NOT to use · Production Case Studies · Trade-offs · Implementation Notes · Alternatives · Unresolved Questions |
| `academic` | Verdict · Key Findings by Theme · Evidence Strength per Claim · Citations · Research Gaps · Unresolved Questions |
| `market` | Verdict · Market Size & Segments · Competitor Matrix · Trends · Risks · Sources · Unresolved Questions |

## Workflow Position

**Precedes:** `{skill:hl-brainstorm}` — research findings inform option evaluation; `{skill:hc-plan}` — research informs phase design
**Precedes:** `{skill:hl-mindmap}` — when research surfaces entities and relationships worth persisting as a navigable graph
**Precedes:** `{skill:hl-write}` — research findings feed an authored document's Recon stage
**Used alongside:** `{skill:hc-lookup}` — fetch library/repo docs during gather stage

Use native `/deep-research` for exhaustive open-ended reports; use this skill for bounded decision artifacts.

## References

| File | Content |
|---|---|
| `references/research-protocol.md` | Query Fan-Out templates, credibility ladder, active refutation, and inversion techniques |
