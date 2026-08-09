# MCP Transports

Register tools once on a transport-agnostic server. Expose the same schemas and behavior through `stdio`, legacy `SSE`, and preferred remote `Streamable HTTP`.

## Selection

Resolve `MCP_TRANSPORT`, then `--transport`, then default to `stdio`. Reject unknown values before startup.

| Transport | Use | State |
|---|---|---|
| stdio | local spawned agents | per process |
| SSE | compatibility with older remote clients | per connection/session |
| Streamable HTTP | preferred remote/PaaS/Workers | keyed by `mcp-session-id` |

## stdio

- Trust the spawning parent; credentials use the local resolution chain.
- Never write non-protocol bytes to stdout. Logs and diagnostics go to stderr.
- Connect one `StdioServerTransport` to the shared server.

## SSE

- Create one transport per connection and pair `/sse` with its message endpoint.
- Authenticate before upgrade and send heartbeats when proxies may idle the connection.
- Keep only for client compatibility; document Streamable HTTP as preferred.

## Streamable HTTP

- Serve POST requests and GET streams through one `/mcp` endpoint.
- Generate and validate session IDs; map `mcp-session-id` to server state.
- Support resumable streams where the SDK/runtime permits.

Remote state uses Durable Objects on Cloudflare or Redis/sticky sessions on Node deployments. Do not rely on local in-memory state when requests can reach different replicas.

## Remote Auth

Apply to SSE and HTTP only:

- require `Authorization: Bearer <token>` before creating a session;
- reject invalid credentials with `401` without revealing which tokens exist;
- rate-limit per token;
- source secrets from Workers Secrets, a deployment secret manager, or protected environment variables—never the image or repository.

## Observability

HTTP deployments expose `/healthz` for liveness and `/readyz` for readiness. Emit structured logs with `trace_id`, `session_id`, `tool_name`, and `duration_ms`; never log tool arguments or credentials. Protect metrics or expose them only on an internal listener.
