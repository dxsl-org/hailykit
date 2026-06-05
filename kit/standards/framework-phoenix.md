# Phoenix Standards

Detected via `:phoenix` in `mix.exs` deps.

## When to Use

- Elixir-based web framework, the default for any Elixir webapp
- Built-in WebSocket support via Channels (scales to millions of connections)
- LiveView for realtime UI without writing JS
- High-concurrency APIs (BEAM scheduler handles 100k+ connections per node)

## Project Structure

```
my_app/
├── lib/
│   ├── my_app/                   # Business logic (contexts)
│   │   ├── accounts.ex            # "Accounts" context
│   │   ├── accounts/
│   │   │   └── user.ex            # Schema
│   │   └── application.ex         # OTP supervision tree
│   ├── my_app_web/                # Web layer
│   │   ├── controllers/
│   │   ├── live/                  # LiveView modules
│   │   ├── components/            # Function components
│   │   ├── router.ex
│   │   ├── endpoint.ex
│   │   └── telemetry.ex
│   ├── my_app.ex                  # Business public API
│   └── my_app_web.ex              # Web public API (use macros)
├── priv/repo/migrations/           # Ecto migrations
├── assets/                         # JS/CSS (esbuild + Tailwind)
├── test/
├── config/
└── mix.exs
```

**Phoenix separates web from business logic.** `lib/my_app/` is your domain; `lib/my_app_web/` is the HTTP/WebSocket layer.

## Contexts (Business Logic Boundaries)

Group related domain logic into **contexts** — public modules that hide internal schemas:

```elixir
defmodule MyApp.Accounts do
  alias MyApp.Accounts.User
  alias MyApp.Repo

  def get_user!(id), do: Repo.get!(User, id)

  def create_user(attrs) do
    %User{}
    |> User.changeset(attrs)
    |> Repo.insert()
  end
end
```

Controllers + LiveViews call contexts, NEVER `Repo` directly. This boundary is critical for testability.

## Router

```elixir
defmodule MyAppWeb.Router do
  use MyAppWeb, :router

  pipeline :browser do
    plug :accepts, ["html"]
    plug :fetch_session
    plug :fetch_live_flash
    plug :put_root_layout, html: {MyAppWeb.Layouts, :root}
    plug :protect_from_forgery
    plug :put_secure_browser_headers
  end

  pipeline :api do
    plug :accepts, ["json"]
  end

  scope "/", MyAppWeb do
    pipe_through :browser
    live "/", PageLive
    live "/posts/:id", PostLive
  end

  scope "/api", MyAppWeb do
    pipe_through :api
    resources "/users", UserController, only: [:index, :create]
  end
end
```

## Controllers

```elixir
defmodule MyAppWeb.UserController do
  use MyAppWeb, :controller
  alias MyApp.Accounts

  def index(conn, _params) do
    users = Accounts.list_users()
    json(conn, users)
  end

  def create(conn, %{"user" => user_params}) do
    case Accounts.create_user(user_params) do
      {:ok, user} -> conn |> put_status(:created) |> json(user)
      {:error, changeset} -> conn |> put_status(:unprocessable_entity) |> json(%{errors: changeset.errors})
    end
  end
end
```

## LiveView (Realtime UI)

```elixir
defmodule MyAppWeb.CounterLive do
  use MyAppWeb, :live_view

  def mount(_params, _session, socket) do
    {:ok, assign(socket, count: 0)}
  end

  def handle_event("inc", _, socket) do
    {:noreply, update(socket, :count, &(&1 + 1))}
  end

  def render(assigns) do
    ~H"""
    <div>
      Count: <%= @count %>
      <button phx-click="inc">+</button>
    </div>
    """
  end
end
```

Server-rendered, WebSocket-connected, updates DOM via efficient diffs. No JS to write.

See `framework-liveview.md` for deeper patterns.

## Channels (WebSocket Pub/Sub)

For chat, presence, multi-user features outside LiveView:

```elixir
defmodule MyAppWeb.RoomChannel do
  use MyAppWeb, :channel

  def join("room:" <> room_id, _payload, socket) do
    {:ok, assign(socket, :room_id, room_id)}
  end

  def handle_in("new_msg", %{"body" => body}, socket) do
    broadcast!(socket, "new_msg", %{body: body})
    {:reply, :ok, socket}
  end
end
```

Scales horizontally via PubSub adapter (PG2 in cluster, Redis for multi-node-no-cluster).

## PubSub

```elixir
# Subscribe
Phoenix.PubSub.subscribe(MyApp.PubSub, "user:#{user_id}")

# Broadcast
Phoenix.PubSub.broadcast(MyApp.PubSub, "user:#{user_id}", {:new_msg, msg})

# Receive in GenServer / LiveView
def handle_info({:new_msg, msg}, socket), do: {:noreply, push_event(socket, "msg", msg)}
```

## Authentication

`mix phx.gen.auth` generates a complete email/password auth flow (registration, login, password reset, email confirmation). Battle-tested — use it instead of rolling your own.

For OAuth: `ueberauth` + provider-specific strategies.

## Tasks & Background Jobs

- **Oban** — Postgres-backed job queue, the standard. See `framework-oban.md`.
- **Task.Supervisor** — for fire-and-forget async work
- **GenServer** — for stateful workers

## Best Practices

- Contexts as the public API; never call `Repo` from controllers/LiveViews
- Pattern match in function heads — let it crash, then handle in supervisor
- `with` statements for happy-path chains: `with {:ok, x} <- step1(), {:ok, y} <- step2(x), do: ...`
- Pipelines (`|>`) over deeply nested calls
- `mix phx.gen.context`, `mix phx.gen.live`, `mix phx.gen.json` — use generators for consistency
- Compile-time config (`config/`) for env-specific values; `runtime.exs` for secrets

## Telemetry

Phoenix emits telemetry events out of the box. Wire them to Prometheus / DataDog:

```elixir
# lib/my_app_web/telemetry.ex
def metrics do
  [
    summary("phoenix.endpoint.start.system_time", unit: {:native, :millisecond}),
    summary("phoenix.router_dispatch.stop.duration", tags: [:route]),
    summary("ecto.query.total_time", unit: {:native, :millisecond}),
  ]
end
```

## Common Pitfalls

- Calling `Repo` from controllers — breaks context boundary, hurts testability
- Using `try/rescue` for control flow — prefer `case`/`with`/`{:ok, _}`/`{:error, _}` tuples
- Forgetting to start your supervisor's child in `application.ex`
- Storing large state in LiveView socket → memory blows up at scale
- Broadcasting to PubSub topic with too-broad scope (e.g. `"posts"` instead of `"posts:#{user_id}"`)
- Missing CSRF token on non-API forms

## Resources

- Docs: https://hexdocs.pm/phoenix
- LiveView: https://hexdocs.pm/phoenix_live_view
- Programming Phoenix LiveView (book) by Bruce + Sophie Tate
- Phoenix Forum: https://elixirforum.com/c/elixir-framework-forums/phoenix-forum
