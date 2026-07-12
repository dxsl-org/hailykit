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

# hl:research — Technical Intelligence

Multi-source research from scope definition to actionable report. **YAGNI · KISS · DRY.**

## Usage

```
{skill:hl-research} <topic> [--quick | --deep] [--type eval|security|migration|arch|academic|market]
```

Depth follows the canonical vocabulary (`docs/engineering-standards.md` → Depth Tiers) — this skill's three tiers are the searches-and-time expression of the same Cheapest / Baseline / 3–5× cost curve every `--deep`-eligible skill shares:

| Flag | Depth | Searches | Cost | Use when |
|------|-------|---------|------|---------|
| `--quick` | Skip cross-validation and follow-up leads | 2 parallel | Cheapest, ~5 min | Sanity check — is this library maintained? does this pattern exist? |
| *(none)* | Normal — standard evaluation depth | 5 parallel | Baseline, ~10 min | Standard evaluation or best-practice check |
| `--deep` | Maximum scrutiny: more streams, one-hop follow-up, active refutation | 8–10 parallel + cross-validation | 3–5× baseline, ~20 min | Architecture decision, production migration, security audit |

| `--type` flag | Output template | Use when |
|---|---|---|
| `eval` (default) | Comparison matrix + ranked recommendation | Choosing between 2+ options |
| `security` | CVEs + affected versions + patch status + mitigations | Security review or audit |
| `migration` | From/to state + gotchas + order of operations | Planning an upgrade or migration |
| `arch` | Case studies + trade-offs + when NOT to use | Architecture pattern evaluation |
| `academic` | Literature review — findings by theme + evidence strength + citations + gaps | Scholarly or scientific research |
| `market` | Market size + segments + competitor matrix + trends + risks | Market or competitive research |

## Constraints

> **Required — parallel searches:** Run all search calls concurrently. Never run searches sequentially when they are independent.

> **Required — recency first:** Prioritize information from the last 12 months unless historical context is explicitly needed. For security topics, always check for recent CVEs and advisories. For `--type academic`/`market`, use the per-domain recency override in `references/research-protocol.md` instead.

> **Required — source credibility weighting:** Official docs and maintainer blogs outrank tutorials. Production case studies outrank theoretical analysis. `--type academic` and `--type market` use their own ladders (`market` inverts the tech ordering — vendor PR is low tier, not Tier 1) — see `references/research-protocol.md` for the full credibility ladders.

> **Required — read by tier (token discipline):** Use search snippets for breadth. Full-fetch a source (`{skill:hc-lookup}` / WebFetch) ONLY for the 1–3 highest-credibility (Tier 1–2) results. Never full-read low-tier pages — that is the token sink this skill exists to avoid.

> **Required — sufficiency gate:** Stop gathering once every evaluation criterion has ≥1 Tier 1–2 source. If forward search leaves a criterion unmet, dry, or contradictory, switch to the **inversion pass** (`references/research-protocol.md` § Inversion Techniques) — never pad with low-tier sources or infer to fill the gap.

## Process

1. **Scope** — decompose the topic into explicit sub-questions, then map each to a search angle (targeted queries beat repeated rewording — fewer wasted searches). Identify recency requirements, evaluation criteria, depth limits. Select `--type` from topic keywords if unspecified — `academic` on "paper/study/meta-analysis/literature/scholarly/arxiv/clinical/peer-reviewed", `market` on "market size/competitor/TAM/pricing/G2/Crunchbase/industry report/nghiên cứu thị trường". If the question is already inverted (signals: "why avoid", "origin of", "is X actually", "why is there no"), open with the inversion pass instead of forward fan-out.

