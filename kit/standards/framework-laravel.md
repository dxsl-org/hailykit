# Laravel Standards

Detected via `laravel/framework` in `composer.json`. Target Laravel 11+ (current LTS path).

## Project Structure

```
app/
├── Console/Commands/
├── Http/
│   ├── Controllers/
│   ├── Middleware/
│   ├── Requests/        # Form request validation
│   └── Resources/        # API response shaping
├── Models/               # Eloquent models
├── Services/             # Business logic
├── Providers/
└── Jobs/                 # Queueable jobs
config/                   # Config files
database/
├── migrations/
├── seeders/
└── factories/
routes/
├── web.php
├── api.php
└── console.php
resources/
├── views/                # Blade templates
└── js/                   # Frontend (Vite)
```

Laravel 11+ slimmed down `app/Http/Kernel.php` etc — middleware lives in `bootstrap/app.php`.

## Routing

```php
// routes/api.php
use App\Http\Controllers\UserController;

Route::get('/users', [UserController::class, 'index']);
Route::post('/users', [UserController::class, 'store']);
Route::apiResource('users', UserController::class);   // index/store/show/update/destroy

Route::prefix('admin')->middleware(['auth:sanctum', 'role:admin'])->group(function () {
    Route::get('/stats', [AdminController::class, 'stats']);
});
```

## Eloquent (ORM)

```php
// app/Models/Post.php
class Post extends Model
{
    protected $fillable = ['title', 'body', 'user_id'];
    protected $casts = ['published_at' => 'datetime', 'metadata' => 'array'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function scopePublished($query)
    {
        return $query->whereNotNull('published_at');
    }
}

// Usage
$posts = Post::with('user')->published()->latest()->paginate(20);
$post = Post::find($id);
$post = Post::firstOrCreate(['slug' => $slug], ['title' => $title]);
$post->update(['title' => 'New title']);
```

**Always `with()`** to eager-load — N+1 is Laravel's #1 perf killer. Use `Debugbar` in dev to catch.

## Form Requests (Validation)

```php
// app/Http/Requests/StoreUserRequest.php
class StoreUserRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'email' => ['required', 'email', 'unique:users'],
            'password' => ['required', Password::min(8)->letters()->numbers()],
            'name' => ['required', 'string', 'max:255'],
        ];
    }
}

// Controller
public function store(StoreUserRequest $request)
{
    $user = User::create($request->validated());
    return new UserResource($user);
}
```

Validation auto-runs before controller; failure returns 422 with field errors.

## API Resources (Response Shaping)

```php
class UserResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'email' => $this->email,
            'name' => $this->name,
            'posts' => PostResource::collection($this->whenLoaded('posts')),
            'created_at' => $this->created_at->toIso8601String(),
        ];
    }
}

return UserResource::collection(User::paginate(20));
```

Decouples DB shape from API contract. `whenLoaded()` for conditional inclusion of relationships.

## Authentication

- **Sanctum** for SPA + mobile + simple APIs (token-based)
- **Passport** for full OAuth2 server
- **Breeze** / **Jetstream** for scaffolded starter kits

```php
// Login (Sanctum SPA mode)
public function login(LoginRequest $request)
{
    if (!Auth::attempt($request->validated())) {
        throw ValidationException::withMessages(['email' => 'Invalid credentials']);
    }
    $request->session()->regenerate();
    return response()->json(['user' => Auth::user()]);
}

// Protected route
Route::middleware('auth:sanctum')->get('/me', fn() => Auth::user());
```

## Migrations

```php
// database/migrations/xxxx_create_posts_table.php
Schema::create('posts', function (Blueprint $table) {
    $table->id();
    $table->foreignId('user_id')->constrained()->cascadeOnDelete();
    $table->string('title');
    $table->text('body')->nullable();
    $table->timestamp('published_at')->nullable();
    $table->timestamps();
    $table->index(['user_id', 'published_at']);
});
```

```bash
php artisan make:migration create_posts_table
php artisan migrate
php artisan migrate:rollback
php artisan migrate:fresh --seed     # nuke + reseed (dev only!)
```

## Queues + Jobs

```php
class SendWelcomeEmail implements ShouldQueue
{
    use Queueable;

    public function __construct(public User $user) {}

    public function handle(): void
    {
        Mail::to($this->user)->send(new WelcomeMail($this->user));
    }
}

// Dispatch
SendWelcomeEmail::dispatch($user);
SendWelcomeEmail::dispatch($user)->delay(now()->addMinutes(5));
SendWelcomeEmail::dispatch($user)->onQueue('emails');
```

Run worker: `php artisan queue:work --queue=emails,default`

Use **Redis** or **database** queue driver in production; **sync** only for tests.

## Events + Listeners

```php
event(new UserRegistered($user));

// Listener
class SendWelcomeNotification
{
    public function handle(UserRegistered $event): void
    {
        SendWelcomeEmail::dispatch($event->user);
    }
}
```

Decouples side effects from main flow. Listeners can be queueable.

## Cache

```php
Cache::remember('users.all', 3600, fn() => User::all());
Cache::forget('users.all');
Cache::tags(['users', 'posts'])->put('user.1', $user, 600);
```

Use **Redis** in production for tagging + atomic operations.

## Testing

```php
// tests/Feature/UserTest.php
class UserTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_register(): void
    {
        $response = $this->postJson('/api/register', [
            'email' => 'a@b.com',
            'password' => 'password123',
            'name' => 'Alice',
        ]);

        $response->assertCreated();
        $this->assertDatabaseHas('users', ['email' => 'a@b.com']);
    }
}
```

```bash
php artisan test
php artisan test --parallel
```

Use **factories** for test data, never hardcode:
```php
User::factory()->count(10)->create();
User::factory()->admin()->create();
```

## Best Practices

- **Form Requests** for all input validation — never `$request->all()` blindly
- **Resources** for all API responses — decouple from DB schema
- **Eager-load relationships** via `with()` — N+1 will eat your perf
- **Queues for slow work** — never block the HTTP response on email/PDF/etc.
- **Eloquent observers** for cross-cutting concerns (audit, cache invalidation)
- **Service classes** for complex business logic — keep controllers thin
- **`php artisan make:*`** generators — enforce consistent structure
- Use `.env` for secrets; never commit it; provide `.env.example`

## Common Pitfalls

- `Post::all()` then iterate → loads entire table; use chunking or pagination
- N+1 from `$posts->each(fn($p) => $p->user->name)` → forgot `with('user')`
- Mass assignment via `$request->all()` → use `$request->validated()` only
- `dd()` left in production code → leaks debug info
- `Carbon::now()` in DB queries → use raw expressions for tz-safe queries
- Mixing `web` + `api` middleware unintentionally → CSRF on API routes
- Putting business logic in controllers → extract to services

## Resources

- Docs: https://laravel.com/docs
- Laravel News: https://laravel-news.com
- Telescope (debugging): https://laravel.com/docs/telescope
- Horizon (queue dashboard): https://laravel.com/docs/horizon
- Laracasts (video tutorials): https://laracasts.com
