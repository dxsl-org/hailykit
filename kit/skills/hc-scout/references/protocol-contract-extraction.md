# Contract Extraction Protocol

Extract the public API surface of a module or scope. Used by `hc:scout --contracts` to answer: "what must I not break in this refactor?"

---

## What counts as a contract

A **contract** is any interface or behavior that other modules depend on — changing it without a coordinated update causes compile errors, runtime failures, or data corruption.

| Contract type | Examples |
|---------------|---------|
| **Exported types/interfaces** | `export interface User`, `export type UserId` |
| **Public function signatures** | `export function createUser(...)` |
| **HTTP endpoints** | `POST /api/users`, GraphQL mutations |
| **Database schemas** | Table definitions, column types, foreign keys |
| **Event bus contracts** | Event names, payload shapes |
| **Config / env schemas** | Required env vars, config file shape |
| **CLI interfaces** | Flag names, argument shapes, exit codes |

---

## Extraction by Stack

### TypeScript / JavaScript

```bash
# All exports from a file
grep -n "^export" src/auth.ts

# All exports from a directory
grep -rn "^export\|^export default" src/api/ --include="*.ts"

# Interface and type exports
grep -rn "^export (?:interface|type|class|const|function|enum)" src/ --include="*.ts"

# Re-exports (barrel files)
grep -rn "^export \* from\|^export {" src/index.ts
```

**Follow-up:** For each exported symbol, find all consumers:
```bash
# Who imports UserProfile?
grep -rn "import.*UserProfile\|import.*{.*UserProfile" src/
```

### REST API (Express / Hono / Fastify / NestJS)

```bash
# Express / Hono routes
grep -rn "router\.\(get\|post\|put\|patch\|delete\)" src/ --include="*.ts"
grep -rn "app\.\(get\|post\|put\|patch\|delete\)" src/ --include="*.ts"

# NestJS route decorators
grep -rn "@\(Get\|Post\|Put\|Patch\|Delete\|Controller\)" src/ --include="*.ts"

# OpenAPI spec (if exists)
find . -name "openapi.yaml" -o -name "swagger.json" | head -5
```

### GraphQL

```bash
# Schema definitions
find . -name "*.graphql" -o -name "*.gql" | head -20
grep -rn "gql\`\|buildSchema\|makeExecutableSchema" src/ --include="*.ts"

# Type definitions in resolvers
grep -rn "type Query\|type Mutation\|type Subscription" src/
```

### Database (SQL migrations / ORM)

```bash
# Migration files
find . -path "*/migrations/*.sql" | sort | tail -20
find . -path "*/migrations/*.ts" | sort | tail -20  # TypeORM/Prisma

# Prisma schema
find . -name "schema.prisma" | head -3

# Drizzle / TypeORM table definitions
grep -rn "@Table\|@Entity\|pgTable\|mysqlTable" src/ --include="*.ts"

# Knex / raw SQL table names
grep -rn "createTable\|ALTER TABLE\|CREATE TABLE" migrations/
```

### Event Bus / Message Queue

```bash
# Event names (constants / enums)
grep -rn "emit\|publish\|send\|dispatch" src/ --include="*.ts" | grep "event\|queue\|topic" | head -20

# Event payload types
grep -rn "EventPayload\|MessagePayload\|QueueMessage" src/ --include="*.ts"
```

### Python

```bash
# Public functions/classes (no leading underscore)
grep -rn "^def [^_]\|^class [^_]" src/ --include="*.py"

# FastAPI routes
grep -rn "@app\.\|@router\." src/ --include="*.py"

# Pydantic models (schemas)
grep -rn "class.*BaseModel\|class.*Schema" src/ --include="*.py"
```

### Go

```bash
# Exported symbols (Capitalized)
grep -rn "^func [A-Z]\|^type [A-Z]\|^var [A-Z]\|^const [A-Z]" --include="*.go" .

# HTTP handlers
grep -rn "http.HandleFunc\|mux.Handle\|router.GET\|router.POST" --include="*.go" .

# Interface definitions
grep -rn "^type .* interface" --include="*.go" .
```

---

## Stability Boundary

After extracting contracts, classify each by stability:

| Stability | Definition | Examples |
|-----------|-----------|---------|
| **Stable** | Other services/clients depend on it; breaking = incident | Public API endpoints, DB schema columns |
| **Internal** | Module boundary; breaking requires coordinated update | Exported TypeScript interfaces between packages |
| **Volatile** | Implementation detail that happens to be exported | Utility functions with single caller |

**Document the Stability Boundary** in the output — the list of files whose public interface must not change without a version bump, migration, or coordinated update across consumers.

---

## Blast Radius Analysis

After extracting contracts, measure the impact radius:

```bash
# Direct consumers of a module
grep -rn "from '.*auth'" src/ --include="*.ts" | cut -d: -f1 | sort -u

# Transitive: consumers of consumers (1 level deep)
# For each file in the direct consumer list:
#   grep -rn "from '.*<consumer-file>'" src/ --include="*.ts"

# Quick summary: how many files import this module?
grep -rn "from '.*src/auth'" src/ --include="*.ts" | wc -l
```

**Rule:** If changing a contract would require edits in >5 files, document it explicitly in `## Unresolved Questions` as a breaking-change risk.
