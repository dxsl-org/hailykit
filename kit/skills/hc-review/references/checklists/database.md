# Database / Migration Review Checklist

Overlay for changes that include schema migrations, query modifications, or ORM model changes.
Load alongside `checklists/base.md` — does not replace it.

**Trigger:** diff includes `migrations/`, `*schema*`, `*.sql`, ORM model files, or query builders.

---

## Migration Safety

| # | Check | Severity |
|---|-------|---------|
| DB-01 | Migration has both `up` and `down` functions — rollback is tested, not just written | CRITICAL |
| DB-02 | Destructive operations (`DROP TABLE`, `DROP COLUMN`, `TRUNCATE`) are commented with explicit intent confirmation | CRITICAL |
| DB-03 | `NOT NULL` added to existing column — default value provided OR column is backfilled before constraint applied | CRITICAL |
| DB-04 | Column type changed — existing data fits new type without truncation or loss | CRITICAL |
| DB-05 | Enum value added — DB version supports online enum addition (Postgres ≥ 12 for most cases; verify for older) | HIGH |
| DB-06 | Enum value removed or renamed — existing rows have been migrated or type changed first | CRITICAL |
| DB-07 | Unique constraint added — uniqueness verified in existing data before migration runs | CRITICAL |

## Locking & Performance

| # | Check | Severity |
|---|-------|---------|
| DB-08 | `ALTER TABLE` on large table (>1M rows) — uses concurrent/online migration strategy (e.g., `CREATE INDEX CONCURRENTLY`, `pt-online-schema-change`, Flyway shadow table) | HIGH |
| DB-09 | `CREATE INDEX` — uses `CONCURRENTLY` flag to avoid `ACCESS EXCLUSIVE` lock on Postgres | HIGH |
| DB-10 | Backfill operation — batched (e.g., 1000 rows/transaction) not single transaction on full table | HIGH |
| DB-11 | Foreign key added — index on the FK column exists or is created in same migration | MEDIUM |
| DB-12 | Full-table scan introduced by query — `EXPLAIN ANALYZE` plan reviewed, index strategy documented | HIGH |

## Query Correctness

| # | Check | Severity |
|---|-------|---------|
| DB-13 | Raw SQL strings — parameters bound via placeholders, not f-string/concatenation (SQL injection) | CRITICAL |
| DB-14 | `DELETE` / `UPDATE` without `WHERE` — intentional bulk op explicitly named as such in code | CRITICAL |
| DB-15 | Soft-delete pattern used — queries filter `deleted_at IS NULL` everywhere it's relevant | HIGH |
| DB-16 | Transactions wrap multi-step mutations — partial success cannot leave data in inconsistent state | HIGH |
| DB-17 | `SELECT *` in production queries — explicit column list used; new columns won't silently break callers | MEDIUM |
| DB-18 | Pagination uses cursor or keyset, not `OFFSET` on large tables | MEDIUM |

## ORM & Model

| # | Check | Severity |
|---|-------|---------|
| DB-19 | N+1 query risk — associations eager-loaded where result set is unbounded | HIGH |
| DB-20 | Lazy-load in a loop — replaced with batch load or join | HIGH |
| DB-21 | Model timestamps (`created_at`, `updated_at`) — set by DB default, not application code | LOW |
| DB-22 | Cascade delete configured — cascades are intentional and documented; no orphan risk | HIGH |

## Output Format

```
Database Review: N issues (X critical, Y high, Z medium)

**CRITICAL** (blocking):
- [DB-NN] file:line — finding description
  Fix: suggested fix

**HIGH** (should fix before ship):
- [DB-NN] file:line — finding description
```
