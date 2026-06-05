# Swift Standards

## Comments

### DocC (public symbols)
```swift
/// Why this function exists + non-obvious contract.
/// - Parameter userId: Must be a valid UUID
/// - Returns: User or nil when soft-deleted
/// - Throws: `NotFoundError` when userId doesn't exist
public func getUser(userId: String) async throws -> User?
```

- `///` for all public API; `//` for inline notes
- `// MARK: - Section` for organizing large files (shows in Xcode jump bar)
- `// TODO:` and `// FIXME:` trigger Xcode warnings

## Key Idioms

### Optionals
```swift
// Optional binding — preferred over force unwrap
guard let user = findUser(id) else { return }

// Optional chaining
let city = user.address?.city

// Nil-coalescing
let name = user?.name ?? "Unknown"

// NEVER force unwrap in production code unless the invariant is documented:
// SAFETY: session is non-nil — set in AppDelegate.didFinishLaunching before any view loads
let session = session!
```

### Error Handling
```swift
// Use throws/Result for recoverable errors; fatalError only for programmer errors
enum UserError: Error {
    case notFound(id: String)
    case invalidInput(String)
}

func getUser(_ id: String) throws -> User {
    guard let user = store[id] else { throw UserError.notFound(id: id) }
    return user
}

// Result for async contexts
func fetchUser(_ id: String) async -> Result<User, UserError>

// do/try/catch at call site
do {
    let user = try getUser(id)
} catch UserError.notFound(let id) {
    print("Missing: \(id)")
} catch {
    print("Unexpected: \(error)")
}
```

### Value vs Reference Types
```swift
// struct — value semantics, prefer for data models
struct User: Codable {
    let id: UUID
    var name: String
    var role: Role
}

// class — reference semantics, for shared mutable state
final class UserStore: ObservableObject {
    @Published private(set) var users: [User] = []
}

// enum with associated values — algebraic data types
enum NetworkState<T> {
    case idle
    case loading
    case success(T)
    case failure(Error)
}
```

### Swift Concurrency
```swift
// async/await — structured concurrency
func loadData() async throws {
    async let users = fetchUsers()
    async let config = fetchConfig()
    let (u, c) = try await (users, config)  // runs concurrently
}

// Actor — safe shared mutable state
actor UserCache {
    private var store: [String: User] = [:]
    func get(_ id: String) -> User? { store[id] }
    func set(_ user: User) { store[user.id] = user }
}
```

## Naming
- Types/Protocols: `PascalCase`
- Functions/variables: `camelCase`
- Constants: `camelCase` (Swift has no ALL_CAPS convention)
- Protocols: noun (`Collection`) or adjective (`Equatable`, `Sendable`)
- Mark implementation-detail types `private` or `internal`; `final` classes by default unless designed for inheritance
