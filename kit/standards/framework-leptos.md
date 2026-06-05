# Leptos Standards

Detected via `leptos` in `Cargo.toml` `[dependencies]`.

## What Leptos Is

Leptos is a Rust full-stack web framework — fine-grained reactivity (like SolidJS), compiled to WASM for the client, with optional SSR + isomorphic server functions.

## When to Use

- Want Rust on both client + server (single language, end-to-end types)
- Like SolidJS / signals-based reactivity but want Rust safety
- Need fast cold starts (WASM bundles smaller than React equivalents)
- Building SPAs or full-stack apps with server functions

Pair with Axum or Actix for backend hosting.

## Setup

```bash
cargo install cargo-leptos
cargo leptos new --git leptos-rs/start-axum
cd <project>
cargo leptos watch
```

`cargo-leptos` handles WASM building + asset bundling + dev server with hot reload.

## Basic Component

```rust
use leptos::prelude::*;

#[component]
fn Counter(initial: i32) -> impl IntoView {
    let (count, set_count) = signal(initial);

    view! {
        <button on:click=move |_| set_count.update(|c| *c += 1)>
            "Count: " {count}
        </button>
    }
}

#[component]
fn App() -> impl IntoView {
    view! {
        <h1>"Leptos App"</h1>
        <Counter initial=0 />
    }
}
```

`signal()` creates reactive state; `view!` is the JSX-like macro for templates.

## Signals (Reactivity Primitives)

```rust
let (count, set_count) = signal(0);                    // reactive value
let doubled = Memo::new(move |_| count.get() * 2);     // derived (memoized)

Effect::new(move |_| {                                  // side effect
    leptos::logging::log!("count changed to {}", count.get());
});

// In view
view! {
    <p>"Count: " {count}</p>
    <p>"Doubled: " {doubled}</p>
    <button on:click=move |_| set_count.update(|c| *c += 1)>"+"</button>
}
```

`.get()` reads (subscribes), `.set()` overwrites, `.update(|v| ...)` mutates in place.

## RwSignal (Read + Write Combined)

```rust
let count = RwSignal::new(0);
count.set(5);
count.update(|c| *c += 1);
let value = count.get();
```

Useful when passing as a single prop instead of `(read, write)` tuple.

## Server Functions (Isomorphic)

```rust
use server_fn::ServerFnError;

#[server(GetUser, "/api")]
pub async fn get_user(id: u64) -> Result<User, ServerFnError> {
    // Runs on server only — DB access OK
    let pool = use_context::<PgPool>().ok_or(ServerFnError::ServerError("no pool".into()))?;
    let user = sqlx::query_as!(User, "SELECT * FROM users WHERE id = $1", id as i64)
        .fetch_one(&pool).await?;
    Ok(user)
}

// Client: call like a normal function — Leptos generates an HTTP endpoint
let user = get_user(123).await?;
```

Server fns compile out of the client WASM bundle. The client gets a thin RPC stub. Body is JSON-serialized via Serde.

## Resources (Async Data)

```rust
let user_id = signal(1);
let user_resource = Resource::new(
    move || user_id.0.get(),
    |id| async move { get_user(id).await }
);

view! {
    <Suspense fallback=move || view! { <p>"Loading..."</p> }>
        {move || user_resource.get().map(|result|
            result.map(|user| view! { <p>{user.name}</p> })
        )}
    </Suspense>
}
```

`Resource` ties async work to reactive deps — refetches when source signal changes.

## Routing

```rust
use leptos_router::components::{Router, Routes, Route};
use leptos_router::path;

#[component]
fn App() -> impl IntoView {
    view! {
        <Router>
            <Routes fallback=|| view! { <p>"Not found"</p> }>
                <Route path=path!("/") view=Home />
                <Route path=path!("/users/:id") view=UserPage />
                <Route path=path!("/admin/*any") view=Admin />
            </Routes>
        </Router>
    }
}

#[component]
fn UserPage() -> impl IntoView {
    let params = leptos_router::hooks::use_params_map();
    let id = move || params.read().get("id").unwrap_or_default();
    view! { <p>"User ID: " {id}</p> }
}
```

## Forms with Server Actions

```rust
#[server(CreatePost, "/api")]
pub async fn create_post(title: String, body: String) -> Result<i64, ServerFnError> {
    let pool = use_context::<PgPool>().unwrap();
    let row = sqlx::query!(
        "INSERT INTO posts (title, body) VALUES ($1, $2) RETURNING id",
        title, body
    ).fetch_one(&pool).await?;
    Ok(row.id)
}

#[component]
fn NewPostForm() -> impl IntoView {
    let action = ServerAction::<CreatePost>::new();

    view! {
        <ActionForm action=action>
            <input type="text" name="title" />
            <textarea name="body" />
            <button>"Submit"</button>
        </ActionForm>
        {move || action.value().get().map(|res| match res {
            Ok(id) => view! { <p>"Created post " {id}</p> }.into_any(),
            Err(e) => view! { <p>"Error: " {e.to_string()}</p> }.into_any(),
        })}
    }
}
```

Forms work without JS — progressive enhancement.

## Context (Dependency Injection)

```rust
#[component]
fn App() -> impl IntoView {
    provide_context(AppConfig { api_url: "...".to_string() });
    view! { <Body /> }
}

#[component]
fn Body() -> impl IntoView {
    let config: AppConfig = use_context().expect("config");
    view! { <p>{config.api_url}</p> }
}
```

## SSR Setup

`Cargo.toml`:
```toml
[features]
hydrate = ["leptos/hydrate"]
ssr = ["leptos/ssr", "leptos_axum/ssr"]
```

```bash
cargo leptos build --release
# Outputs:
# - server binary (Axum + your fns)
# - client WASM bundle
# - hashed CSS / images in target/site/
```

Deploy as a normal Rust binary. Cloudflare Pages, Fly.io, Railway, AWS Lambda all work.

## Best Practices

- Use **signals + memos** sparingly — every signal is a reactive subscription point
- `move ||` closures for view expressions — captures owner context properly
- Server functions for ALL DB / external API calls — don't fetch from WASM directly
- Use `Resource` for async data tied to reactive deps — gets refetching for free
- `<Suspense>` for loading states — Leptos suspends rendering until resources resolve
- Profile WASM binary size — `wasm-opt` aggressively for production
- Use `cargo leptos serve --release` for prod-like local testing

## Common Pitfalls

- Forgetting `.get()` inside `move ||` closure → signal not subscribed
- Closing over signals without `move` → borrow checker errors
- Heavy work inside `view!` macro → re-runs on every reactive change
- Mixing isomorphic server fns + client-only code without `#[cfg(target_arch = "wasm32")]`
- Big WASM bundles → slow first paint; use `wasm-opt -Oz` + code splitting
- Server fn returning non-Serializable type → compile error

## Resources

- Docs: https://book.leptos.dev
- API: https://docs.rs/leptos
- Examples: https://github.com/leptos-rs/leptos/tree/main/examples
- Awesome Leptos: https://github.com/leptos-rs/awesome-leptos
