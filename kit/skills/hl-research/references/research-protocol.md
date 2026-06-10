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
