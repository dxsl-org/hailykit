# Rocket Standards

Detected via `rocket` in `Cargo.toml` `[dependencies]`.

## What Rocket Is

Rocket is the most ergonomic Rust web framework — attribute-macro routing, type-safe everywhere, batteries included (forms, templates, sessions, cookies). Pre-1.0 history had a "nightly Rust only" stigma; modern Rocket (0.5+) works on stable.

## When to Use

- Want maximum ergonomics + minimal boilerplate (auto-derive routes, parameters, etc.)
- Type-safe form handling out of the box
- Templating (Tera / Handlebars) included
- Smaller team / project — DX wins over raw perf

For max throughput or middleware ecosystem → Axum or Actix. For ergonomic CRUD APIs → Rocket is hard to beat.

## Setup

```toml
[dependencies]
rocket = { version = "0.5", features = ["json"] }
serde = { version = "1", features = ["derive"] }
```

## Hello World

```rust
#[macro_use] extern crate rocket;

#[get("/")]
fn index() -> &'static str { "Hello, World!" }

#[get("/health")]
fn health() -> &'static str { "OK" }

#[launch]
fn rocket() -> _ {
    rocket::build()
        .mount("/", routes![index, health])
}
```

`#[launch]` macro generates the `main` — runs the Rocket instance.

## Routing

```rust
#[get("/users/<id>")]
fn get_user(id: u64) -> String { format!("User {}", id) }

#[get("/search?<q>&<limit>")]
fn search(q: &str, limit: Option<u32>) -> String {
    format!("Searching '{}' (limit={:?})", q, limit.unwrap_or(10))
}

#[post("/users", data = "<user>")]
fn create_user(user: Json<CreateUser>) -> Json<User> { /* ... */ }
```

Path params + query params + body data — all type-checked at compile time.

## JSON

```rust
use rocket::serde::{json::Json, Deserialize, Serialize};

#[derive(Deserialize)]
#[serde(crate = "rocket::serde")]
struct CreateUser { name: String, email: String }

#[derive(Serialize)]
#[serde(crate = "rocket::serde")]
struct User { id: u64, name: String, email: String }

#[post("/users", data = "<user>", format = "application/json")]
async fn create(user: Json<CreateUser>, state: &State<AppState>) -> Json<User> {
    let user = state.repo.insert(user.into_inner()).await.unwrap();
    Json(user)
}
```

## State

```rust
struct AppState {
    pool: PgPool,
}

#[launch]
fn rocket() -> _ {
    rocket::build()
        .manage(AppState { pool: create_pool() })
        .mount("/", routes![create])
}

#[get("/users/<id>")]
async fn get_user(id: u64, state: &State<AppState>) -> Option<Json<User>> {
    state.repo.find(id).await.ok().flatten().map(Json)
}
```

`&State<T>` extractor — `T` is whatever you passed to `.manage()`.

## Request Guards (Auth)

Custom guards = type-safe middleware:

```rust
use rocket::request::{FromRequest, Outcome, Request};

struct User { id: u64, role: String }

#[rocket::async_trait]
impl<'r> FromRequest<'r> for User {
    type Error = ();

    async fn from_request(req: &'r Request<'_>) -> Outcome<Self, Self::Error> {
        let token = req.headers().get_one("authorization");
        match verify_token(token).await {
            Some(user) => Outcome::Success(user),
            None => Outcome::Error((rocket::http::Status::Unauthorized, ())),
        }
    }
}

#[get("/me")]
fn me(user: User) -> Json<User> { Json(user) }    // Auth enforced by extractor
```

Add `User` as a handler arg — Rocket auto-runs the guard. Failure = 401 returned automatically.

## Forms

```rust
use rocket::form::Form;

#[derive(FromForm)]
struct Login<'r> { email: &'r str, password: &'r str }

#[post("/login", data = "<login>")]
fn login(login: Form<Login<'_>>) -> &'static str {
    /* ... */ "OK"
}
```

