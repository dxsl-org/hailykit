# HailyKit Engineering Lexicon

> Authoritative vocabulary and engineering standards for all HailyKit skills/hooks/tools.
> Every skill, reference file, and rule document MUST use the terms defined here.
> If a concept is not listed, use the most widely adopted term from the relevant
> engineering discipline (DevOps, SRE, CI/CD, software architecture).

---

## HailyKit Design Principles

Four invariants that govern every skill and workflow decision in this catalog:

1. **Single-pipeline model** — every workflow skill follows one named-stage pipeline; no mode explosion, no branching pipelines per flag.
2. **Two-mode execution** — interactive (default, pauses at Checkpoints) and autonomous (`--auto`, resolves autonomously). Avoid redundant mode flags that duplicate what input detection or default behavior already handles.
3. **Delegation over self-implementation** — workflow skills never implement testing, code review, or finalization directly; they delegate to specialist agents via Task tool.
4. **Auto-detect over explicit flags** — detect behavior from input shape (file extension, URL domain, path pattern) rather than requiring the user to name a mode.

These principles apply at the skill design level. When in doubt about a flag or section, ask: does this violate one of the four?

---

## Part I — Pipeline Architecture

HailyKit workflow skills follow a **named-stage pipeline** modeled on Continuous
Delivery practices. Stages have names, not numbers. Each stage declares its own
entry criteria, actions, and exit artifacts.

### Canonical Stages

```
Route → Recon → Draft → Build → Verify → Ship
```

| Stage | Purpose | Industry basis |
|---|---|---|
| **Route** | Classify input, select execution mode, initialize workspace | CI trigger / webhook routing |
| **Recon** | Codebase scan + requirements capture + domain research | Sprint discovery / spike |
| **Draft** | Produce implementation plan + dependency graph | Design phase / ADR drafting |
| **Build** | Implement code, run Preflight Checks, run Lean Pass | Build + link stage in CI |
| **Verify** | Test (delegated) + code review (delegated) + Stress Probe | CI verification / QA gate |
| **Ship** | Sync plan state, update docs, commit, journal | Release / deploy stage |

### Stage Rules

1. Stages are referred to by **name** (e.g., "the Build stage"), never by
   index number.
2. Each stage has exactly one **checkpoint** (see Part II) at its exit — never
   mid-stage.
3. Stages may be **skipped** when input type makes them redundant (e.g., plan-path
   input skips Recon + Draft). The skip condition is documented per-skill.
4. A stage **never** begins until its predecessor's exit artifacts are available
   (except Route, which has no predecessor).

### Stage Output Format

Every stage emits a one-line status on completion:

```
✓ [StageName]: [status summary] — [key metrics]
```

Examples:
```
✓ Route: task input detected — mode=interactive, flags=[--tdd]
✓ Recon: codebase scanned — 5 findings, 3 requirements locked
✓ Build: 12 files changed — 8/8 phases complete, Lean Pass clean
✓ Verify: tests 42/42 passed — review 9.2/10 approved
✓ Ship: plan synced — 3 agents invoked, committed as feat(auth)
```

---

## Part II — Quality Mechanisms

### Checkpoints

A **checkpoint** is a decision point at the boundary between stages where the
pipeline pauses for approval.

| Mode | Checkpoint behavior |
|---|---|
| Interactive (default) | Pause, present summary, user decides: proceed / revise / abort |
| Autonomous (`--auto`) | Auto-proceed if exit artifacts pass validation; halt on high-risk |

Checkpoints replace the older concepts of "Review Gates" and "Hard Gates".
Do NOT use "gate" as a noun for pipeline decision points in skill documentation.
(Exception: internal filenames — `artifact-verifier.cjs`, `review-gates.md`,
`review-artifacts.md` — retain their names as opaque identifiers. The vocabulary
restriction applies to user-facing prose, not file or variable naming.)

### Guardrails

A **guardrail** is an invariant rule enforced throughout the pipeline — not at a
specific point, but as a continuous constraint.

Guardrails in skill documentation use the callout syntax:

```markdown
> **Required — [rule-name]:** [What must hold. Why, if non-obvious.]
```

Standard guardrails for workflow skills:

