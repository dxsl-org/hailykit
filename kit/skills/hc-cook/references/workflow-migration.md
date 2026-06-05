# Large-Scale Code Migration Workflow

Systematic approach to migrating a codebase from one library, framework, or pattern to another. For migrations spanning 20+ files or touching public APIs.

**Activation:** `{skill:hc-cook} migrate "[description]"`

Examples:
```
{skill:hc-cook} migrate "Moment.js → date-fns"
{skill:hc-cook} migrate "callbacks → async/await in auth module"
{skill:hc-cook} migrate "class components → React hooks"
{skill:hc-cook} migrate "REST → GraphQL for user endpoints"
```

---

## Step 1: Scope Analysis

Before writing a line of migration code, understand the full blast radius.

```bash
# Count usages of the thing being migrated
grep -rn "require('moment')" . --include="*.ts" | wc -l
grep -rn "moment(" . --include="*.ts" | sort -u

# List every file touching it
grep -rn "moment" . --include="*.ts" -l

# Identify public API surface (callers outside the module)
# (grep for exports from the module being changed)
```

**Scope document — required before proceeding:**
- Number of files affected
- Number of call sites
- Any external consumers (other services, public API, test fixtures)
- Estimated migration effort (S/M/L)
- Rollback strategy if migration is abandoned mid-way

---

## Step 2: Compatibility Strategy

Choose the migration pattern based on scope:

| Pattern | When to use | Risk |
|---------|------------|------|
| **Big bang** | <10 files, no external consumers, no data migration | Low if small |
| **Incremental with adapter** | >10 files or external consumers | Medium — adapter complexity |
| **Parallel run** | Data migration, behavioral change under load | Low runtime risk, higher dev cost |
| **Strangler fig** | Framework migration (old framework handles fallback) | Lowest — never down |

**Adapter pattern** (recommended for most library migrations):

```typescript
// adapter.ts — translate new API to old interface during transition
// Remove this file when migration is complete
export function formatDate(date: Date, format: string): string {
  // new library call here, but old signature
  return dateFns.format(date, convertFormatString(format));
}
```

Keep the adapter thin. If the adapter is complex, the APIs are incompatible — reconsider strategy.

---

## Step 3: Automated Codemods (when available)

Many migrations have official or community codemods:

```bash
# React class → hooks
npx react-codemod React-PropTypes-to-prop-types .

# Moment → date-fns
npx moment-to-date-fns .

# Jest → Vitest
npx @vitest/migrate .

# General: jscodeshift
npx jscodeshift -t ./transform.js src/
```

Run codemod on a branch, review the diff before committing. Codemods are rarely 100% complete — review output carefully.

---

## Step 4: Incremental Migration Plan

Break the migration into phases by **logical grouping**, not by file count:

1. **Core utilities** (no dependencies on other migrated code)
2. **Services** (depend on utilities)
3. **UI components** (depend on services)
4. **Tests** (update fixtures, mocks, assertions)
5. **Remove adapter** (only when all usages migrated)

Each phase:
- Migrate the files in that group
- Run the full test suite — must stay green after each phase
- Commit the phase: `migrate(date-fns): phase 2 — service layer`

**Do not** batch phases into one giant commit. Each phase must be independently reviewable and revertable.

---

## Step 5: Behavioral Verification

For each migrated component, verify behavior is identical:

```bash
# Before migration: capture baseline
npm test -- --testPathPattern="date-utils" 2>&1 > baseline.txt

# After migration
npm test -- --testPathPattern="date-utils" 2>&1 > after.txt

# Compare
diff baseline.txt after.txt
```

For UI behavior: before/after screenshots or visual regression tests.

For API behavior: record request/response pairs before migration; replay against migrated code.

---

## Step 6: Removal of Old Code

Once all phases are complete:

```bash
# Confirm no remaining usages of old library/pattern
grep -rn "require('moment')" . --include="*.ts"
# Should return 0 results

# Remove the adapter
rm src/adapters/moment-adapter.ts

# Remove the old dependency
npm uninstall moment

# Run full test suite — all green required before marking migration complete
npm test
```

---

## Rollback Strategy

Each phase commit is independently revertable:

```bash
# Revert a specific phase
git revert [phase-commit-hash]

# If multiple phases need reverting, revert in reverse order
git revert [phase-3-hash]
git revert [phase-2-hash]
```

If the adapter pattern is used: the adapter allows partial rollback (some modules still use old API via adapter, others use new API directly).

---

## Output Format

```
## Migration Progress — [description]

**Strategy:** [big-bang | incremental | strangler-fig]
**Total scope:** [N files, M call sites]
**Completed:** [phases done] / [total phases]

### Phase Log
| Phase | Files | Tests | Status |
|-------|-------|-------|--------|
| 1: Core utilities | 12 | 34/34 | ✅ |
| 2: Services | 8 | 67/67 | ✅ |
| 3: UI (pending) | 15 | — | ⏳ |

### Remaining Usages
[N] call sites remaining (from grep output)

### Blockers
[any API incompatibilities discovered, requiring decisions]
```
