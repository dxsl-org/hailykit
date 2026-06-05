# Quarkus Standards

Detected via `quarkus` in `pom.xml` or `build.gradle`. Target Quarkus 3.x (Java 17+).

## When to Use

- Cloud-native Java — fast startup, low memory (vs Spring Boot)
- **Native compilation** via GraalVM — ~50ms boot, ~50MB RAM
- Kubernetes / serverless deployment (AWS Lambda, Knative)
- Reactive + imperative in same codebase

vs Spring Boot: Quarkus is younger, smaller ecosystem, but **much faster startup** and lower memory — ideal for FaaS / autoscaling.

## Project Setup

```bash
quarkus create app com.example:my-app --extension=rest,rest-jackson,hibernate-orm-panache,jdbc-postgresql
cd my-app
quarkus dev      # live reload
```

## REST (JAX-RS / Resteasy)

```java
@Path("/users")
public class UserResource {

    @Inject
    UserService userService;

    @GET
    @Produces(MediaType.APPLICATION_JSON)
    public List<UserDto> list() {
        return userService.list();
    }

    @POST
    @Consumes(MediaType.APPLICATION_JSON)
    public Response create(@Valid CreateUserRequest req) {
        UserDto user = userService.create(req);
        return Response.status(201).entity(user).build();
    }

    @GET
    @Path("/{id}")
    public UserDto get(@PathParam("id") Long id) {
        return userService.findById(id)
            .orElseThrow(() -> new WebApplicationException(404));
    }
}
```

Quarkus also supports Spring annotations via the **Spring Web compatibility** extension — easier migration.

## Persistence — Hibernate ORM with Panache

Panache simplifies JPA dramatically:

```java
@Entity
public class User extends PanacheEntity {       // id auto-managed
    @Column(unique = true) public String email;
    public String name;
    @CreationTimestamp public Instant createdAt;
}

// Usage — no repository class needed
User user = User.findById(1L);
List<User> active = User.list("active", true);
long count = User.count("email LIKE ?1", "%@example.com");
User.deleteById(1L);
new User("a@b.com", "Alice").persist();
```

For complex queries, use **Panache Repository** pattern. Both work; pick one per codebase.

## Reactive (Mutiny)

Quarkus uses **Mutiny** instead of Project Reactor:

```java
@GET
@Path("/users/{id}")
public Uni<User> get(@PathParam("id") Long id) {
    return User.findById(id);     // Panache supports reactive
}
```

`Uni<T>` = 0-or-1 (like Mono); `Multi<T>` = 0-to-many (like Flux). Pair with reactive DB drivers (`reactive-pg-client`).

## Dependency Injection (CDI)

```java
@ApplicationScoped
public class UserService {
    @Inject UserRepository repo;
    @Inject Logger log;
}
```

Scopes: `@ApplicationScoped` (singleton), `@RequestScoped`, `@Dependent`.

## Configuration

```properties
# src/main/resources/application.properties
quarkus.datasource.db-kind=postgresql
quarkus.datasource.username=${DB_USER}
quarkus.datasource.password=${DB_PASSWORD}
quarkus.datasource.jdbc.url=${DB_URL}

quarkus.hibernate-orm.database.generation=validate

%dev.quarkus.log.level=DEBUG
%prod.quarkus.log.level=INFO
```

`%profile.` prefix overrides per environment.

Inject config:
```java
@ConfigProperty(name = "app.feature-x.enabled", defaultValue = "false")
boolean featureXEnabled;
```

## Native Compilation

```bash
quarkus build --native
# or: ./mvnw package -Dnative
# Result: target/*-runner — single static binary
```

Requires GraalVM (or use the Maven plugin's container builder). Startup: ~50ms. Memory: ~50MB.

Trade-offs: build time longer, reflection requires hints, dynamic features (JNI, ClassLoaders) restricted.

## Security

```java
@RolesAllowed("admin")
@Path("/admin/stats")
public class AdminResource { /* ... */ }

// JWT via SmallRye JWT
@Inject JsonWebToken jwt;

public String getUserId() {
    return jwt.getClaim("sub");
}
```

OIDC + JWT via extensions. Keycloak integrates first-class.

## Testing

```java
@QuarkusTest
class UserResourceTest {
    @Test
    void list_returnsUsers() {
        given().when().get("/users").then().statusCode(200);
    }
}
```

`@QuarkusTest` boots a real Quarkus instance — full integration tests are the default.

**Continuous Testing** in `quarkus dev` mode auto-runs affected tests on save.

## Best Practices

- Use **Panache** over plain JPA — way less boilerplate
- Records for DTOs — immutable, less code
- Native build only for prod deployment targets that benefit (lambda, K8s)
- `application.properties` over YAML in Quarkus (idiomatic)
- Use **Quarkus extensions** instead of raw libraries — they're tested + auto-configured
- Test in `quarkus dev` for fast feedback; CI runs full test suite

## Common Pitfalls

- Using libraries that don't have a Quarkus extension → may break native compilation
- Reflection-heavy code without `@RegisterForReflection` → native build fails or crashes at runtime
- Mixing Mutiny + blocking JDBC → blocks the reactive event loop
- Configuration in code instead of `application.properties` → loses native-time injection benefits
- Old Quarkus 2.x docs — 3.x has notable changes (Jakarta EE 10 namespace shift)

## Resources

- Docs: https://quarkus.io/guides
- Extensions: https://quarkus.io/extensions
- Code with Quarkus: https://code.quarkus.io
- Native compilation: https://quarkus.io/guides/building-native-image
