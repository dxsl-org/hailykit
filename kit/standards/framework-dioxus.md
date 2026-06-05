# Dioxus Standards

Detected via `dioxus` in `Cargo.toml` `[dependencies]`.

## What Dioxus Is

Dioxus is a cross-platform Rust UI framework — single codebase compiles to **web (WASM)**, **desktop (WebView)**, **mobile (iOS/Android)**, **TUI**, and **fullstack with SSR**. Virtual DOM, React-like component model.

## When to Use

- Cross-platform apps (one codebase, multiple targets)
- React/JSX-style ergonomics in Rust
- Desktop + web + mobile from the same code
- Don't need ultra-fine-grained reactivity (Leptos's strength)

Trade-off vs Leptos: Dioxus is React-like (VDOM diff); Leptos is SolidJS-like (signals). Dioxus has wider platform coverage; Leptos has potentially better runtime perf for highly reactive UIs.

## Setup

```bash
cargo install dioxus-cli
dx new <project>
# Choose: web, desktop, mobile, fullstack, etc.
cd <project>
dx serve
```

`dx` is the Dioxus CLI — handles WASM, hot reload, mobile bundling, native binaries.

## Basic Component

```rust
use dioxus::prelude::*;

fn App() -> Element {
    let mut count = use_signal(|| 0);

    rsx! {
        h1 { "Counter" }
        button {
            onclick: move |_| count += 1,
            "Count: {count}"
        }
    }
}

fn main() {
    launch(App);
}
```

`rsx!` is Dioxus's JSX equivalent — embedded DSL with full type checking.

## Signals (Reactive State)

```rust
let mut count = use_signal(|| 0);                  // Signal<i32>
let doubled = use_memo(move || count() * 2);       // Memo (derived)

// Read
let value = count();         // or count.read()

// Write
count.set(5);
count += 1;                  // operator overloaded
count.with_mut(|v| *v += 1); // closure-based mutation

// Effect
use_effect(move || {
    println!("count changed to {}", count());
});
```

`use_signal` returns `Signal<T>` — `Copy`, cheap to pass to children.

## Components with Props

```rust
#[component]
fn Greeting(name: String, #[props(default = "🌍".to_string())] emoji: String) -> Element {
    rsx! {
        h2 { "Hello, {name} {emoji}" }
    }
}

// Usage
rsx! {
    Greeting { name: "World".to_string() }
    Greeting { name: "Tokyo".to_string(), emoji: "🗾".to_string() }
}
```

`#[component]` macro generates the Props struct + Builder. Use `#[props(...)]` attributes for defaults, optional, etc.

## Event Handlers

```rust
rsx! {
    input {
        r#type: "text",
        value: "{text}",
        oninput: move |evt| text.set(evt.value()),
    }

    button {
        onclick: move |_| async move {        // async handler!
            let user = fetch_user().await.unwrap();
            user_state.set(Some(user));
        },
        "Load User"
    }
}
```

All handlers can be sync OR async — Dioxus schedules them appropriately.

## Resources (Async Data)

```rust
let user_id = use_signal(|| 1);
let user = use_resource(move || async move {
    fetch_user(user_id()).await
});

rsx! {
    match &*user.read_unchecked() {
        Some(Ok(user)) => rsx! { p { "{user.name}" } },
        Some(Err(e)) => rsx! { p { "Error: {e}" } },
        None => rsx! { p { "Loading..." } },
    }
}
```

`use_resource` ties async work to reactive deps. Refetches when `user_id` changes.

## Server Functions (Fullstack)

With the `fullstack` feature:

```rust
#[server(GetUser)]
async fn get_user(id: u64) -> Result<User, ServerFnError> {
    // Server-only: DB access
    let pool = extract::<axum::Extension<PgPool>, _>().await?.0;
    let user = sqlx::query_as!(User, "SELECT * FROM users WHERE id = $1", id as i64)
        .fetch_one(&pool).await?;
    Ok(user)
}

// Call from client component:
let user = get_user(123).await?;
```

Identical to Leptos's server functions — auto-generated RPC client + server route.

## Routing

```rust
use dioxus_router::prelude::*;

#[derive(Clone, Routable)]
enum Route {
    #[route("/")]
    Home {},
    #[route("/users/:id")]
    UserPage { id: u64 },
    #[route("/:..segments")]
    NotFound { segments: Vec<String> },
}

#[component]
fn App() -> Element {
    rsx! { Router::<Route> {} }
}

#[component]
fn UserPage(id: u64) -> Element {
    rsx! { p { "User: {id}" } }
}
```

`#[derive(Routable)]` generates URL parsing + nav helpers (`use_navigator`, `Link`).

## Global State

```rust
fn App() -> Element {
    use_context_provider(|| Signal::new(AppState::default()));
    rsx! { Body {} }
}

fn Body() -> Element {
    let state = use_context::<Signal<AppState>>();
    rsx! { p { "Logged in: {state.read().user.is_some()}" } }
}
```

Context = React-style DI. Pair with `Signal` for reactive global state.

## Platform Targets

```bash
# Web
dx serve --platform web

# Desktop (webview)
dx serve --platform desktop

# Mobile
dx serve --platform mobile-ios     # requires Xcode
dx serve --platform mobile-android  # requires Android SDK

# Fullstack (SSR + hydration)
dx serve --platform fullstack
```

Same Rust code; some features (DOM API access, file pickers, etc.) differ per platform — check `cfg(target_arch = ...)`.

## Native Resources (Desktop / Mobile)

```rust
use dioxus_desktop::{use_window, Config};

fn App() -> Element {
    let window = use_window();
    rsx! {
        button {
            onclick: move |_| window.set_title("Updated!"),
            "Update title"
        }
    }
}
```

Filesystem, OS dialogs, native menus via `tao`/`wry` crates (Dioxus uses them under the hood).

## Styling

Several options:
- **Inline**: `style: "color: red;"` (no scoping)
- **CSS file**: include via `head { link { rel: "stylesheet", href: "style.css" } }`
- **Tailwind**: ` dx-tailwind` integration; or run `tailwindcss --watch` separately
- **Dioxus-specific CSS-in-Rust libs**: `dioxus-style` (early stage)

## Best Practices

- Use `Signal<T>` for state — `Copy`, ergonomic with operators
- `use_memo` for derived values that depend on signals
- `use_resource` for async data — handles loading/error states
- `#[component]` macro for any reusable UI piece
- Server functions for ALL DB access in fullstack apps
- Profile WASM bundle size; use `wasm-opt -Oz` for production
- Test with `dx serve --release` before deploying — debug builds are much slower

## Common Pitfalls

- Forgetting to call signal (`count()` vs `count`) → printed `Signal { ... }` instead of value
- Heavy work inside component body (re-runs on every render) → memoize with `use_memo`
- `Cell` / `RefCell` for shared state → not reactive; use `Signal`
- Mixing async + sync rendering — keep handlers async-aware
- Cross-platform features (filesystem, dialogs) without `cfg` guards → compile errors on unsupported targets
- Mobile builds first time → Xcode / Android Studio config gotchas; allow time

## Resources

- Docs: https://dioxuslabs.com/learn
- API: https://docs.rs/dioxus
- Examples: https://github.com/DioxusLabs/dioxus/tree/main/examples
- Discord: https://discord.gg/XgGxMSkvUM
