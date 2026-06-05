# Spring Boot Standards

Detected via `spring-boot` / `org.springframework.boot` in `pom.xml` or `build.gradle{,.kts}`. Target Spring Boot 3.x (Java 17+).

## When to Use

- Enterprise Java applications (the dominant choice)
- REST APIs, microservices, batch processing
- Need massive ecosystem (Spring Security, Spring Data, Spring Cloud)
- Mature ops integration (Actuator, Micrometer)

## Project Structure

```
src/main/java/com/example/myapp/
├── MyAppApplication.java          # @SpringBootApplication entry
├── controller/                     # REST controllers
├── service/                        # Business logic
├── repository/                     # Spring Data interfaces
├── model/                          # JPA entities / DTOs
├── config/                         # @Configuration classes
└── exception/
src/main/resources/
├── application.yml                 # config
├── application-{profile}.yml        # per-env overrides
└── db/migration/                   # Flyway migrations (V1__init.sql)
src/test/java/...
```

## Entry Point

```java
@SpringBootApplication
public class MyAppApplication {
    public static void main(String[] args) {
        SpringApplication.run(MyAppApplication.class, args);
    }
}
```

`@SpringBootApplication` = `@Configuration` + `@EnableAutoConfiguration` + `@ComponentScan`.

## Controllers

```java
@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor       // Lombok — generates ctor for final fields
public class UserController {

    private final UserService userService;

    @GetMapping
    public Page<UserDto> list(@PageableDefault(size = 20) Pageable pageable) {
        return userService.list(pageable);
    }

    @GetMapping("/{id}")
    public UserDto get(@PathVariable Long id) {
        return userService.findById(id)
            .orElseThrow(() -> new NotFoundException("User " + id));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public UserDto create(@Valid @RequestBody CreateUserRequest request) {
        return userService.create(request);
    }
}
```

`@Valid` triggers Jakarta Bean Validation on the request body — auto-returns 400 with field errors.

## Services (Business Logic)

```java
@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Transactional(readOnly = true)
    public Page<UserDto> list(Pageable pageable) {
        return userRepository.findAll(pageable).map(this::toDto);
    }

    @Transactional
    public UserDto create(CreateUserRequest request) {
        if (userRepository.existsByEmail(request.email())) {
            throw new ConflictException("Email already exists");
        }
        User user = User.builder()
            .email(request.email())
            .passwordHash(passwordEncoder.encode(request.password()))
            .build();
        userRepository.save(user);
        return toDto(user);
    }
}
```

`@Transactional` for write operations. `readOnly = true` lets the DB optimize.

## Spring Data JPA

```java
@Entity
@Table(name = "users")
@Getter @Setter @Builder
@NoArgsConstructor @AllArgsConstructor
public class User {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String email;

    private String passwordHash;

    @OneToMany(mappedBy = "author", fetch = FetchType.LAZY)
    private List<Post> posts;

    @CreationTimestamp
    private Instant createdAt;
}

public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmail(String email);
    boolean existsByEmail(String email);

    @Query("SELECT u FROM User u WHERE u.email LIKE %:term%")
    List<User> searchByEmail(@Param("term") String term);
}
```

Spring derives queries from method names — `findByX`, `existsByY`, `countByZ`. Custom queries via `@Query`.

## DTOs

```java
public record CreateUserRequest(
    @Email @NotBlank String email,
    @Size(min = 8) String password,
    @NotBlank String name
) {}

public record UserDto(Long id, String email, String name, Instant createdAt) {}
```

**Use records** (Java 14+) for immutable DTOs — much less boilerplate than classes.

## Configuration

```yaml
# application.yml
spring:
  datasource:
    url: jdbc:postgresql://localhost:5432/mydb
    username: ${DB_USER}
    password: ${DB_PASSWORD}
  jpa:
    hibernate:
      ddl-auto: validate          # never `update` in prod
    properties:
      hibernate:
        format_sql: true
  flyway:
    enabled: true
    locations: classpath:db/migration

server:
  port: 8080
  shutdown: graceful

logging:
  level:
    root: INFO
    com.example.myapp: DEBUG
```