| Guardrail | Shorthand | Meaning |
|---|---|---|
| Plan before code | `plan-first` | No implementation until a plan exists and has been reviewed |
| Scout before asking | `recon-first` | Scan codebase before asking user questions or producing a plan |
| Zero-regress | `zero-regress` | All existing tests pass, no lint/type/build regressions, public contracts unchanged unless intentional |

### Scope Contract

Before planning begins, the pipeline captures a **Scope Contract** — a structured
agreement between user and agent on what will be built. It has three sections:

| Section | What it captures | Maps to artifact field |
|---|---|---|
| **Deliverables** | Concrete output artifacts the user will see (file paths, endpoints, UI screens) | `context-snippets.json → task` |
| **Boundaries** | What is in scope (acceptance criteria), what is out of scope, and what must not change (invariants) | `context-snippets.json → acceptanceCriteria` |
| **Blast Radius** | Modules, contracts, and interfaces the change will touch or could affect | `context-snippets.json → touchpoints, blastRadius, publicContracts` |

"Blast Radius" is standard DevOps/SRE terminology (AWS, Google SRE handbook).

### Severity Triage

When a regression or side effect is detected, the agent classifies it by severity
and responds according to this matrix:

| Severity | Definition | Interactive response | `--auto` response |
|---|---|---|---|
| **Critical** | Breaks existing users, data loss, security hole | Immediate rollback. Halt. Write incident report. | Same — auto-rollback + terminate + incident report. |
| **Major** | Breaks internal contract, fails neighbor tests | Pause. Present options: rollback / propagate new contract / add compatibility shim. User decides. | Agent selects lowest-risk resolution (default: rollback affected slice). Logs rationale to incident report. Continues if resolved; terminates if unresolvable. |
| **Minor** | Cosmetic, style drift, non-blocking warning | Log warning. Continue. Address in Verify if reviewer flags it. | Same — log and continue. |

---

## Part III — Terminology Reference

### Pipeline & Workflow

| Term | Definition | Do NOT use |
|---|---|---|
| **Stage** | A named phase in the pipeline (Route, Recon, Draft, Build, Verify, Ship) | "Step", "Step N", "Phase" (for pipeline level) |
| **Checkpoint** | Decision point at stage boundary | "Gate", "Review Gate", "Hard Gate" |
| **Guardrail** | Continuous invariant rule | "Hard Gate", "HARD-GATE" |
| **Scope Contract** | Structured requirements agreement (Deliverables + Boundaries + Blast Radius) | "Exact Requirements", "5 anchors", "nail the spec" |
| **Stage Graph** | DAG of plan phase dependencies; determines parallel execution | "Phase Dependency Analysis" |
| **Mode** | Execution style: interactive (default), autonomous (`--auto`) | "Fast", "Parallel", "No-test" (these are not modes — see below) |
| **Input Detection** | Classifying the first argument: file extension, URL domain, path pattern → determines input type | "Intent Detection", "Smart Intent Detection" |
| **Input Routing** | Acting on the detected input type: selecting the execution path, workflow file, or stage entry point | "Conflict Resolution" (for precedence) |
| **Routing Precedence** | Priority order when multiple routing signals conflict (e.g., image file + task text override) | "Conflict Resolution" |

### Standard Flags

Skills do not need to offer these flags — but a skill that offers the underlying
behavior MUST name it with the canonical flag, never a synonym. `scripts/check-skill-cross-refs.js`
enforces this against each skill's `argument-hint:` line.

| Canonical | Meaning | Do NOT use |
|---|---|---|
| `--quick` | Shallower/faster path: skip the heavier stages for small or well-understood work | `--fast`, `--shallow`, `--lite`, `--simple` |
| `--deep` | Maximum-scrutiny path: more research, adversarial review, per-item depth | `--thorough`, `--exhaustive`, `--deep-dive` |
| `--auto` | Autonomous execution: resolve checkpoints without pausing | `--yolo`, `--yes`, `--noninteractive`, `--unattended` |

Interactive is the **default** execution mode — never add an `--interactive` flag for it. `--quick` and `--deep` are mutually exclusive (depth is one axis); `--auto` composes with either. A skill may add its own domain flags freely — the contract governs only these three shared axes.

### Depth Tiers

Three flag-level depths map onto the same axis every eligible skill shares:

| Flag | Depth | Cost |
|---|---|---|
| `--quick` | Skip heavier stages (research, adversarial review, per-item passes) | Cheapest |
| *(none)* | Normal — the skill's default stage set runs at normal thoroughness | Baseline |
| `--deep` | Maximum scrutiny: more research streams, adversarial/red-team passes, per-item depth | 3–5× the baseline token cost |

> **Required — never-auto-escalate:** a skill must never turn on `--deep` behavior by itself, no matter what it infers from the task (large diff, "critical", "production"). `--deep` is always a user-initiated flag or an explicit `haily.json` `deep.auto` opt-in (below) — never a heuristic decision made mid-run.

**`HL_MODEL_TIER`** — session-scoped, written once at SessionStart (`kit/hooks/haily-session.cjs`) from the active model id, canonical vocabulary only: `fast | medium | thinking | ultra`. This is the ONLY place the vocabulary is defined; every consumer imports or reads the env var rather than re-deriving it. `deriveTier()` (`kit/hooks/haily-lib/model.cjs`) returns `deep` as a legacy display label for `haily-tracer`'s benefit — that string never reaches `HL_MODEL_TIER` or any tier-gated behavior; it is normalized to `ultra` first. Unresolvable model ids (non-Claude sessions without a model-map match) yield an empty value — every consumer must treat empty exactly like "no tier known", never guess.

Consumers compare **ordinal rank**, never the literal string: `fast(0) < medium(1) < thinking(2) < ultra(3)`. A tier-gated behavior is phrased as "runs when tier < ultra" (rank comparison), not "runs unless tier === 'ultra'" (string comparison) — the rank form still fails safe if a fifth tier is ever added above `ultra`.

**Parity hint** — advisory-only guidance connecting `HL_MODEL_TIER` to the `--quick`/`--deep` axis. Never auto-escalates, never auto-downgrades — an explicit flag always wins. Both directions emit as one advisory log line at the skill's Route stage (or its earliest equivalent stage, for skills without a stage literally named Route), and both skip silently when `HL_MODEL_TIER` is empty (non-Claude session, unresolvable tier):

- **Downward** — `HL_MODEL_TIER` ranks below `ultra` and the task touches a high-risk domain (canonical list: `{skill:hc-cook}` `references/agent-invocations.md` § Domain-Risk Review): the Route stage logs one line suggesting `--deep`, then the skill proceeds at the requested depth.
- **Upward** — `HL_MODEL_TIER` ranks `ultra` and `--deep` was requested: the skill logs one line noting `--deep` adds comparatively little over its default pass, then honors the flag and runs `--deep` in full anyway.

Both directions compare `HL_MODEL_TIER` by ordinal rank (`fast(0) < medium(1) < thinking(2) < ultra(3)`), never the literal string. A skill implements whichever direction(s) apply to its own default-scrutiny profile — see each skill's own Parity hint line for which direction(s) it carries.

**`haily.json` `deep.auto`** (defined once, here — do not redefine the schema elsewhere): opts a skill's `--deep` behavior on by default for the repo, following the same lowercase shape as `crossReview.auto` / `quiz.auto`:

```json
{ "deep": { "auto": true } }
```

Still user-controlled: it lives in a config file the user commits, not inferred at runtime, so it does not violate never-auto-escalate.

Unlike `crossReview.auto` (read by a deterministic CLI reader with a sanitizer, `cli/lib/cross-review/config.ts`), `deep.auto` is read by the LLM directly from `haily.json` at Route/Scope Check — there is no CLI-side validation, so a typo'd key (`Deep.auto`, `deep.Auto`) silently no-ops instead of erroring. The single canonical schema defined above is the mitigation; a validated reader is deliberate future work if misreads show up in practice.

**Documented non-adoption** — these skills deliberately have NO `--quick`/`--deep` flags; do not add them speculatively:
- `{skill:hc-spec}` — a blocking approval checkpoint, not a depth axis.
- `{skill:hl-reasoning}` — a methodology skill with no stages to skip or deepen.
- `{skill:hc-optimize}` — a metric-driven loop, not a research/review pipeline. N-best candidate sampling (N parallel candidates per iteration, keep the best by measure) was scoped as a possible `--deep` mechanism and rejected for now (YAGNI) — it needs worktree isolation per candidate, which does not exist yet. Revisit as its own plan if the single-candidate loop proves insufficient.

