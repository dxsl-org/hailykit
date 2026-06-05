---
name: hc-db
description: "Database expert: schema design, queries, migrations, ORM selection for PostgreSQL, MongoDB, MySQL, SQLite, Redis, Neo4j, Supabase."
when_to_use: "Invoke when designing schemas, writing queries, selecting a database, or planning migrations. Auto-invoked by hc:plan, hc:cook, hc:review when database work is detected."
user-invocable: true
argument-hint: "[database task or question]"
metadata:
  category: database
  keywords: [postgresql, mongodb, mysql, sqlite, redis, neo4j, supabase, sql, schemas, queries, orm, migrations]
---

# DB — Database Expert

Schema design, query writing, ORM selection, connection pooling, and migration strategies across all common databases.

## Database Selection

| Database | Use When |
|----------|----------|
| **PostgreSQL** | General-purpose relational, complex queries, ACID, full-text search |
| **MySQL/MariaDB** | Laravel/PHP stacks, existing LAMP, read-heavy workloads |
| **SQLite** | Local dev, embedded, edge (Turso/D1), testing, simple self-hosted apps |
| **MongoDB** | Flexible schema, document-oriented, high write throughput |
| **Redis** | Caching, sessions, rate limiting, pub/sub, queues |
| **Supabase** | PostgreSQL + realtime + auth + storage in one managed platform |
| **Neo4j** | Highly connected data: knowledge graphs, recommendations, fraud detection |

## Layer Selection

| Layer | When | Trade-off |
|-------|------|-----------|
| **ORM** (Prisma, TypeORM, SQLAlchemy) | CRUD-heavy, schema-driven, type safety | Heavier runtime; complex queries awkward |
| **Query Builder** (Drizzle, Knex) | SQL control + composability | More boilerplate |
| **Raw SQL** | Reports, analytics, hot paths | No type safety |

**Rule:** ORM for transactional CRUD · query builder for complex reads · raw SQL for hot paths/reports.

## PostgreSQL

**ORM/Driver:** Prisma · Drizzle · TypeORM · SQLAlchemy · `pg` (Node) · `psycopg2/asyncpg` (Python)

**Connection pooling — ALWAYS use a pool:**

| Mode | Use case |
|------|----------|
| pgBouncer transaction | Web apps (Next.js, Express) — connection released after each transaction |
| pgBouncer session | Long-lived prepared statements, `LISTEN/NOTIFY`, `SET LOCAL` |
| pgBouncer statement | Edge runtime (Vercel/Cloudflare) |
| Node `pg` Pool | Self-hosted Node API. Default `max: 10`; tune to CPU count |

Anti-pattern: creating a new client per HTTP request.

**Best practices:** normalize to 3NF · FK for referential integrity · index FK + frequently filtered columns · `EXPLAIN ANALYZE` before optimizing · `VACUUM/ANALYZE` regularly · UUID v7 for distributed surrogate keys.

See: `references/postgresql-queries.md` · `references/postgresql-performance.md` · `references/postgresql-administration.md` · `references/postgresql-psql-cli.md`

## MySQL / MariaDB

**ORM/Driver:** Prisma · TypeORM · Drizzle · SQLAlchemy · `mysql2` (Node)