2. **Gather** — use the session's native search tool. Apply Query Fan-Out: each parallel search covers a distinct angle (official docs, security, performance, community sentiment, comparisons). Read by tier (snippet-first; full-fetch only Tier 1–2 via `{skill:hc-lookup}`/WebFetch). See `references/research-protocol.md` for query templates.
   - `--quick`: 2 searches (essential facts + community health)
   - *(default)*: 5 searches covering all angles
   - `--deep`: 8–10 searches; follow ≤2 highest-value leads (one hop)
   - **Blocked fetch:** a 403/challenge page/empty body on a Tier 1–2 source is a bot wall or JS-rendered SPA, not a dry source — retry once via `{skill:hc-browser}` (`agent-browser open <url>` → `get text`) before treating the criterion as unmet.
   - **Sufficiency gate:** once every criterion has a Tier 1–2 source, STOP (don't run remaining angles). If a criterion stays dry/contradictory → run a bounded **inversion pass** (≤2–3 reverse queries, technique chosen by why forward failed — see protocol).

3. **Synthesize** — identify patterns, pros/cons, maturity, security, compatibility; flag consensus vs. controversy. *(default + `--deep`)* For ≤3 highest-stakes or contested claims, run **active refutation**: search to *disprove* the claim, not re-confirm it. Tag each `VERIFIED` / `UNVERIFIED` / `CONTESTED`.

4. **Report** — save to `.agents/reports/research-YYMMDD-HHMM-{slug}.md`. Select output template based on `--type`. Cite the source inline for every non-obvious claim.

## Output Templates

### `--type eval` (default) — Technology Evaluation

```markdown
# Research: [Topic]
**Mode:** eval · **Depth:** quick|standard|deep · **Date:** YYYY-MM-DD

## Verdict
[ONE sentence: the recommended choice and the single most important reason]

## Comparison Matrix
| Dimension | Option A | Option B | Option C |
|---|---|---|---|
| Performance | | | |
| Maturity / stars / last commit | | | |
| Bundle size / dependencies | | | |
| TypeScript support | | | |
| Security track record | | | |
| Migration effort | | | |

## Ranked Recommendation
1. **Winner:** [Name] — [reason in one sentence]
2. **Runner-up:** [Name] — [when to prefer instead]
3. **Avoid:** [Name] — [concrete reason]

## Common Pitfalls
## Resources & References
## Unresolved Questions
```

### `--type security` — Security Research

```markdown
# Security Research: [Library / Topic]
**Date:** YYYY-MM-DD · **Severity scope:** [Critical/High/Medium/Low]

## Verdict
[Is this safe to use at the current version? One sentence.]

## CVE Summary
| CVE | Severity | Affected versions | Patched in | Notes |
|---|---|---|---|---|

## Current Status
- Latest version: [version] · Released: [date]
- Maintenance status: [actively maintained / maintenance only / abandoned]
- Security advisory policy: [link if exists]

## Mitigations
## References
## Unresolved Questions
```

### `--type migration` — Migration Research

```markdown
# Migration Research: [From] → [To]
**Date:** YYYY-MM-DD

## Verdict
[Is this migration recommended? How long does it typically take? One sentence.]

## Migration Map
| Step | What changes | Breaking? | Effort |
|---|---|---|---|

## Gotchas (things that surprised others)
## Order of Operations
## Rollback Strategy
## Real-world Examples
## Unresolved Questions
```

### `--type arch` — Architecture Pattern

```markdown
# Architecture Research: [Pattern]
**Date:** YYYY-MM-DD

## Verdict
[Is this the right pattern for the stated use case? One sentence.]

## When to use
## When NOT to use (anti-patterns / over-engineering signals)
## Production Case Studies
## Trade-offs
| Pro | Con |
|---|---|

## Implementation Notes
## Alternatives
## Unresolved Questions
```

### `--type academic` — Literature Review

```markdown
# Literature Review: [Research Question]
**Date:** YYYY-MM-DD · **Depth:** quick|standard|deep

## Verdict
[What does the literature currently support? One sentence.]

## Key Findings by Theme
## Evidence Strength per Claim
| Claim | Support tier | Replication status |
|---|---|---|

## Citations
## Research Gaps
## Unresolved Questions
```

### `--type market` — Market Research

```markdown
# Market Research: [Market / Product]
**Date:** YYYY-MM-DD · **Depth:** quick|standard|deep

## Verdict
[Is this market attractive, or who is the leading competitor? One sentence.]

## Market Size & Segments
## Competitor Matrix
| Competitor | Positioning | Pricing | Moat |
|---|---|---|---|

## Trends
## Risks
## Sources
## Unresolved Questions
```

## Session Model

Judgment agents (`haily-planner`, `haily-implementor`, `haily-reviewer`, `haily-brainstormer`, `haily-debugger`) inherit the session model — running on `{model:ultra}` passes that model to these agents automatically. Mechanical agents (`haily-tester`, `haily-git-manager`, `haily-stats`, etc.) are capped at their `model_max` tier and never escalate.

## Workflow Position

**Precedes:** `{skill:hl-brainstorm}` — research findings inform option evaluation; `{skill:hc-plan}` — research informs phase design
**Precedes:** `{skill:hl-mindmap}` — when research surfaces entities and relationships worth persisting as a navigable graph
**Precedes:** `{skill:hl-write}` — research findings feed an authored document's Recon stage
**Used alongside:** `{skill:hc-lookup}` — fetch library/repo docs during gather stage

**Versus native `/deep-research`:** on Claude Code, for an exhaustive, open-ended, fact-checked **prose report** where high token cost is acceptable, prefer `/deep-research`. hl-research is the bounded, predictable-cost tier that produces **structured decision artifacts** (comparison matrix, CVE table, migration map) — and it runs on every provider, not just Claude.

## References

| File | Content |
|------|---------|
| `references/research-protocol.md` | Query Fan-Out templates, credibility ladder, active refutation, and inversion techniques |
