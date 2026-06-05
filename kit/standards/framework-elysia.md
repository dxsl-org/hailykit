# Elysia Standards

Detected via `elysia` in `package.json` deps.

## When to Use

- **Bun-native** web framework — built specifically for Bun's runtime
- Fastest TypeScript inference in the JS ecosystem (no type generation step)
- Plugin pattern with method chaining + complete type flow
- API + WebSocket + GraphQL in one cohesive framework

Runs on Node too via `@elysiajs/node`, but Bun is the target — best perf there.

## Setup

```ts
import { Elysia } from 'elysia';

const app = new Elysia()
  .get('/', () => 'Hello!')
  .get('/json', () => ({ ok: true }))
  .listen(3000);

console.log(`Running at http://${app.server?.hostname}:${app.server?.port}`);
```

On Bun: `bun run --hot src/index.ts` for hot reload.

## Schema Validation (TypeBox)

Schemas are first-class — they drive types + runtime validation:

```ts
import { Elysia, t } from 'elysia';

new Elysia()
  .post('/users',
    ({ body }) => ({ id: '1', ...body }),
    {
      body: t.Object({
        email: t.String({ format: 'email' }),
        age: t.Integer({ minimum: 13 }),
      }),
      response: t.Object({ id: t.String(), email: t.String(), age: t.Integer() }),
    }
  );
```

`t.*` is re-exported from TypeBox. `body` is fully typed in the handler.

## Plugin System

```ts
const auth = new Elysia({ name: 'auth' })
  .derive(async ({ headers }) => {
    const token = headers.authorization?.replace('Bearer ', '');
    return { user: await verifyJwt(token) };
  });

new Elysia()
  .use(auth)
  .get('/me', ({ user }) => user);   // `user` is typed!
```

`.derive()` adds typed context. `.decorate()` adds methods/values. Plugins are deduplicated by `name`.

## Lifecycle Hooks

```ts
new Elysia()
  .onBeforeHandle(({ headers }) => { /* request preprocessing */ })
  .onAfterHandle(({ response }) => { /* mutate response */ })
  .onError(({ error, code }) => {
    if (code === 'VALIDATION') return new Response('Invalid', { status: 400 });
  });
```

Per-route hooks via the options object — scoped to that route only.

## Groups

```ts
new Elysia()
  .group('/api/v1', (app) =>
    app
      .get('/users', () => users)
      .post('/users', ({ body }) => create(body), { body: UserSchema })
  );
```

## WebSocket

```ts
new Elysia()
  .ws('/chat', {
    body: t.Object({ msg: t.String() }),
    message(ws, { msg }) {
      ws.send(`echo: ${msg}`);
    },
    open(ws) { ws.subscribe('room1'); },
    close(ws) { ws.unsubscribe('room1'); },
  });
```

Pub/sub via `ws.publish('room1', data)` — fan-out to all subscribers.

## Eden Treaty (End-to-End RPC)

Type-safe client from server types:

```ts
// server.ts
const app = new Elysia()
  .post('/users', ({ body }) => body, { body: UserSchema });
export type App = typeof app;

// client.ts
import { treaty } from '@elysiajs/eden';
import type { App } from './server';

const client = treaty<App>('http://localhost:3000');
const { data } = await client.users.post({ email: 'a@b.com', age: 30 });
// `data` is fully typed
```

Comparable to tRPC but with zero codegen, zero schema duplication.

## Plugins

| Plugin | Purpose |
|---|---|
| `@elysiajs/cors` | CORS |
| `@elysiajs/jwt` | JWT |
| `@elysiajs/cookie` | Cookies |
| `@elysiajs/swagger` | OpenAPI + Swagger UI |
| `@elysiajs/static` | Static file serving |
| `@elysiajs/stream` | SSE / streaming |
| `@elysiajs/cron` | Scheduled tasks |
| `@elysiajs/graphql-yoga` | GraphQL |
| `@elysiajs/trpc` | tRPC adapter |

## Best Practices

- **Schema everything** — Elysia uses TypeBox at compile + runtime; no separate validation lib needed
- Use `.derive()` for per-request context (auth, db connection)
- Use `.decorate()` for app-wide singletons (DB client, config)
- Name your plugins (`new Elysia({ name: 'auth' })`) to dedupe registrations
- Run on Bun for max perf — `@elysiajs/node` adapter exists for Node compat
- Eden Treaty for monorepo client — beats manual fetch + types
- Swagger plugin gives free interactive docs

## Common Pitfalls

- Importing Elysia in non-Bun runtime without adapter → cryptic runtime errors
- Forgetting schema → handler args are `unknown`, not typed
- Unnamed plugins → registered multiple times if `.use()` called from many places
- Mixing `Response` constructor + Elysia return value → double response
- Heavy work in `.derive()` → runs per request, can slow hot paths

## Resources

- Docs: https://elysiajs.com
- Plugins: https://elysiajs.com/plugins/overview
- Eden Treaty: https://elysiajs.com/eden/treaty/overview
- Bun runtime: https://bun.sh
