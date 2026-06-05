# Erlang Standards

## Comments

### EDoc (exported functions)
```erlang
%% @doc Why this function exists + non-obvious contract.
%% Returns {ok, User} or {error, not_found}.
%% @spec get_user(UserId :: binary()) -> {ok, user()} | {error, atom()}
get_user(UserId) ->
```

- Module-level: `-module(name).` always first, then `-export([]).`
- `%% @doc` for exported functions, `%` for inline implementation notes
- `-type` and `-spec` declarations improve Dialyzer coverage

## Key Idioms

### Error Handling — Tagged Tuples
```erlang
%% Always return tagged tuples from fallible operations
{ok, User} = fetch_user(Id),
{error, not_found} = fetch_user(BadId),

%% Pattern match in function head for branching
handle_result({ok, Value}) -> process(Value);
handle_result({error, Reason}) -> log_error(Reason).
```

### Pattern Matching in Function Heads
Prefer multiple clauses over `if`/`case` for dispatch:
```erlang
handle(create, Params) -> create_record(Params);
handle(update, Params) -> update_record(Params);
handle(_, _)           -> {error, unknown_action}.
```

### Process Communication
```erlang
%% Send message
Pid ! {self(), request, Payload},

%% Receive with timeout
receive
  {Pid, reply, Result} -> Result
after 5000 ->
  {error, timeout}
end.
```

### OTP gen_server
```erlang
-behaviour(gen_server).

%% Required callbacks
init(Args)                              -> {ok, State}.
handle_call(Request, From, State)       -> {reply, Reply, NewState}.
handle_cast(Msg, State)                 -> {noreply, NewState}.
handle_info(Info, State)                -> {noreply, NewState}.
terminate(Reason, State)                -> ok.
```

### Supervision
```erlang
%% In supervisor init/1
ChildSpec = #{
  id       => my_worker,
  start    => {my_worker, start_link, [Args]},
  restart  => permanent,
  type     => worker
},
{ok, {#{strategy => one_for_one}, [ChildSpec]}}.
```

## Naming
- Modules: `snake_case` (matches file name)
- Functions/variables: `snake_case`
- Variables: `PascalCase` (Erlang convention — `UserId`, `Result`)
- Atoms: `snake_case` (`ok`, `error`, `not_found`)
- Macros: `ALL_CAPS` or `?MACRO_NAME`
