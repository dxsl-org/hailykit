# Gin Standards

Detected via `github.com/gin-gonic/gin` in `go.mod`. The most popular Go web framework.

## When to Use

- High-performance Go HTTP APIs
- Want a more ergonomic alternative to `net/http`
- Need middleware composition + route grouping out of the box

For minimal projects, `chi` or stdlib `net/http` (Go 1.22+ has tree-based routing) are also great.

## Setup

```bash
go mod init github.com/myorg/myapp
go get -u github.com/gin-gonic/gin
```

## Hello World

```go
package main

import "github.com/gin-gonic/gin"

func main() {
    r := gin.Default()      // includes Logger + Recovery middleware

    r.GET("/health", func(c *gin.Context) {
        c.JSON(200, gin.H{"status": "ok"})
    })

    r.Run(":8080")          // or r.Run() to use $PORT
}
```

`gin.Default()` adds Logger + Recovery; `gin.New()` for no middleware.

## Routing

```go
r.GET("/users/:id", getUser)
r.POST("/users", createUser)
r.PUT("/users/:id", updateUser)
r.DELETE("/users/:id", deleteUser)

// Groups
api := r.Group("/api/v1")
{
    api.GET("/users", listUsers)
    api.GET("/users/:id", getUser)

    admin := api.Group("/admin", AuthMiddleware(), AdminMiddleware())
    {
        admin.GET("/stats", getStats)
    }
}
```

## Handlers

```go
type CreateUserRequest struct {
    Email    string `json:"email" binding:"required,email"`
    Password string `json:"password" binding:"required,min=8"`
    Name     string `json:"name" binding:"required"`
}

type UserResponse struct {
    ID    uint   `json:"id"`
    Email string `json:"email"`
    Name  string `json:"name"`
}

func createUser(c *gin.Context) {
    var req CreateUserRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(400, gin.H{"error": err.Error()})
        return
    }

    user, err := userService.Create(c.Request.Context(), req)
    if err != nil {
        c.JSON(500, gin.H{"error": "internal"})
        return
    }

    c.JSON(201, UserResponse{ID: user.ID, Email: user.Email, Name: user.Name})
}

func getUser(c *gin.Context) {
    id := c.Param("id")
    // ...
}
```

`binding:"required,email,min=8"` tags drive auto-validation via `ShouldBindJSON`.

## Middleware

```go
func AuthMiddleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        token := strings.TrimPrefix(c.GetHeader("Authorization"), "Bearer ")
        userID, err := verifyJWT(token)
        if err != nil {
            c.AbortWithStatusJSON(401, gin.H{"error": "unauthorized"})
            return
        }
        c.Set("user_id", userID)
        c.Next()
    }
}

// Apply globally
r.Use(AuthMiddleware())

// Or per-group
api := r.Group("/api", AuthMiddleware())
```

`c.Abort()` stops the middleware chain; `c.Next()` continues.

## Dependency Injection

Gin doesn't ship DI. Common patterns:

```go
// Struct-based handlers
type UserHandler struct {
    service *UserService
}

func NewUserHandler(s *UserService) *UserHandler {
    return &UserHandler{service: s}
}

func (h *UserHandler) Create(c *gin.Context) { /* ... */ }

// Register
h := NewUserHandler(userService)
r.POST("/users", h.Create)
```

For larger apps: `wire` (Google) for compile-time DI, or `fx` (Uber) for runtime.

## Validation

`gin` uses `go-playground/validator`. Common tags:

| Tag | Meaning |
|---|---|
| `required` | Field must be present + non-zero |
| `email` | Valid email |
| `min=N` / `max=N` | Numeric/length bounds |
| `oneof=a b c` | Must match one of values |
| `gte=N` / `lte=N` | Numeric ≥ / ≤ |
| `omitempty` | Skip validation if zero value |

Custom validators:
```go
v := binding.Validator.Engine().(*validator.Validate)
v.RegisterValidation("strong_password", strongPasswordValidator)
```

## Database (typical stack)

Gin + your favorite DB lib:
- **sqlc** — compile-time SQL → Go (see `framework-sqlc.md`)
- **GORM** — ORM (popular but slower runtime)
- **pgx** — high-performance Postgres driver
- **squirrel** — query builder
- **bun** — modern ORM

```go
type UserRepository struct {
    db *pgxpool.Pool
}

func (r *UserRepository) FindByID(ctx context.Context, id int64) (*User, error) {
    var u User
    err := r.db.QueryRow(ctx,
        "SELECT id, email, name FROM users WHERE id = $1", id,
    ).Scan(&u.ID, &u.Email, &u.Name)
    if errors.Is(err, pgx.ErrNoRows) {
        return nil, ErrNotFound
    }
    return &u, err
}
```

Always pass `context.Context` from `c.Request.Context()` — propagates cancellation.

## Error Handling

```go
// Centralize via middleware
func ErrorHandler() gin.HandlerFunc {
    return func(c *gin.Context) {
        c.Next()

        if len(c.Errors) > 0 {
            err := c.Errors.Last()
            switch {
            case errors.Is(err.Err, ErrNotFound):
                c.JSON(404, gin.H{"error": err.Err.Error()})
            case errors.Is(err.Err, ErrUnauthorized):
                c.JSON(401, gin.H{"error": err.Err.Error()})
            default:
                c.JSON(500, gin.H{"error": "internal"})
            }
        }
    }
}

// In handler
c.Error(ErrNotFound)
return
```

Alternatively, define a `httpErr` type that wraps `error + status`.

## Testing

```go
func TestGetUser(t *testing.T) {
    gin.SetMode(gin.TestMode)
    r := setupRouter()
    w := httptest.NewRecorder()
    req, _ := http.NewRequest("GET", "/users/1", nil)
    r.ServeHTTP(w, req)

    assert.Equal(t, 200, w.Code)
    var user UserResponse
    json.Unmarshal(w.Body.Bytes(), &user)
    assert.Equal(t, "alice@example.com", user.Email)
}
```

`httptest` is stdlib — works seamlessly with Gin.

## Graceful Shutdown

```go
srv := &http.Server{Addr: ":8080", Handler: r}

go func() {
    if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
        log.Fatal(err)
    }
}()

quit := make(chan os.Signal, 1)
signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
<-quit

ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
defer cancel()
srv.Shutdown(ctx)
```

Drain in-flight requests on SIGTERM.

## Best Practices

- Use **`ShouldBind*`** (returns error) over `Bind*` (auto-aborts) — gives you control
- **Validate via struct tags** — keeps validation declarative
- **Pass context** to DB/external calls via `c.Request.Context()`
- **Middleware order matters** — log first, recover second, auth third (typically)
- For prod, **don't use `gin.Default()`** — build middleware chain explicitly
- Use `c.MustGet("key")` only when you're sure it's set; otherwise `c.Get`
- Structure: `cmd/server/main.go`, `internal/handlers/`, `internal/services/`, `internal/repository/`

## Common Pitfalls

- Using `gin.H{}` for typed responses → loose types; prefer struct + JSON tags
- Forgetting `return` after `c.JSON(400, ...)` → handler continues, writes again
- `c.Bind*` (vs `ShouldBind*`) auto-aborts the chain → unexpected when you wanted to handle
- Not passing context to DB calls → can't cancel hung queries
- Putting business logic in handlers → extract to services
- Using `gin.Default()` in production without understanding what it adds
- Modifying `c.Request` in middleware → race condition risk

## Resources

- Docs: https://gin-gonic.com/docs
- GitHub: https://github.com/gin-gonic/gin
- Examples: https://github.com/gin-gonic/examples
- go-playground/validator: https://github.com/go-playground/validator
