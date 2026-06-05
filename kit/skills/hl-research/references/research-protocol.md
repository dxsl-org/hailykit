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

## Cross-Validation Protocol (deep mode)

After gathering, identify claims that:
1. Appear in only one source (single-source claim)
2. Contradict another source (conflicting claim)

For each: run one additional targeted search to verify or refute. Mark findings as:
- `VERIFIED` — 2+ independent sources agree
- `UNVERIFIED` — single source, no contradicting evidence
- `CONTESTED` — sources disagree; present both sides

Contested findings must appear in `## Unresolved Questions`.