**Key rules:** always use InnoDB engine · set `charset=utf8mb4` (MySQL's `utf8` is 3-byte only, broken) · enable `STRICT_ALL_TABLES` · use connection pool (`mysql2` pool or ProxySQL).

**Gotchas:** GROUP BY strict mode (all non-aggregated columns must be selected) · ENUM is painful to alter at scale · case sensitivity varies by OS (use lowercase table names always).

## SQLite

**ORM/Driver:** Prisma · Drizzle (better-sqlite3) · SQLAlchemy · `better-sqlite3` (Node sync) · Python built-in `sqlite3`

```sql
PRAGMA journal_mode = WAL;     -- concurrent reads + writes
PRAGMA foreign_keys = ON;      -- disabled by default
PRAGMA synchronous = NORMAL;   -- safer than OFF, faster than FULL
```

**Edge variants:** Turso (libSQL, distributed) · Cloudflare D1 — use Drizzle for both.
**Not for:** high-concurrency writes · multi-process access.

## MongoDB

**ORM/Driver:** Mongoose (Node) · Motor/PyMongo (Python) · MongoDB Node Driver

**Schema design:** embed for 1-to-few · reference for 1-to-many · index all frequently queried fields · avoid unbounded arrays.

**Key rules:** always enable auth + TLS · use Atlas for managed (replicas, backups, monitoring) · aggregation pipeline for complex transforms.

See: `references/mongodb-crud.md` · `references/mongodb-aggregation.md` · `references/mongodb-indexing.md` · `references/mongodb-atlas.md`

## Redis

**Client:** `ioredis` (Node) · `redis-py` / `aioredis` (Python)

| Structure | Use case |
|-----------|----------|
| String | Simple cache, counters, rate limits |
| Hash | User sessions, structured objects |
| Set | Tags, unique visitors, deduplication |
| Sorted Set | Leaderboards, priority queues |
| List | Message queues, activity feeds |
| Stream | Event sourcing, audit logs |

**Key rules:** always set TTL on cached keys · use `SCAN` not `KEYS` · choose eviction policy (`allkeys-lru` for pure cache) · namespace keys: `app:resource:id`.

**Anti-patterns:** blobs >100KB · Redis as primary DB · no TTL on cache keys.

## Supabase

**Client:** `@supabase/supabase-js` · Prisma (direct PostgreSQL connection for migrations)

**Differences from raw PostgreSQL:** access via PostgREST · Row Level Security (RLS) mandatory for client queries · realtime subscriptions via websockets.

**Key patterns:** always enable RLS + write policies · use Edge Functions for server-side logic · use direct connection string for migrations (bypass PostgREST).

## Neo4j

**Client:** `neo4j-driver` (Node/Python) · `py2neo` (Python)

**Use for:** knowledge graphs · recommendation engines · fraud detection · social network traversal · problems where relationships matter as much as data.

```cypher
-- Create
CREATE (u:User {id: '1', name: 'Alice'})-[:FOLLOWS]->(v:User {id: '2', name: 'Bob'})

-- Friends of friends
MATCH (u:User {id: '1'})-[:FOLLOWS*2]->(fof:User)
WHERE NOT (u)-[:FOLLOWS]->(fof) AND fof <> u
RETURN fof.name LIMIT 10
```

**Key rules:** index node properties used in MATCH · always use parameterized queries · prefer MERGE over CREATE (avoids duplicates) · `PROFILE`/`EXPLAIN` for optimization.

**HailyKit:** `{skill:hc-scout} --graph` builds queryable knowledge graphs and can use Neo4j as backend.

## Migrations

**Zero-downtime column change (Expand/Backfill/Switch/Contract):**
1. **Expand** — add nullable new column; write to both old + new
2. **Backfill** — background job populates new from old
3. **Switch reads** — read from new column only
4. **Contract** — drop old column

Always run forward + backward migration in CI before production.

| Tool | Stack |
|------|-------|
| Prisma Migrate | Node/TS |
| Drizzle Kit | Node/TS |
| Alembic | Python |
| golang-migrate | Go |
| Flyway | Polyglot |

## References

| Topic | File |
|-------|------|
| Schema design (OLTP/OLAP) | `references/db-design.md` |
| MongoDB CRUD + operators | `references/mongodb-crud.md` |
| MongoDB aggregation pipeline | `references/mongodb-aggregation.md` |
| MongoDB index types | `references/mongodb-indexing.md` |
| MongoDB Atlas cloud | `references/mongodb-atlas.md` |
| PostgreSQL SELECT, JOINs, CTEs | `references/postgresql-queries.md` |
| psql commands + scripting | `references/postgresql-psql-cli.md` |
| EXPLAIN, optimization, vacuum | `references/postgresql-performance.md` |
| Users, backups, replication | `references/postgresql-administration.md` |

## Scripts

```bash
python scripts/db_migrate.py --db mongodb --generate "add_user_index"
python scripts/db_backup.py --db postgres --output /backups/
python scripts/db_performance_check.py --db mongodb --threshold 100ms
```

## Workflow Position

**Auto-invoked by:** `{skill:hc-plan}` (schema phases), `{skill:hc-cook}` (DB implementation), `{skill:hc-review}` (query review)
**Precedes:** `{skill:hc-deploy}` — deploy after schema is finalized
**Related:** `{skill:hc-security}`, `{skill:hc-devops}`
