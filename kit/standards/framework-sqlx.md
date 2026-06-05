# SQLx Standards

Detected via `sqlx` in `Cargo.toml` `[dependencies]` — auto-injected as **extra**, typically alongside Axum/Actix/Rocket.

## What SQLx Is

SQLx is an async, pure-Rust SQL toolkit with **compile-time checked queries**. Not an ORM — you write SQL, SQLx verifies it against a real database at build time.

## Supported Databases

PostgreSQL, MySQL, MariaDB, SQLite. Each driver is a feature flag.

## Setup

```toml
[dependencies]
sqlx = { version = "0.8", features = ["runtime-tokio", "postgres", "macros", "migrate", "chrono", "uuid"] }
tokio = { version = "1", features = ["full"] }
```

Set `DATABASE_URL` env var for compile-time query checks:
```bash
export DATABASE_URL="postgres://user:pass@localhost/dbname"
```

Or use offline mode (no DB needed for `cargo build`):
```bash
cargo sqlx prepare       # caches queries to .sqlx/
# Commit .sqlx/ to git for CI builds without DB
```

## Connection Pool

```rust
use sqlx::postgres::PgPoolOptions;

let pool = PgPoolOptions::new()
    .max_connections(10)
    .acquire_timeout(std::time::Duration::from_secs(5))
    .connect(&database_url)
    .await?;
```

Pool is `Clone` (it's `Arc` internally) — pass to handlers via state.

## Queries

```rust
// Simple query — returns row
let row = sqlx::query("SELECT id, name FROM users WHERE id = $1")
    .bind(1_i64)
    .fetch_one(&pool)
    .await?;
let id: i64 = row.get("id");

// Typed query — returns struct (compile-time checked!)
#[derive(sqlx::FromRow)]
struct User { id: i64, name: String, email: String }

let user = sqlx::query_as!(
    User,
    "SELECT id, name, email FROM users WHERE id = $1",
    1_i64
)
.fetch_one(&pool)
.await?;

// Or with FromRow + query_as
let user = sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = $1")
    .bind(1_i64)
    .fetch_one(&pool)
    .await?;
```

**`query!` and `query_as!` macros validate against the live DB** at compile time. Catch SQL typos, type mismatches, missing columns BEFORE running.

## Fetch Variants

```rust
.fetch_one(&pool)     // exactly one row, error otherwise
.fetch_optional(&pool) // Option<Row>
.fetch_all(&pool)     // Vec<Row>
.fetch(&pool)         // Stream<Row> — for huge results
.execute(&pool)       // for INSERT/UPDATE/DELETE; returns RowsAffected
```

## Transactions

```rust
let mut tx = pool.begin().await?;

sqlx::query!("INSERT INTO users (email) VALUES ($1)", email)
    .execute(&mut *tx)
    .await?;

sqlx::query!("INSERT INTO audit_log (action) VALUES ('user_created')")
    .execute(&mut *tx)
    .await?;

tx.commit().await?;
// Drop without commit = rollback
```

Use `&mut *tx` (deref to executor) when passing to queries.

## Migrations

`migrations/20240101000000_init.sql`:
```sql
CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Run via:
```bash
sqlx migrate add init
sqlx migrate run
```

Or from code:
```rust
sqlx::migrate!("./migrations").run(&pool).await?;
```

Versions tracked in `_sqlx_migrations` table. Filenames: `<timestamp>_<name>.sql`.

## Compile-Time Checking

The killer feature. `query!`/`query_as!` macros connect to the DB at build time:

```rust
let user = sqlx::query_as!(
    User,
    "SELECT id, name FROM users WHERE id = $1",
    user_id
).fetch_one(&pool).await?;
```

- ✅ Verifies query is valid SQL
- ✅ Verifies column types match `User` struct
- ✅ Verifies parameter types (`user_id` must be `i64` if `id` is bigint)
- ✅ Catches typos before runtime

Trade-off: compile time can grow with many queries. Use `sqlx prepare` + `.sqlx/` cache for CI builds without DB.

## NULL Handling

```rust
struct User {
    id: i64,
    name: String,            // NOT NULL column
    nickname: Option<String>, // NULL column
}
```

Type mismatch (e.g. using `String` where DB allows NULL) = compile error from `query_as!`. Forces correct nullability modeling.

## JSON / JSONB

```rust
use sqlx::types::Json;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
struct Metadata { tags: Vec<String> }

#[derive(sqlx::FromRow)]
struct Post {
    id: i64,
    metadata: Json<Metadata>,    // jsonb column
}

let post = sqlx::query_as!(
    Post,
    r#"SELECT id, metadata as "metadata: Json<Metadata>" FROM posts WHERE id = $1"#,
    post_id
).fetch_one(&pool).await?;

let tags = &post.metadata.tags;
```

Note the `as "name: Type"` syntax — sometimes needed to help the type checker.

## Dynamic Queries (Builder)

When you need WHERE clauses conditionally:
```rust
use sqlx::QueryBuilder;

let mut qb = QueryBuilder::new("SELECT id, name FROM users WHERE 1=1 ");
if let Some(email) = filter_email {
    qb.push(" AND email = ").push_bind(email);
}
if let Some(min_age) = min_age {
    qb.push(" AND age >= ").push_bind(min_age);
}

let users: Vec<User> = qb.build_query_as().fetch_all(&pool).await?;
```

`push_bind` adds parameters safely — no SQL injection.

## Bulk Inserts

```rust
let mut qb = QueryBuilder::new("INSERT INTO users (email, name) ");
qb.push_values(users_to_insert.iter(), |mut b, user| {
    b.push_bind(&user.email).push_bind(&user.name);
});
qb.build().execute(&pool).await?;
```

Single round-trip for N inserts — much faster than loop.

## Best Practices

- Pool one instance for the whole app — clone the `PgPool`/`MySqlPool` handle
- Use `query!` / `query_as!` macros — compile-time safety beats runtime debugging
- Configure `DATABASE_URL` in `.env` for local dev; `cargo sqlx prepare` for CI
- Transactions for multi-statement logical units
- Migrations in version control — never edit applied migrations, write new ones
- Use `Stream` (`.fetch()`) for huge result sets — don't `.fetch_all()` 1M rows
- Set connection acquire timeout — don't hang indefinitely on pool exhaustion
- Use **statement timeouts** at the DB level for safety: `SET statement_timeout = 30000;`

## Common Pitfalls

- Forgetting `DATABASE_URL` env var → cryptic macro errors at compile time
- Using `query!` without DB available + no `.sqlx/` cache → CI build fails; run `cargo sqlx prepare` and commit
- `fetch_one` when 0 rows possible → error; use `fetch_optional`
- Forgetting `&mut *tx` syntax in transactions → type errors
- Loading huge result sets via `.fetch_all()` → memory blowup; use streaming
- Mixing different runtimes (`runtime-tokio` vs `runtime-async-std`) → compile errors

## Performance Tips

- `prepare_cached` on hot queries — caches plan
- Index columns used in `WHERE` + `ORDER BY` — SQLx doesn't auto-index
- Use Postgres-specific types: `BIGINT` not `INTEGER` for IDs (avoids overflow at scale)
- Connection pool size = `2 × cores` is a reasonable default; tune based on DB load
- Use `EXPLAIN ANALYZE` on slow queries — SQLx can't optimize bad SQL

## Resources

- Docs: https://docs.rs/sqlx
- GitHub: https://github.com/launchbadge/sqlx
- Postgres docs: https://www.postgresql.org/docs
- "Zero To Production In Rust" book (Luca Palmieri) — heavy SQLx usage
