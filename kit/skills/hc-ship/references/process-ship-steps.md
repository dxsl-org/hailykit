# Ship Workflow — Detailed Steps

## Step 1: Pre-flight

1. Check current branch: `git branch --show-current`
   - If on target branch (main/master/dev): **ABORT** — "Ship from a feature branch, not the target branch."
2. Determine ship mode from arguments:
   - `official` → target = auto-detect default branch (main/master)
   - `beta` → target = auto-detect dev branch (dev/beta/develop)
   - No argument → infer from branch name:
     - `feature/* hotfix/* bugfix/*` → official
     - `dev/* beta/* experiment/*` → beta
     - Unclear → `AskUserQuestion` with options: "Official (main)", "Beta (dev)"
3. Auto-detect target branch:
   ```bash
   # For official: detect default branch
   git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@'
   # Fallback
   git rev-parse --verify origin/main 2>/dev/null && echo "main" || echo "master"

   # For beta: detect dev branch
   for b in dev beta develop; do
     git rev-parse --verify origin/$b 2>/dev/null && echo "$b" && break
   done
   ```
4. Run `git status` (never use `-uall`). Uncommitted changes are always included.
5. Run `git diff <target>...HEAD --stat` and `git log <target>..HEAD --oneline` to understand what's being shipped.
6. **Detect the release regime** (see `git-automation-compat.md` § 1) — semantic-release / release-please / changesets / standard-version / GoReleaser / tag-workflow / manual. This gates who owns version + changelog + tag + release (Steps 6, 7, 13). Log e.g. `✓ Release regime: changesets (version/changelog delegated)`.
7. If `--dry-run`: output what would happen at each step and stop here.

## Step 2: Link Issues

Find or create related GitHub issues for traceability.

1. Search for related open issues by keywords from branch name and commit messages:
   ```bash
   # Extract keywords from branch name
   BRANCH=$(git branch --show-current)
   KEYWORDS=$(echo "$BRANCH" | sed 's/[^a-zA-Z0-9]/ /g' | tr '[:upper:]' '[:lower:]')

   # Search existing issues
   gh issue list --state open --limit 10 --search "$KEYWORDS"
   ```

2. Also check if any issues are referenced in commit messages:
   ```bash
   git log <target>..HEAD --oneline | grep -oE '#[0-9]+' | sort -u
   ```

3. **If related issues found:** Note issue numbers for PR linking.

4. **If NO related issues found:** Create a new issue with structured format:
   ```bash
   gh issue create --title "<type>: <summary from commits>" --body "$(cat <<'EOF'
   ## Problem Statement
   <infer from diff and commit messages>

   ## Proposal
   <summarize the implementation approach>

   ## How It Works
   <describe key changes with bullet points>

   ### Architecture
   ```
   <ASCII diagram of component interactions>
   ```

   ## Challenges
   - <potential edge cases or risks>

   ## Plan & Phases
   - [x] Implementation complete
   - [x] Tests passing
   - [ ] Code review approved
   - [ ] Merged to <target>

   ## Human Review Tasks
   - [ ] Verify business logic correctness
   - [ ] Check for edge cases not covered by tests
   - [ ] Validate UX/API contract changes (if any)
   EOF
   )"
   ```

5. Store issue numbers for Step 12 (PR creation).

## Step 3: Merge target branch

Fetch and merge so tests run against the merged state:

```bash
git fetch origin <target> && git merge origin/<target> --no-edit
```

- **If merge conflicts:** Try auto-resolve simple ones (lockfiles, version files). For complex conflicts, **STOP** and show them.
- **If already up to date:** Continue silently.

## Step 4: Run Tests

**Skip if:** `--skip-tests` flag.

1. Auto-detect test command (see `tech-auto-detect.md`)
2. Delegate to `haily-tester` subagent — don't inline test execution
3. Check pass/fail from agent result

- **If any test fails:** Show failures and **STOP**. Do not proceed.
- **If all pass:** Note counts briefly and continue.
- **If no test runner detected:** Use `AskUserQuestion` — "No test runner detected. Skip tests or provide command?"

## Step 5: Pre-Landing Review

**Skip if:** `--skip-review` flag.

1. Run `git diff origin/<target>` to get the full diff
2. Delegate to `haily-reviewer` subagent with the diff
3. Two-pass model:
   - **Pass 1 (CRITICAL):** Security, injection, race conditions, auth bypass
   - **Pass 2 (INFORMATIONAL):** Dead code, magic numbers, test gaps, style