### Build Stage

| Term | Definition | Do NOT use |
|---|---|---|
| **Preflight Checks** | Verification steps before writing code in a phase: conventions audit, neighbor scan, reuse search, contract trace, inventory reconciliation | "Conformance Checklist", "Pre-Code Audit" (the latter is acceptable as a synonym) |
| **Lean Pass** | Post-implementation complexity reduction triggered by diff metrics | "Conditional Simplify", "Code Simplifier" |
| **Red-Green-Refactor** | TDD cycle: write failing test → implement to pass → clean up | "Snapshot/Transform/Verify", "3.T/3.I/3.V" |

### Verify Stage

| Term | Definition | Do NOT use |
|---|---|---|
| **Review Circuit** | Iterative review-fix loop, max 3 iterations | "Interactive Cycle", "Review Cycle", "3-round cap" |
| **Auto-Resolve Ladder** | Autonomous escalation: auto-fix → retry → incident report → terminate | "Auto-Handling Cycle", "budget = 3" |
| **Stress Probe** | Adversarial validation: attempts to disprove implementation claims | "Adversarial Challenge", "Adversarial Validator" |
| **Domain Audit** | Focused risk review for security, data, infrastructure, or contract surfaces | "Domain-Risk Review" |
| **3 Lenses** | Code review framework: Correctness, Compatibility, Cleanliness | "5 axes (a-e)", "MANDATORY checks (a) through (e)" |

#### 3 Lenses — Detail

| Lens | Scope |
|---|---|
| **Correctness** | Every acceptance criterion has proof (test or manual). No regression in business logic across blast radius. |
| **Compatibility** | Public contracts (signatures, schemas, APIs, env vars, config keys) unchanged unless intentional. New code follows patterns identified during Recon. |
| **Cleanliness** | Zero new lint, type, or build errors anywhere in the repo. |

### Ship Stage

| Term | Definition | Do NOT use |
|---|---|---|
| **Bookkeeping** | Plan sync-back + task status updates + docs update | Part of "Finalize" |
| **Release** | Commit via git-manager + journal entry | Part of "Finalize" |

"Finalize" is acceptable as an informal synonym for the entire Ship stage.

### Agent Delegation

| Term | Definition | Do NOT use |
|---|---|---|
| **Delegate** | Spawn a subagent via Task tool to perform work | "Implement directly" |
| **Agent role** | The `subagent_type` value in a Task invocation | "Subagent pattern" |
| **Delegation pattern** | Canonical Task() invocation template for a specific role | "Subagent pattern" |

Standard agent roles used by workflow skills:

| Category | Roles |
|---|---|
| **Analysis** | `researcher`, `scout` |
| **Build** | `planner`, `designer`, `implementor` |
| **Quality** | `tester`, `debugger`, `code-reviewer`, `refiner` |
| **Operations** | `project-manager`, `docs-writer`, `git-manager` |

### Artifact Files

These file names are locked (hook code depends on them). Do not rename.

| File | Purpose |
|---|---|
| `context-snippets.json` | Scope Contract serialized: skill, mode, task, acceptance criteria, touchpoints, blast radius, scout summary |
| `risk-gate.json` | Risk assessment: highRisk, reasons, autoStopRequired, humanApproved, largeDiff |
| `verification.json` | Test/build command results with status, exit codes, timestamps |
| `review-decision.json` | Review verdict: decision (PASS/PASS_WITH_RISK/BLOCKED), score, critical count, coverage, contract status |
| `adversarial-validation.json` | Stress Probe output: decision, disproven claims, unverified claims, missing proof, reachable regressions |

Artifact directory conventions:
- Plan workflow: `.agents/<plan-dir>/reports/harness/`
- No-plan workflow: `.agents/reports/harness/<timestamp-slug>/`
- Active pointer: `.agents/workflow-artifacts.json`

### Deep Audit Triggers

Conditions that demand a Stress Probe or Domain Audit beyond standard review:

