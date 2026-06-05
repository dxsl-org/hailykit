# Blazor Standards

Detected via `Microsoft.NET.Sdk.BlazorWebAssembly` SDK or `Microsoft.AspNetCore.Components.WebAssembly` package. .NET-based web UI framework.

## Blazor Render Modes (.NET 8+)

Blazor 8+ unified the model — one project can mix modes per component:

| Mode | Where it runs | Use for |
|---|---|---|
| **Static SSR** | Server, no interactivity | Marketing pages, content sites |
| **Server interactive** | Server via SignalR | Real-time, low-latency UI, admin tools |
| **WebAssembly (WASM)** | Browser, full client-side | SPAs, offline-capable, PWA |
| **Auto** | Initially server, switches to WASM after download | Best of both |

Set via `@rendermode`:
```razor
@rendermode InteractiveServer
@rendermode InteractiveWebAssembly
@rendermode InteractiveAuto
```

## Project Structure

```
Pages/
├── Index.razor
├── Counter.razor
└── FetchData.razor
Components/
├── Layout/
│   ├── MainLayout.razor
│   └── NavMenu.razor
└── Pages/                  # In some templates
Shared/
wwwroot/                    # Static files (WASM)
Program.cs                  # Entry
appsettings.json
```

## Components

```razor
@* Counter.razor *@
@page "/counter"
@rendermode InteractiveServer

<PageTitle>Counter</PageTitle>

<h1>Counter</h1>

<p>Current count: @currentCount</p>

<button class="btn btn-primary" @onclick="IncrementCount">Click me</button>

@code {
    private int currentCount = 0;

    private void IncrementCount()
    {
        currentCount++;
    }
}
```

`@page "..."` makes it routable. `@code { }` is the C# section. Variables in scope appear in markup via `@varName`.

## Data Binding

```razor
<input @bind="name" />
<input @bind="age" @bind:event="oninput" />     <!-- real-time -->
<select @bind="selectedId">
    @foreach (var item in items) {
        <option value="@item.Id">@item.Name</option>
    }
</select>

<p>Hello, @name!</p>

@code {
    private string name = "";
    private int age = 0;
    private int selectedId;
    private List<Item> items = new();
}
```

`@bind` is two-way (default on `change` event). `@bind:event="oninput"` for live updates per keystroke.

## Parameters + Component Composition

```razor
@* Components/UserCard.razor *@
<div class="user-card">
    <h3>@User.Name</h3>
    <p>@User.Email</p>
    @ChildContent
</div>

@code {
    [Parameter, EditorRequired] public User User { get; set; } = null!;
    [Parameter] public RenderFragment? ChildContent { get; set; }
}

@* Usage *@
<UserCard User="@currentUser">
    <p>Additional content here</p>
</UserCard>
```

`RenderFragment` is Blazor's slot equivalent.

## Forms (EditForm)

```razor
@page "/users/new"
@rendermode InteractiveServer
@inject UserService Service
@inject NavigationManager Nav

<EditForm Model="@model" OnValidSubmit="@HandleSubmit">
    <DataAnnotationsValidator />
    <ValidationSummary />

    <div>
        <label>Email:</label>
        <InputText @bind-Value="model.Email" />
        <ValidationMessage For="@(() => model.Email)" />
    </div>

    <div>
        <label>Name:</label>
        <InputText @bind-Value="model.Name" />
    </div>

    <button type="submit" disabled="@submitting">Save</button>
</EditForm>

@code {
    private CreateUserDto model = new();
    private bool submitting;

    private async Task HandleSubmit()
    {
        submitting = true;
        await Service.CreateAsync(model);
        Nav.NavigateTo("/users");
    }
}

public class CreateUserDto
{
    [Required, EmailAddress] public string Email { get; set; } = "";
    [Required, StringLength(100)] public string Name { get; set; } = "";
}
```

Built-in form components: `InputText`, `InputNumber`, `InputSelect`, `InputCheckbox`, `InputDate`, `InputTextArea`.

## State Management

For simple state: `@code { }` block, lifted to parent components.

For app-wide state:
- **Cascading values** for tree-wide read-only data
- **Scoped services** for state that survives navigation
- **Fluxor** or **Blazor-State** for Redux-style patterns

