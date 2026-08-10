---
name: hc-lookup
description: "Find up-to-date library/framework docs by name, topic, version, or comparison. Auto-discovers via context7 llms.txt. Supports version-specific lookup (react@19), library comparison (hono vs express), and migration guides."
when_to_use: "Invoke when you need API docs, version-specific behavior, library comparisons, or migration/upgrade guides without hunting for URLs manually."
user-invocable: true
argument-hint: "[library[@version]] [topic] | [lib1] vs [lib2] [topic] | [library] migration [from-to]"
metadata:
  category: dev-tools
  keywords: [docs, llms-txt, api, library, context7, versioned, comparison, migration]
---

# Lookup — Current, Versioned Documentation

Discover current library docs through context7 `llms.txt`, including version, comparison, migration, and repository fallback.

## Usage

```
{skill:hc-lookup} [library[@version]] [topic]
{skill:hc-lookup} [lib1] vs [lib2] [topic]
{skill:hc-lookup} [library] migration [version-range]

{skill:hc-lookup} react@19 useOptimistic
{skill:hc-lookup} hono vs express middleware
{skill:hc-lookup} next.js migration 14-to-15
```

Query shape selects topic, version, overview, comparison, migration, or repo fallback.

## Constraints

> **Required — source freshness:** Fetch documentation during this run and attribute claims to returned sources. Do not answer changing API/version questions from model memory alone.

> **Required — version fidelity:** Preserve an explicit `@version`. If version-specific docs return 404, fall back to general docs and disclose that the evidence is not version-pinned.

## Process

Run in order; scripts own URL construction and fallback:

1. **Detect** — `node scripts/detect-topic.js "<query>"`; preserve library, version, topic, comparison, and migration metadata.
2. **Fetch** — `node scripts/fetch-docs.js "<query>"`; for comparison, run one chain per library in parallel.
3. **Distribute** — for multiple URLs, pipe content to `node scripts/analyze-llms-txt.js -` and follow its strategy.
4. **Synthesize** — answer with sources, version scope, and disclosed fallback.

For versioned queries, try `/v2/llms.txt` or `/tags/v5.0.0/llms.txt` before general docs. Comparisons load `references/flow-library-search.md` per branch and use equal criteria. Migrations load `references/flow-repo-analysis.md` and prioritize official migration guides, changelogs, upgrade notes, and breaking changes. If context7 lacks the library, identify repository-fallback sources.

## Output

Return direct source links, queried versions, and any general-doc or repository fallback.

Scripts:

| Script | Output |
|---|---|
| `scripts/detect-topic.js` | query type, libraries, topic, version |
| `scripts/fetch-docs.js` | fetched `llms.txt` or error |
| `scripts/analyze-llms-txt.js` | URL categories and distribution strategy |

Environment search order: `process.env` → `.claude/skills/hc-lookup/.env` → `.claude/skills/.env` → `.claude/.env`. `CONTEXT7_API_KEY` raises rate limits; `GITHUB_TOKEN` supports repository fallback.

## Workflow Position

**Precedes:** `{skill:hc-plan}` or `{skill:hl-research}` — current API evidence informs decisions
**Used alongside:** `{skill:hl-brainstorm}`
**Related:** `{skill:hc-docs}` — generates `llms.txt`

## References

| File | Content |
|---|---|
| `references/flow-topic-search.md` | Topic and version lookup |
| `references/flow-library-search.md` | Library and comparison lookup |
| `references/flow-repo-analysis.md` | Repository and migration fallback |
| `references/context7-patterns.md` | Repository and version URL patterns |
| `references/errors.md` | Errors and fallbacks |
| `references/advanced.md` | Version conflicts and edge cases |
