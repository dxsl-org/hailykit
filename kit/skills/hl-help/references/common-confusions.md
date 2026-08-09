# Common Confusions

## Built-in vs HailyKit

Some HailyKit skills resemble built-in commands but serve a different scope.

| Built-in | HailyKit skill | Difference |
|---|---|---|
| `/init` | `{skill:hc-new}` | `/init` creates one repo guidance file; `{skill:hc-new}` bootstraps a full project |
| `/init` | `{skill:hc-docs} init` | `{skill:hc-docs} init` reads the real codebase and writes `./docs/*` plus CLAUDE.md |
| `/review` | `{skill:hc-review}` | Built-in review is lighter; `{skill:hc-review}` runs the adversarial review pipeline |
| `/security-review` | `{skill:hc-security}` | `{skill:hc-security}` covers STRIDE/OWASP plus secret and dependency scans |
| `/run` or `/verify` | `{skill:hc-test}` | Built-ins support manual verification; `{skill:hc-test}` executes automated tests |
| `/loop` | `{skill:hc-optimize}` | `/loop` schedules recurring work; `{skill:hc-optimize}` runs a metric-driven optimization loop |
| `/mcp` | `{skill:hc-mcp-builder}` | `/mcp` manages servers; `{skill:hc-mcp-builder}` creates MCP server code |
| `/schedule` | no HailyKit equivalent | Use the built-in directly |

Rule of thumb: use a built-in for a quick single-purpose action in the current session. Use a HailyKit skill when you need a fuller workflow, artifacts, or specialist delegation.

## Community Skill Aliases

| Community name | HailyKit skill | What it does |
|---|---|---|
| `code-reviewer`, `pr-reviewer` | `{skill:hc-review}` | Adversarial code review |
| `commit-writer`, `smart-commit` | `{skill:hc-git}` | Commit, push, PR, merge, and impact analysis |
| `changelog-generator`, `release-notes-writer` | `{skill:hc-ship}` | Release pipeline with changelog generation inside it |
| `debugger`, `bug-investigator` | `{skill:hc-debug}` plus `{skill:hc-fix}` | Root cause first, then repair |
| `test-writer`, `test-generator` | `{skill:hc-test}` | Test execution, coverage, and web checks |
| `security-scanner`, `dependency-auditor` | `{skill:hc-security}` | Code security auditing |
| `scaffolder`, `project-initializer` | `{skill:hc-new}` | End-to-end project bootstrap |
| `tech-debt-finder` | `Task(subagent_type="haily-tech-analyst")` | Debt inventory and prioritization |
| `adr-writer` | `{skill:hc-adr}` | Capture or discover architecture decisions |
| `api-designer` | `Task(subagent_type="haily-api-designer")` | REST or GraphQL contract design |
