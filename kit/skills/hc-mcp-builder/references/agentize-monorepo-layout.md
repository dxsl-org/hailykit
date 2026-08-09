# Monorepo Layout

Use this boundary for `--both`: one shared core, thin CLI and MCP adapters.

```text
packages/
  core/src/{capabilities,config,errors.ts,index.ts}
  cli/src/{commands,credentials.ts,formatter.ts,bin.ts}
  mcp/src/{tools,transports,auth.ts,server.ts}
docs/{cli.md,mcp.md,architecture.md,contributing.md}
.github/workflows/{ci.yml,release.yml}
claude/skills/<tool-name>/
package.json
pnpm-workspace.yaml
tsconfig.base.json
LICENSE
README.md
```

Each package owns tests, `package.json`, and `tsconfig.json`. The MCP package may also own `wrangler.toml` and a `Dockerfile`.

## Package Contracts

- Root is private and defines workspace-wide `build`, `test`, `lint`, `typecheck`, and release commands.
- `core` is private and exports types plus capability functions.
- CLI publishes a `bin`, includes only distributable files, declares its Node engine, and runs build/tests before publish.
- MCP publishes its own `bin`, depends on the core and MCP SDK, and carries provider deployment assets.
- Public packages use provenance-enabled publishing; never publish workspace source, tests, or secrets by accident.

## Core Boundary

`core`:

- contains all business rules and shared capability implementations;
- accepts explicit config and injected clients;
- returns plain data or throws typed errors;
- does not parse argv, write protocol output, or host HTTP transports.

`cli` and `mcp`:

- translate argv/tool arguments into core inputs;
- translate core results/errors into their surface format;
- own formatting, auth adaptation, and transport lifecycle;
- contain no business logic.

If logic must behave identically through CLI and MCP, it belongs in `core`.

## Single-Surface Fallback

For `--cli` or `--mcp`, keep the same separation inside one package:

```text
src/
  core/
  cli/  # or mcp/
  index.ts
```

Preserving `src/core/` makes adding the second adapter a packaging change rather than a rewrite.
