# ASP.NET Core Standards

Detected via `*.csproj` with `Sdk="Microsoft.NET.Sdk.Web"`. Target .NET 8/9 LTS.

## When to Use

- High-performance C# web APIs + MVC apps
- Enterprise integration (Entity Framework Core, SignalR, OData)
- Cross-platform deployment (Linux containers, Azure App Service, K8s)
- Strong typing + tooling (Visual Studio, Rider, JetBrains tooling)

## Minimal APIs (Modern Default)

Skip controllers for small/medium APIs:

```csharp
var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDbContext<AppDbContext>(opt =>
    opt.UseNpgsql(builder.Configuration.GetConnectionString("Default")));
builder.Services.AddScoped<IUserService, UserService>();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.MapGet("/users", async (IUserService svc) =>
    Results.Ok(await svc.ListAsync()));

app.MapGet("/users/{id:int}", async (int id, IUserService svc) =>
    await svc.FindAsync(id) is { } user ? Results.Ok(user) : Results.NotFound());

app.MapPost("/users", async (CreateUserDto dto, IUserService svc) =>
{
    var user = await svc.CreateAsync(dto);
    return Results.Created($"/users/{user.Id}", user);
})
.WithName("CreateUser")
.WithOpenApi();

app.Run();
```

## Controllers (For Larger APIs)

```csharp
[ApiController]
[Route("api/[controller]")]
public class UsersController(IUserService service) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IEnumerable<UserDto>>> List([FromQuery] int page = 1)
    {
        return Ok(await service.ListAsync(page));
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<UserDto>> Get(int id)
    {
        var user = await service.FindAsync(id);
        return user is null ? NotFound() : Ok(user);
    }

    [HttpPost]
    [ProducesResponseType<UserDto>(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<UserDto>> Create([FromBody] CreateUserDto dto)
    {
        var user = await service.CreateAsync(dto);
        return CreatedAtAction(nameof(Get), new { id = user.Id }, user);
    }
}
```

`[ApiController]` auto-binds + validates model state — saves boilerplate.

## DTOs + Validation (Data Annotations)

```csharp
public record CreateUserDto(
    [Required, EmailAddress] string Email,
    [Required, MinLength(8)] string Password,
    [Required, StringLength(100)] string Name);

public record UserDto(int Id, string Email, string Name, DateTime CreatedAt);
```

For complex validation, **FluentValidation** is the better fit:

```csharp
public class CreateUserValidator : AbstractValidator<CreateUserDto>
{
    public CreateUserValidator()
    {
        RuleFor(x => x.Email).NotEmpty().EmailAddress();
        RuleFor(x => x.Password).MinimumLength(8).Matches("[A-Z]").Matches("[0-9]");
    }
}

builder.Services.AddValidatorsFromAssemblyContaining<CreateUserValidator>();
```

## Entity Framework Core

```csharp
public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<Post> Posts => Set<Post>();

    protected override void OnModelCreating(ModelBuilder mb)
    {
        mb.Entity<User>(e =>
        {
            e.HasIndex(u => u.Email).IsUnique();
            e.Property(u => u.Email).IsRequired().HasMaxLength(255);
        });
    }
}

public class User
{
    public int Id { get; set; }
    public required string Email { get; set; }
    public required string Name { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public List<Post> Posts { get; set; } = [];
}
```

Migrations:
```bash
dotnet ef migrations add InitialCreate
dotnet ef database update
```

**Always `Include` relationships** to avoid N+1:
```csharp
var posts = await db.Posts.Include(p => p.User).ToListAsync();
```

## Auth + JWT

```csharp
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(opt =>
    {
        opt.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidateAudience = true,
            ValidAudience = builder.Configuration["Jwt:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Secret"]!)),
        };
    });

builder.Services.AddAuthorization(opt =>
{
    opt.AddPolicy("Admin", p => p.RequireRole("admin"));
});

app.UseAuthentication();
app.UseAuthorization();

// Protect endpoint
app.MapGet("/me", (HttpContext ctx) => ctx.User.Identity?.Name)
   .RequireAuthorization();
```

