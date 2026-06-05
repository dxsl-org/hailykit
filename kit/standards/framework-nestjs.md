# NestJS Standards

## Project Structure

```
src/
├── modules/
│   └── users/
│       ├── users.module.ts
│       ├── users.controller.ts
│       ├── users.service.ts
│       ├── dto/
│       │   ├── create-user.dto.ts
│       │   └── update-user.dto.ts
│       └── entities/
│           └── user.entity.ts
├── common/             # Cross-cutting filters, guards, pipes, interceptors
├── config/             # ConfigModule + validation schemas
├── app.module.ts
└── main.ts
```

Feature-modules over technical layers — every feature gets its own module with controller + service + DTOs.

## Core Patterns

- **Dependency Injection** is mandatory — never `new SomeService()`, always inject via constructor
- One service = one responsibility; split when a service exceeds 200 lines
- Controllers stay thin — they validate input via DTOs, delegate to services, return DTOs
- Services contain business logic — they never touch `req`/`res` directly

## DTOs + Validation

Use `class-validator` + `class-transformer` for request validation:

```ts
import { IsEmail, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;
}
```

Enable global pipe in `main.ts`:
```ts
app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
```

## Database

- **TypeORM** or **Prisma** are the two mature choices
- Prisma preferred for new projects — better type safety, simpler migrations
- TypeORM if you need decorator-driven entity definitions to match Nest's style
- Repository pattern: inject `@InjectRepository(User)` (TypeORM) or `PrismaService`

## Auth

- **Passport** strategies via `@nestjs/passport` — `passport-jwt` for stateless JWT auth
- `@nestjs/jwt` for token sign/verify
- Guards for route protection: `@UseGuards(JwtAuthGuard)`
- Role-based access: custom `@Roles('admin')` decorator + `RolesGuard`
- Refresh tokens stored in DB; rotate on use; revoke on logout

## Configuration

- `@nestjs/config` with Joi schema validation
- Never read `process.env` directly in services — inject `ConfigService`
- Separate `.env.development` / `.env.production` — never commit secrets

## Error Handling

- Throw `HttpException` (or subclasses: `BadRequestException`, `NotFoundException`)
- Global exception filter for unexpected errors — log + sanitize before returning
- Don't leak stack traces in production responses

## Performance

- Use `@nestjs/cache-manager` with Redis for distributed cache
- `class-transformer`'s `@Exclude()` / `@Expose()` for trimming response payloads
- Streaming responses for large files (`StreamableFile`) — don't buffer entire file in memory
- Compression middleware (`compression` npm package) for JSON responses

## Microservices

- `@nestjs/microservices` supports TCP, Redis pub/sub, NATS, RabbitMQ, Kafka, gRPC
- Use message patterns (`@MessagePattern('user.created')`) for events
- Use request/response patterns sparingly — adds coupling between services

## Testing

- **Jest** is the default — `@nestjs/testing` provides `Test.createTestingModule`
- Unit tests: mock service dependencies with `useValue` or `useFactory`
- E2E tests: spin up the full app with `request(app.getHttpServer())`
- Aim for 70%+ unit coverage on services; controllers tested via E2E

## Security

- Helmet middleware: `app.use(helmet())`
- Rate limiting: `@nestjs/throttler` with route-specific overrides
- CORS: configure `app.enableCors()` with explicit origin list — never `*` in production
- Validate file uploads via `FileInterceptor` size/MIME limits

## Production

- `app.enableShutdownHooks()` for graceful shutdown (drain connections, close DB pool)
- Health endpoint: `@nestjs/terminus` — checks DB, Redis, disk space
- OpenAPI/Swagger: `@nestjs/swagger` — auto-generate spec from decorators
- Log to stdout (JSON format), let infrastructure handle aggregation

## Common Pitfalls

- Putting logic in controllers — they should only orchestrate
- Forgetting `@Injectable()` on services — DI silently fails
- Using `request`-scoped providers without need — kills singleton optimizations
- Catching exceptions in controllers — let global filter handle it
- Manual JSON serialization instead of using `ClassSerializerInterceptor`