| Category | Surfaces | Required response |
|---|---|---|
| **Security** | Auth flows, credential handling, payment logic, secret management | Domain Audit |
| **Data** | Schema changes, migration scripts, bulk data mutations | Domain Audit |
| **Contract** | Public API shapes, exported types, env var contracts, config keys | Domain Audit |
| **Infrastructure** | CI pipelines, deploy configs, release scripts, production config | Domain Audit |
| **Scale** | Autonomous execution (`--auto`), large diffs, ship/push/PR/deploy | Stress Probe |
| **Destructive** | Bulk file deletion, data wipes, irreversible writes | Domain Audit + Stress Probe |

No majority vote. A single evidenced critical finding blocks.

---

## Part IV — Configuration Keys

| Config file | Key path | Default | Purpose |
|---|---|---|---|
| `haily.json` | `simplify.threshold.locDelta` | 400 | Lean Pass: max total lines changed |
| `haily.json` | `simplify.threshold.fileCount` | 8 | Lean Pass: max files changed |
| `haily.json` | `simplify.threshold.singleFileLoc` | 200 | Lean Pass: max lines in a single file |
| `haily.json` | `simplify.gate.enabled` | true | Enable/disable Lean Pass |
| env var | `HL_SIMPLIFY_DISABLED` | — | Set to `1` to bypass Lean Pass |
| `haily.json` | `crossReview.auto` | false | Run cross-model review without the `--cross` flag |
| `haily.json` | `crossReview.reviewer` | — | Force a reviewer leg: codex, gemini, opencode, cline, ollama |
| `haily.json` | `crossReview.model` | — | Force the reviewer model (overrides the model-map lookup) |
| `haily.json` | `crossReview.tier` | thinking | Model tier to resolve from the map |
| `haily.json` | `crossReview.timeoutMs` | 120000 | Per-call timeout for the external reviewer |
| `haily.json` | `crossReview.disable` | false | Turn cross-model review off for this repo |
| `haily.json` | `quiz.auto` | false | Offer the comprehension quiz before every commit gate |
| `haily.json` | `output.verbosity` | `standard` | `concise` tightens MAIN-session chat output (status lines ≤1 line, outcome-first summaries, no decorative tables); never changes agent Report Contracts or model-trace lines |
| env var | `HL_OUTPUT_VERBOSITY` | `standard` | Session-scoped mirror of `output.verbosity`, written by `haily-session.cjs` |

### Ultra Mode (deep-model escalation)

Ultra mode runs a reasoning-heavy skill on the deep-tier model. The ONLY user-facing entry point is `{skill:hl-ultra} <skill> [args]` — it escalates the main loop (via its `model: deep` frontmatter) AND core agents. The `--ultra` marker it passes downstream is internal plumbing: never document it as a user flag, because a bare flag escalates subagents only and would mislead users into believing the whole session escalated. Strictly user-initiated — a skill must never self-activate it.

Rules every eligible skill's `## --ultra Mode` section follows:

- **Turn-scoped state** — once active, every skill in the chain sees it; there is no flag forwarding between skills.
- **Agent whitelist, not skill scope** — only Task calls to deep-eligible agents (`haily-planner`, `haily-implementor`, `haily-reviewer`, `haily-brainstormer`, `haily-debugger`) pass `model: {model:deep}`. Mechanical agents (git, tester, docs, project-manager, reporter, researcher) always keep their pins. Escalate judgment, not mechanics.
- **Fallback** — if the deep model is rejected, retry once on the thinking tier and report which model ran.
- **`{model:<tier>}` placeholders** — resolved to concrete model names per provider at install time; never ship verbatim.

Eligible skills (also listed in `kit/skills/hl-ultra/SKILL.md` — keep both in sync): hl-brainstorm, hc-plan, hc-cook, hc-review, hc-fix, hc-optimize, hc-cop, hl-reasoning, hc-goal, hc-security, hl-research.

---

## Part V — Writing Conventions for Skill Files

### Voice

- **Direct and technical.** No marketing language, no superlatives ("world-class",
  "cutting-edge", "elite"), no roleplay openers ("You are a…").
- **Imperative mood** for instructions: "Scan the codebase", not "You should scan
  the codebase".
- **Active voice** for descriptions: "The agent spawns a tester", not "A tester
  is spawned by the agent".

### Banned Phrases

These phrases indicate copied or marketing-derived content. Replace or remove.

