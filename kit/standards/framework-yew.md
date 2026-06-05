# Yew Standards

Detected via `yew` in `Cargo.toml` `[dependencies]`.

## What Yew Is

Yew is the **original** Rust frontend framework — React-like component model, virtual DOM, compiled to WASM. Older than Leptos/Dioxus, mature ecosystem, but slower momentum recently.

## When to Use

- Existing Yew codebase
- React mental model preferred
- Mature ecosystem matters (Yew has been stable longer)

For new projects: **Leptos** (fine-grained reactivity, faster) or **Dioxus** (multi-platform) are usually better picks. Use Yew when you need its specific ecosystem libs.

## Setup

```bash
cargo install trunk          # WASM bundler
cargo install --locked wasm-bindgen-cli
rustup target add wasm32-unknown-unknown
```

```toml
[dependencies]
yew = { version = "0.21", features = ["csr"] }
```

```html
<!-- index.html -->
<!DOCTYPE html>
<html>
<head><link data-trunk rel="rust" href="Cargo.toml" data-wasm-opt="z" /></head>
<body></body>
</html>
```

```bash
trunk serve
```

## Component (Functional)

```rust
use yew::prelude::*;

#[function_component]
fn App() -> Html {
    let counter = use_state(|| 0);
    let onclick = {
        let counter = counter.clone();
        move |_| counter.set(*counter + 1)
    };

    html! {
        <div>
            <h1>{ "Counter" }</h1>
            <button {onclick}>{ format!("Count: {}", *counter) }</button>
        </div>
    }
}

fn main() {
    yew::Renderer::<App>::new().render();
}
```

`html!` macro is JSX-like.

## Hooks

```rust
// State
let count = use_state(|| 0);
count.set(5);
let v = *count;

// Reducer
let counter = use_reducer(|| CounterState { count: 0 });
counter.dispatch(CounterAction::Increment);

// Effect
use_effect_with(deps, move |deps| {
    // Run when deps change
    || { /* cleanup */ }
});

// Memo
let doubled = use_memo(deps, |deps| deps.0 * 2);

// Context
let ctx = use_context::<MyContext>().unwrap();
```

Hooks must follow React's rules: top-level only, same order each render.

## Props

```rust
#[derive(Properties, PartialEq)]
struct GreetingProps {
    name: String,
    #[prop_or_default]
    emoji: String,
}

#[function_component]
fn Greeting(props: &GreetingProps) -> Html {
    html! {
        <p>{ format!("Hello, {} {}", props.name, props.emoji) }</p>
    }
}

// Usage
html! { <Greeting name="World" emoji="🌍" /> }
```

`PartialEq` required for props (used in reconciliation).

## Events

```rust
let oninput = Callback::from(|e: InputEvent| {
    let input: HtmlInputElement = e.target_unchecked_into();
    log::info!("value: {}", input.value());
});

html! { <input {oninput} /> }
```

Cast event targets via `target_unchecked_into::<HtmlInputElement>()` (web-sys types).

## Router

Use `yew-router`:

```rust
use yew_router::prelude::*;

#[derive(Clone, Routable, PartialEq)]
enum Route {
    #[at("/")]
    Home,
    #[at("/users/:id")]
    UserPage { id: u64 },
    #[not_found]
    #[at("/404")]
    NotFound,
}

fn switch(route: Route) -> Html {
    match route {
        Route::Home => html! { <h1>{ "Home" }</h1> },
        Route::UserPage { id } => html! { <p>{ format!("User {}", id) }</p> },
        Route::NotFound => html! { <h1>{ "404" }</h1> },
    }
}

#[function_component]
fn App() -> Html {
    html! {
        <BrowserRouter>
            <Switch<Route> render={switch} />
        </BrowserRouter>
    }
}
```

## Fetch + Async

Yew has no built-in fetch. Use `gloo-net` or `reqwest` (WASM target):

```rust
use gloo_net::http::Request;

let user = use_state(|| None);
{
    let user = user.clone();
    use_effect_with((), move |_| {
        wasm_bindgen_futures::spawn_local(async move {
            let fetched = Request::get("/api/me")
                .send().await.unwrap()
                .json::<User>().await.unwrap();
            user.set(Some(fetched));
        });
        || {}
    });
}
```

`spawn_local` is the WASM equivalent of `tokio::spawn`.

## SSR

Yew supports SSR via `yew::ServerRenderer`:

```rust
use yew::ServerRenderer;

let html = ServerRenderer::<App>::new().render().await;
```

Pair with Axum/Actix to serve the rendered HTML, then hydrate on the client. More setup than Leptos's batteries-included approach.

## Best Practices

- **Functional components + hooks** — class components are deprecated
- Use `use_state` for simple state, `use_reducer` for complex logic
- `Callback::from(...)` for event handlers — they're `Clone`able
- Provide `PartialEq` on props for proper reconciliation
- Memoize expensive computations with `use_memo`
- Use `Context` for global state — avoid prop-drilling
- Minimize re-renders by structuring components so prop changes affect smallest subtree

## Common Pitfalls

- Forgetting `clone()` before move into closure → borrow checker errors
- Heavy work in render → re-runs each frame; memoize with `use_memo`
- Mutating state outside hooks → no re-render
- WASM bundle size — use `wasm-opt -Oz` aggressively
- Routing without `BrowserRouter` wrapper → blank page
- Async fetch without `spawn_local` → "future not bound" errors

## Performance Tips

- `wasm-opt -Oz` for release builds — significant bundle size reduction
- Code-split via dynamic imports + `gloo-utils`
- Use `Cow<'static, str>` instead of `String` for static strings to avoid allocations
- Profile WASM with browser devtools "Performance" tab

## Resources

- Docs: https://yew.rs/docs/getting-started/introduction
- API: https://docs.rs/yew
- yew-router: https://docs.rs/yew-router
- gloo (utilities): https://gloo-rs.web.app
- Awesome Yew: https://github.com/jetli/awesome-yew
