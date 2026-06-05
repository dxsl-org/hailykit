---
name: flow-parallel
description: Parallel edge-case audit workflow — exhaustively list edge cases first, then dispatch parallel haily-reviewer agents to verify each category. Activated by `{skill:hc-review} codebase parallel`.
---

# Parallel Edge-Case Audit Workflow

Exhaustive audit: enumerate all potential edge cases, then dispatch parallel `haily-reviewer` agents to verify each category, followed by an adversarial pass on the full scope.

## Workflow

### Enumerate Edge Cases

Main agent analyzes the codebase scope exhaustively before spawning reviewers:
- Read `codebase-summary.md` if present
- Spawn `{skill:hc-scout}` to find relevant files and data flows
- Analyze all potential failure modes:
  - Null/undefined scenarios
  - Boundary conditions (off-by-one, empty, max values)
  - Error handling gaps
  - Race conditions and async edge cases
  - Input validation holes
  - Security vulnerabilities
  - Resource leaks
  - Untested code paths

Output format:
```
## Edge Cases Identified

### [scope-area]
1. [edge case description] → files: [file1, file2]
```

### Categorize and Assign

Group edge cases by scope for parallel verification:
- Each category → one `haily-reviewer` subagent
- Max 6 categories (merge small ones)
- Each reviewer receives: category name, specific edge cases to verify, relevant files
- Task: **verify** whether each edge case is properly handled — do not discover new ones

### Parallel Verification

Dispatch N `haily-reviewer` subagents simultaneously. Each reports: which edge cases are handled vs. unhandled.

Aggregate results:
```
## Edge Case Verification Report

### Summary
- Total: X  |  Handled: Y  |  Unhandled: Z  |  Partial: W

### Unhandled Edge Cases (Need Fix)
| # | Edge Case | File | Status |
|---|-----------|------|--------|
```

### Adversarial Pass (Always-On)

After aggregation, spawn adversarial reviewer (`references/review-adversarial.md`) on the full scope:
- Pass aggregated findings + unhandled edge cases as context
- Adjudicate findings: Accept / Reject / Defer

No scope gate in parallel audit mode — adversarial pass always runs.

### Auto-Fix Pipeline

If unhandled/partial edge cases were found:
- `AskUserQuestion`: "Found N unhandled edge cases. Fix now with `{skill:hc-fix}`? [Y/n]"

### Final Report

Summary + ask user: "Commit? [Y/n]" → spawn `haily-git-manager` if yes.
