# Ktor Standards

Detected via `io.ktor` in `build.gradle.kts` or `pom.xml`. JetBrains' async Kotlin web framework.

## When to Use

- Pure Kotlin server (idiomatic coroutines, no Java reflection magic)
- Lightweight HTTP servers / microservices
- Multiplatform code reuse (Ktor client works on Android, JVM, native, JS)
- Want explicit configuration over Spring's heavy auto-magic

## Setup (Gradle)

```kotlin
// build.gradle.kts
plugins {
    kotlin("jvm") version "2.0.21"
    id("io.ktor.plugin") version "3.0.0"
    kotlin("plugin.serialization") version "2.0.21"
}

dependencies {
    implementation("io.ktor:ktor-server-core")
    implementation("io.ktor:ktor-server-netty")
    implementation("io.ktor:ktor-server-content-negotiation")
    implementation("io.ktor:ktor-serialization-kotlinx-json")
    implementation("io.ktor:ktor-server-auth")
    implementation("io.ktor:ktor-server-auth-jwt")
    implementation("ch.qos.logback:logback-classic")
    testImplementation("io.ktor:ktor-server-test-host")
}
```

## Entry Point

```kotlin
fun main() {
    embeddedServer(Netty, port = 8080, host = "0.0.0.0", module = Application::module)
        .start(wait = true)
}

fun Application.module() {
    install(ContentNegotiation) { json() }
    install(Authentication) { /* ... */ }
    install(CallLogging)
    install(StatusPages) {
        exception<Throwable> { call, cause ->
            call.respondText("500: ${cause.message}", status = HttpStatusCode.InternalServerError)
        }
    }

    routing {
        userRoutes()
        authRoutes()
    }
}
```

`install(...)` is how features (plugins) are wired in. Order matters for some plugins.

## Routing

```kotlin
fun Route.userRoutes() {
    route("/users") {
        get {
            val users = userService.list()
            call.respond(users)
        }

        post {
            val req = call.receive<CreateUserRequest>()
            val user = userService.create(req)
            call.respond(HttpStatusCode.Created, user)
        }

        get("/{id}") {
            val id = call.parameters["id"]?.toLongOrNull()
                ?: return@get call.respond(HttpStatusCode.BadRequest)
            val user = userService.findById(id)
                ?: return@get call.respond(HttpStatusCode.NotFound)
            call.respond(user)
        }
    }

    authenticate("auth-jwt") {
        get("/me") {
            val principal = call.principal<JWTPrincipal>()
            val userId = principal!!.payload.subject
            call.respond(userService.findById(userId.toLong())!!)
        }
    }
}
```

DSL-based — routes are just Kotlin functions composing into a tree.

## Serialization (kotlinx.serialization)

```kotlin
@Serializable
data class CreateUserRequest(val email: String, val password: String)

@Serializable
data class UserDto(val id: Long, val email: String)
```

Set up via `install(ContentNegotiation) { json() }`. No reflection — works on native + multiplatform.

## Authentication

```kotlin
install(Authentication) {
    jwt("auth-jwt") {
        realm = "myapp"
        verifier(JWT
            .require(Algorithm.HMAC256(secret))
            .withIssuer(issuer)
            .build())
        validate { credential ->
            if (credential.payload.subject != null) JWTPrincipal(credential.payload) else null
        }
    }
}

// In route
authenticate("auth-jwt") {
    get("/protected") {
        val principal = call.principal<JWTPrincipal>()
        call.respond(principal!!.payload.claims)
    }
}
```

OAuth, Sessions, Basic, Digest, OIDC all built in. `bearer { }` for custom token validation.

## Configuration

```hocon
# resources/application.conf
ktor {
    deployment {
        port = 8080
        port = ${?PORT}
    }
    application {
        modules = [ com.example.ApplicationKt.module ]
    }
}

database {
    url = "jdbc:postgresql://localhost/myapp"
    user = "postgres"
    user = ${?DB_USER}
}
```

```kotlin
val dbUrl = environment.config.property("database.url").getString()
```

HOCON or YAML (3.0+). Env var substitution via `${?VAR}`.

## Database — Exposed / Ktorm / JDBI

Ktor doesn't ship an ORM. Common picks:
- **Exposed** (JetBrains) — type-safe SQL DSL
- **Ktorm** — lighter, less magic
- **JOOQ** — heavy but very capable
- **Hibernate / JPA** — works but feels un-Kotliny

```kotlin
// Exposed
object Users : LongIdTable() {
    val email = varchar("email", 255).uniqueIndex()
    val name = varchar("name", 255)
}

transaction {
    Users.insert {
        it[email] = "a@b.com"
        it[name] = "Alice"
    }

    Users.selectAll().forEach { row ->
        println(row[Users.email])
    }
}
```

## Coroutines (Async I/O)

Every Ktor handler runs in a coroutine — `suspend` everywhere:

```kotlin
get("/users") {
    val users = withContext(Dispatchers.IO) {
        transaction { Users.selectAll().toList() }
    }
    call.respond(users)
}
```

Use `Dispatchers.IO` for blocking JDBC; `Dispatchers.Default` for CPU work.

## Testing

```kotlin
class UserRoutesTest {
    @Test
    fun testList() = testApplication {
        application { module() }

        val response = client.get("/users")
        assertEquals(HttpStatusCode.OK, response.status)
    }
}
```

`testApplication { }` boots an in-memory Ktor server — no port binding, very fast.

## Best Practices

- **DSL-based routing** is the way — embrace it
- Use **kotlinx.serialization** over Jackson — native, fast, no reflection
- One module function per feature area — compose via `Application.module()`
- `install(plugin) { }` for all framework features — never roll your own auth/cors/serialization
- **Coroutines all the way** — never use `Thread.sleep` or blocking I/O in handler
- Use `application.conf` for all config — code-as-default is brittle
- Build native via Ktor's GraalVM support for fast startup

## Common Pitfalls

- Blocking I/O in handlers without `withContext(Dispatchers.IO)` → starves Netty event loop
- Forgetting `@Serializable` annotation → ContentNegotiation throws at runtime
- Missing `install(ContentNegotiation)` → 415 errors on JSON requests
- Auth `validate` returning non-null when token invalid → silent auth bypass
- Mixing imperative + coroutine state → race conditions
- Using Jackson on top of kotlinx.serialization → conflicts; pick one

## Resources

- Docs: https://ktor.io/docs
- API: https://api.ktor.io
- Plugins: https://ktor.io/docs/server-create-and-configure.html
- Project generator: https://start.ktor.io
