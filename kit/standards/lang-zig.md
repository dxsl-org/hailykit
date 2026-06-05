# Zig Standards (0.13+)

## Comments

### Doc Comments
```zig
/// Why this function exists + non-obvious contract.
/// Returns error.NotFound when user_id doesn't exist in the store.
/// Caller owns the returned slice — must free with `allocator.free`.
pub fn getUser(allocator: std.mem.Allocator, user_id: []const u8) ![]const u8 {
```

- `///` for public declarations (functions, types, constants) — picked up by `zig build docs`
- `//!` at the top of a file for module-level documentation
- `//` for inline implementation notes
- Document errors in the error set explicitly: list which conditions produce which error

### Allocator Ownership (MANDATORY)
Zig has no GC — every allocation has an owner. State it.
```zig
/// Caller owns the returned slice. Free with `allocator.free(result)`.
pub fn render(allocator: std.mem.Allocator, template: []const u8) ![]u8 { ... }

/// Returned slice is borrowed from `arena`; valid until the arena is reset.
pub fn intern(arena: *std.heap.ArenaAllocator, s: []const u8) []const u8 { ... }
```
Every function that allocates must document who frees and when.

### Unsafe / `@ptrCast` / `@alignCast`
```zig
// SAFETY: ptr is 4-byte aligned — guaranteed by header parser invariant above
const word: *const u32 = @ptrCast(@alignCast(ptr));
```
Any `@ptrCast`, `@alignCast`, `@bitCast` across non-trivial types, `@constCast`, or `volatile` access needs a `// SAFETY:` comment.

## Key Idioms

### Errors — Error Unions, Not Exceptions
```zig
// Define error sets explicitly when stable; let Zig infer when local
const ParseError = error{
    InvalidFormat,
    Overflow,
    OutOfMemory,
};

pub fn parse(input: []const u8) ParseError!u32 {
    if (input.len == 0) return error.InvalidFormat;
    // ...
}

// try = propagate; catch = handle
const n = try parse(input);
const n = parse(input) catch |err| switch (err) {
    error.InvalidFormat => 0,
    error.Overflow => std.math.maxInt(u32),
    else => return err,
};

// errdefer for cleanup on the error path only
var buf = try allocator.alloc(u8, size);
errdefer allocator.free(buf);
try fill(buf);  // if this errors, buf is freed
return buf;     // success — buf survives, caller owns it
```

### Memory — Explicit Allocator Passing
```zig
// Never allocate via a hidden global — always take an allocator parameter
pub fn loadConfig(allocator: std.mem.Allocator, path: []const u8) !Config {
    const data = try std.fs.cwd().readFileAlloc(allocator, path, 1 << 20);
    defer allocator.free(data);
    return parse(allocator, data);
}

// Arena for "free everything at once" patterns — request handling, scratch space
var arena = std.heap.ArenaAllocator.init(parent_allocator);
defer arena.deinit();
const alloc = arena.allocator();

// std.testing.allocator catches leaks in tests automatically — use it
```

### `defer` and `errdefer`
```zig
const file = try std.fs.cwd().openFile(path, .{});
defer file.close();              // always runs on scope exit

var buf = try allocator.alloc(u8, size);
errdefer allocator.free(buf);    // runs only if we error out before returning
```

### Comptime
```zig
// Use comptime for compile-time computation, generics, and reflection
pub fn Vec(comptime T: type, comptime n: usize) type {
    return struct {
        data: [n]T,
        pub fn sum(self: @This()) T { ... }
    };
}

// Avoid runtime polymorphism — prefer comptime generics or tagged unions
```

### Tagged Unions for Sum Types
```zig
const Result = union(enum) {
    success: User,
    failure: []const u8,
};

// Exhaustive switch — compile error if you miss a case
switch (result) {
    .success => |user| process(user),
    .failure => |reason| log(reason),
}
```

### Patterns to Avoid
- Hidden allocators (globals, default-allocator helpers) — always pass explicitly
- `catch unreachable` outside test code or proven-impossible paths
- Ignoring error union returns (`_ = foo()`) — handle or propagate
- Manual memory management when an arena or `std.ArrayList` fits
- C-style enums when a tagged union models the data better

## Naming
- Types/Structs/Unions/Enums: `PascalCase` (`User`, `ParseError`)
- Functions/methods/variables: `camelCase` (`getUser`, `user_id` for params is also acceptable per project)
- Constants: `snake_case` for local consts; `PascalCase` if it returns a type
- Files: `snake_case.zig` (Zig ecosystem convention)
- Test names: `test "what is being tested"` — natural language in quotes

## Build & Layout
- Public API in `src/root.zig` (libraries) or `src/main.zig` (executables) — set by `build.zig`
- Tests live alongside code in `test "..." { ... }` blocks; `zig build test` runs everything
- Use `std.testing.allocator` in tests to detect leaks
- `zig fmt` is canonical — run before commit, no style debate
- Pin Zig version in `build.zig.zon` (`minimum_zig_version`) — language still evolves
