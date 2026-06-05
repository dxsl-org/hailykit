# Fiber Standards

Detected via `github.com/gofiber/fiber` in `go.mod`. Express-inspired Go framework built on `fasthttp` — extremely fast.

## When to Use

- Need maximum HTTP throughput (10x faster than `net/http` in microbenchmarks)
- Coming from Node.js / Express — API feels familiar
- Building high-volume APIs where every microsecond counts

**Trade-off:** Fiber uses `fasthttp` instead of stdlib `net/http`. Most libraries work, but some Go ecosystem tools (e.g. h2/HTTP2-pusher, some middleware) assume `net/http` and won't work directly.

## Setup

```bash
go get github.com/gofiber/fiber/v3
```

```go
package main

import "github.com/gofiber/fiber/v3"

func main() {
    app := fiber.New(fiber.Config{
        AppName:               "MyApp",
        BodyLimit:             10 * 1024 * 1024,
        DisableStartupMessage: false,
    })

    app.Get("/health", func(c fiber.Ctx) error {
        return c.JSON(fiber.Map{"status": "ok"})
    })

    app.Listen(":8080")
}
```

## Routing

```go
app.Get("/users/:id", getUser)
app.Post("/users", createUser)

api := app.Group("/api/v1")
api.Get("/users", listUsers)

admin := api.Group("/admin", authMiddleware)
admin.Get("/stats", getStats)
```

## Handlers

```go
type CreateUserRequest struct {
    Email    string `json:"email" validate:"required,email"`
    Password string `json:"password" validate:"required,min=8"`
}

func createUser(c fiber.Ctx) error {
    var req CreateUserRequest
    if err := c.Bind().JSON(&req); err != nil {
        return fiber.NewError(fiber.StatusBadRequest, "invalid body")
    }

    if err := validate.Struct(&req); err != nil {
        return fiber.NewError(fiber.StatusBadRequest, err.Error())
    }

    user, err := userService.Create(c.Context(), req)
    if err != nil {
        return err
    }

    return c.Status(fiber.StatusCreated).JSON(user)
}
```

## Params

```go
id := c.Params("id")                       // /users/:id
all := c.Params("*")                        // /files/*
name := c.Query("name", "default")           // ?name=alice (with default)
header := c.Get("Authorization")
```

## Middleware

Built-in (in `fiber/middleware/*`):

```go
import (
    "github.com/gofiber/fiber/v3"
    "github.com/gofiber/fiber/v3/middleware/logger"
    "github.com/gofiber/fiber/v3/middleware/cors"
    "github.com/gofiber/fiber/v3/middleware/recover"
    "github.com/gofiber/fiber/v3/middleware/limiter"
)

app.Use(recover.New())
app.Use(logger.New())
app.Use(cors.New())
app.Use(limiter.New(limiter.Config{Max: 100, Expiration: 1 * time.Minute}))
```

Custom:
```go
func authMiddleware(c fiber.Ctx) error {
    token := c.Get("Authorization")
    user, err := verifyJWT(token)
    if err != nil {
        return fiber.NewError(fiber.StatusUnauthorized, "unauthorized")
    }
    c.Locals("user", user)
    return c.Next()
}

app.Use(authMiddleware)
```

`c.Locals(key)` is request-scoped storage (similar to Express's `req.X = ...`).

## Error Handler

```go
app := fiber.New(fiber.Config{
    ErrorHandler: func(c fiber.Ctx, err error) error {
        code := fiber.StatusInternalServerError
        var e *fiber.Error
        if errors.As(err, &e) {
            code = e.Code
        }
        return c.Status(code).JSON(fiber.Map{"error": err.Error()})
    },
})
```

## Database

Fiber doesn't ship DB tooling — bring your own:

- **pgx** for raw Postgres (fastest)
- **GORM** for ORM
- **sqlc** for compile-time SQL → Go

```go
func getUser(c fiber.Ctx) error {
    var user User
    err := db.QueryRow(c.Context(),
        "SELECT id, email FROM users WHERE id = $1", c.Params("id"),
    ).Scan(&user.ID, &user.Email)
    if err != nil {
        return fiber.NewError(fiber.StatusNotFound, "user not found")
    }
    return c.JSON(user)
}
```

`c.Context()` returns a `context.Context` — pass to DB/HTTP calls.

## WebSocket

```go
import "github.com/gofiber/contrib/websocket"

app.Use("/ws", func(c fiber.Ctx) error {
    if websocket.IsWebSocketUpgrade(c) {
        return c.Next()
    }
    return fiber.ErrUpgradeRequired
})

app.Get("/ws/:id", websocket.New(func(c *websocket.Conn) {
    defer c.Close()
    for {
        mt, msg, err := c.ReadMessage()
        if err != nil { break }
        if err := c.WriteMessage(mt, msg); err != nil { break }
    }
}))
```

## Testing

```go
func TestGetUser(t *testing.T) {
    app := setupApp()
    req := httptest.NewRequest("GET", "/users/1", nil)
    resp, _ := app.Test(req)
    assert.Equal(t, 200, resp.StatusCode)
}
```

`app.Test(req)` is Fiber's built-in test helper.

## Best Practices

- **Return errors**, let the global handler format
- Use `c.Locals(key)` for request-scoped state (auth, request ID, etc.)
- **`c.Context()`** to propagate cancellation to DB/external calls
- **Built-in middleware** for the basics — don't reinvent
- Use `fiber.NewError(code, msg)` for HTTP-level errors
- Pin Fiber major version — v2 → v3 breaking changes

## Common Pitfalls

- Forgetting `c.Next()` in middleware → request hangs
- Using `*http.Request` types directly → Fiber uses `fasthttp.Request` underneath
- Importing middleware that assumes `net/http` → won't compile
- Mutating shared state in `c.Locals()` across goroutines → race
- Heavy CPU work in handler → blocks the fasthttp worker; offload via goroutine
- Forgetting to return after sending response → "headers already written"

## Migration from Express

If coming from Node:
- `req.body` → `c.Bind().JSON(&body)`
- `req.params.id` → `c.Params("id")`
- `req.query.x` → `c.Query("x")`
- `res.status(201).json(...)` → `c.Status(201).JSON(...)`
- `next()` → `c.Next()`

## Resources

- Docs: https://docs.gofiber.io
- GitHub: https://github.com/gofiber/fiber
- Middleware: https://docs.gofiber.io/category/-middleware
- Awesome Fiber: https://github.com/gofiber/awesome-fiber
