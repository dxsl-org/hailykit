# Java Standards

## Comments

### Javadoc (public API only)
```java
/**
 * Why this method exists + non-obvious contract.
 *
 * @param userId must be a valid UUID; never null
 * @return the user, or {@code null} when soft-deleted
 * @throws NotFoundException when {@code userId} doesn't exist
 * @throws IllegalArgumentException when {@code userId} is malformed
 */
public User getUser(String userId) throws NotFoundException
```

- Javadoc required on every public class, method, and non-trivial field
- Document EVERY checked exception with `@throws` — they are part of the contract
- Document unchecked exceptions that callers should reasonably handle
- Use `{@link Type#method}` for cross-references — survives renames via IDE refactor
- Package-level docs go in `package-info.java`

### Inline Comments
- `// TODO(owner): issue-ref` — assignee + ticket required
- `// FIXME(owner): issue-ref` — known broken, must include ticket
- `@SuppressWarnings("...")` must have an inline reason comment

```java
@SuppressWarnings("unchecked") // reason: cast validated by isInstance() above
List<User> users = (List<User>) raw;
```

## Key Idioms

### Null Handling
```java
// Prefer Optional over null for return types
public Optional<User> findUser(String id) {
    return Optional.ofNullable(store.get(id));
}

// Objects.requireNonNull for fail-fast on inputs
public void process(User user) {
    Objects.requireNonNull(user, "user must not be null");
}

// Never use Optional for fields or parameters — only return types
```

### Modern Java (17+)
```java
// Records for immutable value objects — auto equals/hashCode/toString
public record User(String id, String name, Role role) {}

// Sealed classes — exhaustive switch, closed hierarchies
public sealed interface Result<T> permits Success, Failure {}
public record Success<T>(T value) implements Result<T> {}
public record Failure<T>(String reason) implements Result<T> {}

// Pattern matching in switch (Java 21+)
String label = switch (result) {
    case Success<?> s -> "ok: " + s.value();
    case Failure<?> f -> "err: " + f.reason();
};

// var for local type inference — keep the right-hand side obvious
var users = new ArrayList<User>();          // good
var x = someMethod();                       // bad — type unclear
```

### Exceptions
```java
// Checked for recoverable, domain errors; RuntimeException for bugs
public class NotFoundException extends Exception { /* ... */ }

// Wrap with cause — never swallow
try {
    return repo.find(id);
} catch (SQLException e) {
    throw new RepositoryException("find failed for " + id, e);
}

// try-with-resources for any AutoCloseable
try (var stream = Files.newInputStream(path)) {
    return reader.read(stream);
}
```

### Concurrency
```java
// Prefer concurrent collections over synchronized wrappers
ConcurrentHashMap<String, User> cache = new ConcurrentHashMap<>();

// Virtual threads (Java 21+) for I/O-heavy work
try (var exec = Executors.newVirtualThreadPerTaskExecutor()) {
    var futures = ids.stream().map(id -> exec.submit(() -> fetch(id))).toList();
}

// CompletableFuture for async pipelines
CompletableFuture.supplyAsync(this::loadUsers)
    .thenApply(this::filter)
    .thenAccept(this::publish);
```

### Streams
```java
// Use streams for transformations, not side effects
var names = users.stream()
    .filter(User::active)
    .map(User::name)
    .sorted()
    .toList();   // Java 16+ — immutable, prefer over collect(toList())

// Avoid forEach for state mutation — use a loop instead
```

## Naming
- Classes/Interfaces/Enums/Records: `PascalCase`
- Methods/variables/parameters: `camelCase`
- Constants: `SCREAMING_SNAKE_CASE` (`static final`)
- Packages: `lowercase.dotted` (all lowercase, no underscores)
- Test classes: `XxxTest` (suffix), test methods: `methodName_givenX_returnsY` or `shouldDoXWhenY`
- Boolean methods/fields: `isX`, `hasX`, `canX` — never bare adjectives

## Layout
- One public top-level class per file; filename matches class
- `final` by default — make classes/fields `final` unless inheritance/mutation is intentional
- Prefer composition over inheritance
- Keep methods under ~30 lines; classes under ~200 lines (see coding.md)
