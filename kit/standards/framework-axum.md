# Axum Standards

Detected via `axum` in `Cargo.toml` `[dependencies]`.

## What Axum Is

Axum is the Tokio team's web framework — modern, ergonomic, built on `hyper` + `tower`. The de-facto default for new Rust web servers as of 2026.

## When to Use

- Modern Rust web APIs / HTTP services
- Need fine-grained type-safe routing + extractors
- Want to leverage the **Tower** ecosystem (middleware, tracing, retry, rate-limit)
- Async-first, no blocking surprises

## Setup

```toml
[dependencies]
axum = "0.7"
tokio = { version = "1", features = ["full"] }
tower = "0.5"
tower-http = { version = "0.6", features = ["trace", "cors", "compression-gzip"] }
tracing = "0.1"
tracing-subscriber = "0.3"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
```

## Hello World

```rust
use axum::{routing::get, Router};
use std::net::SocketAddr;

#[tokio::main]
async fn main() {
    let app = Router::new()
        .route("/", get(|| async { "Hello, World!" }))
        .route("/health", get(|| async { "OK" }));

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
```

## Handlers

```rust
use axum::{
    extract::{Path, Query, State, Json as JsonExtract},
    response::{Json, IntoResponse},
    http::StatusCode,
};
use serde::{Deserialize, Serialize};

#[derive(Deserialize)]
struct CreateUser { name: String, email: String }

#[derive(Serialize)]
struct User { id: u64, name: String, email: String }

async fn create_user(
    State(state): State<AppState>,
    JsonExtract(payload): JsonExtract<CreateUser>,
) -> Result<(StatusCode, Json<User>), AppError> {
    let user = state.repo.insert(payload).await?;
    Ok((StatusCode::CREATED, Json(user)))
}

async fn get_user(
    Path(id): Path<u64>,
    State(state): State<AppState>,
) -> Result<Json<User>, AppError> {
    let user = state.repo.find(id).await?.ok_or(AppError::NotFound)?;
    Ok(Json(user))
}
```

**Extractors are the magic** — `Path`, `Query`, `Json`, `State`, `Headers`, etc. all impl `FromRequestParts` / `FromRequest`.

## State

```rust
#[derive(Clone)]
struct AppState {
    pool: PgPool,
    config: Arc<Config>,
}

let state = AppState { pool, config: Arc::new(config) };

let app = Router::new()
    .route("/users", post(create_user))
    .with_state(state);
```

State must be `Clone` (typically wrap heavy resources in `Arc`). Available in handlers via `State(...)` extractor.

## Error Handling

```rust
use axum::{response::IntoResponse, http::StatusCode, Json};

enum AppError {
    NotFound,
    Database(sqlx::Error),
    Validation(String),
}

impl IntoResponse for AppError {
    fn into_response(self) -> axum::response::Response {
        let (status, msg) = match self {
            AppError::NotFound => (StatusCode::NOT_FOUND, "Not found".to_string()),
            AppError::Database(e) => {
                tracing::error!("db error: {:?}", e);
                (StatusCode::INTERNAL_SERVER_ERROR, "Internal error".to_string())
            }
            AppError::Validation(m) => (StatusCode::BAD_REQUEST, m),
        };
        (status, Json(serde_json::json!({ "error": msg }))).into_response()
    }
}

impl From<sqlx::Error> for AppError {
    fn from(e: sqlx::Error) -> Self { AppError::Database(e) }
}
```

Handlers return `Result<T, AppError>` — the `?` operator + `From` impls compose cleanly.

## Middleware (Tower)

```rust
use tower_http::{trace::TraceLayer, cors::CorsLayer, compression::CompressionLayer};
use tower::ServiceBuilder;

let app = Router::new()
    .route("/", get(handler))
    .layer(
        ServiceBuilder::new()
            .layer(TraceLayer::new_for_http())
            .layer(CompressionLayer::new())
            .layer(CorsLayer::permissive())
    );
```

`ServiceBuilder` is the recommended way to stack middleware — applies in the order written.

## Custom Middleware

```rust
use axum::{middleware::Next, extract::Request, response::Response};

async fn auth(mut req: Request, next: Next) -> Result<Response, StatusCode> {
    let token = req.headers().get("authorization")
        .and_then(|h| h.to_str().ok())
        .and_then(|h| h.strip_prefix("Bearer "));

    let user = verify_token(token).await.ok_or(StatusCode::UNAUTHORIZED)?;
    req.extensions_mut().insert(user);
    Ok(next.run(req).await)
}

let app = Router::new()
    .route("/me", get(me_handler))
    .layer(axum::middleware::from_fn(auth));
```

## Nested Routers

```rust
let api_v1 = Router::new()
    .route("/users", get(list_users).post(create_user))
    .route("/users/:id", get(get_user).delete(delete_user));

let app = Router::new()
    .nest("/api/v1", api_v1)
    .route("/health", get(health));
```

## WebSockets

```rust
use axum::extract::ws::{WebSocket, WebSocketUpgrade, Message};

async fn ws_handler(ws: WebSocketUpgrade) -> impl IntoResponse {
    ws.on_upgrade(handle_socket)
}

async fn handle_socket(mut socket: WebSocket) {
    while let Some(msg) = socket.recv().await {
        if let Ok(Message::Text(text)) = msg {
            socket.send(Message::Text(format!("echo: {}", text))).await.ok();
        }
    }
}
```

## Streaming Responses

```rust
use axum::body::Body;
use futures::stream;

async fn stream_handler() -> Body {
    let s = stream::iter(vec![Ok::<_, std::io::Error>(b"chunk 1".to_vec()), Ok(b"chunk 2".to_vec())]);
    Body::from_stream(s)
}
```

Server-sent events via `axum::response::sse::Sse`.

## Testing

```rust
use axum::body::Body;
use axum::http::Request;
use tower::ServiceExt;     // for `oneshot`

#[tokio::test]
async fn test_health() {
    let app = router();
    let response = app
        .oneshot(Request::builder().uri("/health").body(Body::empty()).unwrap())
        .await
        .unwrap();
    assert_eq!(response.status(), 200);
}
```

`.oneshot()` from Tower processes a single request without binding a socket — fast tests.

## Best Practices

- Wrap heavy state in `Arc` — `Clone` is cheap
- Use **extractors** instead of pulling from raw request — better errors, type-safe
- Implement `IntoResponse` for your error type — `?` propagation in handlers
- Layer middleware via `ServiceBuilder` — order matters (outer → inner)
- Use `tracing` + `tower-http::trace::TraceLayer` — get request logging for free
- `tokio::spawn` for fire-and-forget async work — don't block the handler
- Configure `tokio::main` with worker threads matching CPU: `#[tokio::main(flavor = "multi_thread", worker_threads = 8)]`

## Common Pitfalls

- Extractor order matters: `Body`-consuming extractors must be **last** (only one can consume)
- Forgetting `.with_state(state)` → compile error about missing State impl
- Returning `String` directly instead of `Json(...)` → wrong Content-Type
- Blocking work in handler (`std::fs::read`) → blocks Tokio thread; use `tokio::fs` or `spawn_blocking`
- Mismatched route patterns: `:id` vs `/:id` — Axum's syntax is `:id` (no slash prefix)
- Cloning expensive types in extractors instead of borrowing via `Arc`

## Resources

- Docs: https://docs.rs/axum
- Examples: https://github.com/tokio-rs/axum/tree/main/examples
- Tower-http: https://docs.rs/tower-http
- Tokio: https://tokio.rs
