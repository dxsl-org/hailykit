# sqlc Standards

Detected via `sqlc.yaml` or `sqlc.json` config file — auto-injected as **extra**, typically alongside Gin/Echo/Fiber.

## What sqlc Is

sqlc generates **type-safe Go code from raw SQL**. You write `.sql` files; sqlc reads them + your schema; it generates Go functions with proper types. No ORM, no runtime parsing.

Closest analog: SQLx in Rust. Or PgTyped in TypeScript.

## When to Use

- Want raw SQL control + Go type safety
- Avoid ORM overhead + leaky abstractions
- Need compile-time guarantees that your SQL matches your schema
- Like to read/write SQL fluently

Trade-off: every query is a separate function. Dynamic queries (e.g. variable WHERE clauses) need a query builder on top.

## Setup

Install:
```bash
go install github.com/sqlc-dev/sqlc/cmd/sqlc@latest
```

`sqlc.yaml`:
```yaml
version: "2"
sql:
  - engine: "postgresql"        # or mysql, sqlite
    queries: "db/queries"
    schema: "db/migrations"
    gen:
      go:
        package: "db"
        out: "db/generated"
        sql_package: "pgx/v5"    # or database/sql
        emit_json_tags: true
        emit_pointers_for_null_types: true
```

## Schema (Migrations)

`db/migrations/0001_init.sql`:
```sql
CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE posts (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    body TEXT,
    published_at TIMESTAMPTZ
);

CREATE INDEX idx_posts_user_id ON posts(user_id);
```

sqlc reads schema to understand types — pair with **golang-migrate** or **goose** for actually running migrations.

## Queries

`db/queries/users.sql`:
```sql
-- name: GetUserByID :one
SELECT id, email, name, created_at
FROM users
WHERE id = $1;

-- name: ListUsers :many
SELECT id, email, name
FROM users
ORDER BY created_at DESC
LIMIT $1 OFFSET $2;

-- name: CreateUser :one
INSERT INTO users (email, name)
VALUES ($1, $2)
RETURNING id, email, name, created_at;

-- name: UpdateUserName :exec
UPDATE users SET name = $1 WHERE id = $2;

-- name: DeleteUser :exec
DELETE FROM users WHERE id = $1;

-- name: CountActiveUsers :one
SELECT COUNT(*) FROM users WHERE created_at > $1;
```

The annotation tells sqlc what to generate:
- `:one` — returns single row + error
- `:many` — returns slice + error
- `:exec` — returns just error
- `:execrows` — returns `sql.Result` (affected rows)
- `:batchexec`, `:batchone`, `:batchmany` — batched (Postgres)

## Generate

```bash
sqlc generate
```

Produces `db/generated/queries.sql.go`:

```go
type User struct {
    ID        int64     `json:"id"`
    Email     string    `json:"email"`
    Name      string    `json:"name"`
    CreatedAt time.Time `json:"created_at"`
}

func (q *Queries) GetUserByID(ctx context.Context, id int64) (User, error) {
    row := q.db.QueryRow(ctx, getUserByID, id)
    var u User
    err := row.Scan(&u.ID, &u.Email, &u.Name, &u.CreatedAt)
    return u, err
}

type ListUsersParams struct {
    Limit  int32
    Offset int32
}

func (q *Queries) ListUsers(ctx context.Context, arg ListUsersParams) ([]User, error) {
    // ...
}

type CreateUserParams struct {
    Email string
    Name  string
}

func (q *Queries) CreateUser(ctx context.Context, arg CreateUserParams) (User, error) {
    // ...
}
```

## Using Generated Code

```go
import (
    "github.com/jackc/pgx/v5/pgxpool"
    "myapp/db"
)

pool, _ := pgxpool.New(ctx, dbURL)
queries := db.New(pool)

user, err := queries.GetUserByID(ctx, 42)
if err != nil { /* ... */ }

users, err := queries.ListUsers(ctx, db.ListUsersParams{Limit: 20, Offset: 0})

newUser, err := queries.CreateUser(ctx, db.CreateUserParams{
    Email: "a@b.com",
    Name:  "Alice",
})
```

Compile-time errors if you change the SQL but forget to update callers — exactly what we want.

## Transactions

```go
tx, err := pool.Begin(ctx)
if err != nil { return err }
defer tx.Rollback(ctx)        // safe to call after commit

qtx := queries.WithTx(tx)
_, err = qtx.CreateUser(ctx, db.CreateUserParams{...})
if err != nil { return err }
_, err = qtx.CreatePost(ctx, db.CreatePostParams{...})
if err != nil { return err }

return tx.Commit(ctx)
```

`queries.WithTx(tx)` returns a new `*Queries` bound to the transaction.

## Joins + Custom Types

```sql
-- name: GetPostWithAuthor :one
SELECT
    p.id AS post_id,
    p.title,
    p.body,
    u.id AS author_id,
    u.name AS author_name,
    u.email AS author_email
FROM posts p
JOIN users u ON u.id = p.user_id
WHERE p.id = $1;
```

sqlc generates a `GetPostWithAuthorRow` struct with all selected columns. For deeper composition, define your own DTOs and convert in your service layer.

## Nullable Columns

With `emit_pointers_for_null_types: true`:
```sql
SELECT id, body FROM posts WHERE id = $1;
-- if `body TEXT` is nullable → field becomes *string
```

Without the option, nullable columns use `sql.NullString` / `sql.NullInt64` / etc. — clunky but explicit.

## Dynamic Queries

sqlc doesn't do dynamic WHERE clauses well. Use coalesce hack:

```sql
-- name: SearchUsers :many
SELECT * FROM users
WHERE
    ($1::text IS NULL OR email ILIKE '%' || $1 || '%')
    AND ($2::text IS NULL OR name ILIKE '%' || $2 || '%')
ORDER BY created_at DESC
LIMIT $3;
```

For truly dynamic queries, mix sqlc (static queries) with **squirrel** / **goqu** / hand-built query strings (static queries).

## Pagination

```sql
-- name: ListUsersPaginated :many
SELECT id, email, name
FROM users
WHERE ($1::bigint IS NULL OR id < $1)   -- cursor
ORDER BY id DESC
LIMIT $2;
```

Cursor-based pagination scales better than `OFFSET` for large tables.

## Best Practices

- **One query file per domain table** (`users.sql`, `posts.sql`) — easier to grep
- Run `sqlc generate` in `make` / `task` build step + CI — never commit stale generated code
- Generated code goes in **dedicated package** (`db/` or `internal/db/`) — separate from business logic
- Build a **repository layer** wrapping `*Queries` — domain-friendly method names
- **golang-migrate** or **goose** for actual schema migrations
- Use **`pgx/v5`** SQL package — better Postgres feature support than `database/sql`

## Common Pitfalls

- Forgetting to re-run `sqlc generate` after schema/query change → compile passes, runtime fails
- Committing generated code edits → next `sqlc generate` overwrites them
- Schema file out of sync with actual DB → sqlc can't infer types correctly
- Using `:one` when query might return zero rows → returns `pgx.ErrNoRows`; handle it
- Heavy column lists in `SELECT *` → sqlc generates wide struct; explicit columns are clearer
- Trying to do dynamic WHERE with sqlc → use a query builder for those, sqlc for static queries

## Resources

- Docs: https://docs.sqlc.dev
- GitHub: https://github.com/sqlc-dev/sqlc
- Playground: https://play.sqlc.dev
- Configuration: https://docs.sqlc.dev/en/latest/reference/config.html
