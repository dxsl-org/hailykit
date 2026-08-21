# System Architecture

`hailykit` is two cohesive subsystems sharing one CLI and one set of utilities:

1. **Engine** — a runtime that registers, routes, and executes *tools* (native TS in-process, or external polyglot executables via JSON/stdio).
2. **Installer** — distributes the HailyKit skill catalog into AI-agent runtimes (Claude Code, Cursor, Gemini, …) by downloading a release zip and converting/merging files per provider. TypeScript port of the original installer architecture.

```text
┌────────────────────── cli/  (sub "cli": the tool) ────────────┐
│  bin.ts               #! entrypoint; dispatch via registry    │
│  arg-parser.ts        parseArgs (no commander)                │
│  commands/            run · list · info  (engine commands)    │
│   ├─ registry.ts      native-command table → VALUE_FLAGS/help │
│   ├─ stats/ git-insights · scan/ (secrets·vuln) · contracts/  │
│   ├─ test/ (detect·coverage) · deps/ (audit) · adr-next       │
│   └─ license-detect · pack   (11 native analysis commands)    │
│  index.ts             public library surface (engine exports) │
│                                                               │
│  lib/                 cross-command primitives (zero-dep)     │
│   ├─ git.ts (churn/numstat) · activity.ts · fs-scan.ts        │
│   ├─ gitignore.ts · lang-syntax.ts · spawn.ts · json-output   │
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
kit/   ← sub "kit": distributable skill catalog (versioned in metadata.json)
├── skills/            40 skill dirs (hX-name/SKILL.md, where X ∈ {c,l})
├── agents/            25 agent .md files (provider-neutral model tiers)
├── templates/         4 task templates (bug, feature, refactor, usage)
├── standards/         ~106 language/framework standards (auto-injected)
├── rules/             6 markdown rules files (dev standards, workflows, routing)
├── hooks/             9 production hooks (.cjs) + subdirs with helpers
├── metadata.json      catalog version + deletions[] for upgrade path
└── [other catalog assets as added]
```

## Native analysis commands

Beyond the engine (`run`/`list`/`info`) and installer, the CLI ships zero-dep
analysis commands registered in `commands/registry.ts` (each declares its name,
value-flags, help, and handler; `bin.ts` derives `VALUE_FLAGS`, the help listing,
and dispatch by reducing over the table). All emit `--json` via the shared
`lib/json-output` envelope (`{ ok, tool, data, warnings? }`); `stats` keeps its
own `{ v: 2 }` shape. They replace third-party CLIs / LLM reasoning in skills:

| Command | Replaces / serves | Skill |
|---------|-------------------|-------|
| `stats` | scc/cloc/tokei | hl-stats |
| `git-insights` | awk/sort/uniq churn pipelines; LLM change-impact | hc-git retro/analyze |
| `secrets` · `vuln-scan` | gitleaks (quick path), grep, partial semgrep | hc-security, hc-git |
| `contracts` | Explore-subagent symbol extraction | hc-scout --contracts |
| `test-detect` · `coverage-parse` | LLM framework-guessing, hand-parsed coverage | hc-test |
| `deps-audit` | per-ecosystem audit parsing | hc-fix deps |
| `adr-next` · `license-detect` · `pack` | manual numbering / SPDX / repomix core | hc-adr, hc-cop, hc-scout |
| `ocr` | third-party OCR SaaS for bulk PDF/scan → Markdown | hl-ocr |

`ocr` is the one command above that isn't zero-dep: it spawns a user-installed
Python engine (`cli/tools/ocr/`, docling + opencv-python-headless) and, above
`--max-tier local`, calls the Gemini API for flash/pro escalation.

Security-sensitive primitives are centralized in `lib/`: `spawn.ts` (absolute-path
resolve, scrubbed env, win32 `.cmd`, stdout-on-non-zero), `fs-scan.ts` (realpath
containment, BOM/UTF-16 decode, binary/size skip), and the redaction + per-line
ReDoS guard in the scan engine.

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

## Benchmark backends

The benchmark subsystem now has two Codex live backends with different evidence surfaces:

- `provider` — the default path, which reuses the existing CLI adapter and parses Codex `exec --json` output. Current Codex JSONL reports `turn.completed.usage` with `input_tokens`, `cached_input_tokens`, `output_tokens`, and `reasoning_output_tokens`; model identity and USD cost remain null unless a provider surface emits them explicitly.
- `codex_app_server` — live-only and Codex-only. It negotiates a fresh Codex App Server session per trial, starts a new thread per arm/repeat, and aggregates streamed `thread/tokenUsage/updated`, item lifecycle, context-compaction, approval, and turn-completion events. This backend never reuses the caller's current interactive thread.

