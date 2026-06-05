# Repo Type Detection and Structure

How `worktree.cjs info` classifies repos and what each type means for worktree creation.

## Detection Order

`repoType` is determined by checking these signals in order (first match wins):

| Signal | `repoType` |
|--------|-----------|
| `.gitmodules` references repos AND is itself referenced by a parent | `superproject` |
| `turbo.json`, `pnpm-workspace.yaml`, or `nx.json` present | `monorepo` |
| `.gitmodules` present (contains submodules) | `submodule` |
| None of the above | `standalone` |

## Standalone Repo

Standard single-repo project. Worktrees created as siblings:

```
my-project/              ← main checkout (branch: main)
my-project-worktrees/
  feat-payment/          ← worktree (branch: feat/payment)
  fix-login/             ← worktree (branch: fix/login)
```

Default `worktreeRoot`: sibling directory named `<repo>-worktrees/`.

## Monorepo

Detected by `turbo.json`, `pnpm-workspace.yaml`, or `nx.json`. Skill asks which package/app to scope the worktree to, then runs the correct package manager (`pnpm` / `bun` / `yarn`) in that package after creation.

```
my-monorepo/
  apps/web/              ← working here now
  apps/mobile/           ← need to start feature here too
  packages/ui-kit/
→ AskUserQuestion: "Which project?" → picks apps/mobile
→ Creates worktree scoped to apps/mobile
```

Default `worktreeRoot`: sibling of the monorepo root.

## Repo with Submodules

By default, a new worktree has **empty** submodule folders. Use `--checkout-submodules` to auto-run:

```bash
git submodule update --init --checkout --recursive
```

Use when the build depends on submodule content — it will fail with empty folders otherwise.

```
my-project/
  vendor/auth-lib/       ← submodule
  vendor/payment-sdk/    ← submodule
→ New worktree: vendor/auth-lib/ is empty unless --checkout-submodules
```

## Superproject

A repo that contains other repos as submodules. `worktree.cjs status` auto-normalizes the main checkout path so health reports are correct across all nested repos.

Default `worktreeRoot`: superproject root takes precedence over monorepo root and sibling location.

## Worktree Root Priority

When determining where to create worktrees:

1. `--worktree-root <path>` (explicit override)
2. Superproject root (if superproject detected)
3. Monorepo root sibling (if monorepo detected)
4. Sibling of current repo (standalone fallback)

## Auto-Copied Files

`.env*.example` files are automatically copied into the new worktree with the `.example` suffix removed, so the worktree is ready to use without manual setup.
