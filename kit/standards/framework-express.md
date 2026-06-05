# Express Standards

Detected via `express` in `package.json` deps.

## When to Use

- Maximum library ecosystem compatibility (oldest, most middleware available)
- Simple REST APIs with minimal abstraction
- Compatibility with legacy Node.js code
- Need very specific middleware behavior

**For new projects, strongly consider Fastify or Hono** — both faster, better TypeScript, modern async patterns. Express is in **maintenance mode** with infrequent releases.

## Project Structure

```
src/
├── server.ts                # Entry: create app, mount middleware, listen
├── routes/
│   ├── index.ts             # Router aggregator
│   ├── users.ts
│   └── posts.ts
├── controllers/             # Request handlers, thin
├── services/                # Business logic
├── middleware/              # Reusable: auth, validation, rate-limit
├── models/                  # DB models or repositories
├── lib/                     # Utilities
└── config/                  # Env, DB, etc.
```

## Modern Async-Safe Setup

```ts
import express, { type Request, type Response, type NextFunction } from 'express';

const app = express();

// Body parsing (built into Express 4.16+)
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Security baseline — ALWAYS
import helmet from 'helmet';
import cors from 'cors';
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN }));

// Routes
import { router } from './routes';
app.use('/api', router);

// Global error handler — MUST be last
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(3000);
```

## Async Handlers

Express 4 doesn't auto-catch promise rejections. Wrap async handlers:

```ts
// Option 1: try/catch in each handler
router.get('/posts', async (req, res, next) => {
  try {
    const posts = await db.post.findMany();
    res.json(posts);
  } catch (e) { next(e); }
});

// Option 2: use express-async-errors (v5 is closer to default)
import 'express-async-errors';
router.get('/posts', async (req, res) => {
  res.json(await db.post.findMany());
});

// Option 3: small wrapper
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
```

**Express 5** (still RC at time of writing) handles promise rejection natively.

## Validation

Use **Zod** (or Joi) — never trust `req.body`:

```ts
import { z } from 'zod';

const createUserSchema = z.object({
  email: z.string().email(),
  age: z.number().int().min(13),
});

router.post('/users', asyncHandler(async (req, res) => {
  const data = createUserSchema.parse(req.body);   // throws 400 on invalid
  const user = await db.user.create({ data });
  res.status(201).json(user);
}));

// Error handler converts ZodError → 400
app.use((err, req, res, next) => {
  if (err instanceof z.ZodError) return res.status(400).json({ errors: err.errors });
  next(err);
});
```

## Auth Middleware

```ts
async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Missing token' });
  try {
    req.user = await verifyJwt(token);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

router.get('/profile', requireAuth, (req, res) => res.json(req.user));
```

## Rate Limiting

```ts
import rateLimit from 'express-rate-limit';

app.use('/api/auth', rateLimit({ windowMs: 60_000, max: 5 }));
app.use('/api', rateLimit({ windowMs: 60_000, max: 100 }));
```

## File Uploads

Use `multer` for multipart — never write your own parser:
```ts
import multer from 'multer';
const upload = multer({ dest: 'uploads/', limits: { fileSize: 5 * 1024 * 1024 } });
router.post('/upload', upload.single('file'), (req, res) => {
  res.json({ filename: req.file?.filename });
});
```

## Best Practices

- Always use `helmet()` + `cors()` + body-parser limits
- Validate **every** request body/query/params at the boundary
- Async handlers MUST handle rejections (`asyncHandler` wrapper or v5)
- Centralize error handling in ONE global error middleware
- Type `req.user` via module augmentation, don't use `as any`
- Use **environment-based config** — no hardcoded ports/URLs

## Common Pitfalls

- Unhandled promise rejection crashes Node 15+ — wrap async handlers
- `app.use(express.json())` without size limit → DoS via huge payloads
- Mixing `res.send()` and `res.json()` after another response was already sent → "Cannot set headers after they are sent"
- Forgetting `next(err)` in error path → request hangs forever
- Putting business logic in route handlers — extract to services
- Trusting `Content-Type` header for upload validation — use file signature checking

## Migration to Modern Alternatives

If starting fresh:
- **Fastify** — drop-in faster Express alternative, better TS, schema validation built-in
- **Hono** — runs on Node + edge runtimes (Cloudflare, Deno, Bun), tiny + fast
- **NestJS** — opinionated, decorator-based, good for large teams
- **Elysia** — Bun-native, blazing fast on Bun runtime

## Resources

- Docs: https://expressjs.com
- Express 5 migration: https://expressjs.com/en/guide/migrating-5.html
- Security best practices: https://expressjs.com/en/advanced/best-practice-security.html
