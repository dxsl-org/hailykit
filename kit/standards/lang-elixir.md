# Elixir Standards

## Comments

### ExDoc (public functions)
```elixir
@doc """
Why this function exists + non-obvious contract.

## Parameters
  - user_id: must be a valid UUID string

## Examples
    iex> get_user("uuid")
    {:ok, %User{}}
    iex> get_user("bad")
    {:error, :not_found}
"""
@spec get_user(String.t()) :: {:ok, User.t()} | {:error, atom()}
def get_user(user_id) do
```

- `@moduledoc` required on every public module
- `@doc false` for functions intentionally hidden from docs
- `@spec` on all public functions — Dialyzer catches type errors at compile time

## Key Idioms

### Error Handling
Always use tagged tuples — never raise for expected failures:
```elixir
# Good
{:ok, user} = fetch_user(id)
{:error, :not_found} = fetch_user(bad_id)

# Chain with `with` for sequential ok/error paths
with {:ok, user} <- fetch_user(id),
     {:ok, token} <- generate_token(user) do
  {:ok, %{user: user, token: token}}
end
```

### Pipe Operator
Prefer pipes for data transformation chains:
```elixir
# Good
id
|> fetch_user()
|> Map.get(:name)
|> String.upcase()

# Avoid intermediate variables when pipe reads clearly
```

### Pattern Matching
Use function head matching over `if`/`cond` for dispatching:
```elixir
def handle(:create, params), do: ...
def handle(:update, params), do: ...
def handle(_, _), do: {:error, :unknown_action}
```

### GenServer
```elixir
defmodule MyWorker do
  use GenServer

  def start_link(opts), do: GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  def init(state), do: {:ok, state}

  # Client API — public functions call GenServer.call/cast
  def get_value, do: GenServer.call(__MODULE__, :get_value)

  # Server callbacks — handle_call for sync, handle_cast for async
  def handle_call(:get_value, _from, state), do: {:reply, state.value, state}
end
```

### Supervision
Use `Supervisor.child_spec/2` over manual child specs:
```elixir
children = [
  {MyWorker, arg},
  {Task.Supervisor, name: MyApp.TaskSupervisor}
]
Supervisor.start_link(children, strategy: :one_for_one)
```

## Naming
- Modules: `PascalCase`
- Functions/variables: `snake_case`
- Predicate functions: end with `?` (`valid?/1`, `admin?/1`)
- Bang functions: end with `!` — raise on error instead of `{:error, _}`
- Private functions: `defp`
