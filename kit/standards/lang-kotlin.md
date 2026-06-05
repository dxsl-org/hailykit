# Kotlin Standards

## Comments

### KDoc (public symbols)
```kotlin
/**
 * Why this function exists + non-obvious contract.
 * @param userId Must be a valid UUID; throws if not found
 * @return User or null when soft-deleted
 * @throws NotFoundException when userId doesn't exist
 */
suspend fun getUser(userId: String): User?
```

- KDoc on all public functions, classes, properties
- `@throws` required — Kotlin has unchecked exceptions, callers need this
- Omit KDoc for private/internal when signature is self-documenting

## Key Idioms

### Null Safety
```kotlin
// Elvis operator for defaults
val name = user?.name ?: "Unknown"

// Safe call chain
val city = user?.address?.city

// Let for null-safe blocks
user?.let { u ->
    sendEmail(u.email)
    log("Sent to ${u.id}")
}

// Require/check for preconditions (throws IllegalArgumentException/IllegalStateException)
require(userId.isNotBlank()) { "userId must not be blank" }
checkNotNull(user) { "user must be set before calling this" }
```

### Data Classes and Sealed Classes
```kotlin
// Data class — auto equals/hashCode/copy/toString
data class User(val id: String, val name: String, val role: Role)

// Sealed class — exhaustive when expressions, no unknown subclasses
sealed class Result<out T> {
    data class Success<T>(val data: T) : Result<T>()
    data class Error(val message: String) : Result<Nothing>()
}

// when is exhaustive on sealed types
when (result) {
    is Result.Success -> process(result.data)
    is Result.Error   -> handleError(result.message)
}
```

### Coroutines
```kotlin
// Suspend functions for async — no callbacks needed
suspend fun fetchUser(id: String): User = withContext(Dispatchers.IO) {
    userRepository.findById(id)
}

// Launch for fire-and-forget; async for concurrent work
val deferred1 = async { fetchUser(id1) }
val deferred2 = async { fetchUser(id2) }
val (user1, user2) = awaitAll(deferred1, deferred2)

// Flow for reactive streams
fun userUpdates(): Flow<User> = flow {
    while (true) {
        emit(fetchUser(id))
        delay(5000)
    }
}
```

### Extension Functions
```kotlin
// Add behavior without inheritance
fun String.toSlug() = lowercase().replace(Regex("[^a-z0-9]+"), "-")
fun List<User>.admins() = filter { it.role == Role.ADMIN }

// Extension properties
val User.displayName: String get() = "$firstName $lastName"
```

## Naming
- Classes/Interfaces: `PascalCase`
- Functions/variables/properties: `camelCase`
- Constants: `SCREAMING_SNAKE_CASE` or `camelCase` in companion object
- Private: prefix with `_` for backing properties only
