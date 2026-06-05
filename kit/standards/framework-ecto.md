# Ecto Standards

Detected via `:ecto` or `:ecto_sql` in `mix.exs` — auto-injected as **extra**, typically alongside Phoenix.

## What Ecto Is

Ecto is Elixir's database toolkit — it's an **adapter, query builder, schema mapper, and migration runner**, not a traditional ORM. There are no lazy-loading objects, no "save this object" magic. Everything is explicit functions.

Components:
- `Ecto.Repo` — your gateway to the DB
- `Ecto.Schema` — Elixir struct ↔ DB table mapping
- `Ecto.Changeset` — validation + change tracking
- `Ecto.Query` — composable query DSL
- `Ecto.Migration` — schema migrations

## Configuration

```elixir
# config/dev.exs
config :my_app, MyApp.Repo,
  database: "my_app_dev",
  username: "postgres",
  hostname: "localhost",
  pool_size: 10

# lib/my_app/repo.ex
defmodule MyApp.Repo do
  use Ecto.Repo, otp_app: :my_app, adapter: Ecto.Adapters.Postgres
end
```

Add to supervision tree (`application.ex`): `MyApp.Repo`.

## Schema

```elixir
defmodule MyApp.Accounts.User do
  use Ecto.Schema
  import Ecto.Changeset

  schema "users" do
    field :email, :string
    field :name, :string
    field :age, :integer
    field :password_hash, :string

    has_many :posts, MyApp.Blog.Post
    belongs_to :team, MyApp.Accounts.Team

    timestamps()
  end

  def changeset(user, attrs) do
    user
    |> cast(attrs, [:email, :name, :age])
    |> validate_required([:email, :name])
    |> validate_format(:email, ~r/@/)
    |> unique_constraint(:email)
  end
end
```

## Changesets (Critical Pattern)

Changesets are **the** validation primitive in Ecto. They track changes + validations + DB constraint mapping:

```elixir
user
|> User.changeset(%{email: "new@example.com"})
|> Repo.update()
# → {:ok, %User{}} | {:error, %Ecto.Changeset{}}
```

**Don't write your own validation.** Use changesets for every insert/update.

Common functions:
- `cast/3` — whitelist fields, type-cast values
- `validate_required/2` — required fields
- `validate_format/3`, `validate_length/3`, `validate_inclusion/3` — value checks
- `unique_constraint/2` — maps DB unique index to changeset error
- `foreign_key_constraint/2` — maps FK violation to changeset error
- `cast_assoc/3` — nested changesets for has_many/has_one
- `put_assoc/3` — replace an associated record

## Queries

```elixir
import Ecto.Query

# Simple
Repo.all(from u in User, where: u.age > 18)

# With select
Repo.all(from u in User, select: {u.id, u.name}, order_by: [desc: u.inserted_at])

# Joins
Repo.all(
  from u in User,
    join: p in assoc(u, :posts),
    where: p.published == true,
    preload: [posts: p]
)

# Composable
def adults, do: from u in User, where: u.age >= 18
def by_team(query, team_id), do: from u in query, where: u.team_id == ^team_id

Repo.all(adults() |> by_team(123))
```

`^` interpolates parameters safely (prepared statements — no SQL injection).

## Preload (N+1 Prevention)

```elixir
# Bad — N+1
users = Repo.all(User)
Enum.map(users, & &1.posts)        # KaboomError: not loaded

# Good — preload
users = Repo.all(User) |> Repo.preload(:posts)

# Even better — join + preload in one query
from(u in User, preload: [posts: :comments]) |> Repo.all()
```

## Transactions

```elixir
Repo.transaction(fn ->
  user = Repo.insert!(user_changeset)
  log = Repo.insert!(audit_log_changeset)
  {user, log}
end)
# → {:ok, {user, log}} | {:error, reason}

# With multi (preferred for complex tx)
Ecto.Multi.new()
|> Ecto.Multi.insert(:user, user_changeset)
|> Ecto.Multi.insert(:profile, fn %{user: user} -> Profile.changeset(%Profile{}, %{user_id: user.id}) end)
|> Repo.transaction()
# → {:ok, %{user: ..., profile: ...}} | {:error, failed_op, failed_changeset, changes_so_far}
```

`Ecto.Multi` composes multiple operations with shared rollback semantics.

## Migrations

```bash
mix ecto.gen.migration create_posts
```

```elixir
defmodule MyApp.Repo.Migrations.CreatePosts do
  use Ecto.Migration

  def change do
    create table(:posts) do
      add :title, :string, null: false
      add :body, :text
      add :user_id, references(:users, on_delete: :delete_all), null: false
      timestamps()
    end

    create index(:posts, [:user_id])
    create unique_index(:posts, [:slug])
  end
end
```

```bash
mix ecto.migrate
mix ecto.rollback
mix ecto.reset           # drop + create + migrate + seed
```

**Use `change/0` for reversible migrations.** Use `up/0` + `down/0` for data migrations or operations Ecto can't auto-reverse.

## Soft Deletes / Timestamps

Ecto doesn't have soft-delete built in — use a `deleted_at` field + a query default. Libraries like `paper_trail` or `phoenix_swoosh_delete` can help.

## Best Practices

- **Repo at the boundary** — only contexts call `Repo.*`, never controllers/LiveViews
- One changeset per use case (register vs profile edit vs admin edit) — don't reuse `changeset/2` for everything
- `unique_constraint` + DB unique index — both required for race-safe uniqueness
- Always `preload` — never iterate associations without it
- `Ecto.Multi` for multi-step transactions — cleaner than nested function calls
- Use **named indexes** in migrations for clarity in error messages

## Performance Tips

- `select: %{...}` to fetch only needed fields — avoid full struct load when you only need a count
- `Repo.stream/2` for batch processing — doesn't load full result in memory
- `Repo.aggregate(query, :count, :id)` instead of `Repo.all(query) |> length()`
- `prepare: :unnamed` for one-off queries (skips prepared statement cache)
- Connection pool: tune `pool_size` based on concurrent request load

## Common Pitfalls

- Mutating a schema struct directly → no DB update; must go through changeset + `Repo.update`
- Forgetting `unique_constraint` after creating DB unique index → ugly raw error instead of changeset error
- N+1: accessing assoc field without preload → `Ecto.Association.NotLoaded` error
- Using `Repo.insert(%User{...})` without changeset → bypasses validation
- Schema field type mismatch with DB column → cryptic errors at insert time
- Forgetting `on_delete: :delete_all` / `:nilify_all` on `references/2` → migration succeeds but orphans on delete

## Resources

- Docs: https://hexdocs.pm/ecto
- Ecto SQL: https://hexdocs.pm/ecto_sql
- "Programming Ecto" book (Pragmatic Bookshelf)