| Banned | Replacement |
|---|---|
| "Hard Gate" / `<HARD-GATE>` | Guardrail (in prose) or `> **Required —**` callout |
| "nail the spec" | "capture the Scope Contract" |
| "5 anchors" | "Scope Contract" |
| "zero collateral damage" | "zero-regress guarantee" |
| "blast surface" / "touchpoints" (as coined terms) | "blast radius" (industry standard) |
| "fence line" | "scope boundary" or "Boundaries section" |
| "Conformance Checklist" | "Preflight Checks" |
| "budget = 3" | "max 3 iterations" or "Auto-Resolve Ladder" |
| "Anti-Rationalization" table | Remove entirely (rules layer provides this) |
| "brutal honesty" / "elite expert" / "You are a…" | Remove |
| "CK-Native" / `metadata: author: claudekit` | Remove |
| "Step 0:", "Step 1:", … (pipeline-level) | Stage names: Route, Recon, Draft, Build, Verify, Ship |
| "Phase N:" (pipeline-level) | Stage names (reserve "phase" for plan phases: `phase-01-name.md`) |

### Constraint Callout Format

```markdown
> **Required — recon-first:** Before any question or plan, scan the codebase.
> Collect: project type, frameworks, relevant modules, docs in `./docs/`,
> in-flight plans in `.agents/`. Report 3–6 findings before proceeding.
```

### Cross-Reference Format

```markdown
`{skill:hc-plan}`, `{skill:hl-brainstorm}`, `{skill:hc-cook}`
```

Never use slash form (`/hc-plan`) in skill body text. Slash form is terminal syntax only.

