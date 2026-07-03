---
name: hc-ship
description: "Ship a branch: pre-flight, tests, code review, changelog, commit, push, PR, CI wait, and merge. By default accumulates changes in [Unreleased]. Add --release to bump version, promote changelog, and publish a GitHub release."
when_to_use: "Invoke to ship a branch — runs pre-flight, tests, review, changelog, and creates a PR. Use --release when you're ready to cut an official versioned release."
user-invocable: true
argument-hint: "[--release] [--quick|--full|--dry-run] | rollout [flag-name] | changelog --reformat"
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
{skill:hc-ship} changelog --reformat         # reformat an existing CHANGELOG to match bullet rules
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
| `changelog --reformat` | Reformat all existing entries in CHANGELOG.md to the canonical bullet style (see below). Does not ship — standalone operation. |

```
{skill:hc-ship} rollout feature.checkout.new-payment-flow
{skill:hc-ship} rollout feature.auth.oauth-v2 --stage 10pct
```

## Constraints

> **Required — tests must pass:** Never create a PR over a failing test suite. `--skip-tests` is only valid when tests demonstrably passed earlier in the same session.

> **Required — no force push:** Always use `git push`, never `git push --force`. If rejected, suggest `git pull --rebase` and retry once.

> **Required — auto-detect everything:** Test runner, version file, changelog format, and target branch are inferred from the repo — never hardcoded.

> **Required — respect, never fight, automation:** Detect the release regime first (`references/git-automation-compat.md`). If a tool owns versioning/changelog/tagging/release (semantic-release, release-please, changesets, standard-version, GoReleaser, tag-triggered workflow), hc-ship contributes its input and delegates — it does not duplicate. Never bypass hooks, signing, branch protection, or required reviews (`--no-verify`, `--force`, self-merge are forbidden).

## Process

1. **Pre-flight** — verify current branch is not the target; collect diff stats; **detect the release regime** (`references/git-automation-compat.md` § 1 — gates Steps 7/8/13); if `--dry-run`, print plan and stop. Log `✓ Pre-flight: branch <name>, <N> commits, +X/-Y lines (mode: <standard|fast|full> → <target>)` and `✓ Release regime: <regime>`.
2. **Link issues** — search open GitHub issues by branch name and commit keywords (`gh issue list --search`). Link if found; skip silently if none — do not auto-create issues. Store numbers for PR linking.
3. **Merge target** — `git fetch` + `git merge origin/<target> --no-edit`; auto-resolve lockfile conflicts; stop on unresolvable conflicts.
4. **Run tests** — auto-detect runner (npm/pytest/cargo/go test/…); delegate to `haily-tester` subagent. Stop on any failure. Log `✓ Tests: <N> passed, 0 failed`.
5. **Build** — compile or bundle; stop if exit code is non-zero. Log `✓ Build: exit 0`. *[skipped: `--quick`]*
6. **Code review** — delegate to `haily-reviewer` subagent when diff ≥ 50 lines changed or `--full`; skip silently for smaller diffs in standard mode. When run: two passes (critical then informational); pause on each critical finding: fix / acknowledge / mark false positive. *[skipped: `--quick`; skipped: diff < 50 lines in standard mode]*
7. **Version bump** — auto-detect version file (package.json, pyproject.toml, Cargo.toml, VERSION); bump patch by default; ask user for minor/major on breaking changes. Beta mode appends `-beta.N`. *[skipped: no `--release` flag; no version file found]*
8. **Changelog** — create CHANGELOG.md if absent. **Default mode (no `--release`):** append new bullets under `[Unreleased]` section (create section if absent). **`--release` mode:** promote `[Unreleased]` → `[X.Y.Z] (YYYY-MM-DD)` and insert a fresh `## [Unreleased]` header above it; if no `[Unreleased]` section exists, generate a versioned entry from commits. Bullet format — write `- <component>: <verb phrase>`, **hard cap 8 words after the colon**, no bold/backticks/em-dashes/parentheticals in bullet text; one concept per bullet. Full rules: `references/process-ship-steps.md` § Step 7. *[skipped: `--quick`]*
9. **Journal + docs** — invoke `{skill:hl-log}` (session log → `.agents/logs/`) as a background task; run `{skill:hc-docs} update` only when `--full` or diff touches `docs/` files. If the pipeline hit a notable failure, also spawn `haily-reporter` subagent (incident report → `.agents/incidents/`). Do not wait for completion. After journaling, scan the commit diff for structural-change signals (new abstraction directories, changed exported interfaces, new external dependencies in the manifest). If any signal is present, print a passive suggestion: `Structural changes detected — consider documenting the decision with {skill:hc-adr}.` Never block on this.
10. **Commit** — scan staged diff for secrets; compose `type(scope): description`; include version + changelog in same commit.
11. **Push** — `git push -u origin <branch>`. Log `✓ Pushed: origin/<branch>`.
12. **PR + CI** — `gh pr create --base <target>` with structured body; link issues with `Closes #N`. Unless `--no-ci-wait`: wait up to 10 min for required checks; merge when green. With `--no-ci-wait`: output PR URL and exit — user monitors CI manually.
13. **GitHub release** — after merge: pull target branch, verify the release commit is the remote target head, tag it **by explicit SHA**, verify the tag points at it, then push the tag (full sequence: `references/process-ship-steps.md` § Step 13 — never tag implicit HEAD or batch tag with commit/push). Then detect release automation (see `tech-auto-detect.md` § Release Automation Detection): if a tag-triggered workflow already publishes the release, let CI build + publish and only enrich notes via `gh release edit` — never `gh release create` (it collides with `422 already exists`). Otherwise build artifacts and `gh release create` with the changelog as notes. Output release URL. *[skipped: no `--release` flag; no version bump; no `gh` CLI; `--quick`]*

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
| Automated release regime detected (semantic-release / release-please / changesets / GoReleaser) | Delegate version + changelog + release; hc-ship only ensures conventional commits / writes a changeset, then merges |
| Tag-triggered release workflow detected | Skip manual `gh release create`; push tag, let CI publish, enrich notes via `gh release edit` |
| `gh release create` returns 422 (already exists) | An undetected workflow published it — fall back to `gh release edit` + `upload --clobber` |
| Pre-commit/pre-push hook reformats or rejects | Never `--no-verify`; re-stage reformatted files (`commit --amend`) or fix the rejected cause |
| Target branch protected / requires reviews | Never push direct or self-merge; open PR and hand off for required review |
| Merge method restricted / merge queue | Use the allowed `gh pr merge --squash\|--merge\|--rebase`; enqueue with `--auto` |
| Tag already exists for version | Stop — warn user; suggest bumping version again |
| Tag target SHA ≠ remote branch head | Stop — push the release commit and re-verify; never tag ahead of the remote |

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

