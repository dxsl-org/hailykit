# Absinthe Standards

Detected via `:absinthe` in `mix.exs` — auto-injected as **extra**.

## What Absinthe Is

Absinthe is the production-grade GraphQL toolkit for Elixir — schema definition, query execution, subscriptions over Phoenix Channels, dataloader for N+1 prevention.

## When to Use

- API surface needs GraphQL (frontend wants flexible queries, mobile bandwidth concerns)
- Multiple client types consuming same API (web, mobile, admin)
- Real-time subscriptions with Phoenix Channels integration
- Type-safe schema with introspection

## Setup

```elixir
# mix.exs
{:absinthe, "~> 1.7"},
{:absinthe_plug, "~> 1.5"},
{:absinthe_phoenix, "~> 2.0"},      # For subscriptions
{:dataloader, "~> 2.0"},            # For batched assoc loading
```

## Schema

```elixir
defmodule MyAppWeb.Schema do
  use Absinthe.Schema

  import_types MyAppWeb.Schema.AccountTypes
  import_types MyAppWeb.Schema.BlogTypes

  query do
    import_fields :account_queries
    import_fields :blog_queries
  end

  mutation do
    import_fields :account_mutations
  end

  subscription do
    field :post_added, :post do
      config fn _args, _info -> {:ok, topic: "posts"} end
    end
  end
end
```

## Type Modules

```elixir
defmodule MyAppWeb.Schema.BlogTypes do
  use Absinthe.Schema.Notation

  object :post do
    field :id, non_null(:id)
    field :title, non_null(:string)
    field :body, :string
    field :author, :user, resolve: dataloader(MyApp.Accounts)
    field :comments, list_of(:comment), resolve: dataloader(MyApp.Blog)
  end

  object :blog_queries do
    field :posts, list_of(:post) do
      arg :limit, :integer, default_value: 10
      resolve &MyAppWeb.Resolvers.Blog.list_posts/3
    end

    field :post, :post do
      arg :id, non_null(:id)
      resolve &MyAppWeb.Resolvers.Blog.get_post/3
    end
  end
end
```

## Resolvers

```elixir
defmodule MyAppWeb.Resolvers.Blog do
  alias MyApp.Blog

  def list_posts(_parent, %{limit: limit}, _resolution) do
    {:ok, Blog.list_posts(limit: limit)}
  end

  def get_post(_parent, %{id: id}, _resolution) do
    case Blog.get_post(id) do
      nil -> {:error, "Post not found"}
      post -> {:ok, post}
    end
  end
end
```

Return `{:ok, value}` or `{:error, reason}`. Errors propagate to the GraphQL response.

## Dataloader (N+1 Prevention)

```elixir
defmodule MyAppWeb.Schema do
  use Absinthe.Schema

  def context(ctx) do
    loader =
      Dataloader.new()
      |> Dataloader.add_source(MyApp.Blog, MyApp.Blog.data())
      |> Dataloader.add_source(MyApp.Accounts, MyApp.Accounts.data())

    Map.put(ctx, :loader, loader)
  end

  def plugins, do: [Absinthe.Middleware.Dataloader] ++ Absinthe.Plugin.defaults()
end

# In context:
defmodule MyApp.Blog do
  def data, do: Dataloader.Ecto.new(MyApp.Repo, query: &query/2)
  def query(queryable, _params), do: queryable
end
```

Now `resolve: dataloader(MyApp.Blog)` batches all `posts -> comments` lookups into a single query. **Critical for performance.**

## Router

```elixir
# router.ex
scope "/api" do
  pipe_through :api

  forward "/graphql", Absinthe.Plug, schema: MyAppWeb.Schema
  forward "/graphiql", Absinthe.Plug.GraphiQL, schema: MyAppWeb.Schema, interface: :playground
end
```

GraphiQL gives you a local IDE for exploring the schema at `/graphiql` in dev.

## Subscriptions

```elixir
# endpoint.ex
use Absinthe.Phoenix.Endpoint

# socket.ex
defmodule MyAppWeb.UserSocket do
  use Phoenix.Socket
  use Absinthe.Phoenix.Socket, schema: MyAppWeb.Schema
end
```

Publish from resolver after mutation:
```elixir
def create_post(_, args, _) do
  case Blog.create_post(args) do
    {:ok, post} ->
      Absinthe.Subscription.publish(MyAppWeb.Endpoint, post, post_added: "posts")
      {:ok, post}
    error -> error
  end
end
```

Client subscribes via WebSocket — Apollo, urql, etc.

## Authentication / Context

```elixir
# Plug in router pipeline
plug MyAppWeb.Plugs.Context

# context.ex
def call(conn, _) do
  context = build_context(conn)
  Absinthe.Plug.put_options(conn, context: context)
end

defp build_context(conn) do
  case get_user_from_token(conn) do
    {:ok, user} -> %{current_user: user}
    _ -> %{}
  end
end

# In resolver
def list_my_posts(_, _, %{context: %{current_user: user}}) do
  {:ok, Blog.list_posts_by_user(user.id)}
end
def list_my_posts(_, _, _), do: {:error, "Unauthorized"}
```

## Authorization (Field-level)

Middleware for permission checks:
```elixir
defmodule MyAppWeb.Middleware.RequireAuth do
  @behaviour Absinthe.Middleware

  def call(%{context: %{current_user: _}} = resolution, _), do: resolution
  def call(resolution, _) do
    Absinthe.Resolution.put_result(resolution, {:error, "Unauthorized"})
  end
end

# Apply to a field
field :secret, :string do
  middleware MyAppWeb.Middleware.RequireAuth
  resolve fn _, _, _ -> {:ok, "secret data"} end
end
```

## Best Practices

- **Always use Dataloader** for ecto associations — N+1 will kill perf otherwise
- One type module per domain context — mirror your business logic layout
- Resolvers should call **context functions**, not `Repo` directly
- Return `{:error, ...}` from resolvers, don't raise
- Use `non_null(...)` aggressively in schema — saves null-checks in clients
- Pagination: use connection pattern (`Absinthe.Relay.Connection`) for cursor-based
- Schema versioning: add fields, deprecate old ones with `deprecate "Use newField"`

## Common Pitfalls

- Resolving associations without dataloader → catastrophic N+1
- Putting business logic in resolvers — extract to contexts
- Returning Ecto changesets directly to GraphQL response → cryptic errors
- Exposing internal IDs that should be UUIDs for security
- No query complexity / depth limits → DoS via deeply nested queries (`max_complexity`, `max_depth`)
- Forgetting CSRF protection on GraphQL endpoint when used from cookies/sessions

## Resources

- Docs: https://hexdocs.pm/absinthe
- Plug: https://hexdocs.pm/absinthe_plug
- Phoenix integration: https://hexdocs.pm/absinthe_phoenix
- Dataloader: https://hexdocs.pm/dataloader
