# Hono Standards

Detected via `hono` in `package.json` deps.

## When to Use

- Ultra-light, fast web framework that runs on **any JS runtime**: Node, Bun, Deno, Cloudflare Workers, Vercel Edge, AWS Lambda, Fastly
- Edge-first APIs with sub-ms cold starts
- TypeScript-first with end-to-end type inference via RPC mode
- Tiny bundle (~12KB) — ideal for serverless cold-start budgets

Pair with Hono for: edge functions, Workers KV/D1/R2, multi-region APIs.

## Setup

```ts
import { Hono } from 'hono';

const app = new Hono();

app.get('/', (c) => c.text('Hello!'));
app.get('/json', (c) => c.json({ hello: 'world' }));

export default app;
```

Runtime entry varies — Hono adapts:
```ts
// Cloudflare Workers / Pages
export default app;

// Bun
Bun.serve({ fetch: app.fetch });

// Node
import { serve } from '@hono/node-server';
serve({ fetch: app.fetch, port: 3000 });

// Deno
Deno.serve(app.fetch);
```

## Routing

```ts
app.get('/users/:id', (c) => {
  const id = c.req.param('id');                  // path param
  const limit = c.req.query('limit');            // query string
  return c.json({ id, limit });
});

app.post('/users', async (c) => {
  const body = await c.req.json();
  return c.json({ created: body }, 201);
});

// Grouped routes
const api = new Hono().basePath('/api');
api.get('/posts', (c) => c.json([]));
app.route('/', api);
```

## Validation with Zod (Recommended)

```ts
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

const schema = z.object({ email: z.string().email(), age: z.number().int() });

app.post('/users', zValidator('json', schema), async (c) => {
  const { email, age } = c.req.valid('json');     // typed!
  return c.json({ created: { email, age } }, 201);
});
```

## Middleware

```ts
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { jwt } from 'hono/jwt';

app.use(logger());
app.use(secureHeaders());
app.use('/api/*', cors({ origin: 'https://example.com' }));
app.use('/api/private/*', jwt({ secret: process.env.JWT_SECRET! }));
```

Built-in middleware is tree-shakeable. Custom middleware:
```ts
app.use(async (c, next) => {
  const start = Date.now();
  await next();
  c.header('X-Response-Time', `${Date.now() - start}ms`);
});
```

## RPC Mode (End-to-End Types)

Hono can generate a typed client for your routes:

```ts
// server.ts
const route = app.post('/posts',
  zValidator('json', z.object({ title: z.string() })),
  (c) => c.json({ id: '1', title: c.req.valid('json').title }, 201)
);
export type AppType = typeof route;

// client.ts
import { hc } from 'hono/client';
import type { AppType } from './server';

const client = hc<AppType>('https://api.example.com');
const res = await client.posts.$post({ json: { title: 'Hello' } });
const data = await res.json();    // typed!
```

No code generation — types flow directly. Works great in monorepos.

## Bindings (Workers / Cloud Runtimes)

```ts
type Bindings = {
  DB: D1Database;
  KV: KVNamespace;
  R2: R2Bucket;
  SECRET: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.get('/posts', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM posts').all();
  return c.json(results);
});
```

`c.env` is the runtime-provided bindings (Workers KV/D1/R2, environment vars).

## Streaming Responses

```ts
import { streamText, streamSSE } from 'hono/streaming';

app.get('/stream', (c) => streamText(c, async (stream) => {
  for (const chunk of generator) {
    await stream.write(chunk);
  }
}));

app.get('/sse', (c) => streamSSE(c, async (stream) => {
  for await (const event of source) {
    await stream.writeSSE({ data: JSON.stringify(event) });
  }
}));
```

Perfect for AI chat streaming (OpenAI/Anthropic/Gemini all support SSE).

## Auth Patterns

- **JWT**: `hono/jwt` built-in middleware
- **OAuth**: `@hono/oauth-providers` for GitHub, Google, etc.
- **Better Auth**: Mount its `/api/auth/*` handler — Hono is supported natively
- **Bearer Token**: `bearerAuth({ token: env.API_KEY })` middleware

## Best Practices

- Keep handlers async — Hono's middleware chain is fully async
- Use `c.json()` / `c.text()` / `c.html()` — sets correct Content-Type automatically
- Validate input with `@hono/zod-validator` — type-safe `c.req.valid()`
- Group routes via `new Hono()` sub-apps + `app.route()` — keeps file structure clean
- Use **RPC mode** when client + server share a repo — eliminates API drift
- Edge-compatible only: no Node `fs`, no native modules — use Web APIs

## Common Pitfalls

- Using Node-only APIs (`fs.readFile`, `Buffer`) → breaks on Workers/Deno; use Web APIs
- Forgetting `await` on `c.req.json()` → returns Promise, not object
- Calling `c.json()` after `c.body()` → response already sent
- Heavy CPU work in handler → Workers have CPU time limits (~10-50ms typical)
- Mixing runtime-specific bindings in shared code → type errors across deploy targets

## Resources

- Docs: https://hono.dev
- Examples: https://github.com/honojs/examples
- Adapters: https://hono.dev/docs/getting-started/basic
- RPC mode: https://hono.dev/docs/guides/rpc
