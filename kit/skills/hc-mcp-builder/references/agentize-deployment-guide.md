# MCP Deployment Guide

Choose Cloudflare Workers, Docker, or a Node-capable PaaS from the required transport, state, and operations model.

## Cloudflare Workers

- Use Streamable HTTP at `/mcp`; stdio cannot run on Workers.
- Store per-session state in a Durable Object keyed by `mcp-session-id`.
- Put tokens in Workers Secrets (`wrangler secret put MCP_TOKEN`).
- Prefer Web APIs; enable `nodejs_compat` only when a dependency requires it.
- Keep SSE only for compatibility.

Required configuration includes the worker entry, compatibility date, Durable Object binding/migration, and `MCP_TRANSPORT=http`.

## Docker

- Use a multi-stage build and copy only runtime artifacts.
- Run as a non-root user.
- Bind the HTTP server to `0.0.0.0`, read `PORT`, expose `/healthz`, and send logs to stdout/stderr.
- Inject `MCP_TOKEN` through a secret manager or protected environment; never bake it into the image or Compose file.
- Publish immutable images to the selected registry through the release workflow.

## PaaS

Fly.io, Railway, Render, and equivalent Node platforms use Streamable HTTP. Configure `MCP_TRANSPORT=http`, inject secrets through the platform, bind `0.0.0.0:$PORT`, and avoid local filesystem persistence.

## Cross-Cutting Contract

- Terminate TLS at the platform or managed reverse proxy.
- Rate-limit per token at the application layer.
- Use Durable Objects on Workers; use Redis or sticky sessions when horizontally scaling Node deployments.
- Prefer redeploy over config hot reload.
- Support token rotation with `MCP_TOKEN` and `MCP_TOKEN_PREV` during a bounded overlap window.
- Provide local stdio and HTTP development commands plus an `mcp.json` registration example in `docs/mcp.md`.