`#[derive(FromForm)]` parses URL-encoded + multipart automatically.

## Cookies + Sessions

```rust
use rocket::http::{Cookie, CookieJar};

#[post("/login")]
fn login(cookies: &CookieJar<'_>) {
    cookies.add_private(Cookie::new("user_id", "123"));
}

#[get("/me")]
fn me(cookies: &CookieJar<'_>) -> Option<String> {
    cookies.get_private("user_id").map(|c| c.value().to_string())
}
```

`add_private` encrypts the cookie — set `secret_key` in `Rocket.toml` (generate with `openssl rand -base64 32`).

## Database (rocket_db_pools)

```toml
[dependencies]
rocket_db_pools = { version = "0.2", features = ["sqlx_postgres"] }
sqlx = "0.8"
```

```rust
use rocket_db_pools::{Database, Connection};
use rocket_db_pools::sqlx::PgPool;

#[derive(Database)]
#[database("main")]
struct Db(PgPool);

#[get("/users/<id>")]
async fn get_user(mut db: Connection<Db>, id: i64) -> Option<Json<User>> {
    sqlx::query_as!(User, "SELECT * FROM users WHERE id = $1", id)
        .fetch_one(&mut **db)
        .await
        .ok()
        .map(Json)
}
```

```toml
# Rocket.toml
[default.databases.main]
url = "postgres://user:pass@localhost/dbname"
```

## Templates

```rust
use rocket_dyn_templates::{Template, context};

#[get("/")]
fn index() -> Template {
    Template::render("index", context! { name: "World" })
}

#[launch]
fn rocket() -> _ {
    rocket::build()
        .mount("/", routes![index])
        .attach(Template::fairing())
}
```

Tera + Handlebars built in. Templates in `templates/index.tera` or `.hbs`.

## Fairings (Middleware)

```rust
use rocket::{Rocket, Build, fairing::{Fairing, Info, Kind}};

struct Cors;

#[rocket::async_trait]
impl Fairing for Cors {
    fn info(&self) -> Info { Info { name: "CORS", kind: Kind::Response } }
    async fn on_response<'r>(&self, _req: &'r Request<'_>, res: &mut Response<'r>) {
        res.set_header(Header::new("Access-Control-Allow-Origin", "*"));
    }
}

#[launch]
fn rocket() -> _ {
    rocket::build().attach(Cors).mount("/", routes![...])
}
```

For CORS specifically, use `rocket_cors` crate — handles edge cases.

## Testing

```rust
use rocket::local::blocking::Client;

#[test]
fn test_index() {
    let client = Client::tracked(rocket()).expect("valid rocket");
    let response = client.get("/").dispatch();
    assert_eq!(response.status(), Status::Ok);
    assert_eq!(response.into_string().unwrap(), "Hello, World!");
}
```

`local::asynchronous::Client` for async tests.

## Best Practices

- Use **request guards** for auth + extracted state — type-safe, declarative
- `#[launch]` for the entry point, `#[get/post/...]` for routes — embrace the macro DSL
- Manage state via `.manage()` — `&State<T>` extractor in handlers
- `Json<T>` extractor + `#[derive(Deserialize)]` — body validation via Serde
- Use **`Rocket.toml`** for config (dev/prod profiles); secrets via env vars
- Catch errors with `#[catch(404)] fn not_found(...) -> ...` — custom error pages

## Common Pitfalls

- Forgetting `#[serde(crate = "rocket::serde")]` on structs → conflicts with global Serde
- Old 0.4 docs (sync, nightly-only) — make sure you're on 0.5+ docs
- Mixing async + sync handlers → 0.5 is fully async, no sync handlers
- Missing route in `routes![]` macro → 404s with no compile error
- `Json<T>` deserialization errors return 400 silently — implement custom error catcher for better messages

## Resources

- Docs: https://rocket.rs
- Guide: https://rocket.rs/guide/v0.5
- API: https://api.rocket.rs/v0.5
- Examples: https://github.com/rwf2/Rocket/tree/master/examples
