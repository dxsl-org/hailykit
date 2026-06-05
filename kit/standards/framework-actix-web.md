# Actix-web Standards

Detected via `actix-web` in `Cargo.toml` `[dependencies]`.

## What Actix-web Is

Actix-web is one of the oldest, fastest Rust web frameworks — consistently top of TechEmpower benchmarks. Actor-model influenced, mature, large library of community middleware.

## When to Use

- Performance-critical APIs (raw throughput matters)
- Existing Actix codebase
- Need actor model for stateful workers within the web server

For new projects, **Axum is often the better default** — simpler API, Tokio-team backed, better ecosystem alignment. Pick Actix when you have a specific perf reason.

## Setup

```toml
[dependencies]
actix-web = "4"
tokio = { version = "1", features = ["full"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
```

## Hello World

```rust
use actix_web::{web, App, HttpServer, HttpResponse, Responder};

async fn hello() -> impl Responder {
    HttpResponse::Ok().body("Hello, World!")
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    HttpServer::new(|| {
        App::new()
            .route("/", web::get().to(hello))
            .route("/health", web::get().to(|| async { HttpResponse::Ok().body("OK") }))
    })
    .bind("0.0.0.0:3000")?
    .run()
    .await
}
```

## Handlers + Extractors

```rust
use actix_web::{web, HttpResponse, Result};
use serde::{Deserialize, Serialize};

#[derive(Deserialize)]
struct CreateUser { name: String, email: String }

#[derive(Serialize)]
struct User { id: u64, name: String, email: String }

async fn create_user(
    state: web::Data<AppState>,
    body: web::Json<CreateUser>,
) -> Result<HttpResponse> {
    let user = state.repo.insert(body.into_inner()).await
        .map_err(actix_web::error::ErrorInternalServerError)?;
    Ok(HttpResponse::Created().json(user))
}

async fn get_user(
    state: web::Data<AppState>,
    path: web::Path<u64>,
) -> Result<HttpResponse> {
    let id = path.into_inner();
    let user = state.repo.find(id).await
        .map_err(actix_web::error::ErrorInternalServerError)?
        .ok_or_else(|| actix_web::error::ErrorNotFound("User not found"))?;
    Ok(HttpResponse::Ok().json(user))
}
```

Extractors: `web::Path`, `web::Query`, `web::Json`, `web::Form`, `web::Data` (shared state), `HttpRequest`.

## App State

```rust
#[derive(Clone)]
struct AppState {
    pool: PgPool,
    config: Arc<Config>,
}

let state = web::Data::new(AppState { pool, config: Arc::new(config) });

HttpServer::new(move || {
    App::new()
        .app_data(state.clone())
        .route("/users", web::post().to(create_user))
})
```

`web::Data<T>` is `Arc`-wrapped — cheap to clone, shared safely across workers.

## Error Handling

```rust
use actix_web::{ResponseError, HttpResponse};
use std::fmt;

#[derive(Debug)]
enum AppError {
    NotFound,
    Database(sqlx::Error),
    Validation(String),
}

impl fmt::Display for AppError {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result { write!(f, "{:?}", self) }
}

impl ResponseError for AppError {
    fn error_response(&self) -> HttpResponse {
        match self {
            AppError::NotFound => HttpResponse::NotFound().json(serde_json::json!({"error": "Not found"})),
            AppError::Database(_) => HttpResponse::InternalServerError().json(serde_json::json!({"error": "DB error"})),
            AppError::Validation(m) => HttpResponse::BadRequest().json(serde_json::json!({"error": m})),
        }
    }
}

impl From<sqlx::Error> for AppError {
    fn from(e: sqlx::Error) -> Self { AppError::Database(e) }
}
```

Handlers can return `Result<HttpResponse, AppError>` — `?` works.

## Middleware

```rust
use actix_web::middleware::{Logger, Compress, NormalizePath};

App::new()
    .wrap(Logger::default())
    .wrap(Compress::default())
    .wrap(NormalizePath::trim())
    .route("/", web::get().to(handler))
```

Custom middleware:
```rust
use actix_web::{dev::{forward_ready, Service, ServiceRequest, ServiceResponse, Transform}, Error};
use futures_util::future::LocalBoxFuture;

pub struct Auth;

impl<S, B> Transform<S, ServiceRequest> for Auth
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    B: 'static,
{
    type Response = ServiceResponse<B>;
    type Error = Error;
    type Transform = AuthMiddleware<S>;
    type InitError = ();
    type Future = futures_util::future::Ready<Result<Self::Transform, Self::InitError>>;

    fn new_transform(&self, service: S) -> Self::Future {
        futures_util::future::ready(Ok(AuthMiddleware { service }))
    }
}
// ... AuthMiddleware impl
```

Middleware boilerplate is heavier than Axum — there are macro crates (`actix-web-middleware`) for common patterns.

## Scopes (Route Grouping)

```rust
App::new()
    .service(
        web::scope("/api/v1")
            .route("/users", web::get().to(list_users))
            .route("/users", web::post().to(create_user))
            .route("/users/{id}", web::get().to(get_user))
    )
    .service(web::scope("/admin").wrap(AdminAuth).route("/stats", web::get().to(stats)))
```

## WebSockets via Actix Actor

Actix-web's WebSocket is built on the Actix actor system:

```rust
use actix::{Actor, StreamHandler};
use actix_web_actors::ws;

struct ChatSession;
impl Actor for ChatSession { type Context = ws::WebsocketContext<Self>; }

impl StreamHandler<Result<ws::Message, ws::ProtocolError>> for ChatSession {
    fn handle(&mut self, msg: Result<ws::Message, ws::ProtocolError>, ctx: &mut Self::Context) {
        match msg {
            Ok(ws::Message::Text(text)) => ctx.text(format!("echo: {}", text)),
            _ => {}
        }
    }
}

async fn ws_index(req: HttpRequest, stream: web::Payload) -> Result<HttpResponse, Error> {
    ws::start(ChatSession {}, &req, stream)
}
```

## Testing

```rust
use actix_web::{test, App};

#[actix_web::test]
async fn test_health() {
    let app = test::init_service(App::new().route("/health", web::get().to(|| async { "OK" }))).await;
    let req = test::TestRequest::get().uri("/health").to_request();
    let resp = test::call_service(&app, req).await;
    assert!(resp.status().is_success());
}
```

## Best Practices

- Use `web::Data<T>` for shared state — it's `Arc`-wrapped
- Implement `ResponseError` for custom errors — `?` propagation in handlers
- Use scopes to group related routes + apply group-level middleware
- Configure workers: `HttpServer::new(...).workers(N)` (default = CPU count)
- Bind explicit address; for `0.0.0.0` in production behind a reverse proxy
- Compress responses with `Compress` middleware — saves bandwidth, minimal CPU cost

## Common Pitfalls

- Blocking work in handlers → use `web::block` to offload to thread pool
- Heavy state cloned every request (instead of `web::Data<T>`) → perf cliff
- Forgetting `move` on closure when capturing `state` → compile error
- Mixing `actix::Actor` patterns with non-actor handlers — pick one paradigm per app
- Old `actix-web` 3.x docs — make sure you're reading v4 docs
- Returning string responses when JSON is expected — use `HttpResponse::Ok().json(...)`

## Resources

- Docs: https://actix.rs
- API: https://docs.rs/actix-web
- Examples: https://github.com/actix/examples