4. **Output findings:**
   ```
   Pre-Landing Review: N issues (X critical, Y informational)
   ```

5. **If critical issues found:** For EACH critical issue, use `AskUserQuestion`:
   - Problem description with `file:line`
   - Recommended fix
   - Options: A) Fix now (recommended), B) Acknowledge and ship, C) False positive — skip

6. **If user chose Fix (A):** Apply fixes, commit fixed files, then **re-run tests** (Step 4) before continuing.
7. **If only informational:** Include in PR body, continue.
8. **If no issues:** Output "No issues found." and continue.

## Step 6: Version Bump (conditional)

**Skip if:** no `--release` flag OR no version file found OR the release regime owns versioning (semantic-release, release-please, GoReleaser, tag-workflow — see `git-automation-compat.md` § 1). Without `--release`, the version stays unchanged — changelog accumulates in `[Unreleased]` instead.

**Regime delegation:** if regime is **changesets**, do NOT bump — instead write `.changeset/<slug>.md` with the bump level + summary. If **standard-version**, run `npm run release` (it bumps + changelogs + tags) and skip Steps 7/13's manual edits.

1. Auto-detect version source (see `tech-auto-detect.md`)
2. If no version file found: **skip silently**
3. Auto-decide bump level from diff size:
   - **< 50 lines:** patch bump
   - **50+ lines:** patch bump (default safe choice)
   - **Major feature or breaking change:** Use `AskUserQuestion` — "This looks like a significant change. Bump minor or patch?"
4. For beta mode: use prerelease suffix (e.g., `1.2.4-beta.1`)
5. Write new version to detected file

## Step 7: Changelog

**Skip if:** `--quick` flag OR the release regime owns the changelog (semantic-release, release-please, changesets, standard-version — see `git-automation-compat.md` § 1). Those tools generate CHANGELOG from commits / changeset files; a manual edit here collides with the bot's release PR or the generated output.

1. Check for CHANGELOG.md or CHANGES.md. If not found, create CHANGELOG.md:
   ```markdown
   # Changelog

   All notable changes to this project will be documented in this file.
   Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
   ```

2. Auto-generate bullet list from ALL commits on branch:
   - `git log <target>..HEAD --oneline` for commit list
   - `git diff <target>...HEAD` for full diff context
   - Categorize into 2 sections only:
     - `### 🚀 Improvements` — new features, enhancements, performance, refactors
     - `### 🐛 Fixes` — bug fixes, security patches, regressions
     - Omit a section entirely if empty

**Bullet format — strict:**
- Pattern: `- <subject>: <short verb phrase>` — e.g. `- hc-plan: memory-augmented planning via --resume`
- **Hard cap: 8 words after the colon.** Count the words; cut if over.
- One concept per bullet. If a commit touches 3 things, write 3 bullets.
- **Forbidden:** bold/inline-code in bullet text · colon-separated sub-lists (`x: a, b, c`) · `—` em-dash qualifiers · parenthetical asides · words like "now", "also", "additionally"
- Subject is the component/skill name, plain text, no backticks

| ❌ Too long | ✅ Correct |
|---|---|
| `**hc-goal** — redesigned autonomous loop: clarify-or-assume, no-new-failures gate, run-ledger compaction` | `- hc-goal: clarify-or-assume loop replaces halt-on-ambiguity` |
| `**hc-debug** — Oracle escalation on 3+ failed fix attempts` | `- hc-debug: oracle escalation after 3 failed fixes` |
| `**hc-review** — Checks system: user-defined per-repo criteria auto-discovered` | `- hc-review: user-defined per-repo check criteria` |

**Do NOT ask user to describe changes.** Infer from diff and commits.

---

### Default mode (no `--release`): append to [Unreleased]

3. Look for an existing `## [Unreleased]` section in the file.
   - If found: append new bullets under the existing `[Unreleased]` block (de-duplicate with already present items).
   - If NOT found: insert a new block immediately after the file header:
     ```markdown
     ## [Unreleased]

     ### 🚀 Improvements
     - <new bullet>
     ```

Output line: `✓ Changelog:   [Unreleased] updated`

---

### `--release` mode: promote [Unreleased] → versioned entry

