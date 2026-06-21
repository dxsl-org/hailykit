# Commit Workflow

Execute via `haily-git-manager` subagent.

## Tool 1: Stage + Analyze
```bash
git add -A && \
echo "=== STAGED ===" && git diff --cached --stat && \
echo "=== SECURITY ===" && \
hailykit secrets --staged && \
echo "=== GROUPS ===" && \
git diff --cached --name-only | awk -F'/' '{
  if ($0 ~ /\.(md|txt)$/) print "docs:"$0
  else if ($0 ~ /test|spec/) print "test:"$0
  else if ($0 ~ /\.claude/) print "config:"$0
  else if ($0 ~ /package\.json|lock/) print "deps:"$0
  else print "code:"$0
}'
```

**`hailykit secrets --staged` exits non-zero when a hardcoded credential is found** (structured, redacted — it never prints the raw value). On non-zero: STOP, show the redacted findings, block the commit. If `hailykit` is unavailable, fall back to a grep over `git diff --cached` for credential keywords.

## Tool 2: Split Decision

NOTE: 
- Search for related issues on GitHub and add to body.
- Only use `feat`, `fix`, or `perf` prefixes for files in `.claude` directory (do not use `docs`).

**From groups, decide:**

**A) Single commit:** Same type/scope, FILES ≤ 3, LINES ≤ 50

**B) Multi commit:** Mixed types/scopes, group by:
- Group 1: `config:` → `chore(config): ...`
- Group 2: `deps:` → `chore(deps): ...`
- Group 3: `test:` → `test: ...`
- Group 4: `code:` → `feat|fix: ...`
- Group 5: `docs:` → `docs: ...`

## Tool 3: Commit

**Single:**
```bash
git commit -m "type(scope): description"
```

**Multi (sequential):**
```bash
git reset && git add file1 file2 && git commit -m "type(scope): desc"
```
Repeat for each group.

## Tool 4: Push (if requested)
```bash
git push && echo "✓ pushed: yes" || echo "✓ pushed: no"
```

**Only push if user explicitly requested** ("push", "commit and push").
