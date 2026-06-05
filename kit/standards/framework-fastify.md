# Fastify Standards

Detected via `fastify` in `package.json` deps.

## When to Use

- Fast Node.js HTTP server (3-5x throughput of Express)
- TypeScript-first APIs with **schema-based** validation + serialization
- Plugin architecture with encapsulation (no global middleware pollution)
- Production APIs that need built-in observability hooks

## Setup

```ts
import Fastify from 'fastify';

const app = Fastify({
  logger: { level: 'info' },
  trustProxy: true,
});

app.listen({ port: 3000, host: '0.0.0.0' });
```

## Schema-Driven Routes

Schemas drive validation, serialization, and OpenAPI generation:

```ts
import { Type } from '@sinclair/typebox';   // or zod via fastify-type-provider-zod

const UserSchema = Type.Object({
  email: Type.String({ format: 'email' }),
  age: Type.Integer({ minimum: 13 }),
});

app.post('/users', {
  schema: {
    body: UserSchema,
    response: {
      201: Type.Object({ id: Type.String(), email: Type.String() }),
    },
  },
  handler: async (req, reply) => {
    // req.body is typed automatically
    const user = await db.user.create({ data: req.body });
    return reply.code(201).send(user);
  },
});
```

Serialization is **2x faster** when you provide a response schema — Fastify uses `fast-json-stringify`.

## Type Providers

Use a TypeProvider to get end-to-end type inference from schemas:

```ts
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
// or
import { ZodTypeProvider, validatorCompiler, serializerCompiler } from 'fastify-type-provider-zod';

const app = Fastify().withTypeProvider<TypeBoxTypeProvider>();
```

With Zod:
```ts
app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);
```

## Plugins

Encapsulate features as plugins — they get their own scope (no global pollution):

```ts
// plugins/db.ts
import fp from 'fastify-plugin';
import { PrismaClient } from '@prisma/client';

export default fp(async (fastify) => {
  const prisma = new PrismaClient();
  await prisma.$connect();
  fastify.decorate('prisma', prisma);
  fastify.addHook('onClose', async () => prisma.$disconnect());
});

// app.ts
app.register(import('./plugins/db'));
```

`fastify-plugin` removes the encapsulation so `decorate` is visible upstream. Without it, decorators are scoped to children only.

## Hooks (Lifecycle)

```ts
app.addHook('onRequest', async (req, reply) => { /* auth, logging */ });
app.addHook('preHandler', async (req, reply) => { /* per-route auth */ });
app.addHook('onResponse', async (req, reply) => { /* metrics */ });
app.addHook('onError', async (req, reply, err) => { /* error logging */ });
```

Per-route hooks via the route options object — scoped, don't leak.

## Auth Pattern

```ts
import fastifyJwt from '@fastify/jwt';

app.register(fastifyJwt, { secret: process.env.JWT_SECRET! });

app.decorate('authenticate', async (req, reply) => {
  try { await req.jwtVerify(); }
  catch { reply.code(401).send({ error: 'Unauthorized' }); }
});

app.get('/profile', {
  onRequest: [app.authenticate],
  handler: async (req) => req.user,
});
```

## Validation Errors

Fastify returns a structured 400 automatically when schema validation fails. Customize:

```ts
app.setErrorHandler((err, req, reply) => {
  if (err.validation) {
    return reply.code(400).send({ errors: err.validation });
  }
  req.log.error(err);
  reply.code(500).send({ error: 'Internal' });
});
```

## Essential Plugins

| Plugin | Purpose |
|---|---|
| `@fastify/helmet` | Security headers |
| `@fastify/cors` | CORS |
| `@fastify/rate-limit` | Rate limiting |
| `@fastify/cookie` | Cookie parsing |
| `@fastify/jwt` | JWT auth |
| `@fastify/multipart` | File uploads (stream-based) |
| `@fastify/swagger` + `@fastify/swagger-ui` | OpenAPI docs (auto from schemas) |
| `@fastify/under-pressure` | Backpressure / health |

## Best Practices

- **Schema-first** — every route has body/params/querystring/response schemas
- Use `@fastify/swagger` to auto-generate OpenAPI from schemas — no duplicate spec
- Register heavy plugins once at app boot, not per request
- Use **child loggers** (`req.log`) — they include `reqId` automatically
- Return values from handlers, don't call `reply.send()` unless needed (e.g. status code change)
- For streaming responses, return the stream directly
- Pin Fastify major version — minor releases sometimes change defaults

## Common Pitfalls

- Forgetting `fastify-plugin` wrapper → decorators don't propagate
- Not setting `trustProxy: true` behind a load balancer → wrong `req.ip`
- Calling `reply.send()` and returning a value → double response
- Adding validation manually instead of via schema → loses serialization speedup
- Sync handlers when async work is happening → use `async` handlers

## Resources

- Docs: https://fastify.dev/docs/latest
- Plugins: https://fastify.dev/ecosystem
- Best practices: https://fastify.dev/docs/latest/Guides/Recommendations
