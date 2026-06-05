# Monorepo Standards (Turborepo / pnpm workspaces / nx)

Detected via presence of `turbo.json`, `nx.json`, or `pnpm-workspace.yaml`.

## When a Monorepo is Worth It

- Multiple apps sharing a UI library, types, or config (web + admin + docs)
- Microfrontends with a shared backend client
- Design system + consumer apps in one repo
- Need build caching across CI runs

**Not worth it for**: single app, < 3 packages, fully independent apps.

## Tool Comparison

| Feature | Turborepo | pnpm workspaces | nx |
|---|---|---|---|
| Package manager | Any | pnpm only | Any |
| Task pipeline | `turbo.json` | scripts only | `nx.json` + project.json |
| Build cache | Local + remote | None | Local + remote (Nx Cloud) |
| Affected detection | `--filter` | manual | `nx affected` |
| Code generation | No | No | Yes (generators) |
| Best for | JS/TS, simple pipelines | Workspace deps only | Polyglot, enterprise, generators |

**Default stack:** Turborepo + pnpm workspaces. Pick nx only if you need generators or polyglot (JS + Python + Go in one repo).

## Standard Structure

```
my-monorepo/
├── apps/
│   ├── web/              # Next.js / TanStack Start / etc.
│   ├── admin/
│   └── docs/
├── packages/
│   ├── ui/               # Shared components
│   ├── config/           # ESLint, TS, Tailwind configs
│   ├── types/            # Shared TS types
│   └── utils/            # Pure helpers
├── turbo.json            # If using Turborepo
├── pnpm-workspace.yaml   # If using pnpm
├── nx.json               # If using nx
└── package.json
```

Apps are end-products; packages are reusable internals.

## pnpm Workspaces (Workspace Layer)

`pnpm-workspace.yaml`:
```yaml
packages:
  - "apps/*"
  - "packages/*"
```

Internal dep in `apps/web/package.json`:
```json
{ "dependencies": { "@repo/ui": "workspace:*" } }
```

- `workspace:*` — always use the local version, never published
- `workspace:^1.0.0` — local + SemVer range fallback for published consumers
- `pnpm --filter web add lodash` — add to a specific package
- `pnpm --filter "./packages/*" build` — build all packages
- `pnpm --filter ...web build` — build web + all its transitive deps

## Turborepo (Task Pipeline)

`turbo.json`:
```json
{
  "$schema": "https://turbo.build/schema.json",
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "!.next/cache/**", "dist/**"]
    },
    "dev": { "cache": false, "persistent": true },
    "lint": {},
    "test": { "dependsOn": ["build"] }
  }
}
```

- `^build` — topological (dependencies build first)
- `outputs` — what to cache; missing this = cache miss every time
- `turbo run build --filter=web` — build only `apps/web` + its deps
- `turbo run build --filter='[origin/main]'` — affected since main

## nx (Generators + Pipeline)

```bash
npx create-nx-workspace@latest my-monorepo
nx generate @nx/react:app web
nx generate @nx/react:library shared-ui --directory=libs/ui
nx affected --target=build
nx graph                  # visualize dep graph
```

`nx.json` + per-project `project.json` files define targets. Generators are nx's killer feature — they enforce structure across the team.

## Remote Caching

Both Turborepo and nx support remote cache — share builds across CI machines and developer laptops.

**Turborepo:**
```bash
npx turbo login
npx turbo link
# CI env: TURBO_TOKEN, TURBO_TEAM
```

**nx Cloud:**
```bash
npx nx connect-to-nx-cloud
# CI env: NX_CLOUD_ACCESS_TOKEN
```

Cache hit on CI = build skipped entirely. Typical 50-80% pipeline time reduction.

## CI Pattern (GitHub Actions example)

```yaml
- uses: pnpm/action-setup@v3
- uses: actions/setup-node@v4
  with: { node-version: 20, cache: 'pnpm' }
- run: pnpm install --frozen-lockfile
- run: pnpm turbo run build test lint
  env:
    TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
    TURBO_TEAM: ${{ secrets.TURBO_TEAM }}
```

For PRs, filter to affected only:
```yaml
- run: pnpm turbo run test lint --filter='[origin/${{ github.base_ref }}]'
```

## Anti-patterns

- **Versioning each internal package independently** — use `workspace:*`, version at app/release boundary only
- **Building everything on every PR** — always use `--filter` (Turborepo) or `affected` (nx)
- **Mixing pnpm and npm in the same workspace** — lockfile chaos
- **Committing build artifacts** — let the cache handle reuse
- **One giant `tsconfig.json` at the root** — each package needs its own with `references` for project refs
- **Hardcoded relative imports across packages** (`../../packages/ui/...`) — always import via workspace name (`@repo/ui`)

## Common Pitfalls

- `outputs` in `turbo.json` missing or wrong → cache never hits
- Forgetting to mark `dev` task with `"cache": false` → broken dev experience
- pnpm + Docker: use `pnpm fetch` + `pnpm install --offline` in builder layer for cache efficiency
- nx project.json + Turborepo turbo.json in same repo → pick one orchestrator, not both

## Performance Wins

- Remote cache → 50-80% CI time reduction on big monorepos
- `dependsOn: ['^build']` topological sort → packages build in parallel where possible
- `--filter` / `affected` → PR builds only touch changed paths
- Package-level `tsconfig` with `incremental: true` → fast type-check
