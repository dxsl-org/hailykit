# Tech Stack & Key Decisions

> Decision record for `hailykit` (TypeScript engine + installer). Author: DXSL. License: PolyForm Noncommercial 1.0.0.

## Hard constraints (locked)

| Constraint | Decision | Why |
|---|---|---|
| **Zero runtime dependencies** | No npm-registry deps at all. Only Node.js built-ins (`fs`, `os`, `path`, `child_process`, `fetch`, `node:test`). | User cannot publish/maintain an npm account; old hailykit was near-zero-dep. Keeps install trivial and supply-chain risk zero. |
| **Distribution** | GitHub **release zip + install script** (`install.ps1` / `install.sh`), repo `dxsl-org/hailykit`. Never `npm publish`. | Matches old hailykit (`curl … \| sh`). No npm account needed. |
| **Language** | TypeScript → `tsc` to `dist/`. `target ES2022`, `module CommonJS`, `strict`. | Already set in `tsconfig.json`. Plain `tsc` build, no bundler. |
| **Imports** | **Relative imports** (`../utils/logger`). Path aliases (`@core/*`) **removed** from `tsconfig`. | Aliases need `tsc-alias` (a dep) to resolve in `dist/` at runtime — violates zero-dep. Relative paths just work. |
| **Node version** | `>=20` (dev on v24). | Native `fetch`, `fs.cpSync`, stable `node:test`. |

## Component choices

| Concern | Choice | Runner-up | Why |
|---|---|---|---|
| CLI arg parsing | **Hand-rolled parser** (mirrors old `parseArgs`) | commander | Zero-dep. Command surface is small (`install/upgrade/status` + engine verbs). |
| Testing | **`node:test` + `node:assert`** | vitest | Built into Node, zero-dep, runs `.test.ts` via Node 24 type-stripping or compiled `dist`. |
| JSON-with-comments | **tiny in-repo `strip-json-comments` util** | npm `strip-json-comments` | Replaces the only external dep the old CLI had. |
| Polyglot IPC framing | **NDJSON** (one JSON object per line) over stdio, one-shot | LSP Content-Length / JSON-RPC handshake | Simplest robust framing; same line-delimited approach MCP uses, minus the session handshake. |
| Subprocess | `child_process.spawn` (piped stdio) | execFile | Streams stdin/stdout; supports timeout + SIGTERM, stderr capture. |
| Zip extraction | `powershell Expand-Archive` (win) / `unzip`→`python3 -m zipfile` (unix) | a zip lib | Zero-dep; ported verbatim from old `lib-extractor`. |

## Polyglot protocol (one-shot tool invocation)

External tools are any executable (Python/Rust/Go/…) that reads **one JSON request line** on stdin and writes **one JSON response line** on stdout.

```jsonc
// stdin  (request)
{"v":1,"id":"<uuid>","tool":"<id>","input":{...},"context":{"sessionId":"...","cwd":"..."}}
// stdout (success)
{"v":1,"id":"<uuid>","ok":true,"output":{...}}
// stdout (failure)
{"v":1,"id":"<uuid>","ok":false,"error":{"code":"E_TOOL","message":"...","detail":{...}}}
```

Failure modes the executor handles: timeout (SIGTERM→SIGKILL), non-zero exit, malformed/missing JSON line, `id` mismatch, stderr capture for diagnostics.

## Result contract

All tool execution returns a discriminated union — never throws across the executor boundary:

```ts
type ToolResult<T> = { ok: true; value: T } | { ok: false; error: ToolError };
```

## Unresolved / deferred

1. **AI-based intent routing** — `RoutingStrategy` interface only; MVP routes by explicit tool id.
2. **Long-lived tool daemons** — one-shot spawn for now; revisit if perf demands.
3. **Schema validation** of tool input/output — deferred (would add ajv/zod = dep). Manifests declare schemas as docs for now.
4. **`sharedState` scope** — per-session for MVP; pipeline scoping later.
