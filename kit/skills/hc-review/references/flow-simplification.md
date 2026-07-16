---
name: flow-simplification
description: Stage 4 Simplification Scan — Haily marker harvest and YAGNI taxonomy pass. Informational only; no fail-gate. Developer decides fix/defer/accept.
---

# Simplification Scan (Stage 4)

Informational pass — findings are advisory; no fail-gate. Developer decides: fix now / defer / accept. Pass 1 runs in the main loop; Pass 2 rides inside the Stage 2 (Quality) reviewer prompt, so this stage spawns no subagent of its own. Report the section after Stage 2/3 findings are adjudicated.

Skip entirely when `--quick`.

## Pass 1 — Haily Marker Harvest

Grep the diff files and all affected files for `// haily:` comments:

```
grep -rn "haily:" <affected files>
```

For each match, extract:
- File + line number
- `<ceiling>` — the declared abstraction limit
- `<upgrade trigger>` — the condition that warrants revisiting

Report format:
```
haily: markers (N)
  src/hooks/session.cjs:42  ceiling=sync-only    trigger="when file >10 MB"
  src/tools/runner.ts:118   ceiling=single-file  trigger="if N>1 providers"
```

Skip Pass 1 if no `haily:` markers are found.

## Pass 2 — YAGNI Taxonomy

No separate subagent — append the following 5-tag taxonomy block to the Stage 2 (Quality) `haily-reviewer` prompt (omit when `--quick`), and extract the tagged findings from the Stage 2 report. The reviewer identifies over-engineering patterns and tags each finding:

| Tag | Pattern to detect |
|-----|-------------------|
| `delete:` | Dead code — unused exports, unreachable branches, stale comments, variables assigned but never read |
| `stdlib:` | Reimplemented stdlib — hand-rolled array utils, string padding, path join, date formatting that a built-in covers |
| `native:` | Bypassed platform feature — polyfilling or reimplementing something the runtime or framework already provides natively |
| `yagni:` | Speculative abstraction — interfaces, generics, factory patterns, plugin systems built for hypothetical future needs not yet real |
| `shrink:` | Overlong implementation — multi-line logic that a one-liner, destructuring, or method chain achieves equally |

Reviewer output per finding:
```
[tag] file:line — one-sentence description
```

Summary line at the end:
```
net: -N lines possible across M findings
```

If no findings, emit: `YAGNI: clean`.

## Output Format

```
## Simplification Scan

### Haily Markers (N)
  src/hooks/session.cjs:42  ceiling=sync-only  trigger="when file >10 MB"

### YAGNI Findings (M)
[stdlib]  src/utils/array.ts:12   — `chunk()` reimplements Array slice loop; use built-in `Array.from({length}, ...)` one-liner
[yagni]   src/core/runner.ts:88   — `PluginRegistry` abstraction has one implementation and no planned extension point
net: -28 lines possible across 2 findings

> Findings are advisory — fix now, defer, or accept as-is.
```

## Scope and Constraints

- Runs over diff files only (not the whole codebase)
- Skip when `--quick`
- Skip Pass 1 when no `haily:` markers found in affected files
- Never blocks or fails the review; always advisory
- Log: `✓ Simplification: [N markers, M findings] — net: -N lines possible`
