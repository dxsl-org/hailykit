# SQLAlchemy Standards

Detected via `sqlalchemy` in Python deps — auto-injected as **extra**.

Target **SQLAlchemy 2.0+** — significantly improved API with `select()` everywhere, type hints, mapped_column.

## Two Layers

- **Core** — SQL expression language, table objects, low-level
- **ORM** — class-based mapping on top of Core

For most apps, use ORM. Drop to Core for complex bulk operations.

## Setup (Async — Recommended for New Code)

```python
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

engine = create_async_engine(
    "postgresql+asyncpg://user:pass@localhost/db",
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,        # detect dead conns
    echo=False,                 # True for SQL logging in dev
)

async_session_factory = async_sessionmaker(engine, expire_on_commit=False)
```

`asyncpg` driver for Postgres (fastest). MySQL: `aiomysql`. SQLite: `aiosqlite`.

## Declarative Models (2.0 Syntax)

```python
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy import String, Integer, ForeignKey, DateTime
from datetime import datetime

class Base(DeclarativeBase):
    pass

class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)

    posts: Mapped[list["Post"]] = relationship(back_populates="author")

class Post(Base):
    __tablename__ = "posts"

    id: Mapped[int] = mapped_column(primary_key=True)
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    title: Mapped[str]
    body: Mapped[str | None]

    author: Mapped[User] = relationship(back_populates="posts")
```

`Mapped[T]` + `mapped_column()` — type hints are now first-class.

## Sessions (Async)

```python
async def get_user(session: AsyncSession, user_id: int) -> User | None:
    result = await session.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()

# In FastAPI / Litestar / etc.
async def get_db():
    async with async_session_factory() as session:
        yield session
```

Always close sessions (`async with`). Don't reuse across requests.

## Queries (2.0 Style — `select()`)

```python
from sqlalchemy import select, and_, or_, func

# Simple
stmt = select(User).where(User.email == "a@b.com")
user = (await session.execute(stmt)).scalar_one_or_none()

# Multiple conditions
stmt = select(User).where(User.age >= 18, User.is_active == True)

# Order, limit, offset
stmt = select(User).order_by(User.created_at.desc()).limit(10).offset(20)

# Joins + eager load
from sqlalchemy.orm import selectinload

stmt = select(User).options(selectinload(User.posts)).where(User.id == 1)

# Aggregation
stmt = select(User.city, func.count(User.id)).group_by(User.city)
result = (await session.execute(stmt)).all()      # list of tuples
```

The `select()` API is unified across Core + ORM in 2.0. No more `session.query()` (deprecated).

## Inserts + Updates

```python
# Insert single
user = User(email="a@b.com", name="Alice")
session.add(user)
await session.commit()
await session.refresh(user)                # populate id + defaults

# Insert many
users = [User(email=f"u{i}@example.com", name=f"User {i}") for i in range(100)]
session.add_all(users)
await session.commit()

# Update
user.name = "Alice Renamed"
await session.commit()

# Bulk update (no Python objects, faster)
from sqlalchemy import update
await session.execute(
    update(User).where(User.age < 18).values(is_minor=True)
)
await session.commit()

# Delete
await session.delete(user)
await session.commit()
```

## Eager Loading (N+1 Prevention)

```python
from sqlalchemy.orm import selectinload, joinedload

# selectinload — separate SELECT IN query (best for collections)
stmt = select(User).options(selectinload(User.posts))

# joinedload — JOIN in same query (best for to-one relationships)
stmt = select(Post).options(joinedload(Post.author))

# Deep nesting
stmt = select(User).options(
    selectinload(User.posts).selectinload(Post.comments)
)
```

**Always eager-load relationships you'll access** — N+1 is the #1 SQLAlchemy perf killer.

## Repository Pattern

```python
class UserRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def find(self, user_id: int) -> User | None:
        return await self.session.get(User, user_id)

    async def find_by_email(self, email: str) -> User | None:
        result = await self.session.execute(select(User).where(User.email == email))
        return result.scalar_one_or_none()

    async def create(self, *, email: str, name: str) -> User:
        user = User(email=email, name=name)
        self.session.add(user)
        await self.session.flush()       # get id without commit
        return user

    async def list(self, limit: int = 20, offset: int = 0) -> list[User]:
        result = await self.session.execute(
            select(User).order_by(User.id).limit(limit).offset(offset)
        )
        return list(result.scalars().all())
```

Keeps queries in one place, services use repository methods.

## Migrations (Alembic)

```bash
alembic init alembic
# Edit alembic/env.py to set target_metadata = Base.metadata
alembic revision --autogenerate -m "create users table"
alembic upgrade head
alembic downgrade -1
```

`autogenerate` diffs DB schema vs models — review the generated file (it's not always perfect).

## Connection Pooling

```python
engine = create_async_engine(
    DB_URL,
    pool_size=20,           # persistent connections
    max_overflow=10,         # extra connections under load
    pool_timeout=30,         # seconds to wait for connection
    pool_recycle=1800,       # recycle after 30 min (avoid stale)
    pool_pre_ping=True,      # ping before reuse (slight overhead, robust)
)
```

For serverless: use **NullPool** (no pooling) + external pooler like **PgBouncer**.

## Transactions

```python
async with session.begin():       # auto-commits on exit, rolls back on error
    user = User(email="a@b.com", name="Alice")
    session.add(user)
    audit = AuditLog(action="user_created")
    session.add(audit)
# both committed atomically

# Nested savepoint
async with session.begin():
    user = await session.get(User, 1)
    try:
        async with session.begin_nested():
            user.name = "..."
            # may raise
    except SomeError:
        pass  # only inner block rolled back
```

## SQL Logging

```python
engine = create_async_engine(DB_URL, echo=True)
```

`echo=True` prints every query — invaluable in dev, never in prod.

## Best Practices

- **Use SQLAlchemy 2.0 syntax** — `select()`, `Mapped[]`, `mapped_column()`
- **Async by default** for new code — `asyncpg` driver + `AsyncSession`
- **Eager-load relationships** with `selectinload` / `joinedload` — N+1 is brutal
- **Repository pattern** to centralize queries
- **Alembic** for migrations — never use `Base.metadata.create_all()` in prod
- **`expire_on_commit=False`** for async sessions — keeps objects usable after commit
- **Pydantic + SQLAlchemy = SQLModel** if you want one model for both layers

## Common Pitfalls

- N+1 queries from lazy-loaded relationships — always eager-load what you access
- Using `session.query()` (1.x style) → deprecated; use `session.execute(select(...))`
- Sharing sessions across requests → race conditions; one per request
- Modifying objects after session close → DetachedInstanceError
- Forgetting `await session.commit()` → changes never persist
- Bulk insert via `for x: session.add(x)` then commit → slow; use `session.add_all(list)`
- Async + sync drivers mixed → silent failures; use `asyncpg` not `psycopg2` with async

## Resources

- Docs: https://docs.sqlalchemy.org
- 2.0 tutorial: https://docs.sqlalchemy.org/en/20/tutorial
- Async docs: https://docs.sqlalchemy.org/en/20/orm/extensions/asyncio.html
- Alembic: https://alembic.sqlalchemy.org
- SQLModel: https://sqlmodel.tiangolo.com