> **agentskills.io compliance:** The `name:` field uses `[a-z0-9-]` only (no colons), per the [agentskills.io spec](https://agentskills.io/specification). Hyphen separates domain prefix from bare name: `hc-debug` = prefix `hc` + name `debug`. Live prefixes: `hl-` (utility), `hc-` (coding), `hs-` (security operations on running systems). When porting future `hd-*` design skills, use `hc-` prefix per domain routing decision.

### Code Implementation Comments

Use the `haily:` comment convention to mark **intentional simplifications** in hook and tool source code (`.cjs`, `.ts`, `.js`). This makes deliberate shortcuts machine-harvestable by `{skill:hc-review}` Stage 4 and audit-ready.

```
// haily: <ceiling>, <upgrade trigger>
```

| Part | Meaning | Example |
|---|---|---|
| `<ceiling>` | Maximum abstraction tier this shortcut stops at | `sync-only`, `single-file`, `no-streaming` |
| `<upgrade trigger>` | Condition that warrants revisiting | `if N>1 providers`, `when file >10 MB`, `on v2 milestone` |

Examples:
```js
// haily: sync-only, upgrade to streaming when file >10 MB
const content = fs.readFileSync(path, 'utf8')

// haily: single-file, extract shared helper if 2+ hooks need this
function normalizeHookEvent(raw) { ... }
```

Rules:
- Add only when the shortcut is **intentional** — a deliberate tradeoff, not an oversight.
- Do NOT use to mark TODOs, bugs, or incomplete work — use `// TODO:` for those.
- `{skill:hc-review}` scans these markers in Stage 4 and surfaces them as advisory findings.

### Agent Report Contract

Every `kit/agents/*.md` file carries a `## Report Contract` section — canonical wording defined once here; agent files carry only the class line plus agent-specific deltas (`docs/skill-template.md` has the copy-paste snippets). Purpose: the caller (main session or another agent) reads the report, not the transcript — a bloated report burns the orchestrator's context and the reader's attention twice. This is the "economy" layer that scopes down to a single agent's own reply; it never touches the model-trace mechanism below.

**Universal rules (every class):**
- **Finding or verdict FIRST line** — lead with the answer; the caller decides whether to read further.
- **No process narration** — never "I read X, then grepped Y, then checked Z"; report what was found, not how.
- **No restating the prompt** — the caller already knows what it asked.
- **Evidence as `file:line`**, never quoted code blocks — the caller opens the file if it needs the text.
- **Structured-output override** — when the caller's prompt requests a specific schema (JSON, a fixed artifact file, a machine-readable contract), that request wins over the prose budget below; budgets bound free-form prose, not a caller-mandated structure.
- **Rationale and evidence are never cut for length** — when budget and substance conflict, drop decoration (headers, transitions, restated context), not information.
- **Clarity override carries over** from the Output Economy rule (`haily-coding.md`): security warnings, irreversible-action confirmations, and order-sensitive multi-step instructions get full sentences regardless of budget.
- **Model-trace lines are exempt and untouched** — the `🤖 [agent]: model` announcement (`haily-tracer.cjs`) is a separate, protected mechanism; this contract never shortens, removes, reorders, or defaults it off.

**Budgets by agent class:**

| Class | Agents | Budget |
|---|---|---|
| Mechanical | git-manager, stats, tester, reporter, project-manager, docs-writer, mcp-manager | ≤10 lines |
| Discovery/research | explore, researcher | ≤40 lines, findings-first |
| Judgment | planner, reviewer, debugger, brainstormer, editor, judge, tech-analyst, test-architect, adr-writer, api-designer, optimizer, designer, refiner, implementor | ~5 lines per finding + a verdict header — scales with finding count, not a fixed cap |

`haily-writer` sits outside the three classes: its chapter/section prose and Canon Delta are the caller-requested structured deliverables the override above protects; only its Unit Summary follows a fixed word count already set by its own Output Contract, not the finding-scaled judgment budget.

### Example Selection

When illustrating a skill, use examples that reflect HailyKit's multi-modal
capability (layout, API, CLI). Avoid reusing examples from other toolkits.

Good examples:
```
{skill:hc-cook} "Add rate limiting to API endpoints" --tdd
{skill:hc-cook} mockup.png
{skill:hc-cook} https://figma.com/file/abc123
{skill:hc-cook} .agents/260601-auth/plan.md --auto
```

---

## Part VI — Industry Standards Referenced

Standards and methodologies HailyKit applies. Each entry names the standard and notes where it appears in the codebase.

- **Named-Stage Pipeline** — stages Route→Recon→Draft→Build→Verify→Ship; Checkpoint at stage boundaries; Stage Graph for parallel execution. [*Continuous Delivery*, Humble & Farley, 2010]
- **Test-Driven Development (Red-Green-Refactor)** — `--tdd` flag; Red-Green-Refactor cycle in Build stage. [Beck, 2002]
- **YAGNI / KISS / DRY** — flag pruning; auto-detect input type; single-pipeline model. [Beck 1999; Hunt & Thomas 1999]
- **Blast Radius** — Scope Contract section; Severity Triage proportional response. [AWS Well-Architected 2015; SRE Book, Google 2016]
- **Severity Classification (SEV-1/2/3)** — Severity Triage matrix in Part II; Critical/Major/Minor response differentiation. [ITIL Service Operation 2007; SRE Book ch.14]
- **Preflight Checklist** — Preflight Checks in Build stage: conventions audit, neighbor scan, reuse search, contract trace. [NASA FCOM; Gawande 2009]
- **Lean Waste Elimination** — Lean Pass triggered on LOC-delta breach; removes complexity without changing behavior. [Ohno 1988; Poppendieck 2003]
- **Circuit Breaker Pattern** — Review Circuit: max 3 review-fix iterations before escalation or termination. [Nygard 2007; Fowler 2014]
- **DAG Scheduling** — Stage Graph from `blockedBy` fields in plan phases; determines parallel execution order. [GNU Make 1988; Airflow 2014]
- **Escalation Ladder** — Auto-Resolve Ladder in `--auto` mode: auto-fix → retry (max 3) → incident report → terminate. [ITIL 2007]
- **Defense in Depth** — layered verification: Preflight → Test → Review Circuit → Stress Probe. [NSA 2010; NIST SP 800-30]
- **Architecture Decision Records (ADR)** — `plan.md` + `phase-XX-*.md` as lightweight ADRs with Scope Contract and blast radius. [Nygard 2011]
- **Hill Climbing (Iterative Metric Optimization)** — `hc-optimize` skill: atomic change → measure metric → keep/revert per iteration. [Russell & Norvig 2010 ch.4]
- **agentskills.io Skill Specification** — `SKILL.md` structure; `name:` field format `[a-z0-9-]`; `metadata:` block; `{skill:hc-cook}` cross-reference syntax; domain prefix routing (`hl-`/`hc-`/`hs-`). [agentskills.io/specification, Apache 2.0]
