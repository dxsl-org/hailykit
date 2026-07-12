# Research Protocol

Query construction, source credibility, and search angle guidance for hl:research.

---

## Query Fan-Out

Run each search covering a **distinct angle**. Do not search the same topic 5 times with different wording.

### Standard angles (default mode — 5 searches)

| # | Angle | Query pattern |
|---|-------|--------------|
| 1 | Official docs / current state | `"[library] documentation [year] getting started"` |
| 2 | Security & vulnerabilities | `"[library] CVE security vulnerability [year]"` |
| 3 | Performance & production use | `"[library] performance benchmark production [year]"` |
| 4 | Community sentiment & adoption | `"[library] vs [alternatives] comparison [year] reddit hacker news"` |
| 5 | Migration & pitfalls | `"[library] migration breaking changes gotchas [year]"` |

### Quick mode (2 searches)

| # | Angle | Query pattern |
|---|-------|--------------|
| 1 | Essential facts | `"[library] overview [year] what is"` |
| 2 | Community health | `"[library] maintained abandoned stars issues [year]"` |

### Deep mode (8–10 searches)

All 5 standard angles + cross-validation angles:

| # | Angle | Query pattern |
|---|-------|--------------|
| 6 | Conference talks & case studies | `"[library] talk conference production case study [year]"` |
| 7 | Known failure modes | `"[library] problems issues pain points [year]"` |
| 8 | Specific competitor comparison | `"[library A] vs [library B] [year] detailed comparison"` |
| 9 | Cross-validation of contradictory claims | Re-search any finding supported by only one source |
| 10 | Architecture fit | `"[library] [framework] integration [year]"` |

**Stop early signal:** If searches 4–5 return the same URLs already found in searches 1–3, the topic is well-covered. Skip remaining angles.

---

## Source Credibility Ladder

Weight sources by reliability. A finding supported only by a tutorial has low confidence.

| Tier | Source type | Confidence |
|------|------------|-----------|
| **1 — Authoritative** | Official docs, maintainer blog, GitHub release notes | High |
| **2 — Production evidence** | Production case studies (with metrics), conference talks with demos | High |
| **3 — Peer-reviewed** | Multiple independent blog posts reaching same conclusion | Medium |
| **4 — Community** | Upvoted Stack Overflow answers, Reddit threads with evidence | Medium |
| **5 — Anecdotal** | Single blog post, non-authoritative comparison sites | Low |
| **6 — LLM inference** | Synthesized without a web source | Very low — flag explicitly |

**Rule:** Never state a finding as fact if it comes from Tier 5 or 6 without explicit qualification ("unverified" or "inferred"). For architecture or security decisions, require at least Tier 2.

---

## Recency Rules

- For **security topics**: always check last 6 months; a 2-year-old "safe" assessment may be outdated
- For **ecosystem topics** (frameworks, cloud tools): last 12 months; things move fast
- For **algorithms / foundational patterns**: historical sources are fine; add recency check for implementations
- For **abandoned libraries**: check last commit date; >2 years with no activity = flag as maintenance risk

---

## Academic Research (--type academic)

Scholarly/scientific research forks the source universe, credibility ladder, and recency rule from the tech-shaped sections above — for `--type academic`, use this section instead of Source Credibility Ladder / Recency Rules.

### Query Fan-Out (Academic)

**Quick mode (2 searches)**

| # | Angle | Query pattern |
|---|-------|--------------|
| 1 | Literature exists? | `"does peer-reviewed literature on [X] exist"` (Google Scholar / Semantic Scholar) |
| 2 | Recent review | `"[X] recent review OR survey [year]"` |

**Default mode (5 searches)**

| # | Angle | Query pattern |
|---|-------|--------------|
| 1 | Broad scholarly search | Google Scholar / Semantic Scholar: `"[X]"` |
| 2 | Preprint server | `site:arxiv.org [X]` |
| 3 | Review / meta-analysis | `"[X] systematic review OR meta-analysis"` |
| 4 | Domain database | PubMed / IEEE Xplore / SSRN (pick domain-appropriate): `"[X]"` |
| 5 | Citation walk | Open one seminal paper on `[X]`, follow its reference list |

**Deep mode (8–10 searches)**

All 5 default angles + citation-walking both directions and cross-validation:

| # | Angle | Query pattern |
|---|-------|--------------|
| 6 | Citation-walk forward | Who cites the seminal paper found in angle 5 |
| 7 | Citation-walk backward | What the seminal paper cites |
| 8 | Replication search | `"[claim] replication OR failed to reproduce"` |
| 9 | Conflicting-findings cross-validation | Re-search any finding supported by only one paper |
| 10 | Methodology / provenance critique | `"[X] methodology critique OR dataset bias OR benchmark provenance"` |

### Credibility Ladder (Academic)

Own ladder, forked from the tech ladder above rather than reused: same authoritative-first direction (rigor beats reach), but a different source universe — a vendor blog is Tier 1 in tech; here, unreviewed prose is low tier regardless of author prestige.

| Tier | Source type | Confidence |
|------|------------|-----------|
| **T1 — Meta-analysis / systematic review** | Aggregates multiple studies with an explicit method | High |
| **T2 — Peer-reviewed primary paper** | Published, peer-reviewed original research | High |
| **T3 — Preprint** | arXiv, bioRxiv, SSRN — not yet peer-reviewed | Medium |
| **T4 — Conference abstract / thesis** | Presented but not journal-reviewed | Medium-low |
| **T5 — Blog / secondary science journalism** | Popularization, no original data | Low |
| **T6 — LLM inference** | Synthesized without a source | Very low — flag explicitly |

**Rule:** a load-bearing claim requires ≥ T2. Never state T5/T6 as fact without explicit qualification.

### Recency Override (Academic)

- Seminal papers are **exempt** from the 12-month rule — publication age alone does not devalue a foundational result.
- Weight **replication status and citation count** over publication date; a well-replicated older finding outranks an unreplicated recent one.
- Flag any **retraction** explicitly — check retraction notices/watch lists before treating a paper as settled.

---

## Market Research (--type market)

Market/competitive research forks the source universe, credibility ladder, and recency rule from the tech-shaped sections above — for `--type market`, use this section instead of Source Credibility Ladder / Recency Rules.

### Query Fan-Out (Market)

**Quick mode (2 searches)**

| # | Angle | Query pattern |
|---|-------|--------------|
| 1 | Market size estimate | `"[market] market size TAM [year]"` |
| 2 | Top competitors | `"[market] top competitors [year]"` |

**Default mode (5 searches)**

| # | Angle | Query pattern |
|---|-------|--------------|
| 1 | Industry reports | `"[market] industry report [year]"` |
| 2 | Funding / usage data | Crunchbase / app-store rankings: `"[company] funding OR downloads [year]"` |
| 3 | Filings / earnings | `"[company] 10-K OR S-1 OR earnings [year]"` |
| 4 | Analyst notes | `"[market] analyst report OR forecast [year]"` |
| 5 | Review platforms & pricing | G2 / Capterra: `"[product] reviews"` + `"[product] pricing"` |

**Deep mode (8–10 searches)**

All 5 default angles + segment/positioning depth and independent verification:

| # | Angle | Query pattern |
|---|-------|--------------|
| 6 | Segment breakdown | `"[market] segments OR verticals breakdown [year]"` |
| 7 | Competitor moat / positioning | `"[competitor] moat OR differentiation OR positioning"` |
| 8 | Pricing-model comparison | `"[market] pricing model comparison [year]"` |
| 9 | Trend / tailwind sourcing | `"[market] trends OR tailwinds [year]"` |
| 10 | Independent contradiction | Re-search any single-sourced number against an independent source |

### Credibility Ladder (Market)

**This inverts the tech ladder above:** a vendor's own docs are Tier 1 in tech (trusting the maintainer to describe their own product); in market research the vendor is a biased party describing itself, so vendor-originated claims sit at the bottom.

| Tier | Source type | Confidence |
|------|------------|-----------|
| **T1 — Primary data / official filings** | 10-K, S-1, earnings calls, government/census data | High |
| **T2 — Analyst / reputable industry report** | Gartner, Forrester, CB Insights, etc. | High |
| **T3 — Methodical third-party survey** | Independent survey with disclosed methodology | Medium |
| **T4 — Review-platform aggregate** | G2/Capterra aggregate ratings (not single reviews) | Medium-low |
| **T5 (LOW) — Press releases / vendor PR** | Vendor's own announcements, marketing pages | Low — inverts the tech ladder; treat as a claim to verify, not a fact |

**Rule:** a market-sizing or competitive claim sourced only from vendor PR is `UNVERIFIED` until corroborated by a T1–T3 source.

### Recency Override (Market)

