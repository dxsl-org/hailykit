# Monorepo Standards

Detect via `turbo.json`, `nx.json`, or `pnpm-workspace.yaml`.

- Default stack: Turborepo + pnpm workspaces. Use nx only when generators or polyglot targets matter.
- Keep `apps/` for end products and `packages/` for shared internals.
- Internal dependencies use `workspace:*`; do not version local packages independently.
- Do not mix package managers in one workspace.
- Do not commit build artifacts.
- Do not use hardcoded cross-package relative imports such as `../../packages/ui/...`; import by workspace name.

## Typical layout

Include only the orchestrator files the workspace actually uses.

```text
apps/
packages/
turbo.json              # Turborepo only
pnpm-workspace.yaml
nx.json                 # nx only
package.json
```

`pnpm-workspace.yaml`

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

`apps/web/package.json`

```json
{ "dependencies": { "@repo/ui": "workspace:*" } }
```

## Turborepo contract

`turbo.json`

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "!.next/cache/**", "dist/**"]
    },
    "dev": { "cache": false, "persistent": true }
  }
}
```

- `^build` means topological build order.
- `outputs` must be explicit or cache reuse will miss.
- Use `turbo run build --filter=web` for one app plus its deps.
- Use `turbo run build --filter='[origin/main]'` for affected builds.

## nx contract

- `nx.json` and per-project `project.json` define targets.
- Use `nx affected --target=build` for changed scope only.
- Pick one orchestrator: nx or Turborepo, not both.

## Remote cache

- Turborepo CI env: `TURBO_TOKEN`, `TURBO_TEAM`
- nx Cloud CI env: `NX_CLOUD_ACCESS_TOKEN`

## Anti-patterns

- One giant root `tsconfig.json` without package-level refs
- Missing or wrong `outputs`
- Caching `dev`
- Building every package on every PR instead of affected/filter scope
