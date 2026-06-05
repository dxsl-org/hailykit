---
name: hc-worktree
description: "Parallel git worktrees — work on multiple branches simultaneously without switching. Auto-detects repo type (standalone, monorepo, superproject/submodule), names branches from descriptions, installs deps in background. Supports turbo/pnpm/nx monorepos and --checkout-submodules."
when_to_use: "Invoke when creating an isolated branch environment — hotfix while mid-feature, PR review without losing work, or parallel package development in a monorepo."
user-invocable: true
argument-hint: "[feature-description] | [project] [feature] | --checkout-submodules"
metadata:
  category: project
  keywords: [worktree, parallel, monorepo, submodule, isolation, branch]
---

# hc:worktree — Parallel Branch Environments

Each worktree is one branch checked out in its own folder. All worktrees share one `.git/` — no clone, no duplication. Switch-free parallel development.

## Usage

```
{skill:hc-worktree} <feature-description>            # standalone repo — infers branch prefix
{skill:hc-worktree} <project> <feature>              # monorepo: scope to a specific package
{skill:hc-worktree} <feature> --checkout-submodules  # auto-initialize submodules after create
{skill:hc-worktree} <exact-branch-name> --no-prefix  # preserve exact case and slashes
```

| Flag | Behavior |
|------|----------|
| *(none)* | Infer branch prefix from description keywords; auto-detect repo type |
| `--checkout-submodules` | Run `git submodule update --init --checkout --recursive` after create |
| `--no-prefix` | Skip prefix — preserve original case and slashes (Jira keys, multi-segment branches) |
| `--base <branch>` | Override auto-detected base branch |
| `--dry-run` | Preview without executing |

## Constraints

> **Required — no force operations:** Never force-push or hard-reset a worktree branch. Each worktree is isolated — changes stay confined to its own checkout.

> **Required — deps in background:** Always run dependency install as a background task so the worktree is immediately usable.

## Process

1. **Detect repo** — run `worktree.cjs info --json`; parse `repoType` (standalone / monorepo / superproject), `baseBranch`, `projects`, `worktreeRoot`, `dirtyState`. Log `✓ Repo: <type>, base=<branch>`.
2. **Name branch** — if input is an exact branch format (uppercase, Jira key `ABC-1234`, multi-segment slashes), use `--no-prefix`; otherwise infer prefix from keywords and convert to kebab slug (max 50 chars). See `references/process-create-worktree.md` for prefix table and slug rules.
3. **Select scope** (monorepo only) — if `repoType === "monorepo"` and no project given, ask user via `AskUserQuestion` to pick from detected packages.
4. **Create** — run `worktree.cjs create [project] <slug> [--prefix <type>] [--base <branch>] [--no-prefix] [--checkout-submodules]`. Log `✓ Worktree: <path> (branch: <name>)`.
5. **Install deps** — detect lockfile; run matching install command in background. Worktree is usable immediately while deps install. See `references/process-create-worktree.md` for lockfile-to-command table.

## Commands

| Command | Usage | Description |
|---------|-------|-------------|
| `create` | `create [project] <feature>` | Create worktree |
| `remove` | `remove <name-or-path>` | Remove worktree |
| `info` | `info [--json]` | Repo info, worktree location |
| `list` | `list [--json]` | List all worktrees |
| `status` | `status [--json]` | Health, normalized paths, base-branch divergence |
| `prune` | `prune [--dry-run]` | Clean stale worktree metadata |

## Workflow Position

**Precedes:** `{skill:hc-cook}`, `{skill:hc-fix}` — creates the isolated branch environment before implementation begins.

## References

| File | Content |
|------|---------|
| `references/process-create-worktree.md` | Branch naming rules, prefix table, dep install lockfile map, JSON output fields |
| `references/tech-repo-types.md` | Repo type detection, directory structures, submodule and superproject handling |
