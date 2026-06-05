# Litestar Standards

Detected via `litestar` in `requirements.txt` / `pyproject.toml` / `Pipfile`.

## What Litestar Is

Litestar (formerly Starlite) is a modern, async-first ASGI framework — competitor to FastAPI with stronger opinions:
- **Dependency injection** as a first-class system (not just a function decorator)
- **Plugin architecture** with built-in adapters (SQLAlchemy, Piccolo, Tortoise)
- Built-in OpenAPI, JWT, OAuth2 password flow
- DTO layer separates HTTP schemas from DB models cleanly

## When to Use

- Want FastAPI ergonomics + more structure (controllers, DTOs, DI containers)
- Building larger APIs where FastAPI's flat-function style gets unwieldy
- Need built-in SQLAlchemy plugin with repository pattern
- Want server-rendered HTML + APIs in one framework (Litestar has good template support)

## Setup

```bash
pip install litestar uvicorn
```

```python
# app.py
from litestar import Litestar, get

@get("/")
async def hello() -> dict:
    return {"hello": "world"}

app = Litestar(route_handlers=[hello])
```

```bash
litestar run --reload   # or: uvicorn app:app --reload
```

## Controllers (Route Grouping)

```python
from litestar import Controller, get, post, Request
from litestar.di import Provide

class UserController(Controller):
    path = "/users"
    tags = ["users"]

    @get()
    async def list_users(self) -> list[dict]:
        return [{"id": 1, "email": "a@b.com"}]

    @get("/{user_id:int}")
    async def get_user(self, user_id: int) -> dict:
        return {"id": user_id}

    @post()
    async def create_user(self, data: dict) -> dict:
        return {"id": 2, **data}

app = Litestar(route_handlers=[UserController])
```

## Dependency Injection

```python
from litestar import get
from litestar.di import Provide

async def get_db() -> AsyncIterator[Session]:
    async with SessionLocal() as session:
        yield session

@get("/users/{id:int}", dependencies={"db": Provide(get_db)})
async def get_user(id: int, db: Session) -> dict:
    user = await db.get(User, id)
    return {"id": user.id, "email": user.email}

# Or app-wide
app = Litestar(
    route_handlers=[...],
    dependencies={"db": Provide(get_db)},
)
```

DI is hierarchical — define at app, controller, or route level. Lower scope overrides higher.

## DTOs (Data Transfer Objects)

Litestar's DTO layer decouples HTTP shape from DB models:

```python
from dataclasses import dataclass
from litestar.dto import DTOConfig, DataclassDTO

@dataclass
class User:
    id: int
    email: str
    password_hash: str
    created_at: datetime

class UserReadDTO(DataclassDTO[User]):
    config = DTOConfig(exclude={"password_hash"})       # never expose

class UserWriteDTO(DataclassDTO[User]):
    config = DTOConfig(exclude={"id", "created_at"})    # client doesn't set

@post("/users", dto=UserWriteDTO, return_dto=UserReadDTO)
async def create_user(data: User) -> User:
    # `data` is a User, but only writeable fields populated
    user = await user_service.create(data)
    return user
```

## SQLAlchemy Plugin

```python
from litestar.plugins.sqlalchemy import SQLAlchemyAsyncConfig, SQLAlchemyPlugin

db_config = SQLAlchemyAsyncConfig(
    connection_string="postgresql+asyncpg://user:pass@localhost/db",
    metadata=Base.metadata,
    create_all=True,
)

app = Litestar(plugins=[SQLAlchemyPlugin(config=db_config)])
```

Inject `AsyncSession` via DI; the plugin handles connection lifecycle.

## Validation

Litestar uses **msgspec** by default (faster than pydantic), but pydantic is also supported:

```python
from msgspec import Struct

class UserCreate(Struct):
    email: str
    age: int

@post("/users")
async def create(data: UserCreate) -> UserCreate:
    return data
```

For pydantic v2:
```python
from pydantic import BaseModel, EmailStr

class UserCreate(BaseModel):
    email: EmailStr
    age: int = Field(ge=13)
```

Both produce automatic 400 responses on invalid input.

## Auth

```python
from litestar.security.jwt import JWTAuth

jwt_auth = JWTAuth[User](
    retrieve_user_handler=retrieve_user,
    token_secret=settings.JWT_SECRET,
    exclude=["/login", "/register", "/schema"],
)

@post("/login")
async def login(data: LoginRequest) -> Response[User]:
    user = await authenticate(data.email, data.password)
    return jwt_auth.login(identifier=str(user.id), response_body=user)

app = Litestar(
    route_handlers=[login, protected_handler],
    on_app_init=[jwt_auth.on_app_init],
)
```

Built-in JWT + OAuth2 password flow + session auth. No third-party libs needed for typical setups.

## OpenAPI / Schema

Auto-generated from type hints — available at `/schema` (Swagger UI), `/schema/redoc`, `/schema/elements`.

Customize:
```python
from litestar.openapi import OpenAPIConfig

app = Litestar(
    route_handlers=[...],
    openapi_config=OpenAPIConfig(title="My API", version="1.0.0", description="..."),
)
```

## Middleware

```python
from litestar.middleware import DefineMiddleware

async def logging_middleware(scope, receive, send):
    # ASGI-style middleware
    ...

app = Litestar(middleware=[DefineMiddleware(logging_middleware)])
```

Or use the abstract class `AbstractMiddleware` for class-based middleware.

## Testing

```python
from litestar.testing import TestClient

def test_get_user():
    with TestClient(app=app) as client:
        response = client.get("/users/1")
        assert response.status_code == 200
        assert response.json()["id"] == 1
```

Built on httpx, supports async tests via `AsyncTestClient`.

## Best Practices

- **Controllers** for related routes — keeps file structure clean
- **DTOs** for any model that touches HTTP — never expose ORM models directly
- DI for everything dependency-like — sessions, settings, repositories
- Type-hint everything — Litestar uses hints for validation, serialization, OpenAPI
- msgspec for hot paths (faster than pydantic), pydantic where ecosystem matters
- Run via `litestar run` in dev, `uvicorn` with `--workers N` in prod

## Common Pitfalls

- Mixing pydantic + msgspec DTOs randomly → pick one for consistency
- Forgetting `dependencies={}` parameter → DI lookups fail at runtime
- Exposing ORM models directly without DTO → leaks fields like `password_hash`
- Heavy CPU work in async handler → blocks event loop; offload to executor
- `litestar run` in production — use `uvicorn` with workers + supervisor

## Resources

- Docs: https://docs.litestar.dev
- GitHub: https://github.com/litestar-org/litestar
- Plugins: https://docs.litestar.dev/latest/usage/plugins
- Discord: https://discord.gg/litestar
