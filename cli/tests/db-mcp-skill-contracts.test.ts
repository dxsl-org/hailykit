import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DB = 'kit/skills/hc-db/SKILL.md';
const MCP = 'kit/skills/hc-mcp-builder/SKILL.md';
const BASELINE_BYTES = 13840;
const MAX_DB_BYTES = 4675;
const MAX_MCP_BYTES = 4500;
const MAX_TOTAL_BYTES = 8304;

function read(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8').replace(/\r\n/g, '\n');
}

function bytes(relativePath: string): number {
  return Buffer.byteLength(read(relativePath), 'utf8');
}

test('DB and MCP skill compression preserves public prompt contracts', () => {
  const frontmatter = new Map([
    [DB, `---
name: hc-db
description: "Database expert: schema design, queries, migrations, ORM selection for PostgreSQL, MongoDB, MySQL, SQLite, Redis, Neo4j, Supabase."
when_to_use: "Invoke when designing schemas, writing queries, selecting a database, or planning migrations. Auto-invoked by {skill:hc-plan}, {skill:hc-cook}, {skill:hc-review} when database work is detected."
user-invocable: true
argument-hint: "[database task or question]"
metadata:
  category: database
  keywords: [postgresql, mongodb, mysql, sqlite, redis, neo4j, supabase, sql, schemas, queries, orm, migrations]
---
`],
    [MCP, `---
name: hc-mcp-builder
description: "Build MCP servers from scratch or convert existing codebases into CLI + MCP server."
when_to_use: "Invoke when building a new MCP server from an API/service, or agentizing an existing codebase so AI agents can use it."
user-invocable: true
argument-hint: "<API description | local-path | github-url> [--mcp|--cli] [--auto]"
metadata:
  category: dev-tools
  keywords: [MCP, server, build, agentize, cli, tools]
---
`],
  ]);
  for (const [file, expected] of frontmatter) {
    assert.ok(read(file).startsWith(expected), `${file} frontmatter changed`);
  }

  const db = read(DB);
  for (const marker of [
    '**Required — inspect before design:**',
    'Never execute DDL without approval',
    '**Required — query safety:**',
    'Parameterize every query',
    'authentication and TLS',
    'ORM for transactional CRUD',
    'query builder for complex reads',
    'raw SQL for reports and measured hot paths',
    'Expand → Backfill → Switch → Contract',
    'forward and backward migrations in CI',
    'restorable backup',
    'always pool connections',
    'Never create a client per HTTP request',
    'use InnoDB, `utf8mb4`, `STRICT_ALL_TABLES`',
    'enable WAL and `PRAGMA foreign_keys = ON`',
    'set TTLs',
    '`SCAN` instead of `KEYS`',
    'never treat Redis as the primary database',
    'enable RLS and explicit policies',
    'direct PostgreSQL connection for migrations',
    'parameterize queries, prefer `MERGE` over `CREATE`',
    '**Auto-invoked by:** `{skill:hc-plan}`',
    '**Precedes:** `{skill:hc-deploy}`',
  ]) assert.ok(db.includes(marker), `hc-db lost: ${marker}`);

  for (const reference of [
    'db-design.md',
    'references/mongodb-crud.md',
    'references/mongodb-aggregation.md',
    'references/mongodb-indexing.md',
    'references/mongodb-atlas.md',
    'references/postgresql-queries.md',
    'references/postgresql-psql-cli.md',
    'references/postgresql-performance.md',
    'references/postgresql-administration.md',
  ]) assert.ok(db.includes(reference), `hc-db lost reference: ${reference}`);

  const mcp = read(MCP);
  for (const marker of [
    '<API description | local-path | github-url> [--mcp|--cli] [--auto]',
    'shared `core/` with thin `cli/` and `mcp/` adapters',
    'Interactive; pause at checkpoints',
    '**Required — workflows not endpoints:**',
    '**Required — testing safety:**',
    'timeout 5s',
    '`tmux` panes',
    '**Required — trust boundaries:**',
    'explicit confirmation for destructive tools',
    'annotations are hints, not authorization controls',
    '`limit`, `has_more`',
    '`readOnlyHint`, `destructiveHint`, `idempotentHint`, and `openWorldHint`',
    '`25,000` characters',
    '`MCP_TRANSPORT`',
    'Streamable HTTP at `/mcp`',
    'SSE for compatibility',
    '`ctx.auth` first',
    'disables keychain outside local development',
    '10 stable and verifiable workflow questions',
    '`.claude/.mcp.json`',
    '**Follows:** `{skill:hc-plan}`',
    '**Precedes:** `{skill:hc-deploy}`',
  ]) assert.ok(mcp.includes(marker), `hc-mcp-builder lost: ${marker}`);

  for (const reference of [
    'references/mcp-best-practices.md',
    'references/python-mcp-server.md',
    'references/node-mcp-server.md',
    'references/evaluation.md',
    'references/agentize-agent-centric-design.md',
    'references/agentize-auth-resolution-chain.md',
    'references/agentize-challenge-framework.md',
    'references/agentize-deployment-guide.md',
    'references/agentize-mcp-transports.md',
    'references/agentize-monorepo-layout.md',
  ]) assert.ok(mcp.includes(reference), `hc-mcp-builder lost reference: ${reference}`);

  const dbBytes = bytes(DB);
  const mcpBytes = bytes(MCP);
  const total = dbBytes + mcpBytes;
  assert.ok(dbBytes <= MAX_DB_BYTES, `hc-db ${dbBytes} exceeds ${MAX_DB_BYTES}`);
  assert.ok(mcpBytes <= MAX_MCP_BYTES, `hc-mcp-builder ${mcpBytes} exceeds ${MAX_MCP_BYTES}`);
  assert.ok(total <= MAX_TOTAL_BYTES, `batch ${total} exceeds ${MAX_TOTAL_BYTES}`);
  assert.ok(total < BASELINE_BYTES, `batch ${total} did not improve over ${BASELINE_BYTES}`);
});
