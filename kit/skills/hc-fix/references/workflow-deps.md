# Dependency Upgrade Workflow

Systematic approach to upgrading dependencies — from CVE patching to major version migrations. Faster than ad-hoc upgrades; safer than leaving dependencies stale.

**Activation:** `{skill:hc-fix} deps [scope]`

`scope`: `security` (CVE/audit only) | `outdated` (minor/patch only) | `major [package]` (one major version bump) | *(none)* (full audit + triage)

---

## Step 1: Audit

Run the package manager's audit tool and capture the full report.

```bash
# Node.js
npm audit --json > /tmp/audit.json
npm outdated

# Python
pip list --outdated
pip-audit  # or safety check

# Rust
cargo audit

# Go
go list -m -u all
govulncheck ./...
```

Classify findings:

| Category | Description | Priority |
|----------|------------|---------|
| **Critical CVE** | CVSS ≥ 9.0 — RCE, auth bypass, data exposure | Fix this sprint |
| **High CVE** | CVSS 7.0–8.9 | Fix within 2 weeks |
| **Medium/Low CVE** | CVSS < 7.0 | Next scheduled upgrade |
| **Major outdated** | 2+ major versions behind; EOL approaching | Plan migration |
| **Minor/patch outdated** | Low risk, usually safe to upgrade | Batch upgrade |

Log `✓ Audit: [N] CVEs (X critical, Y high), [M] outdated packages`

---

## Step 2: Triage & Plan

Order upgrades to minimize risk:

1. **Security patches first** — apply patch/minor security upgrades immediately (rarely breaking)
2. **Indirect deps** — upgrade transitive deps pulled in by security fixes
3. **Minor version bumps** — batch upgrade, run tests, commit if green
4. **Major upgrades** — one at a time; read changelog + migration guide first

For each major upgrade, capture:
- Breaking changes (from CHANGELOG or migration guide)
- Deprecated APIs used in current codebase (`grep -rn "deprecated_api" .`)
- Estimated migration effort
- Whether to upgrade now or defer with documented rationale

Log `✓ Triage: [upgrade plan — N packages in [M] batches]`

---

## Step 3: Apply Upgrades

Apply in batches, smallest risk first. Run full test suite after **each batch**.

```bash
# Security patches (batch 1)
npm audit fix          # or pip install --upgrade [package]==[patched-version]
npm test && npm run build

# Minor updates (batch 2)
npm update             # or pip install --upgrade-strategy eager
npm test && npm run build

# Major upgrade — one at a time (batch 3+)
npm install [package]@[major]
# Apply migration guide changes
npm test && npm run build
```

**If tests fail after a batch:**
1. Identify which package caused the failure (`git bisect` or revert batch)
2. Check breaking changes in that package's changelog
3. Fix usage, re-run tests
4. If fix is non-trivial, defer the upgrade and document: package + version + blocker reason

Log `✓ Apply: Batch [N] — [M] packages upgraded — tests pass`

---

## Step 4: Verify & Harden

After all batches:

```bash
# Full test suite
npm test

# Type check (catches API signature changes)
npm run typecheck

# Build
npm run build

# Re-run audit to confirm CVEs resolved
npm audit
```

Check for behavioral regressions:
- Any warnings in test output that weren't there before?
- Any deprecated-API warnings emitted at runtime?
- Bundle size change > 10%? (check with `npm run build -- --report`)

---

## Step 5: Document

For each major version bump, add to the PR description:
- Package + version range (from → to)
- Breaking changes that required code changes
- Packages deferred and why (so future sessions can resume)

If deferred packages have CVEs:
- Open a tracked issue with severity + target fix date
- Add a comment in `package.json` / `requirements.txt` next to the dep if there's a workaround in place

Log `✓ Document: [N] upgraded, [M] deferred with rationale`

---

## Common Patterns

**Lock-file conflict after upgrade:**
```bash
rm package-lock.json && npm install  # regenerate clean
```

**Peer dependency conflicts:**
```bash
npm install --legacy-peer-deps  # short-term; track the underlying conflict
```

**Python version pinning to unblock security fix:**
```
# requirements.txt
urllib3>=2.0.7  # CVE-2023-43804: minimum safe version
```

**When to rollback an upgrade:**
- Test failure that can't be fixed within 30 min → defer, document, restore
- Runtime behavioral change discovered in staging → defer, file issue
- Bundle size increase > 20% with no clear benefit → investigate before proceeding
