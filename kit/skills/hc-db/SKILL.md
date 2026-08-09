---
name: hc-db
description: "Database expert: schema design, queries, migrations, ORM selection for PostgreSQL, MongoDB, MySQL, SQLite, Redis, Neo4j, Supabase."
when_to_use: "Invoke when designing schemas, writing queries, selecting a database, or planning migrations. Auto-invoked by {skill:hc-plan}, {skill:hc-cook}, {skill:hc-review} when database work is detected."
user-invocable: true
argument-hint: "[database task or question]"
metadata:
  category: database
  keywords: [postgresql, mongodb, mysql, sqlite, redis, neo4j, supabase, sql, schemas, queries, orm, migrations]
---

# DB — Database Design and Operations

Select storage and access layers; design schemas, queries, and reversible migrations. Load manuals only for the selected engine and task.

## Usage

```text
{skill:hc-db} "design the order schema"
{skill:hc-db} "optimize this PostgreSQL query"
```

## Constraints

> **Required — inspect before design:** Inspect the existing schema and query patterns, then clarify missing entities, relationships, constraints, and scale before proposing DDL. Never execute DDL without approval.

> **Required — query safety:** Parameterize every query. Require authentication and TLS for remote databases; do not expose credentials in commands or output.

> **Required — reversible migration:** Name backup, rollback, and compatibility strategy before destructive or production migration work.

## Process

1. **Route storage:** PostgreSQL for general relational work; MySQL/MariaDB for compatible stacks; SQLite for embedded/low-write use; MongoDB for document aggregates; Redis only for cache/session/queue; Supabase for managed PostgreSQL; Neo4j for relationship traversal.
2. **Load context:** for schema work use `db-design.md`, then only the matching reference. Separate OLTP, OLAP, and ETL requirements.
3. **Choose access layer:** ORM for transactional CRUD; query builder for complex reads; raw SQL for reports and measured hot paths.
4. **Protect integrity:** use foreign keys and query-matched indexes; run `EXPLAIN`/`EXPLAIN ANALYZE` before tuning. Authenticate and encrypt remote access.
5. **Plan migration:** use Expand → Backfill → Switch → Contract. Run forward and backward migrations in CI; verify a restorable backup when data could be lost.
6. **Verify engine rules:**
   - PostgreSQL: always pool connections; pgBouncer transaction mode for web requests, session mode for prepared statements/`LISTEN`/session state, statement mode only for compatible edge workloads. Never create a client per HTTP request.
   - MySQL/MariaDB: use InnoDB, `utf8mb4`, `STRICT_ALL_TABLES`, and a connection pool.
   - SQLite: enable WAL and `PRAGMA foreign_keys = ON`; avoid high-concurrency writes and multi-process access.
   - Redis: set TTLs for cached keys, use `SCAN` instead of `KEYS`, namespace keys, and never treat Redis as the primary database.
   - Supabase: enable RLS and explicit policies for client queries; use the direct PostgreSQL connection for migrations.
   - Neo4j: parameterize queries, prefer `MERGE` over `CREATE` when duplicates matter, index matched properties, and inspect with `PROFILE`/`EXPLAIN`.

## Workflow Position

**Auto-invoked by:** `{skill:hc-plan}` (schema phases), `{skill:hc-cook}` (DB implementation), `{skill:hc-review}` (query review)
**Precedes:** `{skill:hc-deploy}` — deploy after schema is finalized
**Related:** `{skill:hc-security}`, `{skill:hc-devops}`

## References

| Topic | File |
|---|---|
| Schema design | `db-design.md` |
| MongoDB CRUD | `references/mongodb-crud.md` |
| MongoDB aggregation | `references/mongodb-aggregation.md` |
| MongoDB indexing | `references/mongodb-indexing.md` |
| MongoDB Atlas | `references/mongodb-atlas.md` |
| PostgreSQL queries | `references/postgresql-queries.md` |
| PostgreSQL CLI | `references/postgresql-psql-cli.md` |
| PostgreSQL performance | `references/postgresql-performance.md` |
| PostgreSQL administration | `references/postgresql-administration.md` |
