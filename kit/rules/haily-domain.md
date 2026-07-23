# Skill Domain Routing

Decision trees to pick the RIGHT skill by user intent within domain.

> **Auto-injected standards:** language/framework guidance (React, Next.js, NestJS, FastAPI, Django, Flutter, monorepos, …) is loaded by session-init hook when stack is detected — no skill to invoke. Rules live in `standards/framework-*-standards.md` and `standards/lang-*-standards.md`. Force-load one with `{skill:hc-lookup}`.

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
Market / competitive research (size, competitors, pricing)  → {skill:hl-research} <topic> --type market
Literature review / scholarly research (no authored deliverable) → {skill:hl-research} <topic> --type academic
```
Disambiguate: want persistent graph you can extend → `{skill:hl-mindmap}` · want one-shot research report → `{skill:hl-research}` · market/competitive analysis as a decision artifact → `{skill:hl-research} --type market` · a literature review with no prose deliverable → `{skill:hl-research} --type academic` · an authored market-research report or thesis the reader consumes as prose → `{skill:hl-write}`.

## Writing / Content

```
Any authored document (report, article, essay, paper)   → {skill:hl-write} "description"
Story or book (short story, novel, non-fiction book)     → {skill:hl-write} "description"
Resume a long-form work in progress                      → {skill:hl-write} <workspace-dir>
```
Disambiguate: authored deliverable user will read as prose (report, essay, story, book) → `{skill:hl-write}` · project/technical documentation from code → `{skill:hc-docs}` · research report with no authored deliverable → `{skill:hl-research}` · a research artifact (competitor matrix, literature review) with no authored prose → `{skill:hl-research} --type market|academic`. References/sources can feed `{skill:hl-write}` directly as input files.

## Architecture & Specification

```
Write EARS-notation spec before coding       → {skill:hc-spec} "feature description"
Lightweight spec for a small task            → {skill:hc-spec} --quick "feature description"
Gate hc-cook with spec approval              → {skill:hc-cook} --spec "task"
Capture agreed architectural decision (ADR)  → {skill:hc-adr} "context or decision"
Auto-discover undocumented decisions         → {skill:hc-adr} scan
Scope scan to a subtree                      → {skill:hc-adr} scan --dir src/auth
```
Disambiguate: need formal acceptance criteria before coding → `{skill:hc-spec}` (full EARS spec) · task touches ≤2 files with no new public interface → `{skill:hc-spec} --quick` (also auto-selected by `{skill:hc-cook} --spec` for tiny tasks) · decision already made, need to record it → `{skill:hc-adr}` · no prior documentation of decisions exists → `{skill:hc-adr} scan`.

## Project Initialization

```
Init docs/ + CLAUDE.md in existing project  → {skill:hc-docs} init  (scouts → real docs + CLAUDE.md)
Bootstrap new project from scratch          → {skill:hc-new}  (Route → Recon → Draft → Build → Verify → Ship; auto-detects project type)
Autonomous feature development (goal → committed code, no manual steps)  → {skill:hc-goal} "description" [--auto]
```
Disambiguate: new project from scratch → `{skill:hc-new}` · many-phase autonomous run (longer than cook, bounded context + regression gate) → `{skill:hc-goal}` · step-by-step with user control → `{skill:hc-plan}` then `{skill:hc-cook}`. `{skill:hc-goal}` flags: `--budget N` (phase cap), `--budget Xtool` (tool-call cap), `--strict` (full-suite-green gating).

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
Thoroughly audit, adversarial verify Critical findings → {skill:hc-security} --deep
```

## Security Operations (Systems)

Security of **running systems / infrastructure / evidence** — distinct from code security above.

