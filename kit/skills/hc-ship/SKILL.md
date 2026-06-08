---
name: hc-ship
description: "Ship a branch: pre-flight, tests, code review, changelog, commit, push, PR, CI wait, and merge. By default accumulates changes in [Unreleased]. Add --release to bump version, promote changelog, and publish a GitHub release."
when_to_use: "Invoke to ship a branch — runs pre-flight, tests, review, changelog, and creates a PR. Use --release when you're ready to cut an official versioned release."
user-invocable: true
argument-hint: "[--release] [--quick|--full|--dry-run] | rollout [flag-name]"
metadata:
  attribution: "Inspired by gstack/ship by Garry Tan (MIT)"
  category: workflow
  keywords: [release, deploy, PR, ship, publish, version]
---

# hc:ship — Release Pipeline

Runs the full path from a working branch to a merged PR: pre-flight, tests, review, changelog, commit, push, PR, and CI. By default, changes accumulate under `[Unreleased]` in the changelog — no version bump, no tag. Add `--release` to promote `[Unreleased]` → `[X.Y.Z]`, bump the version, and publish a GitHub release. Auto-detects branch mode; stops only when the pipeline cannot safely continue.

## Usage

```
{skill:hc-ship}                              # accumulate changes into [Unreleased]
{skill:hc-ship} --release                    # promote [Unreleased] → version, tag, GitHub release
{skill:hc-ship} --quick                      # skip review and changelog
{skill:hc-ship} --full --release             # enforce all steps + publish release
{skill:hc-ship} --dry-run                    # print planned actions without executing
{skill:hc-ship} rollout [flag-name]          # feature flag gradual rollout (see below)
```

| Flag / Subcommand | Behavior |
|---|---|
| *(none)* | Infer from branch: `feature/*` `hotfix/*` `bugfix/*` → standard (→ main); `dev/*` `beta/*` `experiment/*` → fast (→ dev/beta); unclear → ask once |
| `--release` | Promote `[Unreleased]` → `[X.Y.Z]`, bump version, create tag and GitHub release |
| `--quick` | Skip review (step 6) and changelog (step 8) |
| `--full` | Enforce all steps regardless of branch pattern (combine with `--release` to publish) |
| `--dry-run` | Print what would happen at each step; stop after pre-flight |
| `--no-ci-wait` | Push + create PR; skip CI wait and auto-merge — user monitors CI manually |
| `rollout [flag]` | Feature flag gradual rollout: design → deploy with flag off → staged enable (1% → 10% → 50% → 100%) → cleanup. See `references/workflow-feature-rollout.md`. |

```
{skill:hc-ship} rollout feature.checkout.new-payment-flow
{skill:hc-ship} rollout feature.auth.oauth-v2 --stage 10pct
```

## Constraints

> **Required — tests must pass:** Never create a PR over a failing test suite. `--skip-tests` is only valid when tests demonstrably passed earlier in the same session.

> **Required — no force push:** Always use `git push`, never `git push --force`. If rejected, suggest `git pull --rebase` and retry once.

> **Required — auto-detect everything:** Test runner, version file, changelog format, and target branch are inferred from the repo — never hardcoded.

## Process

