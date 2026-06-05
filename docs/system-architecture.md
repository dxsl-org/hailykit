# System Architecture

`hailykit` is two cohesive subsystems sharing one CLI and one set of utilities:

1. **Engine** — a runtime that registers, routes, and executes *tools* (native TS in-process, or external polyglot executables via JSON/stdio).
2. **Installer** — distributes the HailyKit skill catalog into AI-agent runtimes (Claude Code, Cursor, Gemini, …) by downloading a release zip and converting/merging files per provider. TypeScript port of the original installer architecture.

```text
┌────────────────────── cli/  (sub "cli": the tool) ────────────┐
│  bin.ts               #! entrypoint (shebang preserved by tsc)│
│  arg-parser.ts        parseArgs (no commander)                │
│  commands/            run · list · info  (engine commands)    │
│  index.ts             public library surface (engine exports) │
│                                                               │
│  core-engine/         the runtime engine                      │
│   ├─ types.ts         Tool, ToolManifest, ToolContext, …      │
│   ├─ tool-registry.ts · tool-discovery.ts · tool-router.ts   │
│   ├─ executors/  native-executor.ts · external-executor.ts    │
│   ├─ polyglot-protocol.ts  encode/decode NDJSON messages      │
│   └─ engine.ts        facade: registry + router + executor    │
│                                                               │
│  installer/           catalog distribution (ported)           │
│   ├─ github.ts        fetchRelease / downloadZip (GitHub API) │
│   ├─ extractor · merger · converter · paths · venv            │
│   ├─ commands/        install · upgrade · status              │
│   └─ providers/       base + claude/cursor/gemini/windsurf/…  │
│                                                               │
│  tools/               bundled tools (polyglot); discovered by │
│                        default from dist/tools/ at runtime    │
│  utils/               logger · errors · strip-json-comments   │
└───────────────────────────────────────────────────────────────┘
kit/   ← sub "kit": distributable skill catalog (v0.1.0)
├── skills/            58 skill dirs (42 Tier 1 + 15 Tier 2 + template)
├── rules/             6 markdown rules files (dev standards, workflows, routing)
├── hooks/             9 production hooks (.cjs) + 9 lib helpers
├── metadata.json      version + deletions[] for upgrade path
└── [other catalog assets as added]
```

## Engine data flow

```
CLI `run <tool> --input '{...}'`
  → Engine.run(toolId, input, ctx)
      → ToolRouter.resolve(toolId) ─ DirectRouter: Map lookup
      → ToolRegistry.get(id) ─ lazy-load native module on first use
      → ToolExecutor.execute(tool, input, ctx)
          ├─ kind=native   → NativeExecutor: await handler(input, ctx)
          └─ kind=external → ExternalExecutor: spawn(cmd), write NDJSON req, read NDJSON res
      → ToolResult<T>  ({ok:true,value} | {ok:false,error})
```

`ToolContext` (`{ sessionId, cwd, sharedState: Map, logger, signal: AbortSignal }`) is threaded as a parameter — never a global — so native and external tools see the same contract.

## Skill Catalog (`kit/`) structure

The `kit/` directory is a distributable snapshot of the skill catalog, versioned independently. It contains:

- **`skills/`** — 58 skill directories (format: `hX-skill-name/SKILL.md` where X ∈ {c,d,l})
  - Each skill is a self-contained unit with `SKILL.md` (frontmatter + content) and optional `references/` subdirs
  - Tier 1 (42 skills): core workflow (hc-cook, hc-plan, etc.), thinking tools (hl-brainstorm, hl-ask, etc.), design utilities
  - Tier 2 (15 skills): require refactoring (deprecated refs fixed, path updates)
  - Template: `template-skill/SKILL.md` for scaffolding new skills
  - All versions pinned to `0.1.0`; zero npm dependencies

- **`rules/`** — 6 markdown configuration files
  - `coding.md` — language/framework standards, code quality thresholds
  - `quality.md` — step-by-step development workflow with skill routing
  - `domain.md` — decision trees: when to invoke which skill by user intent
  - `workflow.md` — multi-skill sequences (planning → implementation → testing → review → ship)
  - `hailykit.md` — CI patterns, metadata deletion protocol, cross-reference integrity rules
  - `documentation.md` — roadmap/changelog maintenance triggers

- **`hooks/`** — 9 production hooks (.cjs, Node CommonJS) + lib helpers (`lib/` subdir)
  - Hooks: `session-bootstrap.cjs` (project detection), `rules-injector.cjs`, `plan-done-cook-prompt.cjs`, `subagent-context-injector.cjs`, `task-completion-reporter.cjs`, `session-snapshot.cjs`, `artifact-verifier.cjs`, `sensitive-file-blocker.cjs`, `directory-access-guard.cjs`
  - Lib helpers: configuration utils, logger, session state manager, project detector, statusline cache manager, metadata merger, provider converter, venv manager, zip handler, sensitive-path-matcher (credential + directory-escape detection)
  - All hooks have canonical header with event type, exit codes, crash wrapper (never block Claude Code on error)
  - All lib files: zero npm dependencies (only Node built-ins and relative requires)

- **`metadata.json`** — catalog version + upgrade path
  - Fields: `version` (`"0.1.0"`), `name`, `description`, `buildDate`, `repository`, `deletions[]` (stale file cleanup on upgrade), `download` (installer telemetry)
  - `deletions[]` contains all skill/rule/hook files removed in prior versions — tells CLI to delete them from user machines during upgrade

**Installation flow:** CLI downloads release zip (cli + kit bundled), then `mergeClaudeDir(kit/)` → syncs `kit/skills/` → `~/.claude/skills/`, fixes stale files via `metadata.deletions[]`, converts rules + hooks per provider.

## Installer data flow (unchanged from old hailykit, ported to TS)

```
CLI `install --provider <name> [--project] [--version <tag>]`
  → resolveProviders(name)
  → github.fetchRelease(tag) → downloadZip → extractor.extract → resolveRoot
  → for each provider:
       claude   → merger.mergeClaudeDir (full sync + deletions + settings migrate + apply deny rules) + venv.setupVenv
       others   → provider.installSkills (SKILL.md → toml/md) + installRules + installHooks + writeVersion
```

Manifests: `metadata.json` (`version`, `deletions[]`) drives stale-file cleanup; `portable-manifest.json` drives provider path migrations on upgrade.

## Manifest formats

- **Tool manifest** (engine): `tool.json` sidecar per tool dir — `{ id, name, description, version, kind: "native"|"external", entry?, command?, args? }`. Language-agnostic so polyglot tools declare metadata the same way.
- **Catalog metadata** (installer): `metadata.json` with `deletions[]` (unchanged contract from old hailykit).

## Design principles

- **Never throw across the executor boundary** — uniform `ToolResult`.
- **Eager manifest parse, lazy module load** — registry knows all tools at startup, `require()`s native code only on first execute.
- **Provider polymorphism** — `BaseProvider` template method; each provider overrides `convertSkill` + paths. Claude uses full-merge, others use skill-by-skill conversion.
- **Path-safety** — installer rejects deletion/copy paths escaping the target dir (`applyDeletions`); hooks warn on Write/Edit/MultiEdit attempts outside project CWD (`checkDirectoryEscape`); `mergePermissionDeny` writes Claude Code native deny rules for known-dangerous paths.
