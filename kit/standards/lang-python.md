# Python Standards (3.11+)

## Comments

### Docstrings (PEP 257 — Google style preferred)
```python
def get_user(user_id: str) -> User | None:
    """Look up a user by ID.

    Why this function exists + non-obvious contract.

    Args:
        user_id: Must be a valid UUID string.

    Returns:
        The user, or None when soft-deleted.

    Raises:
        NotFoundError: When user_id doesn't exist in the store.
        ValueError: When user_id is not a valid UUID.
    """
```

- Docstring required on every public module, class, function, and method
- Always document `Raises:` — Python has no checked exceptions; callers depend on docstrings
- Omit docstrings for private (`_prefixed`) functions when the signature + name are obvious
- First line is a one-sentence summary, blank line, then full description

### Type Hints (MANDATORY for public API)
Type hints are the contract — runtime can't enforce them, so be precise.
```python
from collections.abc import Iterable, Mapping
from typing import Protocol

def aggregate(items: Iterable[int]) -> int: ...

# Prefer abstract types in parameters (Iterable, Mapping), concrete in returns (list, dict)
def names(users: Iterable[User]) -> list[str]: ...

# Protocols over inheritance for duck-typed interfaces
class Closeable(Protocol):
    def close(self) -> None: ...
```

### Anchor Comments
- `# NOTE:` — non-obvious invariant
- `# TODO(owner):` / `# FIXME(owner):` — include owner + issue
- `# type: ignore[code]  # reason: ...` — reason mandatory

## Key Idioms

### Modern Python (3.10+)
```python
# Pattern matching — exhaustive over sealed shapes
match result:
    case Success(value=v):     handle_ok(v)
    case Failure(reason=r):    handle_err(r)
    case _:                    raise AssertionError("unreachable")

# Union via | (PEP 604)
def find(id: str) -> User | None: ...

# Built-in generics — no need to import from typing for these
items: list[int] = []
mapping: dict[str, User] = {}
```

### Data Classes & Frozen Objects
```python
from dataclasses import dataclass, field

@dataclass(frozen=True, slots=True)
class User:
    id: str
    name: str
    role: Role = Role.MEMBER
    tags: list[str] = field(default_factory=list)

# frozen=True → hashable + immutable; slots=True → faster + less memory
# Prefer over plain classes for value objects
```

### Error Handling
```python
# Define domain-specific exceptions, never raise bare Exception
class NotFoundError(LookupError):
    """Raised when a requested entity is absent."""

# Chain with `from` to preserve context
try:
    parse(raw)
except ValueError as e:
    raise ConfigError("bad config") from e

# Narrow except — never bare `except:` or `except Exception:` outside top-level
try:
    user = load(id)
except (NotFoundError, PermissionError) as e:
    log.warning("load failed: %s", e)
```

### Context Managers
```python
# Always use `with` for resources — files, locks, connections
with open(path, encoding="utf-8") as f:
    data = f.read()

# contextlib for ad-hoc context managers
from contextlib import contextmanager
@contextmanager
def timed(label: str):
    start = time.monotonic()
    try:
        yield
    finally:
        log.info("%s took %.3fs", label, time.monotonic() - start)
```

### Async
```python
import asyncio

async def fetch_user(id: str) -> User: ...

# Run independent coroutines concurrently
users = await asyncio.gather(fetch_user(a), fetch_user(b))

# TaskGroup (3.11+) — cancels siblings on first failure
async with asyncio.TaskGroup() as tg:
    t1 = tg.create_task(fetch_user(a))
    t2 = tg.create_task(fetch_user(b))

# Never mix sync blocking calls in async code — use asyncio.to_thread for blocking I/O
```

### Comprehensions & Iteration
```python
# Comprehensions for transformation, not side effects
names = [u.name for u in users if u.active]
by_id = {u.id: u for u in users}

# Generators for streaming / large data
def parse_lines(path: str):
    with open(path) as f:
        for line in f:
            yield parse(line.strip())
```

### Patterns to Avoid
```python
# mutable default args — shared across calls!
def bad(items=[]): ...                    # never
def good(items: list | None = None):      # always
    items = items if items is not None else []

# Don't compare with == None / == True
if x is None: ...                         # good
if x is True: ...                         # only when you mean exact identity

# Don't use lambdas where def reads better
key = lambda u: u.name                    # OK inline
def by_name(u): return u.name             # better when reused
```

## Naming (PEP 8)
- Modules/packages: `snake_case` (filenames also `snake_case.py` — Python convention, NOT kebab-case)
- Classes/Exceptions: `PascalCase` (`User`, `NotFoundError`)
- Functions/variables: `snake_case`
- Constants: `SCREAMING_SNAKE_CASE`
- Private: `_leading_underscore`; name-mangled: `__double_leading` (rarely needed)
- Boolean: `is_x`, `has_x`, `can_x`

## Tooling
- Format: `ruff format` (Black-compatible) — line length 100 unless project differs
- Lint: `ruff check` — covers flake8, isort, pyupgrade, bugbear
- Types: `mypy --strict` or `pyright` for new code
- Tests: `pytest`, fixtures over setUp/tearDown
- Manage deps with `uv` or `poetry`; lock files committed

## Imports
```python
# 1. stdlib
import asyncio
from pathlib import Path

# 2. third-party
import httpx

# 3. local
from myapp.users import User
from .store import load

# Avoid `from module import *` — pollutes namespace
# Avoid relative imports across packages — use absolute
```
