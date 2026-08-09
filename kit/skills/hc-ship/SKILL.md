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

# hc-ship — Release Pipeline

Ships a branch through test, review, changelog, commit, push, PR, CI, and merge. Versioning, tags, and GitHub releases run only with `--release`.

## Usage

```text
{skill:hc-ship} [--release] [--quick|--full|--dry-run] [--no-ci-wait] [--skip-docs]
{skill:hc-ship} rollout [flag-name]
{skill:hc-ship} changelog --reformat
```

| Input | Behavior |
|---|---|
| default | Infer target/mode from branch; write changes under `[Unreleased]` |
| `--release` | Promote `[Unreleased]`, bump version, tag explicit SHA, publish release |
| `--quick` | Skip review, build, changelog, and release |
| `--full` | Enforce all applicable checks |
| `--dry-run` | Print resolved actions after Pre-flight; make no changes |
| `--no-ci-wait` | Create PR and return its URL without merge |
| `--skip-docs` | Skip docs update |

## Constraints

> **Required — verified branch:** Never create a PR over failing tests. `--skip-tests` is valid only when the same final code passed earlier in this session.

> **Required — protected Git:** Never force push, bypass hooks/signing/protection (`--no-verify`), self-merge around required reviews, or tag implicit `HEAD`. Rebase once after a rejected push; unresolved rejection stops.

> **Required — automation ownership:** Detect the release regime before changing versions, changelogs, tags, or releases. Cooperate with semantic-release, release-please, changesets, GoReleaser, merge queues, and tag-triggered workflows; never duplicate their output.

> **Required — explicit release:** Without `--release`, do not bump versions, create tags, or publish GitHub releases.

## Scope Contract

- **Deliverables:** commit, pushed branch, PR, CI/merge status; version/tag/release URL only with `--release`.
- **Boundaries:** resolved target branch, release automation owner, test/build commands, changelog/version files, skipped flags.
- **Blast Radius:** Git refs, release metadata, CI, changelog, docs, and package artifacts.

## Process

1. **Pre-flight** — reject the target branch; inspect status/diff/commits, infer target and mode, detect automation via `references/git-automation-compat.md`; `--dry-run` stops here.
2. **Link issues** — search by branch/commit terms; link matches, never create issues automatically.
3. **Merge target** — fetch and merge `origin/<target>`; auto-resolve lockfiles only; stop on other conflicts.
4. **Test** — delegate detected suite to `haily-tester`; stop on failure.
5. **Build** — run detected compile/bundle command; stop non-zero. Skip with `--quick`.
6. **Review** — delegate to `haily-reviewer` for `--full` or diff ≥50 lines; critical findings require resolution. Skip with `--quick`.
7. **Version** — with `--release`, detect version owner/file; default patch, confirm minor/major, preserve beta sequencing. Delegate when automation owns it.
8. **Changelog** — default appends under `[Unreleased]`; release promotes it to `[X.Y.Z] (YYYY-MM-DD)` and creates a fresh `[Unreleased]`. Use `- <component>: <verb phrase>`, one concept, ≤8 words after colon. Skip with `--quick`.
9. **Bookkeeping** — invoke `{skill:hl-log}`; delegate docs to `haily-docs-writer` unless skipped/beta; create an incident report for notable failure; suggest `{skill:hc-adr}` only on structural changes.
10. **Commit** — scan staged diff for secrets; follow repository message style; keep version and changelog together.
11. **Push** — `git push -u origin <branch>`; never force.
12. **PR + CI** — create structured PR, link issues, wait ≤10 minutes for required checks, then use an allowed merge method/queue. `--no-ci-wait` returns the URL without merge.
13. **Release** — after merge, verify remote target SHA, tag that explicit SHA, verify, then push tag. Let tag-triggered CI publish; enrich with `gh release edit`. Otherwise build artifacts and create the release. A `422 already exists` response falls back to edit/upload.

Stop on failed tests/build, unresolved conflicts, protected-branch requirements, existing version tag, or tag SHA differing from remote target. Missing optional version/artifact tooling is reported and skipped only when the release contract remains truthful.

## --release Mode

Requires a verified merged release commit. Automation ownership wins; manual mode promotes changelog, bumps version, tags the remote target SHA, publishes once, and returns the release URL.

## rollout Mode

Design the flag, deploy disabled, enable in measured stages `1% → 10% → 50% → 100%`, define rollback at every stage, then remove the flag after stable completion. Full workflow: `references/workflow-feature-rollout.md`.

## changelog --reformat Mode

Rewrite existing bullets to the changelog format above without committing or shipping. Preserve headers, dates, meaning, and footer links; split dense bullets, and ask before any lossy cut. Report changed bullet/version counts.

## Output

Report resolved mode/target, tests, build, review, changelog/version action, commit, push, PR, CI/merge, and release URL when applicable.

## Workflow Position

**Follows:** `{skill:hc-review}`, `{skill:hc-test}`
**Related:** `{skill:hc-cook}`

## References

| File | Content |
|---|---|
| `references/git-automation-compat.md` | Release ownership, hooks, signing, protection, reviews, merge methods/queues |
| `references/tech-auto-detect.md` | Test runner, version file, changelog, release automation detection |
| `references/tech-pr-template.md` | PR title/body and `gh pr create` contract |
| `references/process-ship-steps.md` | Detailed 13-stage commands and release sequence |
| `references/workflow-feature-rollout.md` | Staged rollout and rollback workflow |