3. Look for an existing `## [Unreleased]` section:
   - **Found:** replace `## [Unreleased]` with `## [X.Y.Z] (YYYY-MM-DD)`. Insert a fresh, empty `## [Unreleased]` block above it:
     ```markdown
     ## [Unreleased]

     ## [X.Y.Z] (YYYY-MM-DD)

     ### 🚀 Improvements
     - <promoted bullets>
     ```
   - **Not found:** generate a versioned entry directly from commits and prepend after the file header:
     ```markdown
     ## [X.Y.Z] (YYYY-MM-DD)

     ### 🚀 Improvements
     - <generated bullets>
     ```

Output line: `✓ Changelog:   [Unreleased] → [X.Y.Z] (YYYY-MM-DD)`

## Step 8: Journal (background)

**Skip if:** `--skip-journal` flag.

Run as **background task** to not block pipeline. Two independent concerns — always do (a), conditionally do (b):

a. **Session log** — invoke `{skill:hl-log}` directly:
   - Topic: summary of shipped changes (from commit messages + diff stats)
   - Include: what was shipped, key decisions made
   - Output: `.agents/logs/` (routine session record)

b. **Incident diary** — spawn `haily-reporter` subagent ONLY IF the pipeline encountered a notable failure (test regression rolled back, merge conflict required manual resolution, critical review finding triggered a fix, CI required multiple retries):
   - Include: what went wrong, root cause, resolution taken
   - Output: `.agents/incidents/` (exceptional events only)

Don't wait for completion — continue to next step immediately.

## Step 9: Docs Update (conditional, background)

**Skip if:** `--skip-docs` flag OR ship mode is `beta`.

Update project documentation for official releases. Run as **background task**.

1. Invoke `{skill:hc-docs} update` skill via `haily-docs-writer` subagent in background:
   - Analyzes code changes since last release
   - Updates relevant docs in `./docs/` directory
2. Don't wait for completion — continue to next step immediately.

## Step 10: Commit

1. Stage all changes: `git add -A`
2. Security check: scan staged diff for secrets (API keys, tokens, passwords)
   - If secrets found: **STOP**, warn user, suggest `.gitignore`
3. Compose commit message:
   - Format: `type(scope): description`
   - Infer type from changes (feat/fix/refactor/chore)
   - If version + changelog present, include in same commit
4. Commit:

```bash
git commit -m "$(cat <<'EOF'
type(scope): description

Brief body describing the changes.
EOF
)"
```

**Commit-hook compatibility** (see `git-automation-compat.md` § 2): never `--no-verify`.
- If a pre-commit hook (husky/lefthook/pre-commit/lint-staged) **reformats** files and leaves the tree dirty, re-stage and `git commit --amend --no-edit`.
- If a hook **rejects** (lint/type/secret), fix the real cause and retry — don't bypass.
- If `commitlint` is configured, conform `type`/`scope` to its enums (read `commitlint.config.*`).
- If `commit.gpgsign=true`, let it sign — never `-c commit.gpgsign=false`. If DCO is required, add `-s`.

## Step 11: Push

```bash
git push -u origin $(git branch --show-current)
```

- **Never force push. Never `--no-verify`** — let any pre-push hook run; if it fails, fix the cause.
- If push rejected (non-fast-forward): suggest `git pull --rebase` and retry once.
- **Branch protection** (see `git-automation-compat.md` § 3): never push directly to a protected target. If the target is protected (`gh api .../branches/<target>/protection` ≠ 404), always go feature-branch → PR (Step 12), even if mode inferred direct-to-target.

## Step 12: Create PR

Check if `gh` CLI is available:
```bash
which gh 2>/dev/null || echo "MISSING"
```

If missing: output "Install GitHub CLI (gh) to auto-create PRs" and stop after push.

Create PR targeting the correct branch:
```bash
gh pr create --base <target-branch> --title "<type>: <summary>" --body "$(cat <<'EOF'
<PR body from tech-pr-template.md>
EOF
)"
```

**Link issues** collected from Step 2:
```bash
# If issues were found/created, add closing keywords in PR body
# e.g., "Closes #42, Relates to #43"
```

**Output the PR URL** — this is the final output the user sees.

If PR already exists for this branch, update it instead:
```bash
gh pr edit --title "<type>: <summary>" --body "$(cat <<'EOF'
<PR body>
EOF
)"
```

