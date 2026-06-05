# Prisma Standards

Detected via `prisma` or `@prisma/client` in `package.json` — auto-injected as **extra**.

## What Prisma Is

Type-safe ORM for Node.js / TypeScript. Schema-first: you write a `.prisma` schema file → `prisma generate` produces a fully-typed client. Supports PostgreSQL, MySQL, SQLite, MongoDB, CockroachDB, SQL Server.

## Setup

```bash
npm install prisma --save-dev
npm install @prisma/client
npx prisma init
```

Creates `prisma/schema.prisma` + `.env`.

## Schema

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id        Int      @id @default(autoincrement())
  email     String   @unique
  name      String
  posts     Post[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Post {
  id        Int      @id @default(autoincrement())
  title     String
  body      String?
  author    User     @relation(fields: [authorId], references: [id], onDelete: Cascade)
  authorId  Int
  published Boolean  @default(false)
  createdAt DateTime @default(now())

  @@index([authorId, createdAt])
}
```

## Migrate + Generate

```bash
npx prisma migrate dev --name init      # create + apply migration in dev
npx prisma migrate deploy                # apply existing migrations in prod
npx prisma generate                       # regenerate client (auto-runs after migrate)
npx prisma studio                         # GUI to browse/edit data
```

`prisma migrate dev` is destructive-safe in dev — for prod use `prisma migrate deploy`.

## Client Usage

```ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Create
const user = await prisma.user.create({
    data: {
        email: "alice@example.com",
        name: "Alice",
        posts: { create: [{ title: "Hello", published: true }] },
    },
});

// Read
const users = await prisma.user.findMany({
    where: { email: { contains: "@example.com" } },
    orderBy: { createdAt: "desc" },
    take: 20,
    skip: 0,
});

const user = await prisma.user.findUnique({ where: { id: 1 } });
const userOrThrow = await prisma.user.findUniqueOrThrow({ where: { id: 1 } });

// Include relations
const userWithPosts = await prisma.user.findUnique({
    where: { id: 1 },
    include: { posts: { where: { published: true }, take: 10 } },
});

// Select specific fields
const userEmail = await prisma.user.findUnique({
    where: { id: 1 },
    select: { id: true, email: true },
});

// Update
const updated = await prisma.user.update({
    where: { id: 1 },
    data: { name: "Alice Updated" },
});

// Delete
await prisma.user.delete({ where: { id: 1 } });
```

Every operation is fully typed — auto-complete on `where`, `include`, `select`, `data`.

## Transactions

```ts
// Sequential (Prisma manages tx for you)
const [user, post] = await prisma.$transaction([
    prisma.user.create({ data: { email: "..." } }),
    prisma.post.create({ data: { title: "...", authorId: 1 } }),
]);

// Interactive (callback-based)
await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({ data: { email: "..." } });
    await tx.post.create({ data: { authorId: user.id, title: "..." } });
}, {
    timeout: 10000,
    isolationLevel: "Serializable",
});
```

## Raw Queries (Escape Hatch)

```ts
// Parameterized — SAFE
const users = await prisma.$queryRaw<User[]>`
    SELECT * FROM "User" WHERE email LIKE ${`%${query}%`}
`;

// Or
const users = await prisma.$queryRawUnsafe<User[]>(
    "SELECT * FROM \"User\" WHERE email LIKE $1",
    `%${query}%`,
);
```

`$queryRaw` (tagged template) is SQL-injection safe. **Never** concatenate strings into raw queries.

## Connection Pooling

For serverless (Vercel, Lambda):
- Default: per-instance connection pool → connection exhaustion at scale
- **Prisma Accelerate** — connection pooling + global edge cache (managed)
- **PgBouncer / Supavisor** — external pooler
- **`pool_timeout=0`** + `connection_limit=1` in connection string for transient envs

For long-running servers: default pool is fine.

## Validation Outside Prisma

Prisma validates **types** but not business rules. Pair with Zod / Valibot:

```ts
import { z } from "zod";

const CreateUserSchema = z.object({
    email: z.string().email(),
    name: z.string().min(1).max(100),
});

const data = CreateUserSchema.parse(req.body);
const user = await prisma.user.create({ data });
```

## Seeding

```ts
// prisma/seed.ts
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
    await prisma.user.upsert({
        where: { email: "admin@example.com" },
        update: {},
        create: { email: "admin@example.com", name: "Admin" },
    });
}

main().finally(() => prisma.$disconnect());
```

```json
// package.json
"prisma": { "seed": "tsx prisma/seed.ts" }
```

```bash
npx prisma db seed
```

## Best Practices

- **Single `PrismaClient` instance** — instantiate once, reuse (don't `new PrismaClient()` per request)
- For Next.js / hot-reload: use the global-singleton pattern to avoid leaked connections
  ```ts
  const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
  export const prisma = globalForPrisma.prisma ?? new PrismaClient();
  if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
  ```
- **`include` selectively** — `include: { posts: true }` fetches ALL posts; add filters
- **`select` instead of `include`** when you only need scalar fields — smaller payloads
- **Migrations in CI**: `prisma migrate deploy` before app starts
- **Index foreign keys** + frequently-queried columns
- **Use `findUniqueOrThrow` / `findFirstOrThrow`** to skip null-checks
- **Logging**: `new PrismaClient({ log: ["query", "error", "warn"] })` in dev

## Common Pitfalls

- Multiple `new PrismaClient()` in Next.js dev → connection pool exhaustion (use the singleton pattern)
- `include: { posts: true }` without `take`/`where` → fetches huge nested arrays
- N+1 from iterating users and calling `prisma.user.posts.findMany()` per user — use `include`
- Forgetting `await` on Prisma calls → returns Promise, not result
- Adding column without running `prisma generate` → TypeScript doesn't see it
- `.env` not loaded → `DATABASE_URL undefined`; install `dotenv-cli` or use Next.js auto-load
- Connection pool exhaustion in serverless → use Accelerate or external pooler

## Performance

- Use `select` to fetch only needed fields
- `take` + cursor-based pagination over `skip` for large tables
- **Indexes** on filter/sort columns — add via `@@index([col1, col2])`
- For analytical queries: drop to `$queryRaw` — Prisma's ORM overhead matters less than DB perf
- **Prisma Accelerate** for edge caching + connection pooling

## Resources

- Docs: https://www.prisma.io/docs
- Schema reference: https://www.prisma.io/docs/orm/prisma-schema
- Examples: https://github.com/prisma/prisma-examples
- Accelerate: https://www.prisma.io/accelerate
