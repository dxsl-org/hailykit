# Gleam Standards

## Comments

```gleam
/// Why this function exists + non-obvious contract.
/// Returns Error(Nil) when user_id doesn't exist in the store.
pub fn get_user(user_id: String) -> Result(User, Nil) {
```

- `///` for public functions and types (rendered by `gleam docs`)
- `//` for inline implementation notes
- Omit docs for private functions when name is self-documenting

## Key Idioms

### Error Handling — Result Type
```gleam
// Always use Result — never panic for expected failures
case get_user(id) {
  Ok(user) -> process(user)
  Error(reason) -> handle_error(reason)
}

// Chain with `use` for sequential Result/Option operations
use user <- result.try(get_user(id))
use token <- result.try(generate_token(user))
Ok(#(user, token))
```

### Pipe Operator
```gleam
id
|> get_user
|> result.map(fn(u) { u.name })
|> result.unwrap(or: "unknown")
```

### Pattern Matching
```gleam
case message {
  Create(params) -> create_record(params)
  Update(id, params) -> update_record(id, params)
  Delete(id) -> delete_record(id)
}
```

### Custom Types
Prefer custom types over generic tuples for domain modeling:
```gleam
pub type User {
  User(id: String, name: String, role: Role)
}

pub type Role {
  Admin
  Member
  Guest
}
```

### BEAM Interop
```gleam
@external(erlang, "erlang", "system_time")
pub fn system_time(unit: atom) -> Int
```

## Naming
- Modules: `snake_case` (matches file path)
- Functions/variables: `snake_case`
- Types/constructors: `PascalCase` (`User`, `Ok`, `Error`)
- Constants: `snake_case` (Gleam has no ALL_CAPS convention)
- Private: no `pub` keyword (default is private)

## Module System
```gleam
import gleam/list
import gleam/string
import myapp/users.{type User, get_user}  // selective import

// Qualified access preferred for clarity
list.map(items, transform)
string.uppercase(name)
```