Both backends preserve unknown telemetry as null instead of fabricating it. `codex_app_server` can measure TTFT, output bytes, token breakdowns, tool activity, approvals, and context-occupancy from streamed events; it does not infer observed USD cost, cache-write bytes, or compaction bytes unless the server emits them directly.

Workflow fixtures can opt into a bounded local answer evaluator. It runs after the single provider response is received, derives deterministic contract evidence in memory, and passes only an output digest and evaluation summary into the paired observation. Raw answers are not persisted in V2 workflow rows; the external `--evidence` route remains available for fixtures whose behavior cannot be decided by the local contract.

`hl-write` also supports direct stage entry without splitting the skill. `--stage` selects one stage in the Route → Recon → Draft → Build → Verify → Ship pipeline, while Route preflight validates workspace or prepared-pack shape, writes `.hl-write-state.json`, and tracks research/concept readiness plus `source: external` provenance. Freshness is digest-based, so changing earlier artifacts marks downstream stages stale and turns later calls into explicit `NOT_READY` blockers instead of silent predecessor reruns.

The static inventory classifies source and installed footprints separately. In addition to rules, standards, hooks, agents, and skill bodies, it inventories `kit/contextual/*.md` as `contextual-rule` and recursively classifies skill references as `skill-reference-hot` or `skill-reference-cold`. These rows are descriptive byte/token estimates; only paired live workflow evidence can support behavior, provider-usage, or cost decisions.

## Skill Catalog (`kit/`) structure

The `kit/` directory is a distributable snapshot of the skill catalog, versioned independently. It contains:

- **`skills/`** — 40 skill directories (format: `hX-skill-name/SKILL.md` where X ∈ {c,l})
  - Each skill is a self-contained unit with `SKILL.md` (frontmatter + content) and optional `references/` subdirs
  - All skills are production-ready; zero npm dependencies

- **`rules/`** — 6 markdown configuration files
  - `haily-coding.md` — language/framework standards, code quality thresholds
  - `haily-quality.md` — step-by-step development workflow with skill routing
  - `haily-domain.md` — decision trees: when to invoke which skill by user intent
  - `haily-workflow.md` — multi-skill sequences (planning → implementation → testing → review → ship)
  - Generated rules separate implementation constraints, delegation order, single-intent routing, and multi-stage chains; focused contracts prevent route duplication or loss.
  - `hailykit.md` — CI patterns, metadata deletion protocol, cross-reference integrity rules
  - Routing prose is intentionally compact; contract tests preserve unique routes and the code-security/running-system-security boundary while avoiding repeated skill catalogs.
  - `haily-documentation.md` — roadmap/changelog maintenance triggers

- **`agents/`** — 25 agent .md files (provider-neutral model assignment)
  - Each agent has frontmatter with `model: <tier>` where tier ∈ {thinking, medium, fast}
  - Tiers are resolved to provider-specific model names at install time (for example, Codex: thinking/ultra→gpt-5.6-sol, medium→gpt-5.6-terra, fast→gpt-5.6-luna; Claude: thinking→opus, medium→sonnet, fast→haiku)
  - User-configured-model providers (cursor, zed, windsurf, opencode, kimi) have the `model:` line stripped at install

- **`templates/`** — 4 task templates for common workflows
  - `haily-bug.md`, `haily-feature.md`, `haily-refactor.md`, `haily-usage.md`
  - Used by `Task(...)` references in agent/skill bodies

- **`standards/`** — ~106 language and framework standards files
  - Auto-injected by the session-init hook when the project stack is detected
  - Covers: languages (TypeScript, Python, Go, Rust, etc.), frameworks (Next.js, FastAPI, Django, NestJS, etc.), and integrations (Stripe, Prisma, etc.)

- **`hooks/`** — 12 production hooks (.cjs, Node CommonJS) + helper subdirs
  - `haily-session.cjs` (project detection + session bootstrap), `haily-rules.cjs` (rules injector), `haily-subagent.cjs` (subagent context), `haily-state.cjs` (session state), `haily-usage.cjs` (usage limits), `haily-artifact.cjs` (artifact verification), `haily-pii.cjs` (sensitive file blocker), `haily-access.cjs` (directory access guard), `haily-optimize.cjs` (optimization gate), `haily-audit.cjs` (tool-call activity log + quota refresh), `haily-tracer.cjs` (model announcement), `haily-statusline.cjs` (live session summary)
  - Helper subdirs: `haily-artifact/`, `haily-guard/`, `haily-lib/` with modular component files
  - All hooks have canonical header with event type, exit codes, crash wrapper (never block Claude Code on error)
  - All hook and lib files: zero npm dependencies (only Node built-ins and relative requires)

