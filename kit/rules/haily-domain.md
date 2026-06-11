# Skill Domain Routing

Decision trees to pick the RIGHT skill by user intent within a domain.

> **Auto-injected standards:** language/framework guidance (React, Next.js, NestJS, FastAPI, Django, Flutter, monorepos, …) is loaded by the session-init hook when the stack is detected — no skill to invoke. Rules live in `standards/framework-*-standards.md` and `standards/lang-*-standards.md`. Force-load one with `{skill:hc-lookup}`.

## Frontend / UI

```
Build UI from mockup/screenshot/video  → {skill:hc-cook} --layout <path|url>   (visual-reference-led)
Style components (shadcn/Tailwind)     → framework-shadcn + framework-tailwind standards (auto-inject when detected)
Choose design system (style/palette/font)  → {skill:hl-design} `scripts/ui-ux/search.py`
Audit UI/UX against guidelines            → {skill:hc-review} --ui
```
Disambiguate: visual reference (image/video/Figma) → `{skill:hc-cook} --layout` · style/palette/font choice → `{skill:hl-design}` search scripts · UI/UX audit → `{skill:hc-review} --ui` · shadcn/Tailwind code → framework standards auto-inject.

## Media / Design Assets

```
Generate AI media (image/video/TTS/music)  → {skill:hl-design}
Brand identity, logos, banners, tokens     → {skill:hl-design}
Diagrams (Mermaid v11)                     → {skill:hl-visualize} --mermaid
```

## Codebase Understanding

```
Quick file search, locate code              → {skill:hc-scout}
Full codebase dump for LLM                  → {skill:hc-scout} --pack
Code metrics (nLOC, complexity, token est)  → {skill:hl-stats}
```

## Knowledge / Research

```
Build knowledge graph from topic/entities   → {skill:hl-mindmap} <topic>
Extend existing graph with new entity/rel   → {skill:hl-mindmap} <file.json> <query>
Deep technical research report              → {skill:hl-research} <topic>
```
Disambiguate: want a persistent graph you can extend → `{skill:hl-mindmap}` · want a one-shot research report → `{skill:hl-research}`.

## Project Initialization

```
Init docs/ + CLAUDE.md in existing project  → {skill:hc-docs} init  (scouts → real docs + CLAUDE.md)
Bootstrap new project from scratch          → {skill:hc-new}  (Route → Recon → Draft → Build → Verify → Ship; auto-detects project type)
Autonomous feature development (goal → committed code, no manual steps)  → {skill:hc-goal} "description" [--auto]
```
Disambiguate: new project from scratch → `{skill:hc-new}` · add a feature to existing project without manual orchestration → `{skill:hc-goal}` · step-by-step with control at each stage → `{skill:hc-plan}` then `{skill:hc-cook}`.

## Backend / Database

```
Design schemas, write SQL/NoSQL, optimize indexes/migrations/replication → {skill:hc-db}
```
NestJS / FastAPI / Django / Express / Hono / Fastify / Better Auth standards auto-inject when detected; payment-provider standards (Stripe / Polar / Paddle / Creem / SePay) auto-inject when the SDK is in deps.

## Infrastructure / Deployment

```
Deploy to Vercel/Netlify/Railway/Fly.io  → {skill:hc-deploy}
Docker, Kubernetes, CI/CD, GitOps        → {skill:hc-devops}
```
Monorepo (Turborepo/pnpm/nx) standards auto-inject on `turbo.json` / `nx.json` / `pnpm-workspace.yaml`.

## Security (Code)

```
STRIDE/OWASP audit, auto-fix, full scan   → {skill:hc-security}
Quick secret/dep/vuln scan (pre-commit)   → {skill:hc-security} --quick
```

## AI / LLM

```
Optimize context, agent architecture, memory  → {skill:hl-context-engineering}
Analyze images/audio/video/docs with Gemini   → {skill:hc-docs}
Build MCP servers or agentize existing code   → {skill:hc-mcp-builder}
```

## MCP (Model Context Protocol)

```
Build MCP server (scratch OR agentize codebase)  → {skill:hc-mcp-builder}
Discover/manage/execute MCP tools                → Claude Code /mcp  (built-in)
```

