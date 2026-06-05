---
name: hc-ship
description: "Full release pipeline: pre-flight, tests, code review, version bump, changelog, commit, push, PR creation, CI wait, and merge. Auto-detects mode from branch name. Stops only on test failures, merge conflicts, or rejected reviews."
when_to_use: "Invoke when releasing a feature — runs pre-flight, tests, review, version bump, and creates a PR."
user-invocable: true
argument-hint: "[--quick|--full|--dry-run] | rollout [flag-name]"
metadata:
  attribution: "Inspired by gstack/ship by Garry Tan (MIT)"
  category: workflow
  keywords: [release, deploy, PR, ship, publish, version]
---

# hc:ship — Release Pipeline

Runs the full path from a working branch to a merged PR: pre-flight, tests, review, version bump, changelog, commit, push, PR, CI, and merge. Auto-detects branch mode; stops only when the pipeline cannot safely continue.

## Usage

```
{skill:hc-ship}                              # auto-detect mode from branch name
{skill:hc-ship} --quick                      # skip review and changelog
{skill:hc-ship} --full                       # enforce all steps, no skips
{skill:hc-ship} --dry-run                    # print planned actions without executing
{skill:hc-ship} rollout [flag-name]          # feature flag gradual rollout (see below)
```

| Flag / Subcommand | Behavior |
|---|---|
| *(none)* | Infer from branch: `feature/*` `hotfix/*` `bugfix/*` → standard (→ main); `dev/*` `beta/*` `experiment/*` → fast (→ dev/beta); unclear → ask once |
| `--quick` | Skip review (step 5) and changelog (step 7) |
| `--full` | Enforce all 12 steps regardless of branch pattern |
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
7. **Version bump** — auto-detect version file (package.json, pyproject.toml, Cargo.toml, VERSION); bump patch by default; ask user for minor/major on breaking changes. Beta mode appends `-beta.N`. *[skipped: no version file found]*
8. **Changelog** — generate entry from `git log <target>..HEAD` and diff; prepend to CHANGELOG.md if present. *[skipped: `--quick`, no changelog file]*
9. **Journal + docs** — invoke `{skill:hl-log}` (session log → `.agents/logs/`) as a background task; run `{skill:hc-docs} update` only when `--full` or diff touches `docs/` files. If the pipeline hit a notable failure, also spawn `haily-reporter` subagent (incident report → `.agents/incidents/`). Do not wait for completion.
10. **Commit** — scan staged diff for secrets; compose `type(scope): description`; include version + changelog in same commit.
11. **Push** — `git push -u origin <branch>`. Log `✓ Pushed: origin/<branch>`.
12. **PR + CI** — `gh pr create --base <target>` with structured body; link issues with `Closes #N`. Unless `--no-ci-wait`: wait up to 10 min for required checks; merge when green. With `--no-ci-wait`: output PR URL and exit — user monitors CI manually.

Checkpoint behavior:

| Condition | Response |
|-----------|----------|
| Tests failing | Stop — fix before continuing |
| Unresolvable merge conflict | Stop — surface to user |
| Critical review finding | Pause — ask per finding (fix / acknowledge / false positive) |
| Minor/major version bump needed | Pause — confirm with user |
| On target branch at start | Stop — wrong branch, clarify intent |
| Linting warnings / minor type issues | Continue |
| Changelog or version file missing | Continue — skip step silently |

## Output

```
✓ Pre-flight:  branch feature/foo, 5 commits, +200/-50 lines (mode: standard → main)
✓ Issues:      linked #42, created #43
✓ Merged:      origin/main (up to date)
✓ Tests:       42 passed, 0 failed
✓ Build:       exit 0
✓ Review:      0 critical, 2 informational
✓ Version:     1.2.4 → 1.2.5
✓ Changelog:   updated
✓ Committed:   feat(auth): add OAuth2 login flow
✓ Pushed:      origin/feature/foo
✓ PR:          https://github.com/org/repo/pull/123 (linked: #42, #43)
✓ CI:          all checks passed — merged
```

## Workflow Position

**Follows:** `{skill:hc-review}`, `{skill:hc-test}`
**Related:** `{skill:hc-cook}`

## References

| File | Content |
|------|---------|
| `references/tech-auto-detect.md` | Test runner, version file, and changelog format detection logic |
| `references/tech-pr-template.md` | PR body template, title format, and `gh pr create` invocation |
| `references/process-ship-steps.md` | Detailed implementation for each of the 12 pipeline stages |