- **`metadata.json`** — catalog version + upgrade path
  - Fields: `version`, `name`, `description`, `buildDate`, `repository`, `deletions[]` (stale file cleanup on upgrade), `download` (installer telemetry)
  - `deletions[]` contains all skill/rule/hook files removed in prior versions — tells CLI to delete them from user machines during upgrade

**Installation flow:** CLI downloads release zip (cli + kit bundled), then `mergeClaudeDir(kit/)` → syncs `kit/skills/` → `~/.claude/skills/`, fixes stale files via `metadata.deletions[]`, resolves agent `model: <tier>` frontmatter via MODEL_MAP (in cli/installer/converter.ts; built-in defaults with fallback), strips model tier for user-configured-model providers, and dispatches provider-specific skill installs. Codex writes full skill dirs to `~/.agents/skills/` and records installed names in `hailykit-installed-skills.json`; cleanup prunes only HailyKit-owned leftovers by combining that manifest with each skill directory's `.hailykit-codex-skill.json` ownership marker.

## Installer data flow (unchanged from old hailykit, ported to TS)

```
CLI `install --provider <name> [--project] [--version <tag>]`
  → resolveProviders(name)
  → github.fetchRelease(tag) → downloadZip → extractor.extract → resolveRoot
  → for each provider:
       claude   → merger.mergeClaudeDir (full sync + deletions + settings migrate + apply deny rules) + venv.setupVenv
       codex    → provider.installSkills (full skill dirs + manifest-scoped cleanup) + installRules + installHooks + writeVersion
       others   → provider.installSkills (SKILL.md → toml/md) + installRules + installHooks + writeVersion
```

Manifests: `metadata.json` (`version`, `deletions[]`) drives stale-file cleanup; `portable-manifest.json` drives provider path migrations on upgrade; `hailykit-installed-skills.json` records Codex skill ownership for scoped cleanup, with `.hailykit-codex-skill.json` as the per-directory ownership signal.

## Manifest formats

- **Tool manifest** (engine): `tool.json` sidecar per tool dir — `{ id, name, description, version, kind: "native"|"external", entry?, command?, args? }`. Language-agnostic so polyglot tools declare metadata the same way.
- **Catalog metadata** (installer): `metadata.json` with `deletions[]` (unchanged contract from old hailykit).

## Static validation gates

The repository keeps prose-heavy workflow contracts deterministic with two complementary gates:

- Scout callers resolve current-session context, then the active plan's `context-snippets.json.reconEnvelope`, then its root `scout-report.md`. `ReconEnvelope` records freshness, covered/gap paths, exclusive ownership, and the next route (`reuse`, `quick`, or parallel discovery); stale or prior-plan context is hint-only.
- `scripts/check-skill-cross-refs.js` remains the catalog integrity gate for skill refs, agent model tiers, model-map tiers, and References-table paths, and now also enforces scout-dedup policy against shipped markdown plus deterministic fixtures under `cli/tests/fixtures/scout-dedup/`.
- `cli/tests/scout-dedup-policy.test.ts` and `cli/tests/scout-dedup-fixtures.test.ts` lock the scout reuse contract in `node:test`: fixture README + `reconEnvelope` metadata, direct-Explore rejection in caller Scout steps, root-only `scout-report.md` persistence, and workflow-chain scout budgets such as `hc-new → hc-plan → hc-docs init`.

## Design principles

- **Never throw across the executor boundary** — uniform `ToolResult`.
- **Eager manifest parse, lazy module load** — registry knows all tools at startup, `require()`s native code only on first execute.
- **Provider polymorphism** — `BaseProvider` template method; each provider overrides `convertSkill` + paths. Claude uses full-merge, others use skill-by-skill conversion.
- **Path-safety** — installer rejects deletion/copy paths escaping the target dir (`applyDeletions`); hooks warn on Write/Edit/MultiEdit attempts outside project CWD (`checkDirectoryEscape`); `mergePermissionDeny` writes Claude Code native deny rules for known-dangerous paths.
