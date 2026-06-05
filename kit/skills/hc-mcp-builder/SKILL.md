---
name: hc-mcp-builder
description: "Build MCP servers from scratch or convert existing codebases into CLI + MCP server."
when_to_use: "Invoke when building a new MCP server from an API/service, or agentizing an existing codebase so AI agents can use it."
user-invocable: true
argument-hint: "<API description | local-path | github-url> [--mcp|--cli] [--auto]"
metadata:
  category: dev-tools
  keywords: [MCP, server, build, agentize, cli, tools]
---

# MCP Builder — Build & Agentize MCP Servers

Two modes: **build** a new MCP server from an API; **agentize** existing code into CLI + MCP server.

> To manage or call existing MCP servers, use Claude Code's native `/mcp` command instead.

## Usage

```
{skill:hc-mcp-builder} <API description | local-path | github-url> [--mcp|--cli] [--auto]
```

**Execution mode:**

| Flag | Behavior |
|---|---|
| *(none)* | Interactive — pauses at Checkpoints for user approval |
| `--auto` | Autonomous — no stops; composes with scope flags |

**Input auto-detection:**

| First argument | Mode |
|---|---|
| String description ("Wrap Stripe API") | **Build** — new MCP server from API spec |
| Local path (`./src/payments/`) | **Agentize** — wrap existing code |
| GitHub URL | **Agentize** — wrap repo code |

**Agentize output scope** (user-specified intent, not code analysis):

| Scope flag | Output |
|---|---|
| *(none)* | Monorepo — shared `core/` + thin `cli/` + `mcp/` packages (default, fullest) |
| `--mcp` | MCP server only — add agent interface without touching existing CLI |
| `--cli` | CLI only — npm-publishable CLI without MCP layer |

Scope flags compose with `--auto`:
```
{skill:hc-mcp-builder} "Wrap Stripe API"
{skill:hc-mcp-builder} "Wrap Stripe API" --auto
{skill:hc-mcp-builder} ./src/payments/
{skill:hc-mcp-builder} ./src/payments/ --mcp
{skill:hc-mcp-builder} ./src/payments/ --mcp --auto
{skill:hc-mcp-builder} https://github.com/owner/repo --cli --auto
```

## Constraints

> **Required — workflows not endpoints:** Design tools that map to user workflows, not 1:1 to API endpoints. `schedule_event` = check availability + create, not 3 separate calls.

> **Required — testing safety:** MCP servers are long-running stdio/http processes — running directly hangs your shell. Use `timeout 5s python server.py` for syntax check, or tmux (server in one pane, test harness in another).

## Build Mode

New MCP server from an API or service. Four stages:

### Design

Before writing code, define the tool surface:
- Fetch MCP protocol spec: `WebFetch https://modelcontextprotocol.io/llms-full.txt`
- Study the target API: auth, rate limits, pagination, error codes
- Design response format: high-signal JSON + Markdown; `concise` vs `detailed` modes; names over IDs
- Plan input validation (Pydantic/Zod), actionable error messages, tool annotations

See `references/mcp-best-practices.md` for naming, pagination, character limits, security rules.

### Implement

| | Python | TypeScript |
|--|---|---|
| Validation | Pydantic v2 | Zod `.strict()` |
| Registration | `@mcp.tool` decorator | `server.registerTool` |
| Build check | `python -m py_compile server.py` | `npm run build` → `dist/index.js` |
| Guide | `references/python-mcp-server.md` | `references/node-mcp-server.md` |

Per-tool checklist:
- Input schema with constraints (min/max, regex, ranges) and diverse examples
- Docstring: one-line summary · parameters · return schema · usage example · error cases
- Annotations: `readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`
- Async/await for all I/O; truncation strategy for large responses (≤25 000 tokens)

### Review

- DRY: no duplicated code across tools
- Consistent response format for similar operations
- All external calls have error handling
- Every tool has a comprehensive docstring

### Evaluate

Create 10 evaluation questions covering realistic multi-tool workflows:
1. List available tools and understand capabilities via read-only operations
2. Generate 10 complex, verifiable questions (single clear answer, stable over time)
3. Solve each manually to produce ground-truth answers

See `references/evaluation.md` for output XML format.

## Agentize Mode

Activated when first argument is a local path or GitHub URL. Converts an existing module or codebase into a distributable CLI + MCP server.

Output scope is specified by the user via `--mcp` or `--cli` flags (see Usage). Default when no scope flag is given: monorepo with `core/` + `cli/` + `mcp/` packages.

**Principles:** one source of truth (shared `core/`, thin adapters) · agent-centric tool design · credentials at every layer · ship with docs + tests + CI.

## Register

After building, add to `.claude/.mcp.json`:

```json
{
  "mcpServers": {
    "my-server": {
      "command": "python",
      "args": ["server.py"],
      "env": { "API_KEY": "..." }
    }
  }
}
```

Restart → Claude Code, Cursor, Claude Desktop discover tools automatically.

## Workflow Position

**Follows:** `{skill:hc-plan}` — plan the MCP server design before building
**Precedes:** `{skill:hc-deploy}` — deploy the MCP server after building
**Related:** `{skill:hc-cook}`, `{skill:hc-review}`

## References

| File | Content |
|---|---|
| `references/mcp-best-practices.md` | Naming, pagination, character limits, security rules |
| `references/python-mcp-server.md` | Python implementation guide |
| `references/node-mcp-server.md` | TypeScript/Node implementation guide |
| `references/evaluation.md` | Evaluation XML format and methodology |
| `references/agentize-agent-centric-design.md` | Workflow-first tool design |
| `references/agentize-auth-resolution-chain.md` | env → flag → keychain → OAuth |
| `references/agentize-challenge-framework.md` | Clarifying questions before wrapping |
| `references/agentize-deployment-guide.md` | npm publish, Cloudflare Workers, Docker |
| `references/agentize-mcp-transports.md` | stdio, SSE, Streamable HTTP |
| `references/agentize-monorepo-layout.md` | Shared core + thin CLI/MCP adapters |