1. **Pre-flight** — verify current branch is not the target; collect diff stats; if `--dry-run`, print plan and stop. Log `✓ Pre-flight: branch <name>, <N> commits, +X/-Y lines (mode: <standard|fast|full> → <target>)`.
2. **Link issues** — search open GitHub issues by branch name and commit keywords (`gh issue list --search`). Link if found; skip silently if none — do not auto-create issues. Store numbers for PR linking.
3. **Merge target** — `git fetch` + `git merge origin/<target> --no-edit`; auto-resolve lockfile conflicts; stop on unresolvable conflicts.
4. **Run tests** — auto-detect runner (npm/pytest/cargo/go test/…); delegate to `haily-tester` subagent. Stop on any failure. Log `✓ Tests: <N> passed, 0 failed`.
5. **Build** — compile or bundle; stop if exit code is non-zero. Log `✓ Build: exit 0`. *[skipped: `--quick`]*
6. **Code review** — delegate to `haily-reviewer` subagent when diff ≥ 50 lines changed or `--full`; skip silently for smaller diffs in standard mode. When run: two passes (critical then informational); pause on each critical finding: fix / acknowledge / mark false positive. *[skipped: `--quick`; skipped: diff < 50 lines in standard mode]*
7. **Version bump** — auto-detect version file (package.json, pyproject.toml, Cargo.toml, VERSION); bump patch by default; ask user for minor/major on breaking changes. Beta mode appends `-beta.N`. *[skipped: no `--release` flag; no version file found]*
8. **Changelog** — create CHANGELOG.md if absent. **Default mode (no `--release`):** append new bullets under `[Unreleased]` section (create section if absent). **`--release` mode:** promote `[Unreleased]` → `[X.Y.Z] (YYYY-MM-DD)` and insert a fresh `## [Unreleased]` header above it; if no `[Unreleased]` section exists, generate a versioned entry from commits. *[skipped: `--quick`]*
9. **Journal + docs** — invoke `{skill:hl-log}` (session log → `.agents/logs/`) as a background task; run `{skill:hc-docs} update` only when `--full` or diff touches `docs/` files. If the pipeline hit a notable failure, also spawn `haily-reporter` subagent (incident report → `.agents/incidents/`). Do not wait for completion.
10. **Commit** — scan staged diff for secrets; compose `type(scope): description`; include version + changelog in same commit.
11. **Push** — `git push -u origin <branch>`. Log `✓ Pushed: origin/<branch>`.
12. **PR + CI** — `gh pr create --base <target>` with structured body; link issues with `Closes #N`. Unless `--no-ci-wait`: wait up to 10 min for required checks; merge when green. With `--no-ci-wait`: output PR URL and exit — user monitors CI manually.
13. **GitHub release** — after merge: pull target branch, create and push tag `vX.Y.Z`, run release build if detected (e.g. `npm run release:pack`), then `gh release create vX.Y.Z` with promoted changelog section as notes and any build artifacts attached. Output release URL. *[skipped: no `--release` flag; no version bump; no `gh` CLI; `--quick`]*

Checkpoint behavior:

| Condition | Response |
|-----------|----------|
| Tests failing | Stop — fix before continuing |
| Unresolvable merge conflict | Stop — surface to user |
| Critical review finding | Pause — ask per finding (fix / acknowledge / false positive) |
| Minor/major version bump needed | Pause — confirm with user |
| On target branch at start | Stop — wrong branch, clarify intent |
| Linting warnings / minor type issues | Continue |
| Version file missing | Continue — skip version bump and release silently |
| `--release` not passed | Skip Steps 7 (version bump) and 13 (GitHub release); changelog writes to `[Unreleased]` |
| No `[Unreleased]` section when `--release` | Generate versioned entry from commits directly |
| Release build command not found | Create GitHub release without artifact attachments |
| Tag already exists for version | Stop — warn user; suggest bumping version again |

## Output

Default (no `--release`):
```
✓ Pre-flight:  branch feature/foo, 5 commits, +200/-50 lines (mode: standard → main)
✓ Issues:      linked #42
✓ Merged:      origin/main (up to date)
✓ Tests:       42 passed, 0 failed
✓ Build:       exit 0
✓ Review:      0 critical, 2 informational
✓ Changelog:   [Unreleased] updated
✓ Committed:   feat(auth): add OAuth2 login flow
✓ Pushed:      origin/feature/foo
✓ PR:          https://github.com/org/repo/pull/123 (linked: #42)
✓ CI:          all checks passed — merged
```

With `--release`:
```
✓ ...
✓ Version:     1.2.4 → 1.2.5
✓ Changelog:   [Unreleased] → [1.2.5] (2026-06-08)
✓ Committed:   chore(release): v1.2.5
✓ ...
✓ Release:     https://github.com/org/repo/releases/tag/v1.2.5
```

## Workflow Position

**Follows:** `{skill:hc-review}`, `{skill:hc-test}`
**Related:** `{skill:hc-cook}`

## References

| File | Content |
|------|---------|
| `references/tech-auto-detect.md` | Test runner, version file, and changelog format detection logic |
| `references/tech-pr-template.md` | PR body template, title format, and `gh pr create` invocation |
| `references/process-ship-steps.md` | Detailed implementation for each of the 13 pipeline stages |
