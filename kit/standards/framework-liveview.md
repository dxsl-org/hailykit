# Phoenix LiveView Standards

Detected via `:phoenix_live_view` in `mix.exs` — auto-injected as **extra** on top of Phoenix.

## When to Use

- Realtime UIs without writing JavaScript
- Server-rendered initial load + WebSocket updates after
- Forms with realtime validation
- Live dashboards, chat, notifications, collaborative editing
- Multi-user presence indicators

LiveView replaces 80% of typical SPA work. Hit-or-miss for: drag-drop heavy UIs, offline-first apps, complex client-side animations.

## Lifecycle

```elixir
defmodule MyAppWeb.PostLive do
  use MyAppWeb, :live_view

  # 1. mount/3 — HTTP request (initial render), then again over WebSocket
  def mount(%{"id" => id}, _session, socket) do
    if connected?(socket), do: PubSub.subscribe(MyApp.PubSub, "post:#{id}")
    {:ok, assign(socket, post: Posts.get!(id))}
  end

  # 2. handle_params/3 — runs when URL params change (e.g. live_patch)
  def handle_params(_params, _uri, socket), do: {:noreply, socket}

  # 3. render/1 — HEEx template
  def render(assigns) do
    ~H"""
    <h1>{@post.title}</h1>
    <button phx-click="like">❤ {@post.likes}</button>
    """
  end

  # 4. handle_event/3 — user interaction
  def handle_event("like", _params, socket) do
    post = Posts.increment_likes(socket.assigns.post)
    {:noreply, assign(socket, :post, post)}
  end

  # 5. handle_info/2 — PubSub / GenServer messages
  def handle_info({:updated, post}, socket), do: {:noreply, assign(socket, :post, post)}
end
```

**`mount` runs TWICE** for a LiveView: once during initial HTTP render, again when the WebSocket connects. Use `connected?(socket)` to guard side effects.

## HEEx Templates

```heex
<h1>{@title}</h1>

<.button phx-click="save">Save</.button>

<%= for item <- @items do %>
  <li>{item.name}</li>
<% end %>

<!-- Conditional -->
<%= if @user do %>
  <p>Hello {@user.name}</p>
<% end %>

<!-- For HTML attr that's a struct -->
<input value={@post.title} />
```

`{...}` is the modern HEEx interpolation (Phoenix 1.7+). `<%= ... %>` is legacy EEx, still works.

## Forms with Changesets

```elixir
def mount(_, _, socket) do
  {:ok, assign(socket, form: to_form(Posts.change_post(%Post{})))}
end

def handle_event("validate", %{"post" => params}, socket) do
  form =
    %Post{}
    |> Posts.change_post(params)
    |> Map.put(:action, :validate)
    |> to_form()
  {:noreply, assign(socket, form: form)}
end

def handle_event("save", %{"post" => params}, socket) do
  case Posts.create_post(params) do
    {:ok, _post} -> {:noreply, socket |> put_flash(:info, "Saved!") |> push_navigate(to: ~p"/posts")}
    {:error, changeset} -> {:noreply, assign(socket, form: to_form(changeset))}
  end
end

# Template
def render(assigns) do
  ~H"""
  <.form for={@form} phx-change="validate" phx-submit="save">
    <.input field={@form[:title]} label="Title" />
    <.input field={@form[:body]} type="textarea" label="Body" />
    <.button>Save</.button>
  </.form>
  """
end
```

`phx-change` fires on every keystroke (debounce: `phx-debounce="500"`). `phx-submit` on form submit.

## Streams (Large Collections)

For lists that grow over time (chat, feeds, tables), use **streams** — they don't keep the full list in socket memory:

```elixir
def mount(_, _, socket) do
  {:ok, stream(socket, :posts, Posts.list_posts())}
end

def handle_event("delete", %{"id" => id}, socket) do
  post = Posts.get!(id)
  Posts.delete_post(post)
  {:noreply, stream_delete(socket, :posts, post)}
end

# Template
~H"""
<div id="posts" phx-update="stream">
  <div :for={{id, post} <- @streams.posts} id={id}>
    {post.title}
    <button phx-click="delete" phx-value-id={post.id}>×</button>
  </div>
</div>
"""
```

Critical for memory: a 10k-item list as `assign` = 10k items in socket forever; as a stream = constant memory.

## Function Components

Reusable UI fragments:

```elixir
defmodule MyAppWeb.CoreComponents do
  use Phoenix.Component

  attr :title, :string, required: true
  attr :rest, :global

  slot :inner_block, required: true

  def card(assigns) do
    ~H"""
    <div class="card" {@rest}>
      <h2>{@title}</h2>
      {render_slot(@inner_block)}
    </div>
    """
  end
end

# Usage
<.card title="Hello">
  <p>Body content</p>
</.card>
```

## Live Components (Stateful Children)

When a child component needs its own state:

```elixir
defmodule MyAppWeb.LikeButtonComponent do
  use Phoenix.LiveComponent

  def mount(socket), do: {:ok, assign(socket, :pending, false)}

  def handle_event("like", _, socket) do
    send_update(self(), id: socket.assigns.id, pending: false)
    # ... handle async
    {:noreply, assign(socket, :pending, true)}
  end

  def render(assigns) do
    ~H"""
    <button phx-click="like" phx-target={@myself}>
      {if @pending, do: "...", else: "❤"}
    </button>
    """
  end
end

# Parent
<.live_component module={LikeButtonComponent} id="like-#{@post.id}" />
```

Note `phx-target={@myself}` — without it, the event goes to the parent LiveView.

## JS Hooks (When You Need Real JS)

For things LiveView can't do server-side: focus management, drag-drop, chart libraries, file picker.

```js
// assets/js/app.js
let Hooks = {};
Hooks.AutoFocus = {
  mounted() { this.el.focus(); }
};

let liveSocket = new LiveSocket("/live", Socket, { hooks: Hooks });
```

```heex
<input phx-hook="AutoFocus" id="my-input" />
```

Hooks need a unique `id` to work.

## Navigation

| Helper | Behavior |
|---|---|
| `push_navigate(socket, to: "/x")` | Full LiveView remount, URL changes |
| `push_patch(socket, to: "/x")` | Same LiveView, only `handle_params` re-runs |
| `<.link patch="/x">` | Client-side `push_patch` link |
| `<.link navigate="/x">` | Client-side `push_navigate` link |
| `<.link href="/x">` | Full page reload |

Use `patch` when the same LiveView handles multiple URLs (e.g. tabs). Use `navigate` when switching to a different LiveView.

## Best Practices

- `connected?(socket)` guard for side effects (PubSub subs, timers, expensive queries)
- **Streams** for lists with unbounded growth — never `assign(:items, big_list)`
- Function components for stateless reuse, LiveComponents only when state needed
- `to_form/1` + `phx-change` for realtime validation
- `push_event/3` for sending data to JS hooks
- Keep socket assigns small — they live for the connection duration

## Common Pitfalls

- Forgetting `connected?(socket)` → subscribes twice, expensive query runs in HTTP render
- Putting large data (10k+ items) in assigns → ballooning socket memory
- `phx-click="event"` without unique element ID inside `for` loop → click triggers wrong row
- Mutating struct in handle_event without `assign(socket, :key, new_val)` → no re-render
- Using `JS.push` JS commands when server event would be simpler
- Heavy work in `mount` → slow first paint; defer with `send(self(), :load)` + `handle_info`

## Resources

- Docs: https://hexdocs.pm/phoenix_live_view
- LiveView Cheatsheet: https://hexdocs.pm/phoenix_live_view/Phoenix.LiveView.html
- "Programming Phoenix LiveView" book (Pragmatic Bookshelf)
