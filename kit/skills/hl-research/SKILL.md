---
name: hl-research
description: "Deep technical research for technology evaluation, security review, migration planning, and architecture decisions. Supports --quick (5 min sanity check) and --deep (20 min production-grade evaluation)."
when_to_use: "Invoke when researching a technical topic, library, or best practice before deciding. Use --quick for fast validation, --deep for architecture decisions."
user-invocable: true
argument-hint: "<topic> [--quick | --deep] [--type eval|security|migration|arch]"
metadata:
  category: thinking
  keywords: [research, evaluation, analysis, solutions, security, migration, architecture]
---

# hl:research — Technical Intelligence

Multi-source research from scope definition to actionable report. **YAGNI · KISS · DRY.**

## Usage

```
{skill:hl-research} <topic> [--quick | --deep] [--type eval|security|migration|arch]
```

| Mode | Searches | Time | Use when |
|------|---------|------|---------|
| *(default)* | 5 parallel | ~10 min | Standard evaluation or best-practice check |
| `--quick` | 2 parallel | ~5 min | Sanity check — is this library maintained? does this pattern exist? |
| `--deep` | 8–10 parallel + cross-validation | ~20 min | Architecture decision, production migration, security audit |

| `--type` flag | Output template | Use when |
|---|---|---|
| `eval` (default) | Comparison matrix + ranked recommendation | Choosing between 2+ options |
| `security` | CVEs + affected versions + patch status + mitigations | Security review or audit |
| `migration` | From/to state + gotchas + order of operations | Planning an upgrade or migration |
| `arch` | Case studies + trade-offs + when NOT to use | Architecture pattern evaluation |

## Constraints

> **Required — parallel searches:** Run all search calls concurrently. Never run searches sequentially when they are independent.

> **Required — recency first:** Prioritize information from the last 12 months unless historical context is explicitly needed. For security topics, always check for recent CVEs and advisories.

> **Required — source credibility weighting:** Official docs and maintainer blogs outrank tutorials. Production case studies outrank theoretical analysis. See `references/research-protocol.md` for the full credibility ladder.

## Process

1. **Scope** — identify key terms, recency requirements, evaluation criteria, and depth limits. Select `--type` if not specified from topic keywords.

2. **Gather** — use the session's native search tool. Apply Query Fan-Out: each parallel search covers a distinct angle (official docs, security, performance, community sentiment, comparisons). See `references/research-protocol.md` for query templates. When a GitHub repo URL is found, use `{skill:hc-lookup}` to read it.
   - `--quick`: 2 searches (essential facts + community health)
   - *(default)*: 5 searches covering all angles
   - `--deep`: 8–10 searches + cross-validation pass (re-search any claims from a single source)

3. **Synthesize** — identify patterns, pros/cons, maturity, security implications, compatibility. Cross-reference across sources; flag consensus vs. controversy.

4. **Report** — save to `.agents/reports/research-YYMMDD-HHMM-{slug}.md`. Select output template based on `--type`.

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

## Workflow Position

**Precedes:** `{skill:hl-brainstorm}` — research findings inform option evaluation; `{skill:hc-plan}` — research informs phase design
**Precedes:** `{skill:hl-mindmap}` — when research surfaces entities and relationships worth persisting as a navigable graph
**Used alongside:** `{skill:hc-lookup}` — fetch library/repo docs during gather stage

## References

| File | Content |
|------|---------|
| `references/research-protocol.md` | Query Fan-Out templates, source credibility ladder, search angle guide |