Per-environment: `application-prod.yml`, activated by `SPRING_PROFILES_ACTIVE=prod`.

## Security (Spring Security)

```java
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .csrf(AbstractHttpConfigurer::disable)       // stateless API
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/auth/**", "/api/public/**").permitAll()
                .requestMatchers("/api/admin/**").hasRole("ADMIN")
                .anyRequest().authenticated())
            .oauth2ResourceServer(o -> o.jwt(Customizer.withDefaults()));
        return http.build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
```

JWT validation built in — point `spring.security.oauth2.resourceserver.jwt.issuer-uri` at your IdP.

## Exception Handling

```java
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(NotFoundException.class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public ErrorResponse handleNotFound(NotFoundException e) {
        return new ErrorResponse(e.getMessage());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ValidationErrorResponse handleValidation(MethodArgumentNotValidException e) {
        Map<String, String> errors = e.getBindingResult().getFieldErrors().stream()
            .collect(Collectors.toMap(FieldError::getField, FieldError::getDefaultMessage));
        return new ValidationErrorResponse(errors);
    }
}
```

Centralizes error responses — DRY across all controllers.

## Actuator (Health + Metrics)

```yaml
management:
  endpoints:
    web:
      exposure:
        include: health,metrics,prometheus,info
  endpoint:
    health:
      show-details: never        # never expose in prod
```

`/actuator/health` for liveness probes, `/actuator/prometheus` for Prometheus scraping.

## Migrations (Flyway / Liquibase)

`src/main/resources/db/migration/V1__init.sql`:
```sql
CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Spring Boot auto-applies on startup. Never edit applied migrations — write new ones.

## Testing

```java
@SpringBootTest
@AutoConfigureMockMvc
class UserControllerTest {

    @Autowired MockMvc mockMvc;
    @MockBean UserService userService;

    @Test
    void list_returnsPage() throws Exception {
        when(userService.list(any())).thenReturn(new PageImpl<>(List.of()));
        mockMvc.perform(get("/api/users"))
            .andExpect(status().isOk());
    }
}

// Integration test with Testcontainers
@SpringBootTest
@Testcontainers
class UserIntegrationTest {
    @Container
    static PostgreSQLContainer<?> db = new PostgreSQLContainer<>("postgres:16");

    @DynamicPropertySource
    static void configure(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", db::getJdbcUrl);
        // ...
    }
}
```

**Testcontainers** is the de-facto way to integration-test against real services.

## Best Practices

- Use **constructor injection** (via `@RequiredArgsConstructor` from Lombok or manual) — never field injection
- Use **records** for DTOs — immutable, less boilerplate
- **Lombok**: `@Getter @Setter @Builder @RequiredArgsConstructor` cut entity boilerplate
- `@Transactional` at the **service** layer, not controllers
- Profile per environment (`prod`, `staging`, `dev`) — never hardcode env-specific config
- **Flyway migrations** in version control — never edit applied ones
- Use **Spring Boot DevTools** in dev for fast restarts
- **Actuator + Micrometer + Prometheus** for production observability

## Common Pitfalls

- N+1 from lazy associations + iterating in transactional scope without `JOIN FETCH`
- Field injection (`@Autowired private X x;`) → harder to test, can hide deps
- `ddl-auto: update` in production → silent schema drift; use Flyway/Liquibase
- Returning entities directly from controllers → leaks DB shape, lazy-loading issues outside transaction
- Catching `Exception` instead of specific types → masks real errors
- Synchronous DB calls in webflux app — use reactive driver or stay on Spring MVC
- Heavy stuff in `@PostConstruct` → slows startup; use `@EventListener(ApplicationReadyEvent.class)`

## Resources

- Docs: https://docs.spring.io/spring-boot/docs/current/reference
- Spring Initializr: https://start.spring.io
- Baeldung tutorials: https://www.baeldung.com
- Spring Academy (official): https://spring.academy
