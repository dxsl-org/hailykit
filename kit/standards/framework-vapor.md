# Vapor Standards

Detected via `vapor` in `Package.swift`. Swift's premier server-side framework.

## When to Use

- Pure Swift backend (share types with iOS/macOS clients)
- Want Swift's strong type safety + async/await on server
- Existing Swift mobile team adding API capability

## Setup

```bash
brew install vapor
vapor new MyApp
cd MyApp
swift run
```

## App Structure

```
Sources/App/
├── configure.swift           # App configuration entry
├── routes.swift              # Route definitions
├── Controllers/
├── Models/
└── Migrations/
Tests/AppTests/
Public/                       # Static files
Resources/Views/              # Leaf templates (if using)
Package.swift
```

## Routes

```swift
// routes.swift
import Vapor

func routes(_ app: Application) throws {
    app.get { req in
        return "Hello, World!"
    }

    app.get("users", ":id") { req async throws -> User in
        guard let id = req.parameters.get("id", as: UUID.self) else {
            throw Abort(.badRequest)
        }
        return try await User.find(id, on: req.db) ?? { throw Abort(.notFound) }()
    }

    try app.register(collection: UserController())
}
```

## Controllers (RouteCollection)

```swift
struct UserController: RouteCollection {
    func boot(routes: RoutesBuilder) throws {
        let users = routes.grouped("users")
        users.get(use: index)
        users.post(use: create)
        users.group(":id") { user in
            user.get(use: show)
            user.put(use: update)
            user.delete(use: delete)
        }
    }

    func index(req: Request) async throws -> [User] {
        try await User.query(on: req.db).all()
    }

    func create(req: Request) async throws -> User {
        let user = try req.content.decode(User.self)
        try await user.save(on: req.db)
        return user
    }
}
```

## Models (Fluent ORM)

```swift
final class User: Model, Content, @unchecked Sendable {
    static let schema = "users"

    @ID(key: .id) var id: UUID?
    @Field(key: "email") var email: String
    @Field(key: "name") var name: String
    @Timestamp(key: "created_at", on: .create) var createdAt: Date?
    @Children(for: \.$user) var posts: [Post]

    init() {}
    init(email: String, name: String) {
        self.email = email
        self.name = name
    }
}
```

`Content` makes the model auto-codable for request/response bodies.

## Migrations

```swift
struct CreateUsers: AsyncMigration {
    func prepare(on database: Database) async throws {
        try await database.schema("users")
            .id()
            .field("email", .string, .required)
            .field("name", .string, .required)
            .field("created_at", .datetime)
            .unique(on: "email")
            .create()
    }

    func revert(on database: Database) async throws {
        try await database.schema("users").delete()
    }
}

// In configure.swift
app.migrations.add(CreateUsers())
```

```bash
swift run App migrate
swift run App migrate --revert
```

## Configuration

```swift
// configure.swift
public func configure(_ app: Application) async throws {
    app.databases.use(.postgres(
        configuration: SQLPostgresConfiguration(
            hostname: Environment.get("DB_HOST") ?? "localhost",
            username: Environment.get("DB_USER") ?? "vapor",
            password: Environment.get("DB_PASSWORD"),
            database: Environment.get("DB_NAME") ?? "vapor",
            tls: .disable
        )
    ), as: .psql)

    app.migrations.add(CreateUsers())

    try await app.autoMigrate()    // Dev only — use migrate command in prod

    try routes(app)
}
```

## Auth (JWT)

```swift
import JWT

app.jwt.signers.use(.hs256(key: Environment.get("JWT_SECRET") ?? "secret"))

struct UserPayload: JWTPayload {
    var sub: SubjectClaim
    var exp: ExpirationClaim
    func verify(using signer: JWTSigner) throws { try exp.verifyNotExpired() }
}

// Protected route
let protected = app.grouped(UserAuthenticator(), User.guardMiddleware())
protected.get("me") { req in try req.auth.require(User.self) }
```

## Async/Await Everywhere

```swift
func handler(req: Request) async throws -> Response {
    let user = try await User.find(id, on: req.db)
        ?? { throw Abort(.notFound) }()
    let posts = try await user.$posts.get(on: req.db)
    return Response(status: .ok, body: .init(string: "\(posts.count) posts"))
}
```

Older Vapor (3.x) used `EventLoopFuture<T>` — Vapor 4 supports both but **prefer async/await** for new code.

## Validation

```swift
struct CreateUserRequest: Content, Validatable {
    let email: String
    let password: String

    static func validations(_ validations: inout Validations) {
        validations.add("email", as: String.self, is: .email)
        validations.add("password", as: String.self, is: .count(8...))
    }
}

// Usage
try CreateUserRequest.validate(content: req)
let request = try req.content.decode(CreateUserRequest.self)
```

## Testing

```swift
import XCTVapor

final class UserTests: XCTestCase {
    func testListUsers() async throws {
        let app = Application(.testing)
        defer { app.shutdown() }
        try await configure(app)

        try await app.test(.GET, "users") { res in
            XCTAssertEqual(res.status, .ok)
        }
    }
}
```

## Deployment

- Build native: `swift build -c release`
- Docker: official `swift:slim` image
- Heroku, Fly.io, Railway all support Swift
- Use **Linux** in CI (`swift:5.9-jammy` image) — Vapor is cross-platform

## Best Practices

- Use **async/await** for all new code — `EventLoopFuture` is legacy
- Models conform to `Content` for free codable + body parsing
- Migrations are first-class — never auto-migrate in prod
- Use **environment variables** for all config (`Environment.get`)
- Type-safe routes via parameter types (`:id` + `req.parameters.get("id", as: UUID.self)`)
- **Validatable** content for input validation — declarative
- Fluent (the ORM) supports SQLite, PostgreSQL, MySQL — pick at config time

## Common Pitfalls

- Forgetting `try await app.autoMigrate()` setup in dev → no schema
- Using `EventLoopFuture` chains in new code → hard to read; convert to async/await
- Heavy work in handler without `req.eventLoop.makeFutureWithTask` → blocks event loop
- `Content` decoding error returning generic 400 → add custom error middleware for better messages
- Sharing model instances across requests without `@unchecked Sendable` → Swift concurrency warnings
- Missing migrations in deploy → schema drift between dev and prod

## Resources

- Docs: https://docs.vapor.codes
- API: https://api.vapor.codes
- Discord: https://discord.gg/vapor
- Vapor toolbox: https://github.com/vapor/toolbox
