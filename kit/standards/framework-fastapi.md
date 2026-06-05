# FastAPI Standards

## Project Structure

```
app/
├── main.py             # FastAPI app instance, middleware, routers mount
├── api/
│   ├── deps.py         # Shared dependencies (DB session, current user)
│   └── v1/
│       ├── routes/
│       │   ├── users.py
│       │   └── posts.py
│       └── api.py      # APIRouter aggregation
├── core/
│   ├── config.py       # Settings via pydantic-settings
│   └── security.py     # JWT, password hashing
├── db/
│   ├── base.py         # SQLAlchemy declarative base
│   └── session.py      # engine + SessionLocal
├── models/             # SQLAlchemy ORM models
├── schemas/            # Pydantic request/response models
└── services/           # Business logic
```

Routes thin, services contain logic, models = ORM, schemas = Pydantic.

## Pydantic Models

Pydantic v2 is the standard. Separate request/response/DB schemas:

```python
from pydantic import BaseModel, EmailStr, ConfigDict

class UserBase(BaseModel):
    email: EmailStr
    name: str

class UserCreate(UserBase):
    password: str

class UserRead(UserBase):
    id: int
    model_config = ConfigDict(from_attributes=True)  # ORM mode in v2
```

## Dependency Injection

`Depends()` is the core idiom — composable, testable, type-safe:

```python
from typing import Annotated
from fastapi import Depends

async def get_db() -> AsyncSession:
    async with SessionLocal() as session:
        yield session

DBSession = Annotated[AsyncSession, Depends(get_db)]

@router.get("/users/{id}")
async def get_user(id: int, db: DBSession) -> UserRead:
    return await user_service.get(db, id)
```

## Async + Sync

- Use `async def` for I/O-bound endpoints (DB, HTTP calls)
- Use `def` for CPU-bound work — FastAPI runs them in threadpool
- Don't mix — `await` inside `def` is a syntax error
- DB: prefer **SQLAlchemy 2.0 async** (`AsyncSession`) for production

## Database

- **SQLAlchemy 2.0** for ORM — async support, type-safe queries
- **Alembic** for migrations — generate from model changes, review before applying
- **asyncpg** as Postgres driver — fastest async option
- Connection pooling: configure `pool_size` + `max_overflow` based on worker count

## Auth

- OAuth2 password flow + JWT for typical APIs
- `passlib[bcrypt]` for password hashing — never SHA/MD5
- Tokens: short-lived access (15min) + long-lived refresh (7-30 days)
- `python-jose` or `pyjwt` for JWT encode/decode
- Use `OAuth2PasswordBearer` for `Authorization: Bearer` flow

## Settings

`pydantic-settings` with env var loading:

```python
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    database_url: str
    secret_key: str
    model_config = SettingsConfigDict(env_file='.env', case_sensitive=False)

settings = Settings()
```

## Error Handling

- Raise `HTTPException(status_code=404, detail="Not found")` for known errors
- Custom exceptions: subclass `Exception`, register handler with `@app.exception_handler(MyError)`
- Validation errors auto-convert to 422 — Pydantic handles this
- Don't leak DB exceptions; catch + re-raise as `HTTPException`

## Background Tasks

- `BackgroundTasks` for fire-and-forget after-response work (send email, log analytics)
- **Celery** + **Redis** for serious queue workloads (retries, scheduling, fan-out)
- **arq** as a lighter Redis-only alternative to Celery

## Testing

- **pytest** + **httpx** AsyncClient for endpoint tests
- `TestClient` (sync) for simpler tests, `AsyncClient` for async fixtures
- Test database: separate from dev, run migrations on setup, truncate between tests
- Fixtures via `pytest-asyncio` + `pytest-mock`

```python
@pytest.mark.asyncio
async def test_create_user(client: AsyncClient):
    response = await client.post('/users', json={'email': 'a@b.com', 'password': 'x'})
    assert response.status_code == 201
```

## Performance

- **uvicorn** + `--workers N` for production (N = 2 × CPU cores)
- **gunicorn** + `uvicorn.workers.UvicornWorker` for advanced process management
- Enable `--http httptools` and `--loop uvloop` for speed
- Response models: declare `response_model=UserRead` — strips unused fields, validates
- Use `ORJSONResponse` as default response class for 2-3x faster JSON

## Security

- CORS: `from fastapi.middleware.cors import CORSMiddleware` with explicit origin list
- Trusted host middleware to prevent host header attacks
- Rate limiting: `slowapi` (Redis-backed) or reverse proxy (nginx/Caddy)
- Don't echo back user input verbatim in errors — XSS risk on HTML responses

## OpenAPI

- FastAPI auto-generates `/docs` (Swagger) and `/redoc`
- Add `summary` + `description` to endpoints for better docs
- Tag routes (`tags=['users']`) for grouped Swagger UI
- Hide docs in production via `app = FastAPI(docs_url=None, redoc_url=None)` if API is private

## Common Pitfalls

- Using sync ORM in async endpoint — blocks event loop, kills throughput
- Forgetting `await` on async calls — silent bug, often returns coroutine object
- Not closing DB sessions — leaks connections, eventually exhausts pool
- Putting business logic in route handlers — extract to services for testability
- Catching `Exception` broadly — hides real errors; catch specific types

## Production

- Deploy behind nginx/Caddy or AWS ALB
- Health check endpoint: `GET /health` returning `{"status": "ok"}`
- Structured logging: **structlog** or **loguru** — JSON output for log aggregation
- Metrics: `prometheus-fastapi-instrumentator` for Prometheus scraping
- Tracing: **opentelemetry-instrumentation-fastapi**