**Merge compatibility** (see `git-automation-compat.md` § 4) — before auto-merging:
- **Required reviews / CODEOWNERS** (`required_pull_request_reviews`, or `.github/CODEOWNERS`): **STOP after creating the PR** — do not self-merge. Output "PR open, awaiting required review." and hand off.
- **Merge method**: use only an allowed method (`gh api repos/{o}/{r}` → `allow_squash_merge`/`allow_merge_commit`/`allow_rebase_merge`) → `gh pr merge --squash|--merge|--rebase`. With `required_linear_history`, prefer `--squash`/`--rebase`.
- **Merge queue / auto-merge**: enqueue with `gh pr merge --auto`; don't expect an immediate merge.
- **Semantic PR title lint** (`action-semantic-pull-request`): ensure the PR title is conventional (`type(scope): summary`).

## Step 13: GitHub Release (conditional)

**Skip if:** no `--release` flag, `--quick` flag, version was not bumped in Step 6, `gh` CLI is not available, OR the release regime owns publishing (semantic-release, release-please, GoReleaser — see `git-automation-compat.md` § 1; those publish from CI and must not be duplicated). For a tag-triggered workflow, the regime still wants the tag pushed — push it, then only enrich notes (steps 4 + 8 below).

After CI passes and the branch is merged, publish an official GitHub release.

1. **Switch to target branch and pull:**
   ```bash
   git checkout <target>
   git pull origin <target>
   ```

2. **Check for existing tag** — stop if tag already exists:
   ```bash
   git tag | grep "^v$(cat VERSION 2>/dev/null || node -p "require('./package.json').version" 2>/dev/null)$"
   ```
   If tag exists: **STOP** — "Tag vX.Y.Z already exists. Bump version and retry."

3. **Create and push tag:**
   ```bash
   git tag vX.Y.Z
   git push origin vX.Y.Z
   ```

4. **Detect release automation** (see `tech-auto-detect.md` § Release Automation Detection). Pushing the tag may have already triggered a workflow that builds and publishes the release. **Run this before any manual release step** — a manual `gh release create` over a CI-created release fails with `HTTP 422: Release.tag_name already exists`.

   - **If AUTOMATED** → skip steps 5–7 (CI owns build + publish). Go to step 8 (enrich notes).
   - **If NONE** → continue to step 5.

5. **Run release build** (NONE path only; if release command detected — see `tech-auto-detect.md` § Release Command Detection):
   ```bash
   npm run release:pack   # or detected equivalent
   ```
   If command fails: warn user but continue — release will be created without artifacts.

6. **Detect artifacts** (NONE path only — see `tech-auto-detect.md` § Artifact Detection):
   ```bash
   ARTIFACTS=$(ls dist/*.zip dist/*.tar.gz build/*.zip 2>/dev/null | head -10)
   ```

7. **Create GitHub release** (NONE path only):
   ```bash
   gh release create vX.Y.Z $ARTIFACTS \
     --title "vX.Y.Z" \
     --notes "$(cat <<'EOF'
   <changelog entry generated in Step 7>
   EOF
   )"
   ```
   - Artifacts are positional args — pass them before flags, not via `--attach` (flag does not exist)
   - If no artifacts: omit `$ARTIFACTS`
   - Defensive fallback: if this returns `422 ... already exists` (an undetected workflow published it), switch to the AUTOMATED path — `gh release edit` + `gh release upload vX.Y.Z <file> --clobber`

8. **Enrich notes — best-effort, never fail the pipeline** (AUTOMATED path, or after manual create): CI-generated notes are often just the tag name. Wait for the release to exist, then replace its notes with the Step 7 changelog entry:
   ```bash
   # Poll up to ~5 min — a cold/queued CI runner (npm ci + test + pack) can exceed 2 min
   for i in $(seq 1 20); do gh release view vX.Y.Z >/dev/null 2>&1 && break; sleep 15; done
   if gh release view vX.Y.Z >/dev/null 2>&1; then
     gh release edit vX.Y.Z --notes "$(cat <<'EOF'
   <changelog entry generated in Step 7>
   EOF
   )"
   else
     echo "Release not published yet — CI still running. Enrich later: gh release edit vX.Y.Z --notes-file <changelog>"
   fi
   ```
   - If the poll times out, do NOT fail — CI will publish with default notes; surface the manual `gh release edit` command and continue.
   - Output the release URL — this is the final line of pipeline output