- Market data decays fast — prefer sources ≤ 12 months old for sizing and pricing.
- Filings are authoritative **as of their reporting period** — cite the period, not just the filing date.
- Flag any figure older than the latest reporting cycle as stale.

---

## Specialized Query Templates

### Technology evaluation

```
"[library A] vs [library B] [year] production"
"[library] typescript support [year]"
"[library] bundle size tree shaking [year]"
"why I switched from [A] to [B]"
"[library] limitations downsides [year]"
```

### Security research

```
"[library] CVE [year] site:nvd.nist.gov OR site:github.com/advisories"
"[library] security vulnerability patch [version]"
"[library] security audit [year]"
"[library] dependency vulnerability supply chain"
```

### Migration research

```
"migrating from [A] to [B] [year]"
"[A] to [B] migration guide breaking changes"
"[A] to [B] gotchas production"
"[B] migration [year] real experience"
```

### Architecture patterns

```
"[pattern] production use case [year]"
"[pattern] problems when not to use"
"[pattern] vs [alternative] trade-offs"
"[pattern] at scale [company] [year]"
```

### Academic research

```
"[topic] systematic review meta-analysis"
"[topic] arxiv"
"[claim] replication OR failed to reproduce"
"[seminal paper] cited by" (citation-walk forward)
```

### Market research

```
"[market] market size TAM [year] report"
"[company] competitors alternatives pricing"
"[market] 10-K OR S-1 OR earnings"
"[product] G2 OR Capterra reviews"
```

---

## Active Refutation Protocol (default + deep)

Stronger than re-confirming — for the **≤3 highest-stakes or contested claims**, actively try to *disprove* each (Popperian inversion). Pick claims that, if wrong, would flip the recommendation.

Selection — a claim qualifies when it:
1. Appears in only one source (single-source), OR
2. Contradicts another source (conflicting), OR
3. Is load-bearing for the verdict (the recommendation depends on it).

For each, run **one** targeted refutation search — phrase it to surface counter-evidence, not agreement:

```
"[claim] criticism OR debunked OR "not true" [year]"
"[library/pattern] considered harmful OR why we stopped using"
"[claim] benchmark contradicts OR fails to reproduce"
```

Tag the result:
- `VERIFIED` — refutation search found nothing credible against it (2+ independent sources still agree)
- `UNVERIFIED` — single source, no contradicting evidence found (state explicitly)
- `CONTESTED` — credible counter-evidence exists; present both sides

**Hard cap:** at most 3 refutation searches — this is a bounded rigor pass, not a second fan-out. Contested findings must appear in `## Unresolved Questions`.

### Domain-Specific Refutation Targets

- **Academic (`--type academic`):** target replication failures and retractions — `"[claim] replication OR failed to reproduce"`, `"[paper] retracted OR retraction notice"`.
- **Market (`--type market`):** target vendor-PR bias — find an independent T1–T3 source that contradicts any single-sourced number: `"[claimed figure] independent OR contradicts OR disputed"`.

---

## Inversion Techniques (when forward search is dry)

Forward fan-out assumes you know the right terms, the answer is findable by direct query, and the framing is correct. When the **sufficiency gate** reports a criterion still dry/contradictory — or the question is inverted from the start — switch to a bounded inversion pass (**≤2–3 reverse queries**). Pick the technique by *why* forward failed:

| Technique | Use when forward is dry because… | Reverse query shape |
|-----------|----------------------------------|---------------------|
| **Question inversion** | the framing is wrong | "why do teams AVOID [X]", "how would [X] fail" |
| **Disconfirmation** | only confirming sources surface | "[X] considered harmful", "why we removed [X]", "[X] postmortem" |
| **Provenance tracing** | a claim/number is echoed everywhere, sourced nowhere | trace to the **first** source: "[claim] originally OR source OR study", read the origin |
| **Citation-walking upstream** | you lack the expert vocabulary | open one authoritative artifact, follow its references/dependencies *backwards* |
| **Effect → cause** | the question is causal and inverted | search the symptom/outcome, not the mechanism: "what causes [observed effect]" |
| **Negative space** | the thing may not exist | "is there a [X] for [Y]", "[X] alternatives why none" — the answer is the gap |
| **Reverse-engineer artifact** | too new / undocumented | skip prose; read the repo, changelog, issues, or API responses directly via `{skill:hc-lookup}` |

Log the switch explicitly: `forward dry on [criterion] → inversion: [technique]`. Inversion stays inside the same single context and the same token discipline — bounded queries, snippet-first, full-read only Tier 1–2.