```
Recon / pentest / vuln assessment of an authorized target  → {skill:hs-assess}
Solve a CTF challenge                                        → {skill:hs-assess} --ctf
Audit a running system/container/cluster vs CIS/STIG         → {skill:hs-harden}
Apply guarded hardening remediations                         → {skill:hs-harden} --fix
Investigate an incident that already happened (forensics/IR) → {skill:hs-dfir}
Build a log timeline / correlate IOCs from collected evidence → {skill:hs-dfir}
```
Disambiguate: security of the **code you write** → `{skill:hc-security}` (appsec audit) / `{skill:hc-fix}` (code + CVE patching) · security of a **running system** → `hs-*`. Build/operate Docker/k8s/CI-CD → `{skill:hc-devops}`; **audit their security posture** against benchmarks → `{skill:hs-harden}`. "Scan deps for CVEs" is code-layer → `{skill:hc-fix} deps` or `{skill:hc-security} --quick`, not `hs-assess`. All `hs-*` skills are authorized-use only.

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
Mutation testing (test-quality audit) → {skill:hc-test} --mutation
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
Bulk OCR PDF/scans → Markdown (tiered cost, verify) → {skill:hl-ocr}
```
Disambiguate: batch of scanned PDFs/images needing tiered cost control and sample verification → `{skill:hl-ocr}` · single external doc or project docs, native-Read extraction → `{skill:hc-docs} extract` · turning transcribed/researched material into authored prose → `{skill:hl-write}`.

## Mobile / Native & E-commerce

React Native, Flutter, Swift, Kotlin, Dart standards auto-inject when detected — no dedicated mobile skill. Shopify (`shopify.app.toml` / `@shopify/cli`) auto-injects `framework-shopify.md`.

## Stack Auto-Injection (Reference)

Session-init hook auto-loads these from `standards/` based on detection:

- **Languages (25):** typescript, javascript, python, golang, rust, java, kotlin, swift, dart, php, ruby, elixir, erlang, gleam, c, cpp, zig, csharp, lua, r, solidity, bash, julia, haskell, ocaml
- **Primary framework (one):** next, nuxt, astro, remix, svelte, vue, tanstack-start, react, solidjs, qwik, htmx, react-native, nestjs, express, fastify, hono, elysia, litestar, fastapi, starlette, django, flask, streamlit, gradio, tauri, bevy, leptos, dioxus, yew, axum, actix-web, rocket, phoenix, nerves, lustre, flutter, swiftui, laravel, symfony, rails, spring-boot, quarkus, ktor, vapor, gin, echo, fiber, aspnet, blazor, hardhat, foundry, shopify
- **Framework extras (multiple):** better-auth, monorepo · stripe, polar, paddle, creem, sepay · liveview, ecto, oban, broadway, absinthe · langchain, celery, pytorch, pandas, polars, pydantic, sqlalchemy, jupyter, huggingface · sqlx · sqlc · prisma, drizzle, typeorm, zustand

## Debugging & Performance

```
Analyze flame graph / heap dump / CPU profile   → {skill:hc-debug} --profile <artifact>
Correlate logs across multiple services          → {skill:hc-debug} --trace <trace-id>
Performance regression, slow query, high latency → {skill:hc-debug} (routes to performance-diagnostics)
Adversarial verify against multiple hypotheses   → {skill:hc-debug} --deep
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
Get top-tier advice on one prepared decision → /hl-advisor  (agent: Task(subagent_type="haily-advisor"))
```
`/hl-advisor` = one-shot package-in, advice-out at top tier · haily-brainstormer / {skill:hl-brainstorm} = interactive multi-lens exploration at session tier · haily-judge = verdict on a candidate set — `--deep` adjudication points, plus the tier-gated `--debate`/`--auto` points named in {skill:hl-brainstorm}/{skill:hc-cook}.

## Dependency Management

```
CVE audit and security patches          → {skill:hc-fix} deps security
Upgrade outdated dependencies           → {skill:hc-fix} deps outdated
Major version upgrade (one package)     → {skill:hc-fix} deps major <package>
```

## Usage Notes

- One skill per distinct intent. If task spans domains ("build + deploy"), suggest primary, mention secondary.
- Domain skills combine with core loop: `{skill:hc-plan}` → domain skill → `{skill:hc-cook}`.
- Unlisted skills are core-workflow (see `workflow.md`) or on-demand utilities (`{skill:hl-visualize}`, `{skill:hl-reasoning}`, `{skill:hl-brainstorm}`).
