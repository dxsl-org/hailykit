# Rust Standards

## Comments

### rustdoc (public items)
```rust
/// Why this function exists + non-obvious contract.
///
/// # Arguments
/// * `user_id` - Must be a valid UUID; panics in debug builds if malformed
///
/// # Returns
/// `None` when the user is soft-deleted; `Some(User)` otherwise
///
/// # Errors
/// Returns [`UserError::NotFound`] when userId doesn't exist in the store
///
/// # Panics
/// Panics if the database connection pool is exhausted (should never happen in production)
pub fn get_user(user_id: &str) -> Result<Option<User>, UserError>
```

- `///` for all public items (functions, structs, enums, traits, modules)
- `//!` at the top of `lib.rs` or `mod.rs` for crate/module-level documentation
- Include `# Errors`, `# Panics`, `# Safety` sections only when they apply — omit empty sections
- Private items: comment only when the intent is non-obvious

### SAFETY (MANDATORY for unsafe)
`// SAFETY:` comment is **required** immediately before every `unsafe` block.
Explain the invariant being upheld — the compiler cannot check this:
```rust
// SAFETY: ptr is non-null and properly aligned — guaranteed by the allocator contract in new()
let val = unsafe { *ptr };
```
No `unsafe` block without a `// SAFETY:` comment. Ever.

### Attribute Comments
```rust
#[allow(dead_code)] // reason: used by macro-generated impls not visible to rustc
#[allow(clippy::too_many_arguments)] // reason: mirrors the C FFI signature exactly
```
Always add inline reason for `#[allow(...)]` attributes.

### unwrap / expect
Prefer `expect` over `unwrap` with a message that states the invariant:
```rust
// States WHY this can never fail, not just what it is
let port = env::var("PORT").expect("PORT must be set in environment");
config.parse().expect("config was validated at startup — parse cannot fail here");
```

## Key Idioms

- Lifetime annotations: comment the semantic meaning when names alone (`'a`, `'b`) are ambiguous
- Prefer `thiserror` for library error types; `anyhow` for application-level error propagation
- `Arc<Mutex<T>>` — document the lock ordering when multiple mutexes exist (prevents deadlock)
- Prefer `?` over `unwrap` in fallible functions; reserve `unwrap` only for truly infallible cases with a comment
- Feature flags: document which features enable which code paths in the crate-level `//!` comment
