# Research Phase

**Skip when:** haily-researcher reports are already provided.

## Process

### Spawn Parallel Researchers

Identify 2–4 distinct research angles from the task description. Spawn one `haily-researcher` subagent per angle in parallel:

```
haily-researcher-01: "What are the current best practices for JWT refresh token rotation?"
haily-researcher-02: "What libraries implement this in Node.js / Python / [detected stack]?"
haily-researcher-03: "What are the security risks and edge cases?"
```

Each haily-researcher produces a report ≤150 lines. Wait for all reports before proceeding.

### Structured Analysis (when needed)

For complex or ambiguous tasks where research findings conflict or the causal chain is non-obvious, activate `{skill:hl-reasoning}` for multi-step analysis and hypothesis revision.

### Documentation Lookup

For library, framework, or API questions, use `{skill:hc-lookup}` to retrieve up-to-date documentation via context7:

```
{skill:hc-lookup} "prisma upsert with conflict handling"
{skill:hc-lookup} "next.js app router data fetching caching"
```

### Remote Repository Analysis

When a GitHub URL is provided as reference material:

```bash
repomix --remote https://github.com/owner/repo
```

This produces a codebase summary the haily-researcher can analyze without cloning.

### Issue and PR Context

When the task references a GitHub issue or PR, retrieve context:

```bash
gh issue view <N>
gh pr view <N>
```

## Output

Synthesize haily-researcher reports into a single findings summary covering:
- Available approaches with trade-offs
- Recommended approach with rationale
- Security and performance implications identified
- Open questions that the plan author must decide

Pass the findings summary to the Solution Design stage.
