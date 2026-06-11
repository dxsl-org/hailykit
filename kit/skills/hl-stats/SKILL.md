---
name: hl-stats
description: "Project code statistics — file counts, nLOC per language, cyclomatic complexity hotspots, and LLM token estimate. Filter by path, language, or module."
when_to_use: "Invoke when you need a codebase size snapshot, want to find high-complexity hotspots, or need to estimate token budget before loading files into an LLM context."
user-invocable: true
argument-hint: "[path] [--json] [--lang <list>] [--top <n>] [--exclude <pattern>]"
metadata:
  category: dev-tools
  keywords: [stats, metrics, loc, ncloc, complexity, hotspots, token, codebase, size, language]
---

# Stats — Project Code Metrics

Collect and display code statistics for a codebase path: file counts, nLOC, language breakdown, cyclomatic complexity hotspots, and LLM token estimate. Runs on Haiku — fast and cheap.

## Usage

```
{skill:hl-stats} [path] [--json] [--lang <list>] [--top <n>] [--exclude <pattern>]
```

| Flag | Behavior |
|------|----------|
| *(none)* | Human-readable table — language breakdown + hotspot list |
| `--json` | Compact JSON schema (`v`, `summary`, `hotspots`, `thresholds`) |
| `--lang ts,py` | Filter to specific languages (name or extension) |
| `--top N` | Show top N complexity hotspots (default: 10) |
| `--exclude pattern` | Skip paths containing this substring |

```
{skill:hl-stats}                     # scan current directory
{skill:hl-stats} ./src               # scan ./src subtree
{skill:hl-stats} ./cli --lang ts     # TypeScript files only
{skill:hl-stats} . --json            # machine-readable output
{skill:hl-stats} ./src --top 5       # top 5 hotspots only
```

## Process

Spawn `Task(subagent_type="haily-stats")` with the target path and all provided flags. Present the returned output directly.

## Output

**Table mode (default):** per-language row (files · nLOC · comments · complexity) + hotspot list sorted by complexity.

**JSON mode (`--json`):** structured schema — use for agent pipelines or follow-up analysis.

```json
{
  "summary": { "files": 54, "ncloc": 4376, "complexity": 1002, "token_est": 78768 },
  "hotspots": [{ "file": "cli/installer/merger.ts", "ncloc": 372, "complexity": 142 }],
  "thresholds": { "complexity_warn": 15, "complexity_error": 25, "file_loc_warn": 200 }
}
```

`token_est = ncloc × 18` — use to budget how many files fit in an LLM context window before loading them.

Thresholds: `⚠ complexity ≥ 15` · `✗ complexity ≥ 25` · file size warn ≥ 200 lines.

Auto-excluded: `node_modules` · `dist` · `.git` · `.next` · `coverage` · `__pycache__` · `target` · `.venv`.

## Workflow Position

**Standalone** — no required predecessor or successor.
**Use before:** {skill:hc-plan}, {skill:hl-research} — understand codebase scope before planning work.
**Use after:** implementation phases — verify complexity and file-size budgets stayed within thresholds.
**Related:** {skill:hc-scout} (file search + dependency map), Task(subagent_type="haily-tech-analyst") (full tech debt inventory).