For password auth, **ASP.NET Core Identity** ships with everything (users, roles, password reset, 2FA, external login).

## Configuration

```json
// appsettings.json + appsettings.Production.json
{
  "ConnectionStrings": {
    "Default": "Host=localhost;Database=myapp;Username=postgres"
  },
  "Jwt": {
    "Issuer": "myapp",
    "Audience": "myapp.client"
  },
  "Logging": {
    "LogLevel": { "Default": "Information" }
  }
}
```

Strongly-typed config:
```csharp
public class JwtOptions
{
    public required string Issuer { get; set; }
    public required string Audience { get; set; }
    public required string Secret { get; set; }
}

builder.Services.Configure<JwtOptions>(builder.Configuration.GetSection("Jwt"));
// Inject as IOptions<JwtOptions>
```

Secrets via `dotnet user-secrets` in dev, env vars / Key Vault in prod. **Never commit secrets.**

## Middleware

Order matters — add via `app.Use*`:

```csharp
app.UseHttpsRedirection();
app.UseRouting();
app.UseCors();
app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();
app.UseSerilogRequestLogging();   // if using Serilog

app.MapControllers();
```

Custom:
```csharp
app.Use(async (ctx, next) =>
{
    var sw = Stopwatch.StartNew();
    await next();
    ctx.Response.Headers["X-Response-Time"] = sw.ElapsedMilliseconds.ToString();
});
```

## Background Services

```csharp
public class EmailWorker(IServiceScopeFactory scopeFactory, ILogger<EmailWorker> log) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        while (!ct.IsCancellationRequested)
        {
            using var scope = scopeFactory.CreateScope();
            var queue = scope.ServiceProvider.GetRequiredService<IEmailQueue>();
            await queue.ProcessNextAsync(ct);
            await Task.Delay(1000, ct);
        }
    }
}

builder.Services.AddHostedService<EmailWorker>();
```

For serious queue work: **Hangfire**, **Quartz.NET**, or **MassTransit** with RabbitMQ/Kafka.

## Testing

```csharp
public class UsersIntegrationTests(WebApplicationFactory<Program> factory) : IClassFixture<WebApplicationFactory<Program>>
{
    [Fact]
    public async Task GetUsers_Returns200()
    {
        var client = factory.CreateClient();
        var response = await client.GetAsync("/users");
        response.EnsureSuccessStatusCode();
    }
}
```

**xUnit** + **WebApplicationFactory** = full integration tests. Pair with **Testcontainers** for real DB/Redis.

## Best Practices

- **Minimal APIs** for small services; **controllers** when you have many endpoints sharing logic
- **Records** for DTOs — immutable + concise
- **Dependency injection** for everything — never `new SomeService()` in handlers
- **`[ApiController]`** for auto-validation + ProblemDetails error responses
- **Async/await** on all I/O — never `.Result` or `.Wait()`
- **EF Core: `Include()`** to avoid N+1; **`AsNoTracking()`** for read-only queries
- **Serilog + structured logs** in production
- **Health checks**: `app.MapHealthChecks("/health")`
- **OpenAPI**: built-in via Swashbuckle or `Microsoft.AspNetCore.OpenApi`

## Common Pitfalls

- `.Result` / `.Wait()` on async → deadlocks under classic ASP.NET sync context
- EF Core N+1 from forgotten `Include` — biggest perf killer
- Returning entities directly (not DTOs) → leaks DB shape, lazy-loading errors after DbContext disposal
- `Scoped` service injected into `Singleton` → captures stale dependency
- Middleware order bugs (e.g. `UseAuthorization` before `UseAuthentication`)
- `appsettings.Development.json` committed with prod-looking values → confusion
- Forgetting `CancellationToken` propagation → can't cancel hung requests

## Resources

- Docs: https://learn.microsoft.com/aspnet/core
- Tutorials: https://learn.microsoft.com/training/paths/build-web-api-aspnet-core
- EF Core: https://learn.microsoft.com/ef/core
- .NET API browser: https://learn.microsoft.com/dotnet/api