## Testing / Browser

```
Run tests, coverage, TDD              → {skill:hc-test}
Web testing (Playwright, k6, a11y)    → {skill:hc-test} --web
Puppeteer debug (console/net/perf)    → {skill:hc-debug} (auto-routes to Puppeteer for frontend)
AI-driven browser, Browserbase cloud  → {skill:hc-browser}
Design test strategy before coding    → Task(subagent_type="haily-test-architect")
```

## Documentation

```
Update project docs (codebase-summary, PDR)  → {skill:hc-docs}
Generate llms.txt site index                 → {skill:hc-docs} llms
Search library docs (context7)               → {skill:hc-lookup}
Diagrams (Mermaid v11)                       → {skill:hl-visualize} --mermaid
```

## Mobile / Native & E-commerce

React Native, Flutter, Swift, Kotlin, Dart standards auto-inject when detected — no dedicated mobile skill. Shopify (`shopify.app.toml` / `@shopify/cli`) auto-injects `framework-shopify.md`.

## Stack Auto-Injection (Reference)

The session-init hook auto-loads these from `standards/` based on detection:

- **Languages (25):** typescript, javascript, python, golang, rust, java, kotlin, swift, dart, php, ruby, elixir, erlang, gleam, c, cpp, zig, csharp, lua, r, solidity, bash, julia, haskell, ocaml
- **Primary framework (one):** next, nuxt, astro, remix, svelte, vue, tanstack-start, react, solidjs, qwik, htmx, react-native, nestjs, express, fastify, hono, elysia, litestar, fastapi, starlette, django, flask, streamlit, gradio, tauri, bevy, leptos, dioxus, yew, axum, actix-web, rocket, phoenix, nerves, lustre, flutter, swiftui, laravel, symfony, rails, spring-boot, quarkus, ktor, vapor, gin, echo, fiber, aspnet, blazor, hardhat, foundry, shopify
- **Framework extras (multiple):** better-auth, monorepo · stripe, polar, paddle, creem, sepay · liveview, ecto, oban, broadway, absinthe · langchain, celery, pytorch, pandas, polars, pydantic, sqlalchemy, jupyter, huggingface · sqlx · sqlc · prisma, drizzle, typeorm, zustand

## Debugging & Performance

```
Analyze flame graph / heap dump / CPU profile   → {skill:hc-debug} --profile <artifact>
Correlate logs across multiple services          → {skill:hc-debug} --trace <trace-id>
Performance regression, slow query, high latency → {skill:hc-debug} (routes to performance-diagnostics)
Metric-driven optimization (N iterations)        → {skill:hc-optimize}
```

## Senior Developer Workflows

```
Document architecture decision (ADR)    → Task(subagent_type="haily-adr-writer")
Inventory and prioritize tech debt      → Task(subagent_type="haily-tech-analyst")
Design API contract (REST/GraphQL)      → Task(subagent_type="haily-api-designer")
Design test strategy before coding      → Task(subagent_type="haily-test-architect")
Optimize code clarity/efficiency        → Task(subagent_type="haily-optimizer")
Feature flag gradual rollout            → {skill:hc-ship} rollout <flag-name>
Large-scale library/pattern migration   → {skill:hc-cook} migrate "description"
Port/extract a feature from another repo → {skill:hc-cop} <source> [feature]
Sprint retrospective from git metrics   → {skill:hc-git} retro [timeframe]
Impact analysis of recent changes       → {skill:hc-git} analyze [ref]
```

## Dependency Management

```
CVE audit and security patches          → {skill:hc-fix} deps security
Upgrade outdated dependencies           → {skill:hc-fix} deps outdated
Major version upgrade (one package)     → {skill:hc-fix} deps major <package>
```

## Usage Notes

- One skill per distinct intent. If a task spans domains ("build + deploy"), suggest the primary, mention the secondary.
- Domain skills combine with the core loop: `{skill:hc-plan}` → domain skill → `{skill:hc-cook}`.
- Unlisted skills are core-workflow (see `workflow.md`) or on-demand utilities (`{skill:hl-visualize}`, `{skill:hl-reasoning}`, `{skill:hl-brainstorm}`).
