# Worktree Creation — Detail Reference

Detailed rules for branch naming, slug generation, dependency install, and JSON output fields.

## Branch Prefix Detection

Infer prefix from description keywords (first match wins):

| Keywords in description | Prefix |
|------------------------|--------|
| fix, bug, error, issue | `fix` |
| refactor, restructure, rewrite | `refactor` |
| docs, documentation, readme | `docs` |
| test, spec, coverage | `test` |
| chore, cleanup, deps | `chore` |
| perf, performance, optimize | `perf` |
| *(default)* | `feat` |

**Exact branch mode** — use `--no-prefix` when input matches any of:
- Contains uppercase letters (`ND-1377-cleanup-docs`)
- Contains Jira/Linear key pattern (`ABC-1234`, `ND-1377`)
- Multi-segment slashes (`kai/feat/604-startup-option`)
- Caller explicitly says "use this exact name"

```
"ND-1377-cleanup-docs"        → --no-prefix → branch: ND-1377-cleanup-docs
"kai/feat/604-startup-option" → --no-prefix → branch: kai/feat/604-startup-option
"add authentication system"   → prefix=feat  → branch: feat/add-auth
"fix login bug"               → prefix=fix   → branch: fix/login-bug
```

## Slug Generation Rules

- Lowercase, kebab-case
- Remove stop words (a, an, the, for, to, in, of, and, or)
- Strip special characters; replace spaces with `-`
- Max 50 characters total (including prefix and `/`)
- Truncate at word boundary if needed

## Worktree.cjs Commands

### Get repo info
```bash
node .claude/skills/worktree/scripts/worktree.cjs info --json
```

Parses: `repoType`, `baseBranch`, `projects`, `worktreeRoot`, `worktreeRootSource`, `dirtyState`, `dirtyDetails`.

### Create — standalone
```bash
node .claude/skills/worktree/scripts/worktree.cjs create "<SLUG>" --prefix <TYPE>
```

### Create — monorepo
```bash
node .claude/skills/worktree/scripts/worktree.cjs create "<PROJECT>" "<SLUG>" --prefix <TYPE>
```

### All create options

| Option | Description |
|--------|-------------|
| `--prefix` | Branch type: `feat\|fix\|refactor\|docs\|test\|chore\|perf` |
| `--base <branch>` | Override auto-detected base branch |
| `--checkout-submodules` | Run `git submodule update --init --checkout --recursive` after create |
| `--no-prefix` | Skip prefix, preserve original case and slashes |
| `--worktree-root <path>` | Override default location |
| `--json` | Machine-readable JSON output |
| `--dry-run` | Preview without executing |

## Dependency Install — Lockfile Map

Run in background after worktree creation:

| Lockfile | Command |
|----------|---------|
| `bun.lock` | `bun install` |
| `pnpm-lock.yaml` | `pnpm install` |
| `yarn.lock` | `yarn install` |
| `package-lock.json` | `npm install` |
| `poetry.lock` | `poetry install` |
| `requirements.txt` | `pip install -r requirements.txt` |
| `Cargo.toml` | `cargo build` |
| `go.mod` | `go mod download` |

## JSON Output Fields

| Field | Description |
|-------|-------------|
| `baseBranch` | Branch the worktree is based on |
| `baseBranchSource` | `"explicit"` or `"auto-detected"` |
| `checkoutSubmodules` | Whether create will initialize submodules after checkout |
| `currentWorktree` | Current worktree health record from `status --json` |
| `worktrees` | Normalized worktree records from `list --json` or `status --json` |
| `entries` | Prune output lines from `prune --json` |
| `worktreePath` | Absolute path to the created worktree |
| `worktreeRootSource` | How location was determined |
