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

# Lookup — context7 Documentation Discovery

Script-first documentation discovery using the llms.txt standard. Supports precise topic queries, version-pinned lookups, library comparisons, and migration guides — no manual URL construction needed.

## Usage

```
{skill:hc-lookup} [library[@version]] [topic]
{skill:hc-lookup} [lib1] vs [lib2] [topic]
{skill:hc-lookup} [library] migration [version-range]
```

```
{skill:hc-lookup} shadcn "date picker"
{skill:hc-lookup} next.js "app router data fetching"
{skill:hc-lookup} react@19 useOptimistic          ← version-specific
{skill:hc-lookup} prisma@5 transactions            ← version-specific
{skill:hc-lookup} hono vs express middleware        ← parallel comparison
{skill:hc-lookup} react vs vue lifecycle            ← parallel comparison
{skill:hc-lookup} next.js migration 14-to-15       ← migration guide
{skill:hc-lookup} prisma 4-to-5 breaking-changes   ← upgrade planning
```

## Execution Modes

| Mode | Trigger | Speed | Agents | Use when |
|---|---|---|---|---|
| **Topic-specific** | feature keyword in query | ⚡ 10–15s | 2–3 | Precise API/feature lookup |
| **Version-specific** | `library@version` syntax | ⚡ 10–30s | 2–3 | Version-pinned behavior (API changed!) |
| **Library-level** | library name only | ⚡⚡ 30–60s | 3–7 | Library overview or broad concepts |
| **Comparison** | `vs` between two library names | ⚡⚡ 30–90s | parallel pairs | Choosing between libraries or porting |
| **Migration** | `migration` / `changelog` / `upgrade` in query | ⚡⚡ 30–120s | 3–5 | Upgrade planning, breaking change audit |
| **Repo analysis** | no llms.txt on context7 | ⚡⚡⚡ 5–10min | varies | Unlisted or private libraries |

**Mode is auto-detected** from the query shape — no flag needed.

## Process

Execute scripts in order — scripts handle URL construction, fallback chains, and error handling automatically:

1. **Detect query type and extract metadata**
   ```bash
   node scripts/detect-topic.js "<user query>"
   # → {topic, library, version?, isTopicSpecific}
   # → {isComparison: true, libraries: ["lib1","lib2"], topic?}
   # → {isMigration: true, library, migrationQuery}
   ```

2. **Fetch documentation** (per library; run in parallel for comparison mode)
   ```bash
   node scripts/fetch-docs.js "<user query>"
   # → llms.txt content or error
   ```

3. **Analyze and distribute** (when multiple URLs returned)
   ```bash
   cat llms.txt | node scripts/analyze-llms-txt.js -
   # → {totalUrls, distribution, strategy}
   ```

### Version-specific lookup
When `@version` is detected, `fetch-docs.js` appends the version to the context7 URL path
(`/v2/llms.txt`, `/tags/v5.0.0/llms.txt`). Fall back to general llms.txt if version-specific
URL returns 404, then note the fallback in the response.

### Comparison mode
Spawn two parallel lookup chains (one per library). Present side-by-side once both complete.
Load `references/flow-library-search.md` for each branch.

### Migration mode
Route to `references/flow-repo-analysis.md` with migration-specific prompt: focus on
CHANGELOG, migration guides, and breaking-changes docs. Filter URL list to entries matching
`migration`, `changelog`, `upgrade`, `breaking`.

## Scripts

| Script | Purpose | Output |
|---|---|---|
| `detect-topic.js` | Classify query: topic/version/comparison/migration/general | `{topic, library, version?, isTopicSpecific, isComparison?, isMigration?}` |
| `fetch-docs.js` | Construct context7.com URLs + fetch | llms.txt content or error |
| `analyze-llms-txt.js` | Categorize URLs, recommend agent distribution | `{totalUrls, distribution, strategy}` |

**Environment:** Load `.env` from (first match): `process.env` → `.claude/skills/hc-lookup/.env` → `.claude/skills/.env` → `.claude/.env`.
Set `CONTEXT7_API_KEY` for higher rate limits; `GITHUB_TOKEN` for repo-analysis fallback.

## References

| File | Content |
|---|---|
| `references/flow-topic-search.md` | Topic-specific and version-specific query workflow |
| `references/flow-library-search.md` | General library search + comparison workflow |
| `references/flow-repo-analysis.md` | Repo fallback + migration/changelog workflow |
| `references/context7-patterns.md` | URL patterns, known repositories, versioned URL formats |
| `references/errors.md` | Error handling, fallback strategies |
| `references/advanced.md` | Edge cases, versioning, multi-language, conflict resolution |

## Workflow Position

**Used alongside:** any skill that needs up-to-date library or framework documentation
**Common callers:** `{skill:hl-brainstorm}`, `{skill:hc-plan}`, `{skill:hl-research}`
**Related:** `{skill:hc-docs}` (generates llms.txt), `{skill:hl-research}` (multi-source research)
