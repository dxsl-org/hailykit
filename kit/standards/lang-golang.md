# Go Standards

## Comments

### godoc (exported symbols only)
First sentence is the summary rendered by `go doc`. Must start with the symbol name:
```go
// GetUser retrieves a user by ID. Returns nil when the user is soft-deleted.
// Returns ErrNotFound when userId does not exist in the store.
func GetUser(ctx context.Context, userID string) (*User, error)
```

- Unexported symbols: minimal comments; only add when the behavior is non-obvious
- Package-level comment goes in `doc.go` or at the top of the primary file: `// Package auth provides ...`
- Struct fields: comment fields with non-obvious zero-value semantics or units
  ```go
  type Config struct {
      TimeoutMs int // 0 means no timeout; negative values are invalid
  }
  ```

### Goroutine and Channel Ownership
Document who owns a channel and who is responsible for closing it:
```go
// results is owned by the producer goroutine; closed when all items are sent.
// Consumers must not close it.
results := make(chan Item, 32)
```

### Error Wrapping
```go
// Wrap with context that names the operation — callers use errors.Is/As to unwrap
return fmt.Errorf("getUserByID %s: %w", id, err)
```

### Unsafe and Linter Suppression
```go
// Safety: ptr is guaranteed non-nil here — validated by parseHeader before this call
val := (*int32)(unsafe.Pointer(ptr))

//nolint:exhaustive // reason: default branch handles all unlisted cases
```

## Key Idioms

- Prefer table-driven tests; name subtests with `t.Run("description", ...)`
- Error sentinel values: define as `var ErrFoo = errors.New("foo")` at package level
- Context: always first param for any function that does I/O or can be cancelled
- Prefer `defer` for cleanup even in short functions — consistency over optimization
- Zero value should be useful: document when it isn't
- Avoid `init()` except for registering drivers/codecs; document why it's needed when used
