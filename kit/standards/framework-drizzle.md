# Drizzle ORM Standards

Detected via `drizzle-orm` in `package.json` — auto-injected as **extra**.

## What Drizzle Is

Lightweight TypeScript ORM — closer to SQL than Prisma. **Schema in TypeScript code, not a DSL**. Zero runtime overhead, fully type-safe. Supports PostgreSQL, MySQL, SQLite, Turso, Neon, Vercel Postgres.

## When to Use vs Prisma

| Use Drizzle | Use Prisma |
|---|---|
| Edge / serverless (smaller runtime) | Rich ecosystem (Prisma Studio, Accelerate) |
| Like writing SQL | Like declarative schemas |
| Already using Zod / Valibot | Prefer Prisma-style migrations UX |
| Need raw control over queries | Want auto-generated client |

Drizzle is **gaining mindshare fast** in 2024-2026 for new projects. Prisma is more mature.

## Setup

```bash
npm install drizzle-orm
npm install -D drizzle-kit @types/pg pg
```

```ts
// drizzle.config.ts
import type { Config } from "drizzle-kit";

export default {
    schema: "./src/db/schema.ts",
    out: "./drizzle",
    dialect: "postgresql",
    dbCredentials: { url: process.env.DATABASE_URL! },
} satisfies Config;
```

## Schema (TypeScript)

```ts
// src/db/schema.ts
import { pgTable, serial, varchar, timestamp, integer, boolean, text } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
    id: serial("id").primaryKey(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    name: varchar("name", { length: 100 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const posts = pgTable("posts", {
    id: serial("id").primaryKey(),
    authorId: integer("author_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 200 }).notNull(),
    body: text("body"),
    published: boolean("published").default(false).notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
    posts: many(posts),
}));

export const postsRelations = relations(posts, ({ one }) => ({
    author: one(users, { fields: [posts.authorId], references: [users.id] }),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
```

`$inferSelect` / `$inferInsert` give you TS types from the schema.

## DB Connection

```ts
// src/db/index.ts
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });
```

For serverless / edge (Vercel, Cloudflare):
```ts
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle(sql, { schema });
```

## Queries

```ts
import { eq, and, or, gt, like, desc, sql } from "drizzle-orm";
import { db } from "./db";
import { users, posts } from "./db/schema";

// Select all
const allUsers = await db.select().from(users);

// Filter
const adults = await db
    .select()
    .from(users)
    .where(and(gt(users.age, 18), eq(users.isActive, true)));

// Limit / order
const recent = await db
    .select()
    .from(users)
    .orderBy(desc(users.createdAt))
    .limit(20);

// Specific columns
const emails = await db
    .select({ id: users.id, email: users.email })
    .from(users);

// Join
const withPosts = await db
    .select({ user: users, post: posts })
    .from(users)
    .leftJoin(posts, eq(posts.authorId, users.id));
```

## Query Builder API (Alternative)

Drizzle has TWO query styles. The `db.select()` style above is the **Core**. The newer **Query API** mimics Prisma:

```ts
const userWithPosts = await db.query.users.findFirst({
    where: eq(users.id, 1),
    with: {
        posts: {
            where: eq(posts.published, true),
            limit: 10,
        },
    },
});

const allWithCount = await db.query.users.findMany({
    columns: { id: true, email: true },
    with: { posts: true },
    limit: 20,
});
```

Closer to Prisma syntax, fully typed. Many devs prefer it over the Core API.

## Insert / Update / Delete

```ts
// Insert
const [user] = await db.insert(users).values({
    email: "a@b.com",
    name: "Alice",
}).returning();

// Bulk
await db.insert(users).values([
    { email: "a@b.com", name: "Alice" },
    { email: "b@b.com", name: "Bob" },
]);

// Upsert
await db
    .insert(users)
    .values({ email: "a@b.com", name: "Alice" })
    .onConflictDoUpdate({
        target: users.email,
        set: { name: "Alice Updated" },
    });

// Update
await db.update(users).set({ name: "New name" }).where(eq(users.id, 1));

// Delete
await db.delete(users).where(eq(users.id, 1));
```

## Transactions

```ts
await db.transaction(async (tx) => {
    const [user] = await tx.insert(users).values({ ... }).returning();
    await tx.insert(posts).values({ authorId: user.id, title: "..." });
    // tx auto-commits, or rolls back on throw
});
```

## Migrations (drizzle-kit)

```bash
npx drizzle-kit generate         # generate migration from schema diff
npx drizzle-kit migrate          # apply migrations to DB
npx drizzle-kit push             # push schema directly (dev only)
npx drizzle-kit studio           # GUI browser
```

`push` is fast in dev but skips migration history — use `generate` + `migrate` for prod.

## Raw SQL

```ts
import { sql } from "drizzle-orm";

const result = await db.execute(sql`
    SELECT email, COUNT(*) FROM users GROUP BY email
`);

// Inside select
const adults = await db
    .select()
    .from(users)
    .where(sql`${users.age} >= 18`);
```

`sql` is a tagged template — values are parameterized safely.

## Best Practices

- **Schema in TS** — single source of truth, fully typed
- **Drizzle-zod** for runtime validation: `createInsertSchema(users)` gives you a Zod schema matching your table
- **Query API** (`db.query.*`) for readable code; **Core API** for fine-grained control
- **`drizzle-kit generate`** in CI, `migrate` on deploy
- **Pool one DB connection** for the app (Node) or per-request (edge/serverless)
- **Relations** must be declared via `relations(...)` to use the Query API's `with`
- **`onConflictDoUpdate`** for upserts — much simpler than two queries

## Common Pitfalls

- Forgetting `await` on Drizzle calls → returns Promise unresolved
- `db.select()` without `await` then iterating → not a SQL execution
- Schema changes not reflected → re-run `drizzle-kit generate`
- Connection pool exhaustion on serverless → use `@neondatabase/serverless` driver
- N+1 from manual joins → use Query API's `with` for explicit eager-loading
- Numeric type confusion: `serial` is int, `bigserial` is bigint, watch your TS types

## Performance Notes

- Drizzle has **near-zero runtime overhead** — fastest TS ORM in benchmarks
- Better than Prisma for edge runtimes (smaller bundle, no Rust engine)
- Use `db.execute(sql\`...\`)` for complex queries that don't fit the QB elegantly
- Index frequently-filtered columns via Drizzle's `index()` schema helpers

## Resources

- Docs: https://orm.drizzle.team/docs
- drizzle-kit: https://orm.drizzle.team/kit-docs
- drizzle-zod: https://orm.drizzle.team/docs/zod
- Examples: https://github.com/drizzle-team/drizzle-orm/tree/main/examples
