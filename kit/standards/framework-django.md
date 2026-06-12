# Django Standards

## Project Structure

```
myproject/
├── manage.py
├── pyproject.toml          # or requirements.txt
├── myproject/
│   ├── settings/
│   │   ├── base.py
│   │   ├── development.py
│   │   └── production.py
│   ├── urls.py
│   └── wsgi.py / asgi.py
├── apps/
│   ├── users/
│   │   ├── models.py
│   │   ├── views.py
│   │   ├── serializers.py  # DRF
│   │   ├── urls.py
│   │   ├── admin.py
│   │   └── tests/
│   └── posts/
└── templates/              # If server-rendering
```

Split `settings.py` into environments (`base.py` + overrides). Use `django-environ` to read `.env`.

## Models

- Inherit `models.Model`, keep migrations under version control
- Use `__str__` on every model — improves admin + shell debugging
- Prefer `null=False` (DB level) over Python `None` — use empty string for text, `0`/sentinel for numbers
- `verbose_name` + `help_text` on every non-obvious field
- Foreign keys: explicit `on_delete=` (no default) — `CASCADE`, `PROTECT`, `SET_NULL`
- Add `db_index=True` on frequently filtered fields; `Meta.indexes` for composite indexes

```python
class Post(models.Model):
    title = models.CharField(max_length=200, db_index=True)
    author = models.ForeignKey('users.User', on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [models.Index(fields=['author', '-created_at'])]
```

## Querysets

- **N+1 is the #1 Django killer** — use `select_related()` (FK joins) and `prefetch_related()` (reverse FK / M2M)
- `.only()` / `.defer()` to fetch fewer columns when working with large tables
- `.values()` / `.values_list()` for dict/tuple output (faster than full ORM objects)
- `bulk_create()` / `bulk_update()` for batch operations
- Use `django-debug-toolbar` in dev to catch N+1 immediately

```python
# Bad — N+1
for post in Post.objects.all():
    print(post.author.name)  # one query per post

# Good
for post in Post.objects.select_related('author'):
    print(post.author.name)  # single join
```

## Views

Class-based views (CBV) for CRUD, function-based (FBV) for one-off endpoints.

- **DRF (Django REST Framework)** for APIs — `ModelViewSet` + `Serializer` covers 80% of cases
- **Django Ninja** is a modern alternative — FastAPI-style with type hints, async support
- Plain Django views for HTML responses (admin, server-rendered pages)

```python
# DRF
from rest_framework import viewsets

class PostViewSet(viewsets.ModelViewSet):
    queryset = Post.objects.select_related('author').all()
    serializer_class = PostSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]
    filterset_fields = ['author', 'created_at']
```

## Auth

- Django's built-in auth covers session-based auth out of the box
- **djangorestframework-simplejwt** for JWT in DRF APIs
- **django-allauth** for social OAuth (Google, GitHub, etc.) + email verification
- **django-otp** for 2FA
- Never roll your own password hashing — `make_password()` + `check_password()`

## Permissions

- Per-view: `permission_classes = [IsAuthenticated, IsOwner]` in DRF
- Per-object: implement `has_object_permission()` in custom permission class
- Use **django-guardian** for row-level permissions if the built-in model isn't enough

## Settings

- `DEBUG=False` in production — non-negotiable
- `ALLOWED_HOSTS` explicit list — never `['*']` in production
- `SECRET_KEY` from env, rotate periodically
- `DATABASES` from env via `dj-database-url` or `django-environ`
- `STATIC_ROOT` / `MEDIA_ROOT` separated; serve via CDN or nginx, not Django

## Migrations

- `python manage.py makemigrations` then `migrate` — never edit migration files by hand for normal changes
- Squash migrations periodically (`squashmigrations`) to keep history manageable
- **Always test migrations on a staging copy of prod data** before applying to prod
- Use `RunPython` with `reverse_code` for data migrations — make them reversible

## Caching

- `CACHES` with Redis backend for distributed cache
- `cache_page` decorator for view-level cache
- Low-level cache API for queryset/object caching: `cache.get_or_set('key', expensive_call, 300)`
- Cache invalidation via signals (`post_save`, `post_delete`) or explicit `cache.delete()`

## Testing

- **pytest-django** over Django's built-in test runner — better fixtures, parallel execution
- `pytest.mark.django_db` for tests that hit DB
- **Factory Boy** for test data instead of fixtures
- `Client` for view tests, `APIClient` for DRF
- Separate fast unit tests from slow integration tests; tag with `pytest.mark.slow`

## Security

- `django.middleware.security.SecurityMiddleware` enabled by default — keep it
- `SECURE_SSL_REDIRECT`, `SECURE_HSTS_SECONDS`, `SESSION_COOKIE_SECURE`, `CSRF_COOKIE_SECURE` in production
- CSRF protection on all forms — never disable globally
- File uploads: validate MIME + size; never trust `Content-Type` header
- Use `nh3` to sanitize HTML user input

## Performance

- Database connection pooling via **PgBouncer** for high-traffic apps
- **gunicorn** with `gevent` or `uvicorn` workers (ASGI for async)
- **whitenoise** for static files in containerized deployments
- Profile with **silk** or **django-debug-toolbar** in dev
- Async views (`async def`) for I/O-bound endpoints (Django 4.1+).
  Async views only help for I/O-bound work outside the ORM — Django's ORM is not truly async yet, even with `afirst()`/`aget()` variants.

## Common Pitfalls

- N+1 queries (use `select_related` / `prefetch_related`)
- Forgetting `auto_now_add` vs `auto_now` — first is "set once", second is "update each save".
  `auto_now_add` / `auto_now` make the field read-only on save — avoid them if you need to manually set timestamps (e.g., in tests or import scripts).
- Not running `collectstatic` in production — broken admin styles
- `DEBUG=True` in production — leaks settings + stack traces

## Production

- Reverse proxy: nginx in front of gunicorn/uvicorn
- Static files: `collectstatic` → CDN (CloudFront, Cloudflare, BunnyCDN)
- Media files: S3 / R2 via **django-storages**
- Background jobs: **Celery** + Redis/RabbitMQ
- Monitoring: **Sentry** for errors, Prometheus for metrics, structured JSON logging
- Outside containers, sink logs to `journald` via [`chameleon-log`](https://pypi.org/project/chameleon-log/) or [`structlog-journald`](https://pypi.org/project/structlog-journald/) to keep structured logging benefits
