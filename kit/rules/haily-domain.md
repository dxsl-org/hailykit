# Skill Domain Routing

Pick the narrowest skill that matches the user's intent.

> **Auto-injected standards:** language/framework rules load when the stack is detected. Use `{skill:hc-lookup}` only when you need the source standard on demand.

## Frontend / UI

```text
Build from mockup/screenshot/video     → {skill:hc-cook} --layout <path|url>
Implement shadcn/Tailwind components   → auto-injected framework standards
Choose style / palette / fonts         → {skill:hl-design}
Audit UI/UX                            → {skill:hc-review} --ui
```
Disambiguate: visual reference → `{skill:hc-cook} --layout`; style/palette/font → `{skill:hl-design}`; audit → `{skill:hc-review} --ui`.

## Media / Design Assets

```text
Generate image/video/TTS/music         → {skill:hl-design}
Brand identity / logos / banners       → {skill:hl-design}
Diagrams / Mermaid                     → {skill:hl-visualize} --mermaid
```

## Codebase Understanding

```text
Locate code / patterns                 → {skill:hc-scout}
Full repo pack for another LLM         → {skill:hc-scout} --pack
Code metrics / hotspots                → {skill:hl-stats}
```

## Knowledge / Research

```text
Persistent knowledge graph             → {skill:hl-mindmap}
One-shot technical research            → {skill:hl-research}
Market / competitor research           → {skill:hl-research} --type market
Academic / literature review           → {skill:hl-research} --type academic
```
Disambiguate: authored prose deliverable goes to `{skill:hl-write}`; research artifact stays in `{skill:hl-research}`.

## Writing / Content

```text
Report / article / essay / paper       → {skill:hl-write} "description"
Story / novel / book                   → {skill:hl-write} "description"
Resume long-form workspace             → {skill:hl-write} <workspace-dir>
```
Disambiguate: project docs from code go to `{skill:hc-docs}`.

## Architecture & Specification

```text
Formal feature spec                    → {skill:hc-spec}
Quick spec                             → {skill:hc-spec} --quick
Gate a build on spec approval          → {skill:hc-cook} --spec
Plan before build                      → {skill:hc-plan}
Record an agreed decision              → {skill:hc-adr}
Scan for undocumented decisions        → {skill:hc-adr} scan
```
Disambiguate: API contract design → `Task(subagent_type="haily-api-designer")`; test strategy → `Task(subagent_type="haily-test-architect")`.

## Project Initialization

```text
Init docs + CLAUDE.md in an existing repo → {skill:hc-docs} init
Bootstrap a new project                    → {skill:hc-new}
Autonomous multi-phase delivery            → {skill:hc-goal}
```
Disambiguate: step-by-step execution stays on `{skill:hc-plan}` → domain skill → `{skill:hc-cook}`.

## Backend / Database

```text
Schema / query / migration / index work → {skill:hc-db}
```

## Infrastructure / Deployment

```text
First-time platform deploy             → {skill:hc-deploy}
Docker / Kubernetes / CI/CD / GitOps   → {skill:hc-devops}
```

## Security (Code)

```text
AppSec audit / STRIDE / OWASP          → {skill:hc-security}
Quick secret / dependency scan         → {skill:hc-security} --quick
Code-layer CVE or dependency fix       → {skill:hc-fix} deps
```

## Security Operations (Systems)

Running-system security is separate from code security.

```text
Authorized assessment / pentest / CTF  → {skill:hs-assess}
Config audit / hardening               → {skill:hs-harden}
Forensics / incident response          → {skill:hs-dfir}
```
Disambiguate: code security uses `{skill:hc-security}` or `{skill:hc-fix}`; running infrastructure uses `hs-*`. All `hs-*` routing is authorized-use only.

## AI / LLM

```text
Context / memory / agent architecture  → {skill:hl-context-engineering}
Extract from images / audio / docs     → {skill:hc-docs}
Build or agentize an MCP server        → {skill:hc-mcp-builder}
```

## MCP (Model Context Protocol)

```text
Build an MCP server                    → {skill:hc-mcp-builder}
Discover or execute MCP tools          → Claude Code /mcp
```

## Testing / Browser

```text
Run tests / coverage                   → {skill:hc-test}
Web testing                            → {skill:hc-test} --web
Mutation testing                       → {skill:hc-test} --mutation
Root-cause frontend debugging          → {skill:hc-debug}
Long browser automation                → {skill:hc-browser}
```

## Documentation

```text
Project docs from code                 → {skill:hc-docs}
Generate llms.txt                      → {skill:hc-docs} llms
Current library / framework docs       → {skill:hc-lookup}
Bulk OCR to Markdown                   → {skill:hl-ocr}
Diagrams                               → {skill:hl-visualize} --mermaid
```

## Mobile / Native & E-commerce

Mobile and native stacks rely on auto-injected standards; Shopify-specific guidance auto-loads when the repo exposes Shopify markers.

## Debugging & Performance

```text
General bug investigation              → {skill:hc-debug}
Flame graph / heap / CPU profile       → {skill:hc-debug} --profile <artifact>
Cross-service trace diagnosis          → {skill:hc-debug} --trace <trace-id>
Metric-driven optimization             → {skill:hc-optimize}
```

## Senior Developer Workflows

```text
Tech debt inventory                    → Task(subagent_type="haily-tech-analyst")
Optimize code clarity / efficiency     → Task(subagent_type="haily-optimizer")
Port from another repo                 → {skill:hc-cop}
Sprint retrospective                  → {skill:hc-git} retro [timeframe]
Impact analysis                        → {skill:hc-git} analyze [ref]
Top-tier prepared decision advice      → /hl-advisor
```

## Dependency Management

```text
Security patch deps                    → {skill:hc-fix} deps security
Upgrade outdated deps                  → {skill:hc-fix} deps outdated
Major upgrade one package              → {skill:hc-fix} deps major <package>
```

## Usage Notes

- Use one primary skill per intent; mention a secondary skill only when the task truly spans domains.
- Unlisted utilities stay in workflow routing or the skill files themselves.
