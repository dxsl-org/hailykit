# TypeORM Standards

Detected via `typeorm` in `package.json` — auto-injected as **extra**.

## What TypeORM Is

Class-based ORM for TypeScript/JavaScript. Decorator-driven (`@Entity`, `@Column`). Supports Active Record + Data Mapper patterns. Most commonly seen in **NestJS** projects.

## When to Use

- Existing NestJS / classic enterprise codebase
- Like Hibernate/Doctrine-style decorator entities
- Need Active Record pattern (model.save())

For **new projects**, consider **Prisma** (better DX, generated client) or **Drizzle** (lighter, edge-friendly). TypeORM has well-known sharp edges with the QueryBuilder API and some edge cases.

## Setup

```bash
npm install typeorm reflect-metadata pg
```

`tsconfig.json` must enable decorators:
```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "strictPropertyInitialization": false
  }
}
```

Import once at app entry:
```ts
import "reflect-metadata";
```

## Data Source

```ts
// data-source.ts
import { DataSource } from "typeorm";
import { User } from "./entities/User";
import { Post } from "./entities/Post";

export const AppDataSource = new DataSource({
    type: "postgres",
    host: "localhost",
    port: 5432,
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: "myapp",
    synchronize: false,           // NEVER true in production
    logging: process.env.NODE_ENV === "development",
    entities: [User, Post],
    migrations: ["src/migrations/*.ts"],
});

// On app start
await AppDataSource.initialize();
```

`synchronize: true` auto-applies schema changes — **only in dev**. Use migrations in prod.

## Entities

```ts
import { Entity, PrimaryGeneratedColumn, Column, OneToMany, ManyToOne, CreateDateColumn, Index } from "typeorm";

@Entity("users")
@Index(["email"], { unique: true })
export class User {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: "varchar", length: 255 })
    email!: string;

    @Column({ type: "varchar", length: 100 })
    name!: string;

    @OneToMany(() => Post, (post) => post.author)
    posts!: Post[];

    @CreateDateColumn()
    createdAt!: Date;
}

@Entity("posts")
export class Post {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column()
    title!: string;

    @Column({ type: "text", nullable: true })
    body!: string | null;

    @ManyToOne(() => User, (user) => user.posts, { onDelete: "CASCADE" })
    author!: User;
}
```

## Repository Pattern (Data Mapper)

```ts
const userRepo = AppDataSource.getRepository(User);

// Find
const user = await userRepo.findOne({ where: { id: 1 } });
const users = await userRepo.find({ take: 20, order: { createdAt: "DESC" } });

// With relations
const userWithPosts = await userRepo.findOne({
    where: { id: 1 },
    relations: { posts: true },
});

// Save (insert or update)
const user = userRepo.create({ email: "a@b.com", name: "Alice" });
await userRepo.save(user);

// Update
await userRepo.update(1, { name: "New name" });

// Delete
await userRepo.delete(1);

// Count
const total = await userRepo.count({ where: { isActive: true } });
```

## QueryBuilder (For Complex Queries)

```ts
const users = await userRepo
    .createQueryBuilder("user")
    .leftJoinAndSelect("user.posts", "post")
    .where("user.age > :age", { age: 18 })
    .andWhere("post.published = :published", { published: true })
    .orderBy("user.createdAt", "DESC")
    .take(20)
    .getMany();

const stats = await userRepo
    .createQueryBuilder("user")
    .select("user.city", "city")
    .addSelect("COUNT(*)", "count")
    .groupBy("user.city")
    .getRawMany();
```

QueryBuilder is the **escape hatch** when `find()` options aren't enough.

## Migrations

```bash
# Generate from entity diff
npx typeorm migration:generate src/migrations/CreateUsers -d data-source.ts

# Run
npx typeorm migration:run -d data-source.ts

# Revert
npx typeorm migration:revert -d data-source.ts
```

```ts
import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateUsers1234567890123 implements MigrationInterface {
    async up(queryRunner: QueryRunner) {
        await queryRunner.query(`
            CREATE TABLE users (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) NOT NULL UNIQUE,
                name VARCHAR(100) NOT NULL,
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);
    }

    async down(queryRunner: QueryRunner) {
        await queryRunner.query(`DROP TABLE users`);
    }
}
```

Always review auto-generated migrations — they're not always perfect.

## NestJS Integration

```ts
// app.module.ts
@Module({
    imports: [
        TypeOrmModule.forRoot({
            type: "postgres",
            host: "localhost",
            // ...
            entities: [User, Post],
            synchronize: false,
        }),
        TypeOrmModule.forFeature([User, Post]),
    ],
})
export class AppModule {}

// users.service.ts
@Injectable()
export class UsersService {
    constructor(
        @InjectRepository(User)
        private usersRepo: Repository<User>,
    ) {}

    async findAll() {
        return this.usersRepo.find();
    }
}
```

## Transactions

```ts
await AppDataSource.transaction(async (manager) => {
    const user = manager.create(User, { email: "..." });
    await manager.save(user);
    const post = manager.create(Post, { author: user, title: "..." });
    await manager.save(post);
});

// Or via QueryRunner for finer control
const queryRunner = AppDataSource.createQueryRunner();
await queryRunner.connect();
await queryRunner.startTransaction();
try {
    await queryRunner.manager.save(user);
    await queryRunner.commitTransaction();
} catch (err) {
    await queryRunner.rollbackTransaction();
} finally {
    await queryRunner.release();
}
```

## Relations Eager Loading

```ts
// Eager: always loaded
@OneToMany(() => Post, (post) => post.author, { eager: true })
posts!: Post[];

// Lazy: explicit await
@OneToMany(() => Post, (post) => post.author)
posts!: Promise<Post[]>;

// Per-query (most flexible)
await userRepo.findOne({ where: { id: 1 }, relations: { posts: true } });
```

**Default to per-query loading** — `eager: true` everywhere causes massive joins.

## Best Practices

- **Disable `synchronize` in prod** — use migrations
- Always use **per-query `relations`** to avoid N+1 and unwanted joins
- **Auto-generate migrations** + review them — TypeORM sometimes generates wrong DDL
- **`createQueryBuilder`** for anything complex — `find` options are limited
- Use **`@VersionColumn`** for optimistic locking on concurrent updates
- **DTO + class-validator** for input — don't trust client-sent entity-shaped data
- Pin TypeORM major version — some 0.2 → 0.3 changes are breaking

## Common Pitfalls

- `synchronize: true` in prod → data loss when column type changes
- Forgetting `reflect-metadata` import → decorators silently broken
- N+1 from accessing relations without eager loading or `relations: { ... }`
- Auto-migrate generates `DROP COLUMN` you didn't expect → review!
- `save()` vs `update()`: `save()` does load-then-update (extra query), `update()` is bulk
- `findOne()` returning `null` when you assumed entity → null safety required
- Circular `@OneToMany`/`@ManyToOne` → use string class name in lazy form
- Mixing Active Record (`User.findOne()`) + Repository pattern in same project → confusing

## Migration Helper Tools

- **typeorm-extension** — seeding utilities
- **NestJS Typeorm CLI plugins** — schedule scripts via Nest commands
- **typescript-eslint-plugin-typeorm** — lint rules for common TypeORM mistakes

## Resources

- Docs: https://typeorm.io
- Examples: https://github.com/typeorm/typeorm/tree/master/sample
- NestJS + TypeORM: https://docs.nestjs.com/techniques/database
- typeorm-extension: https://github.com/Tada5hi/typeorm-extension
