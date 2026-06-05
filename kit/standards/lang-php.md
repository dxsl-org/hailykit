# PHP Standards

## Comments

### PHPDoc (public class members)
```php
/**
 * Why this method exists + non-obvious contract.
 *
 * @param string $userId Must be a valid UUID
 * @return User|null Null when user is soft-deleted
 * @throws UserNotFoundException When userId doesn't exist in the store
 */
public function getUser(string $userId): ?User
```

- Required on all public methods, properties, and class declarations
- Omit PHPDoc for private/protected members when signature is self-documenting
- Always document `@throws` — PHP has no checked exceptions; callers need this
- When using constructor property promotion, document in class-level docblock, not per-property

### Inline Comments
- PSR-12: use `//` for single-line logic notes; `/* */` only for disabling blocks temporarily
- `// @phpstan-ignore-next-line reason: ...` — reason is mandatory, never ignore silently
- `// @var Type $var` — use when static analysis cannot infer type (e.g., mixed from legacy APIs)

### Nullable and Union Types
Document the conditions under which `null` is returned — type hint alone is insufficient:
```php
// Returns null only when the cache is cold; never null after first hydration
public function getCachedConfig(): ?Config
```

## Key Idioms

- Prefer strict types: `declare(strict_types=1)` at top of every file
- Prefer named arguments over positional for functions with 3+ params
- Exception hierarchy: extend domain-specific base exceptions (`DomainException`, `RuntimeException`); never throw bare `\Exception`
- Prefer `match` over `switch` for exhaustive value mapping — enforces no fall-through
- Null coalescing: `??` is fine, but document when the fallback has semantic meaning beyond "default"
- Constructor promotion: acceptable for simple value objects; avoid for services with complex initialization
