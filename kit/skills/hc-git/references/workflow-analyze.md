# Impact Analysis Protocol

Senior-dev change review. Not a commit list — a conceptual diff of what the codebase *means* now versus before.

## Ref Forms

| Form | Example | Meaning |
|------|---------|---------|
| (none) | | Since last merge to main; if on main, last 24h |
| timeframe | `2d`, `1w` | Last N days/weeks |
| range | `main..HEAD` | Explicit ref range |
| PR number | `#42` | Specific PR (requires `gh`) |
| commit SHA | `abc1234` | Since a specific commit |

## Data Sources (collect in this order)

1. `git log --oneline [ref]` — commit summary
2. `git diff --stat [ref]` — file-level scope
3. `git diff [ref]` — actual changes (sample by directory if >500 lines; note sampling)
4. `git diff [ref] -- '*.md' CHANGELOG*` — intent signals from docs/changelog
5. If PR number given: `gh pr view <N>` — description and review comments

## Output Sections (always produce all 5)

### 1. Intent
One paragraph on *why* this work happened — the problem being solved, not the files touched.

### 2. Architectural Impact
How did the shape of the system change?
- New abstractions introduced or removed
- API surface changes (added/removed/mutated contracts)
- Dependency graph changes (new/removed deps, version bumps with behavioral changes)
- Data model changes (schema, types, invariants)
- Cross-cutting concerns affected (auth, logging, caching, error handling)

Use before/after framing. Skip if purely cosmetic.

### 3. Technical Debt Delta
Did we pay down debt or accumulate it?
- Complexity reduced: simpler call paths, fewer edge cases, dead code removed
- Complexity added: workarounds, TODO markers, deferred concerns, hardcoded values
- Net assessment: `+debt | -debt | neutral` — one-line rationale

### 4. Risk Radar
What could go wrong in production?
- Behavioral changes visible to users or downstream consumers
- Rollback complexity: can this be reverted cleanly?
- Race conditions, migration risks, config drift
- Test coverage gaps relative to changed surface area
- Rate each risk: Low / Medium / High

### 5. What's Not Done
Explicit gaps left open — deferred work, known unhandled edge cases, required follow-up. If nothing: "None."

## Edge Cases

| Condition | Action |
|-----------|--------|
| No ref provided | `git log --oneline main..HEAD`; if on main, use last 24h |
| No git repo | Explain and exit |
| Empty diff | "No changes detected since [ref]." |
| Large diff (>2000 lines) | Sample by directory; note sampling in output |
| `gh` unavailable for PR | Fall back to local git log; note limitation |

> **Required — analysis only:** Do not implement, edit files, commit, checkout, merge, or push unless the user explicitly requests it.
