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
6. If `--dry-run`: output what would happen at each step and stop here.

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

**Skip if:** no `--release` flag OR no version file found. Without `--release`, the version stays unchanged — changelog accumulates in `[Unreleased]` instead.

1. Auto-detect version source (see `tech-auto-detect.md`)
2. If no version file found: **skip silently**
3. Auto-decide bump level from diff size:
   - **< 50 lines:** patch bump
   - **50+ lines:** patch bump (default safe choice)
   - **Major feature or breaking change:** Use `AskUserQuestion` — "This looks like a significant change. Bump minor or patch?"
4. For beta mode: use prerelease suffix (e.g., `1.2.4-beta.1`)
5. Write new version to detected file

## Step 7: Changelog

**Skip if:** `--quick` flag.

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
     - Each bullet: max 10 words, one clear sentence, no trailing explanations

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

## Step 11: Push

```bash
git push -u origin $(git branch --show-current)
```

- **Never force push.**
- If push rejected: suggest `git pull --rebase` and retry once.

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

## Step 13: GitHub Release (conditional)

**Skip if:** no `--release` flag, `--quick` flag, version was not bumped in Step 6, or `gh` CLI is not available.

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

4. **Run release build** (if release command detected — see `tech-auto-detect.md` § Release Command Detection):
   ```bash
   npm run release:pack   # or detected equivalent
   ```
   If command fails: warn user but continue — release will be created without artifacts.

5. **Detect artifacts** (see `tech-auto-detect.md` § Artifact Detection):
   ```bash
   # Collect files matching known patterns
   ARTIFACTS=$(ls dist/*.zip dist/*.tar.gz build/*.zip 2>/dev/null | head -10)
   ```

6. **Create GitHub release:**
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
   - If release already exists for this tag: use `gh release edit vX.Y.Z` + `gh release upload vX.Y.Z <file> --clobber`
   - Output the release URL — this is the final line of pipeline output