```csharp
// Program.cs
builder.Services.AddScoped<UserStore>();

// UserStore.cs
public class UserStore
{
    public User? CurrentUser { get; private set; }
    public event Action? OnChange;

    public void SetUser(User u)
    {
        CurrentUser = u;
        OnChange?.Invoke();
    }
}

// Component
@inject UserStore Store
@implements IDisposable

@code {
    protected override void OnInitialized()
        => Store.OnChange += StateHasChanged;

    public void Dispose()
        => Store.OnChange -= StateHasChanged;
}
```

## Routing + Navigation

```razor
@page "/users/{Id:int}"

@code {
    [Parameter] public int Id { get; set; }
}

@* Navigate *@
@inject NavigationManager Nav
<button @onclick="@(() => Nav.NavigateTo($"/users/{user.Id}"))">View</button>
```

Use `<NavLink>` for active-link styling in nav menus.

## JS Interop

```csharp
@inject IJSRuntime JS

private async Task CopyToClipboard(string text)
{
    await JS.InvokeVoidAsync("navigator.clipboard.writeText", text);
}

private async Task<string> Prompt(string message)
{
    return await JS.InvokeAsync<string>("prompt", message);
}
```

For non-trivial JS: define an isolated JS module + import via `IJSObjectReference`. Keeps JS scoped.

## Lifecycle

| Method | When |
|---|---|
| `OnInitialized` / `OnInitializedAsync` | Once when component created |
| `OnParametersSet` / `OnParametersSetAsync` | When parameters change |
| `OnAfterRender(firstRender)` / `OnAfterRenderAsync` | After each render (firstRender bool tells you it's the first) |
| `ShouldRender` | Override to skip re-render |
| `Dispose` (`IDisposable`) | On removal — unhook events! |

## Performance

- Use `@key` on lists for stable identity
- Override `ShouldRender` for expensive components
- **WASM only**: enable AOT compilation for production (`<RunAOTCompilation>true</RunAOTCompilation>`)
- WASM bundle size: trim unused assemblies, brotli compression
- Avoid huge component trees — virtualize with `<Virtualize>` for long lists

```razor
<Virtualize Items="@allUsers" Context="user">
    <UserCard User="@user" />
</Virtualize>
```

Only renders visible rows + a buffer.

## SignalR (Real-time)

```csharp
// Hub
public class ChatHub : Hub
{
    public async Task SendMessage(string user, string message)
    {
        await Clients.All.SendAsync("ReceiveMessage", user, message);
    }
}

// Program.cs
builder.Services.AddSignalR();
app.MapHub<ChatHub>("/chathub");
```

```razor
@inject NavigationManager Nav
@implements IAsyncDisposable

@code {
    private HubConnection? hub;

    protected override async Task OnInitializedAsync()
    {
        hub = new HubConnectionBuilder()
            .WithUrl(Nav.ToAbsoluteUri("/chathub"))
            .Build();

        hub.On<string, string>("ReceiveMessage", (user, msg) =>
        {
            messages.Add($"{user}: {msg}");
            InvokeAsync(StateHasChanged);
        });

        await hub.StartAsync();
    }

    public async ValueTask DisposeAsync()
    {
        if (hub is not null) await hub.DisposeAsync();
    }
}
```

## Best Practices

- **Pick render mode wisely**: Static for content, Server for low-latency interactivity, WASM for offline/heavy client logic, Auto for best of both
- **Components are .NET classes** — full DI, testing, type safety
- **Use `EditForm` + DataAnnotations** for forms — much better than raw `<input>`
- **`@key` on dynamic lists** to prevent stale state
- **`StateHasChanged()`** explicitly when triggering updates from non-Blazor events (timers, SignalR)
- **WASM**: enable AOT + trimming for prod bundle size
- **Server mode**: respect SignalR connection limits (default ~5000 / instance)

## Common Pitfalls

- Forgetting `@rendermode` → component renders statically, no interactivity
- WASM trying to access server-only code → runtime errors
- Event handlers leaking → implement `IDisposable` + unhook in `Dispose`
- Heavy work in `OnInitializedAsync` → blocks initial render; defer with `Task.Run`
- WASM bundles too large → no trimming/AOT; users wait for download
- Server-side: stale state if `StateHasChanged` not called from background threads (use `InvokeAsync(StateHasChanged)`)
- Tracking entities across DbContext lifetimes (Server interactive) → use `AsNoTracking` or new context per call

## Resources

- Docs: https://learn.microsoft.com/aspnet/core/blazor
- Tutorials: https://dotnet.microsoft.com/learn/aspnet/blazor-tutorial
- Components: https://learn.microsoft.com/aspnet/core/blazor/components
- Awesome Blazor: https://github.com/AdrienTorris/awesome-blazor
