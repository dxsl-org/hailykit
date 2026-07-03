# HailyKit

[![License: GPL 3.0](https://img.shields.io/badge/License-GPL_3.0-brightgreen.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![Ko-fi](https://img.shields.io/badge/Ko--fi-Donate-%23FF5E5B?logo=ko-fi)](https://ko-fi.com/dxsl_org)

A **zero-dependency** TypeScript framework for AI coding agents — a tool-execution **engine** and a multi-provider skill **installer**.

- **Engine** (`cli/`) — register, route, and execute tools: native TypeScript (in-process) or polyglot executables (Python/Rust/Go/…) over NDJSON stdio.
- **Installer** (`kit/`) — distribute 35 curated skills into any AI agent runtime (Claude Code, Cursor, Gemini CLI, Windsurf, OpenCode, Codex, Antigravity, Zed, Crush, Kimi Code).

> No npm account required. Zero runtime dependencies. Distributed via GitHub release — never `npm publish`.

**Requirements:** Node.js ≥ 20

---

## Install

```bash
# Linux / macOS
curl -fsSL https://raw.githubusercontent.com/dxsl-org/hailykit/refs/heads/main/install.sh | sh

# Windows (PowerShell)
irm https://raw.githubusercontent.com/dxsl-org/hailykit/refs/heads/main/install.ps1 | iex
```

Installs the `hailykit` CLI to `~/.local/bin/` and runs the default Claude Code install.

### By provider

```bash
hailykit install                          # Claude Code (default)
hailykit install --provider gemini        # Gemini CLI
hailykit install --provider cursor        # Cursor
hailykit install --provider windsurf      # Windsurf
hailykit install --provider opencode      # OpenCode
hailykit install --provider codex         # Codex CLI
hailykit install --provider antigravity   # Antigravity
hailykit install --provider zed           # Zed
hailykit install --provider crush         # Crush
hailykit install --provider kimi          # Kimi Code
hailykit install --provider all           # all providers at once
```

Add `--project` for project-scoped install (`.claude/` in CWD instead of `~/.claude/`).

### Upgrade & status

```bash
hailykit upgrade                          # upgrade Claude Code install
hailykit upgrade --provider all           # upgrade all providers
hailykit status                           # show installed vs latest versions
```

### Provider support

| Provider | Skills | Hooks | Command format |
|---|---|---|---|
| **Claude Code** | ✅ SKILL.md native | ✅ Full lifecycle | `/hc-plan`, `/hl-brainstorm` … |
| **Antigravity** | ✅ SKILL.md native | ❌ | `/hc-plan`, `/hl-brainstorm` … |
| **Gemini CLI** | ✅ TOML commands | ❌ | `/hc-plan`, `/hl-brainstorm` … |
| **Cursor** | ✅ Markdown | ✅ Partial | `/hc-plan`, `/hl-brainstorm` … |
| **Windsurf** | ✅ Markdown | ✅ Partial | `/hc-plan`, `/hl-brainstorm` … |
| **OpenCode** | ✅ Markdown | ❌ | `/hc-plan`, `/hl-brainstorm` … |
| **Codex CLI** | ⚠️ Catalog in AGENTS.md | ✅ Partial | Natural language |
| **Zed** | ✅ SKILL.md native | ❌ | `/hc-plan`, `/hl-brainstorm` … |
| **Crush** | ✅ Agent Skills format | ❌ | `/hc-plan`, `/hl-brainstorm` … |
| **Kimi Code** | ✅ Agent Skills format | ✅ TOML hooks | `/skill:hc-plan` … |

---

## Quick Start

Open Claude Code after installing — skills are ready immediately.

### Core dev chain

```
/hc-plan → /hc-cook → /hc-test → /hc-review → /hc-ship
```

| Task | Command |
|---|---|
| Start a new project | `/hc-new` |
| Autonomously build a feature (no manual steps) | `/hc-goal "<description>"` |
| Plan a feature | `/hc-plan <task>` |
| Implement from a plan | `/hc-cook <plan>` |
| Fix a bug | `/hc-fix <description>` |
| Review code | `/hc-review` |
| Ship (tests → version → PR) | `/hc-ship` |
| Debug an issue | `/hc-debug` |
| Brainstorm options | `/hl-brainstorm` |
| Explore the codebase | `/hc-scout` |
| Discover all skills | `/hl-help` |

### Common workflow chains

```bash
# Autonomous feature development (hands-off)
/hc-goal "Add OAuth login with GitHub and Google" --auto

# Feature development (step-by-step with control)
/hl-brainstorm → /hc-plan → /hc-cook → /hc-test → /hc-review → /hc-ship

# Bug fix
/hc-scout → /hc-debug → /hc-fix → /hc-test

# Risky/architecture change
/hl-research → /hl-brainstorm → /hl-reasoning → /hc-plan → /hc-cook → /hc-review

# New project end-to-end
/hc-new "project description"
```

---

## Skills

38 skills across three domain prefixes, installed together and activated on demand.

### Coding — `hc-*`

| Command | What it does |
|---|---|
| `/hc-goal` | Autonomous development loop: goal → plan → cook → review → commit until done. Only stops on genuine blockers |
| `/hc-plan` | Turn a task into a phased plan via research + codebase analysis + adversarial review |
| `/hc-spec` | Draft EARS-notation acceptance criteria before coding. Approval gate before Build stage. Use standalone or via `hc-cook --spec` |
| `/hc-cook` | Implement from a plan: Recon → Draft → Build → Verify → Ship |
| `/hc-new` | Bootstrap a project end-to-end: research → stack → design → plan → implement → ship |
| `/hc-fix` | Root-cause-first bug fix: runtime errors, test failures, type errors, CI failures |
| `/hc-debug` | Root-cause analysis before fixing — 10 specialist techniques |
| `/hc-adr` | Capture architectural decisions as ADRs. `scan` mode auto-discovers undocumented decisions from codebase patterns and git history |
| `/hc-review` | Adversarial review: spec compliance → quality → stress probe. `--comment` posts inline |
| `/hc-test` | Tests + coverage: JS/TS, Python, Go, Rust, Flutter. `--web` adds Playwright/k6/a11y |
| `/hc-ship` | Full release: tests → review → version bump → changelog → push → PR → merge |
| `/hc-scout` | Parallel codebase discovery — segments repo, spawns concurrent Explore agents |
| `/hc-security` | STRIDE + OWASP audit. `--quick` for fast secret/dep scan; `--fix` applies remediations |
| `/hc-git` | Commits, PRs, merges, conflict resolution, sprint retros, and review-gated batch PR merge (`pr --merge`). Auto-scans for secrets |
| `/hc-db` | Schema design, queries, migrations, ORM selection (PostgreSQL, MongoDB, MySQL, Redis…) |
| `/hc-deploy` | First-time platform deploy with cost-optimized auto-detection |
| `/hc-devops` | Cloud infra, CI/CD, Docker, Kubernetes, GitOps |
| `/hc-browser` | AI-driven browser automation for long autonomous sessions |
| `/hc-worktree` | Parallel git worktrees — work multiple branches without switching |
| `/hc-cop` | Port a feature from a GitHub repo (license-first: adapts permissive, rewrites copyleft) |
| `/hc-optimize` | Metric-driven iterative optimization — N iterations, keeps/discards by score |
| `/hc-docs` | Manage project docs; extract from PDFs/Office/images; generate llms.txt |
| `/hc-lookup` | Up-to-date library docs via context7. Supports version-specific and comparison lookups |
| `/hc-mcp-builder` | Build MCP servers from scratch or convert codebases into CLI + MCP server |

### Universal — `hl-*`

| Command | What it does |
|---|---|
| `/hl-help` | Discover all skills: `--list`, `--search <keyword>`, `--combos` |
| `/hl-brainstorm` | Trade-off analysis with personas. `--debate` for adversarial review |
| `/hl-research` | Deep technical research. `--quick` (5 min), `--deep` (20 min) + typed output templates |
| `/hl-reasoning` | Sequential structured analysis with hypothesis revision and branching |
| `/hl-visualize` | Generate diagrams, slides, HTML pages, Excel reports, PDFs |
| `/hl-design` | Brand identity, logos, CIP mockups, AI images/video/TTS/music, slides |
| `/hl-mindmap` | Build and navigate knowledge graphs from topics, URLs, or documents |
| `/hl-context-engineering` | Optimize token usage, debug context failures, design agent memory systems |
| `/hl-log` | Write a session log to `.agents/logs/` — decisions, lessons, next steps |

### Security Ops — `hs-*`

Security of **running systems** (distinct from `hc-security`/`hc-fix`, which secure the code you write). Authorized-use only.

| Command | What it does |
|---|---|
| `/hs-assess` | Red-team assessment of an authorized target: attack-surface recon, vulnerability assessment, pentest, CTF. Orchestrates external tools |
| `/hs-harden` | Blue-team hardening: config audit against CIS/STIG benchmarks, misconfiguration detection, guarded remediation. `--fix` applies with rollback |
| `/hs-dfir` | Blue-team forensics + incident response over collected evidence: log-timeline reasoning, IOC/threat-intel correlation, static malware triage |

---

## Security

HailyKit is built security-first by design: **zero runtime dependencies** (no npm supply chain attack surface), **path-level deny rules** enforced natively by the Claude Code runtime — not the model, and not a userland wrapper you can bypass — and **hook-based guards** that block sensitive file access before tool calls reach the model. These are structural guarantees, not configuration options.

HailyKit applies three protection layers on every Claude Code session.

### Layer 1 — Deny rules

On install and upgrade, HailyKit merges deny rules into `~/.claude/settings.json` (or `.claude/settings.json` for project installs). Claude Code enforces these natively — the AI model cannot bypass them at runtime.

| Category | Blocked paths (Write + Edit) |
|---|---|
| Linux/macOS system | `//etc/**`, `//usr/**`, `//bin/**`, `//sbin/**`, `//boot/**`, `//System/**` |
| Windows system | `//c/Windows/**` |
| SSH & GPG | `~/.ssh/**`, `~/.gnupg/**` |
| AWS credentials | `~/.aws/credentials`, `~/.aws/config` |
| HailyKit config | `~/.claude/settings.json`, `~/.claude/settings.local.json` |
| HailyKit hooks | `~/.claude/hooks/**` |

> `//` is Claude Code's absolute-path anchor. Existing user deny rules are never removed — HailyKit only adds to them.

### Layer 2 — File-access guard (PreToolUse)

`file-access-guard.cjs` intercepts every Bash, Glob, Grep, Read, Edit, and Write call:

**Hard-blocked** (operation cancelled):
- TLS/SSH private keys: `.pem`, `.key`, `.p12`, `.pfx`, `id_rsa`, `id_ed25519`, `authorized_keys`
- Secrets: `.netrc`, `wallet.dat`, `keystore.json`, `htpasswd`, `vault-token`

**Warned** (continues with stderr message):
- `.env`, `.env.*`, `credentials.json`, `secrets.json`
- Shell history: `.bash_history`, `.zsh_history`, `.fish_history`
- `.gitconfig`, `.npmrc`, `.pypirc`, `gradle.properties`
- Docker/K8s/GitHub CLI auth files
- `/etc/shadow`, `/etc/gshadow`
- Writes outside the project directory

### Layer 3 — PII guard (UserPromptSubmit)

`pii-guard.cjs` warns when a prompt contains PII patterns (email addresses, payment card numbers). Never blocks — exits 0. Opt-in and disabled by default.

### Configuration

In your project's `.claude/haily.json`:

```json
{
  "hooks": {
    "scout-block": true,
    "privacy-block": true,
    "read-scope-warn": false,
    "privacy-approval-flow": false,
    "pii-guard": false
  }
}
```

| Key | Default | Effect |
|---|---|---|
| `scout-block` | `true` | Block Glob/Read/Write outside allowed directories |
| `privacy-block` | `true` | Block hard-blocked files; warn on sensitive files |
| `read-scope-warn` | `false` | Warn when Read/Glob/Grep accesses paths outside CWD |
| `privacy-approval-flow` | `false` | Warn-tier files require explicit `AskUserQuestion` approval |
| `pii-guard` | `false` | Warn when prompts contain email addresses or card numbers |

Run `hailykit upgrade` to get the latest protection rules.

---

## Engine

### Running tools

```bash
hailykit list                              # list discovered tools
hailykit run <tool> --input '{"k":"v"}'    # run a tool, get JSON back
hailykit info <tool>                       # show tool manifest
```

| Option | Meaning |
|---|---|
| `--tools <dir>` | Tools directory to discover (default: bundled `dist/tools/`) |
| `--input <json>` | JSON input for `run` |
| `--timeout <ms>` | Execution timeout for external tools |

### Writing a tool

Each tool lives in a directory with a `tool.json` manifest:

```json
{
  "id": "my-tool",
  "name": "My Tool",
  "description": "What this tool does.",
  "version": "1.0.0",
  "kind": "external",
  "command": "node",
  "args": ["my-tool.js"]
}
```

External tools communicate via NDJSON over stdio — one request line in, one response line out:

```jsonc
// stdin
{"v":1,"id":"<uuid>","tool":"my-tool","input":{...},"context":{"sessionId":"...","cwd":"..."}}
// stdout (success)
{"v":1,"id":"<uuid>","ok":true,"output":{...}}
// stdout (error)
{"v":1,"id":"<uuid>","ok":false,"error":{"code":"E_MY_ERR","message":"..."}}
```

Bundled examples in [`cli/tools/`](cli/tools/). Full protocol spec in [`docs/tech-stack.md`](docs/tech-stack.md).

---

## Development

```bash
npm run build      # tsc → dist/ + copy cli/tools/ → dist/tools/
npm run typecheck  # tsc --noEmit
npm test           # compile → .test-build/ then run node:test (226 tests)
```

Before committing any skill cross-reference (`/hc-*`, `/hl-*`) in markdown:

```bash
node scripts/check-skill-cross-refs.js   # must report 0 errors
```

---

## License

[GNU General Public License v3.0](LICENSE) — Open source software. See [COMMERCIAL_LICENSE.md](COMMERCIAL_LICENSE.md) for commercial licensing.
