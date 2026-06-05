# C# Standards

Modern C# (12+) with .NET 8/9 LTS. Detected via `*.csproj`, `*.sln`, or `global.json`.

## Core Patterns (Modern C#)

- **`var`** for local variables when type is obvious from context
- **File-scoped namespaces** — `namespace MyApp;` (one line, no braces) over old `namespace { ... }` block
- **Top-level statements** in `Program.cs` (no explicit `Main` boilerplate)
- **Records** for immutable value objects: `public record User(string Email, int Age);`
- **Pattern matching** in switch expressions, not chains of `if`
- **Nullable reference types** enabled (`<Nullable>enable</Nullable>` in csproj) — non-null by default, `?` opts in
- **`required`** keyword for properties that must be set at init
- **Primary constructors** (C# 12+) — `public class UserService(IDb db)`
- **Collection expressions** (C# 12+) — `List<int> nums = [1, 2, 3];`

## Async

- **All I/O is async** — return `Task` / `Task<T>`, suffix method names with `Async`
- Use `await` everywhere — never `.Result` or `.Wait()` (deadlock risk)
- `ConfigureAwait(false)` only in library code; ASP.NET Core no longer needs it
- `IAsyncEnumerable<T>` + `await foreach` for streams

```csharp
public async Task<User?> GetUserAsync(int id, CancellationToken ct)
{
    return await _db.Users.FirstOrDefaultAsync(u => u.Id == id, ct);
}
```

Always accept `CancellationToken` in async methods — propagate it through.

## Dependency Injection

`Microsoft.Extensions.DependencyInjection` is the standard:

```csharp
builder.Services.AddScoped<IUserRepository, UserRepository>();
builder.Services.AddSingleton<IConfig>(_ => new Config(...));
builder.Services.AddTransient<IEmailSender, SmtpEmailSender>();
```

- **Singleton** — one instance for app lifetime
- **Scoped** — one instance per HTTP request
- **Transient** — new instance every resolution

Inject via constructor; prefer interfaces over concrete types.

## LINQ

```csharp
var adults = users
    .Where(u => u.Age >= 18)
    .OrderBy(u => u.Name)
    .Select(u => new { u.Id, u.Email })
    .ToList();

// Aggregate
var total = orders.Sum(o => o.Amount);
var grouped = orders.GroupBy(o => o.UserId).ToDictionary(g => g.Key, g => g.Sum(o => o.Amount));
```

`ToList()` / `ToArray()` materialize the query — without them, you're working with `IEnumerable<T>` (deferred execution).

## Pattern Matching

```csharp
string Describe(object obj) => obj switch
{
    int n when n > 0 => $"positive int {n}",
    int n => $"non-positive int {n}",
    string s => $"string '{s}'",
    User { Age: > 18 } u => $"adult {u.Name}",
    null => "null",
    _ => "unknown"
};
```

`switch` expressions return values — much more concise than statement form.

## Records (Immutable Data)

```csharp
public record Point(double X, double Y);
public record User(string Email, int Age) { public DateTime Created { get; init; } = DateTime.UtcNow; }

// Value equality, `with` expression for mutation-by-copy
var p1 = new Point(1, 2);
var p2 = p1 with { Y = 5 };       // new Point(1, 5)
```

Use records for DTOs, events, value objects. Classes for entities with identity.

## Nullable Reference Types

```csharp
public string? FindName(int id) { /* may return null */ }
public string GetName(int id) { /* never returns null */ }

// Null-conditional + null-coalescing
var len = name?.Length ?? 0;
```

Enable via `<Nullable>enable</Nullable>` in csproj. Treat warnings as errors.

## Exceptions

- Use exceptions for **exceptional** cases, not control flow
- Custom exception types per domain: `public class UserNotFoundException : Exception { ... }`
- Don't catch `Exception` blindly — catch the specific type, or rethrow with `throw` (not `throw ex` — that loses stack trace)
- `Result<T, E>` pattern via OneOf/ErrorOr libs if you prefer Rust-style error handling

## File Organization

```
src/
├── MyApp.Api/              # ASP.NET Core entry
├── MyApp.Application/      # Business logic, use cases
├── MyApp.Domain/           # Entities, value objects (no dependencies)
├── MyApp.Infrastructure/   # EF Core, external integrations
└── MyApp.Tests/            # xUnit / NUnit tests
MyApp.sln
```

Clean Architecture is dominant in C# enterprise: Domain → Application → Infrastructure → API (dependencies point inward).

## Testing

- **xUnit** is the most common test framework (NUnit + MSTest also fine)
- **Moq** or **NSubstitute** for mocking
- **FluentAssertions** for readable asserts
- **TestContainers** for integration tests with real DBs/Redis/etc.

```csharp
[Fact]
public async Task GetUser_ReturnsUser_WhenExists()
{
    var user = await _service.GetUserAsync(1, CancellationToken.None);
    user.Should().NotBeNull();
    user!.Email.Should().Be("test@example.com");
}
```

## Best Practices

- Enable **TreatWarningsAsErrors** in csproj — catch problems at build
- Use **EditorConfig** + Roslyn analyzers for team consistency
- **Sealed** classes by default — prevent unintended inheritance
- **Source generators** for boilerplate (e.g. `System.Text.Json` source-gen for AOT-friendly serialization)
- **Native AOT** when targeting tiny binaries / fast startup (containers, lambdas)

## Common Pitfalls

- `.Result` / `.Wait()` on async → deadlocks under SynchronizationContext
- `async void` (except event handlers) → uncatchable exceptions
- Forgetting `CancellationToken` propagation → can't cancel hung requests
- `string.Concat` in tight loops → use `StringBuilder` or interpolation
- LINQ `Count()` on `IEnumerable<T>` from a DB → fetches all rows; use `CountAsync` on `IQueryable`
- Reusing `HttpClient` instances incorrectly → socket exhaustion; use `IHttpClientFactory`

## Resources

- Docs: https://learn.microsoft.com/dotnet/csharp
- .NET docs: https://learn.microsoft.com/dotnet
- What's new in C#: https://learn.microsoft.com/dotnet/csharp/whats-new
- Roadmap: https://github.com/dotnet/roslyn/blob/main/docs/Language%20Feature%20Status.md