## changelog --reformat

Standalone operation — no commit, no push, no pipeline. Rewrites every bullet in CHANGELOG.md in place to match the canonical format used by Step 8.

**When to use:** existing project with a CHANGELOG written in inconsistent styles (long lines, bold, em-dashes, multiple concepts per bullet). Run once to normalize; future `/hc-ship` runs stay consistent.

**Process:**
1. Read CHANGELOG.md (or CHANGES.md). If absent, print "No changelog found." and stop.
2. For every version section, rewrite each bullet to match the Step 7 bullet rules:
   - Pattern: `- <component>: <verb phrase>`
   - Hard cap: 8 words after the colon — cut excess; never truncate meaning silently (split into two bullets instead)
   - One concept per bullet: if a bullet contains multiple changes joined by `;` or `,`, split them
   - Strip: `**bold**`, backtick wrapping, em-dash qualifiers, parenthetical asides, words like "now", "also", "additionally"
   - Subject: component or skill name, plain text, no formatting
3. Preserve all version headers, dates, section headers (`### 🚀 Improvements`, `### 🐛 Fixes`), and the footer link block exactly.
4. Print a diff summary: `Reformatted N bullets across M version sections.`
5. Do not commit — let the developer review and commit with their own message.

> **Required — preserve meaning:** never delete a bullet or drop information. If a bullet is too dense to split cleanly, ask the user before cutting.

## Workflow Position

**Follows:** `{skill:hc-review}`, `{skill:hc-test}`
**Related:** `{skill:hc-cook}`

## References

| File | Content |
|------|---------|
| `references/git-automation-compat.md` | Release-regime detection + cooperating with hooks, signing, branch protection, required reviews, merge methods, and merge queues |
| `references/tech-auto-detect.md` | Test runner, version file, and changelog format detection logic |
| `references/tech-pr-template.md` | PR body template, title format, and `gh pr create` invocation |
| `references/process-ship-steps.md` | Detailed implementation for each of the 13 pipeline stages |
