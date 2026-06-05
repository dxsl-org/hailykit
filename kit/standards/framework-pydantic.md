# Pydantic Standards

Detected via `pydantic` in Python deps — auto-injected as **extra**.

Target **Pydantic v2** — significantly faster (Rust-backed core) and has breaking API changes from v1.

## Core: BaseModel

```python
from pydantic import BaseModel, EmailStr, Field

class User(BaseModel):
    id: int
    email: EmailStr
    name: str = Field(min_length=1, max_length=100)
    age: int = Field(ge=0, le=120)
    is_active: bool = True

# Construction validates
user = User(id=1, email="a@b.com", name="Alice", age=30)
# Invalid → ValidationError with field details
user = User(id="not-an-int", email="bad", name="", age=999)  # raises
```

Pydantic models are **runtime-validated** + **type-annotated** — best of both worlds.

## Field

```python
from pydantic import Field

class Config(BaseModel):
    api_key: str = Field(min_length=32, description="API authentication token")
    timeout: float = Field(default=30.0, gt=0, le=300)
    retries: int = Field(default=3, ge=0)
    tags: list[str] = Field(default_factory=list)        # mutable default → factory
    secret: str = Field(repr=False)                      # exclude from repr/str
    name: str = Field(alias="userName")                  # JSON key differs from attr
```

## Validators

```python
from pydantic import field_validator, model_validator

class User(BaseModel):
    email: str
    password: str
    confirm_password: str

    @field_validator("email")
    @classmethod
    def email_lowercase(cls, v: str) -> str:
        return v.lower()

    @model_validator(mode="after")
    def passwords_match(self) -> "User":
        if self.password != self.confirm_password:
            raise ValueError("passwords don't match")
        return self
```

`@field_validator` for per-field; `@model_validator` for cross-field logic.

## Computed Fields

```python
from pydantic import computed_field

class Rectangle(BaseModel):
    width: float
    height: float

    @computed_field
    @property
    def area(self) -> float:
        return self.width * self.height

r = Rectangle(width=3, height=4)
r.area              # 12
r.model_dump()      # includes "area"
```

## Serialization

```python
user.model_dump()                          # → dict
user.model_dump_json()                      # → JSON string
user.model_dump(exclude={"password"})       # exclude fields
user.model_dump(by_alias=True)              # use aliases as keys

# From input
User.model_validate({"id": 1, "email": "a@b.com", ...})       # from dict
User.model_validate_json('{"id": 1, ...}')                     # from JSON string
```

(v1 → v2 rename: `.dict()` → `.model_dump()`, `.json()` → `.model_dump_json()`)

## Generic Types

```python
from typing import TypeVar, Generic

T = TypeVar("T")

class Response(BaseModel, Generic[T]):
    data: T
    error: str | None = None

class User(BaseModel):
    name: str

resp = Response[User](data=User(name="Alice"))
```

## Config

```python
class StrictModel(BaseModel):
    model_config = {
        "str_strip_whitespace": True,           # auto-strip strings
        "validate_assignment": True,             # validate on attr set, not just init
        "extra": "forbid",                       # raise on unknown fields (vs "allow"/"ignore")
        "frozen": True,                          # immutable
        "use_enum_values": True,                 # serialize enum.value not enum
    }
```

Set per-model. Or use `pydantic-settings` for app-wide settings (see below).

## pydantic-settings (Env Var Loading)

```python
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    database_url: str
    redis_url: str = "redis://localhost:6379"
    secret_key: str
    debug: bool = False

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

settings = Settings()    # reads env vars + .env file
```

Replaces `python-dotenv` + manual `os.getenv` boilerplate.

## Discriminated Unions

```python
from pydantic import BaseModel, Field
from typing import Literal, Union

class CreditCard(BaseModel):
    type: Literal["credit_card"]
    number: str

class BankTransfer(BaseModel):
    type: Literal["bank_transfer"]
    iban: str

class Order(BaseModel):
    payment: Union[CreditCard, BankTransfer] = Field(discriminator="type")

# Auto-routes by `type` field
order = Order(payment={"type": "credit_card", "number": "4242..."})
isinstance(order.payment, CreditCard)   # True
```

Cleaner than `if-elif` parsing on JSON unions.

## Dataclasses Integration

```python
from pydantic.dataclasses import dataclass

@dataclass
class User:
    id: int
    email: str
    age: int = 0
```

Same validation power, dataclass syntax. Use when `BaseModel` feels heavy.

## Best Practices

- **v2 syntax**: `model_dump()` over `.dict()`, `model_validate()` over `parse_obj()`
- **Use `EmailStr`, `HttpUrl`, `AnyUrl`** for validated string types (need `pydantic[email]`)
- **`@field_validator`** with `@classmethod` decorator — required in v2
- **`extra="forbid"`** for API request models — reject unknown fields (catches typos)
- **`pydantic-settings`** for app config — env + .env + dotenv-style
- **Discriminated unions** over manual type-checking after JSON parse
- **Computed fields** to derive values without storing — kept in sync with source fields

## Common Pitfalls

- v1 → v2 migration: many renames; use `bump-pydantic` tool for automated upgrade
- `.dict()` / `.json()` still work in v2 but deprecated — use `model_dump()` / `model_dump_json()`
- Mutable defaults: `tags: list = []` shares across instances → use `Field(default_factory=list)`
- Forgetting `@classmethod` on `@field_validator` → silent broken behavior
- `EmailStr` requires `email-validator` package — install via `pydantic[email]`
- Performance: v2 is 5-50x faster than v1 — upgrade old projects
- ORM mode: v2 uses `model_config = {"from_attributes": True}` (was `Config.orm_mode = True` in v1)

## Integration

- **FastAPI** uses Pydantic for request/response validation
- **Litestar** uses pydantic v2 + msgspec interchangeably
- **SQLModel** (FastAPI author's project) marries Pydantic + SQLAlchemy
- **Beanie** = Pydantic + MongoDB ODM
- **Edgy / Ormar** = Pydantic + SQL ORMs

## Resources

- Docs: https://docs.pydantic.dev
- Migration guide: https://docs.pydantic.dev/latest/migration
- pydantic-settings: https://docs.pydantic.dev/latest/concepts/pydantic_settings
- Performance: https://docs.pydantic.dev/latest/internals/architecture
