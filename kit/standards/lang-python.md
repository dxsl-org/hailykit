# Python Standards (Prefer 3.12+ for new projects)

## Comments

### Docstrings (PEP 257 — Sphinx/reST style preferred)
```python
def get_user(user_id: str) -> User | None:
    """Look up a user by ID.

    Why this function exists + non-obvious contract.

    :param user_id: Must be a valid UUID string.
    :returns: The user, or None when soft-deleted.
    :raises NotFoundError: When user_id doesn't exist in the store.
    :raises ValueError: When user_id is not a valid UUID.
    """
```

- Docstring required on every public module, class, function, and method
- Always document `:raises:` — Python has no checked exceptions; callers depend on docstrings
- Omit docstrings for private (`_prefixed`) functions when the signature + name are obvious
- First line is a one-sentence summary, blank line, then full description
- Fall back to Google style only when **both** are true: existing functions already use it **and** the project has no Sphinx setup (no `docs/conf.py`, no `sphinx` in `pyproject.toml`). If Sphinx is configured, always use reST.
- Omit `:type` and `:rtype` directives when the function already has type annotations — Sphinx pulls them into the generated docs automatically

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

Prefer `pathlib.Path` over `os.path` for file operations:

```py
# file_path is of `pathlib.Path` type

with file_path.open() as f:
    f.read()

# Quicker ways
content = file_path.read_text()
file_path.write_text(new_content)
```


### Async
```python
import asyncio

async def fetch_user(id: str) -> User: ...

# Run independent coroutines concurrently
users = await asyncio.gather(fetch_user(a), fetch_user(b))
# Avoid deeply nested asyncio.gather — hard to reason about cancellation

# TaskGroup (3.11+) — cancels siblings on first failure
async with asyncio.TaskGroup() as tg:
    t1 = tg.create_task(fetch_user(a))
    t2 = tg.create_task(fetch_user(b))

# Never mix sync blocking calls in async code — use asyncio.to_thread for blocking I/O
```

Use `async with` for async resources — sync `with` won't await cleanup.

### Comprehensions & Iteration
```python
# Comprehensions for transformation, not side effects
names = [u.name for u in users if u.active]
by_id = {u.id: u for u in users}

# Generators for streaming / large data
def parse_lines(path: Path):
    with path.open() as f:
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
def by_name(u):
    return u.name                         # better when reused
```

## Naming (PEP 8)
- Modules/packages: `snake_case` (filenames also `snake_case.py` — Python convention, NOT kebab-case)
- Classes/Exceptions: `PascalCase` (`User`, `NotFoundError`)
- Functions/variables: `snake_case`
- Constants: `SCREAMING_SNAKE_CASE`
- Private: `_leading_underscore`; name-mangled: `__double_leading` (rarely needed)
- Boolean: `is_x`, `has_x`, `can_x`, `should_`

## Tooling
- Format: `ruff format` (Black-compatible) — line length 100 unless project differs
- Lint: `ruff check` — covers flake8, isort, pyupgrade, bugbear
- Types: `mypy --strict` or `pyright`; `zuban` (Rust-based, 20–200× faster) is an option for greenfield projects — note AGPL-3.0 license (commercial use requires a paid license) and pre-1.0 API stability
- Tests: `pytest`, fixtures over setUp/tearDown, function-based test cases over class-based
- Manage deps with `uv` or `pdm`; lock files committed

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
