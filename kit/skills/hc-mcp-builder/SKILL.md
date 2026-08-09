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

# MCP Builder — Build and Agentize

Build an MCP server from an API description or expose code through CLI/MCP adapters. Use `/mcp` to manage an existing server.

## Usage

```text
{skill:hc-mcp-builder} "Wrap Stripe API"
{skill:hc-mcp-builder} ./src/payments --mcp
```

| Flag | Output |
|---|---|
| *(none)* | Interactive; pause at checkpoints. Output shared `core/` with thin `cli/` and `mcp/` adapters |
| `--mcp` | MCP server only |
| `--cli` | Distributable CLI only |
| `--auto` | Resolve checkpoints autonomously; composes with either scope flag |

## Constraints

> **Required — workflows not endpoints:** Design tools around complete user workflows, not one tool per API endpoint; keep business logic in shared `core/` and adapters thin.

> **Required — testing safety:** MCP servers are long-running stdio/HTTP processes. Use `timeout 5s <server-command>` for a bounded syntax/startup check or run the server and harness in separate `tmux` panes.

> **Required — trust boundaries:** Resolve credentials through the documented auth chain, never bake or print secrets, and require explicit confirmation for destructive tools. MCP annotations are hints, not authorization controls.

## Process

1. **Route:** a text/API description selects Build; a local path or GitHub URL selects Agentize. Apply the user-selected output scope from Usage.
2. **Recon:** inspect auth, rate limits, pagination, errors, public contracts, and deployment. Load only relevant references.
3. **Design:** group workflow-first tools; return concise structured results, names over IDs, actionable errors, and pagination with `limit`, `has_more`, and `next_offset` or `next_cursor`.
4. **Build:** validate inputs with Pydantic v2 or strict Zod; use async I/O; document parameters, return shape, and errors; set `readOnlyHint`, `destructiveHint`, `idempotentHint`, and `openWorldHint`; truncate responses around `25,000` characters with continuation guidance. Return expected tool errors in result objects.
5. **Agentize:** keep business logic in `core/`; let `cli/` and `mcp/` own translation, output, and lifecycle. Select with `MCP_TRANSPORT`: stdout is protocol-only for stdio; prefer Streamable HTTP at `/mcp`; keep SSE for compatibility. Resolve auth explicit token/flag → env → dotenv → user config → project config → keychain; remote HTTP/SSE uses `ctx.auth` first and disables keychain outside local development. Ship docs, tests, and CI.
6. **Verify:** build, run bounded process tests, then create 10 stable and verifiable workflow questions with manual ground truth across read, mutation, failure, pagination, and multi-tool cases.
7. **Register:** add `.claude/.mcp.json` using environment-variable names or secret references, never credentials; restart and verify discovery.

## Workflow Position

**Follows:** `{skill:hc-plan}` — plan the MCP server design before building
**Precedes:** `{skill:hc-deploy}` — deploy the MCP server after building
**Related:** `{skill:hc-cook}`, `{skill:hc-review}`

## References

| File | Content |
|---|---|
| `references/mcp-best-practices.md` | Core contracts |
| `references/python-mcp-server.md` | Python |
| `references/node-mcp-server.md` | TypeScript/Node |
| `references/evaluation.md` | Evaluation |
| `references/agentize-agent-centric-design.md` | Tool design |
| `references/agentize-auth-resolution-chain.md` | Auth chain |
| `references/agentize-challenge-framework.md` | Clarification |
| `references/agentize-deployment-guide.md` | Deployment |
| `references/agentize-mcp-transports.md` | Transports |
| `references/agentize-monorepo-layout.md` | Layout |
