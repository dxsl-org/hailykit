# Echo Standards

Detected via `github.com/labstack/echo` in `go.mod`. High-performance, minimalist Go web framework.

## When to Use

- Want Express-like simplicity in Go
- Need very fast routing (radix tree-based)
- Prefer Echo's middleware/error model over Gin's

vs Gin: similar performance, slightly different API style. Both excellent. Gin is more popular; Echo has cleaner error handling.

## Setup

```bash
go get github.com/labstack/echo/v4
```

```go
package main

import (
    "net/http"
    "github.com/labstack/echo/v4"
    "github.com/labstack/echo/v4/middleware"
)

func main() {
    e := echo.New()
    e.Use(middleware.Logger())
    e.Use(middleware.Recover())

    e.GET("/health", func(c echo.Context) error {
        return c.JSON(http.StatusOK, map[string]string{"status": "ok"})
    })

    e.Logger.Fatal(e.Start(":8080"))
}
```

## Handlers Return Errors

Echo handlers return `error` — much cleaner than Gin's pattern:

```go
func createUser(c echo.Context) error {
    var req CreateUserRequest
    if err := c.Bind(&req); err != nil {
        return echo.NewHTTPError(http.StatusBadRequest, "invalid body")
    }
    if err := c.Validate(&req); err != nil {
        return err     // auto-converts to 400 with details
    }
    user, err := userService.Create(c.Request().Context(), req)
    if err != nil {
        return err     // global error handler turns into 500
    }
    return c.JSON(http.StatusCreated, user)
}
```

Always return either response (`c.JSON`, `c.String`) or error.

## Routing + Groups

```go
e.GET("/users/:id", getUser)
e.POST("/users", createUser)

api := e.Group("/api/v1")
api.Use(authMiddleware)
{
    api.GET("/users", listUsers)
    api.GET("/me", getMe)

    admin := api.Group("/admin", adminMiddleware)
    admin.GET("/stats", getStats)
}
```

## Path + Query Params

```go
id := c.Param("id")                         // /users/:id
name := c.QueryParam("name")                 // ?name=alice
limitStr := c.QueryParam("limit")            // ?limit=10
limit, _ := strconv.Atoi(limitStr)
```

Use `c.Bind(&query)` to auto-parse query strings into a struct via tags:
```go
type ListQuery struct {
    Page  int    `query:"page" validate:"min=1"`
    Limit int    `query:"limit" validate:"min=1,max=100"`
    Sort  string `query:"sort"`
}
```

## Validation

Echo supports any validator; `go-playground/validator` is the common choice:

```go
import "github.com/go-playground/validator/v10"

type CustomValidator struct {
    validator *validator.Validate
}

func (cv *CustomValidator) Validate(i interface{}) error {
    if err := cv.validator.Struct(i); err != nil {
        return echo.NewHTTPError(http.StatusBadRequest, err.Error())
    }
    return nil
}

e.Validator = &CustomValidator{validator: validator.New()}
```

Then `c.Validate(&req)` works in handlers.

## Middleware

Built-in middleware via `middleware.*`:

| Middleware | Use |
|---|---|
| `middleware.Logger()` | Request logging |
| `middleware.Recover()` | Panic recovery |
| `middleware.CORS()` | CORS |
| `middleware.RateLimiter(...)` | Rate limiting |
| `middleware.JWT(...)` | JWT auth |
| `middleware.BodyLimit("10M")` | Body size limit |
| `middleware.Gzip()` | Response compression |
| `middleware.Secure()` | Security headers |
| `middleware.Timeout(...)` | Request timeout |

Custom:
```go
func authMiddleware(next echo.HandlerFunc) echo.HandlerFunc {
    return func(c echo.Context) error {
        token := c.Request().Header.Get("Authorization")
        userID, err := verifyJWT(token)
        if err != nil {
            return echo.NewHTTPError(http.StatusUnauthorized, "invalid token")
        }
        c.Set("user_id", userID)
        return next(c)
    }
}
```

## Global Error Handler

```go
e.HTTPErrorHandler = func(err error, c echo.Context) {
    var httpErr *echo.HTTPError
    if errors.As(err, &httpErr) {
        c.JSON(httpErr.Code, map[string]any{"error": httpErr.Message})
        return
    }

    log.Printf("internal: %v", err)
    c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal"})
}
```

Single place to format all errors uniformly.

## WebSocket

```go
import "github.com/labstack/echo/v4/middleware"
// uses gorilla/websocket under the hood via golang.org/x/net/websocket OR external

e.GET("/ws", func(c echo.Context) error {
    websocket.Handler(func(ws *websocket.Conn) {
        defer ws.Close()
        // ...
    }).ServeHTTP(c.Response(), c.Request())
    return nil
})
```

## Testing

```go
func TestGetUser(t *testing.T) {
    e := echo.New()
    req := httptest.NewRequest(http.MethodGet, "/users/1", nil)
    rec := httptest.NewRecorder()
    c := e.NewContext(req, rec)
    c.SetPath("/users/:id")
    c.SetParamNames("id")
    c.SetParamValues("1")

    if err := getUser(c); err != nil {
        t.Fatal(err)
    }
    assert.Equal(t, http.StatusOK, rec.Code)
}
```

## Best Practices

- **Return errors** from handlers — let the global handler format them
- **Centralize error formatting** via `HTTPErrorHandler` override
- **Group + middleware chains** for related routes
- Use **`echo.NewHTTPError(code, msg)`** for client-facing errors
- Always pass `c.Request().Context()` to downstream DB/HTTP calls
- Build middleware as standalone functions, register via `e.Use()` or per-group

## Common Pitfalls

- Forgetting to return after a response → second response attempt panics
- Using `c.Bind()` for query+body without specifying tags (`query:"..."` vs `json:"..."`) → wrong source
- Skipping `e.Validator` setup but calling `c.Validate(...)` → runtime nil panic
- Long-running handler without `context.Context` propagation → can't cancel
- Mixing Gin and Echo idioms across files → inconsistent codebase

## Resources

- Docs: https://echo.labstack.com
- API: https://pkg.go.dev/github.com/labstack/echo/v4
- Recipes: https://github.com/labstack/echox
