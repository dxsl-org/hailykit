# Changelog

All notable changes to this project will be documented in this file.
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### 🚀 Improvements

- hl-write: add academic writing playbooks — thesis/dissertation (Luận văn ThS / Luận án TS / international thesis) and literary criticism (close-reading essay / phê bình chân dung tác giả / review)
- hl-write: add `citation-styles.md` reference — 6 styles (APA 7, MLA 9, Chicago Notes-Biblio, Chicago Author-Date, IEEE, Vancouver) with mechanically-checkable rules, check tiers, and Vietnamese/East-Asian name-order conventions
- hl-write: IMRaD skeleton gains Abstract and Keywords sections
- hl-write: extended copyedit/fact-check rubrics in `review-passes.md` (citation-format validation, verbatim-quote fixed-string checking, primary-text provenance exclusion)
- haily-editor: streamlined manifest handling for references and playbooks
- scripts: check-skill-cross-refs now validates file paths in SKILL.md References tables

### 🐛 Fixes

- hc-db: correct stale path reference

## [1.14.0] (2026-07-08)

### 🚀 Improvements

- depth-tier: standardize `--quick` / normal / `--deep` as the shared depth axis across eligible skills, with cost framing (cheapest / baseline / 3–5×) and a single `haily.json` `deep.auto` opt-in schema (`docs/engineering-standards.md` → Depth Tiers)
- hc-plan: `--deep` runs a 2-lens judge panel at Solution Design plus red-team and validation
- hc-review, hc-security: `--deep` adds refuter votes — 2–3 independent skeptics must fail to overturn a Critical finding before it can block
- hc-debug, hc-fix: `--deep` spawns a parallel hypothesis panel (2–3 falsification streams) in place of single-stream tracing
- hc-cook, hc-goal: `--deep` forwards judge-panel/refuter-vote rigor through Verify and phase delegation
- hl-brainstorm: `--deep` as an alias for `--debate --edges` — no new machinery, the 9-persona debate is already the maximum-scrutiny panel
- cross-model review (`--cross` / `crossReview.auto`) never auto-activates from `--deep` alone on any skill; when both are authorized, `--deep` upgrades cross findings from advisory to confidence-raising
- session: add `HL_MODEL_TIER` (fast|medium|thinking|ultra), written once at session start and compared by ordinal rank everywhere it gates behavior
- hc-cook, hc-plan, hc-review, hc-fix, hc-debug: parity hints suggest `--deep` when session tier is below `ultra` and the task touches a high-risk domain — advisory only, never auto-escalates
- hc-cook: add Verify-by-Execution (runs prove behavior instead of assuming it) at normal and `--deep` depth
- hc-fix: rename `--hotfix` to `--quick` for consistency with the shared depth axis
- config: migrate `.hl.json` to `haily.json` across hooks, CLI, and skill docs
- agents: add `haily-judge` (apex adjudication agent, `model: ultra`, read-only) — wired into `--deep` verdict points in hc-plan (judge synthesis, red-team), hc-review (refuter adjudication), and hc-debug (hypothesis convergence), with session-model fallback when unavailable
- hc-cook: Recon pre-Build pass injects 2–3 idiomatic in-repo exemplars (`file:line`, ≤80 lines) into the implementor prompt, with a greenfield escape hatch when no precedent exists
- subagent context: add a tier-gated `'reason'` scaffold (competing hypotheses → cited evidence → verdict + confidence) alongside the existing `'think'` directive for judgment agents below `ultra`
- hc-review, hc-fix: append accepted findings to a local `review-history.jsonl`; a 3rd same-category+module recurrence proposes a distillation target (standards entry, guard pattern, lint rule, or memory note) — always a user-approved checkpoint, never a silent write
- hc-plan: phase template gains an `## Assumptions` ledger (claim + confidence + verification method); hc-cook verifies the top-3 low/medium-confidence entries per phase before Build and halts (interactive) or defers (`--auto`) on a failed assumption
- hc-cook: Build gate adds an external-API contract check for untyped/loosely-typed paths — new import with zero prior call sites must be verified via `{skill:hc-lookup}` before Finalize (typed languages already covered by typecheck)
- haily-artifact: `execution-evidence.json` is now a conditionally-required ship-gate artifact — required iff Scope Contract recorded an `evidence: "expected"` marker on `context-snippets.json`; legacy plan dirs without the marker are unaffected

### 🐛 Fixes

- haily-artifact: fix a wiring bug (`readArtifacts()` return shape mismatch) that made the ship/push/pr/deploy artifact gate throw internally and silently fail open on every invocation — shape, policy, and secret-scan validation now actually run before ship

---

## [1.13.1] (2026-07-07)

### 🚀 Improvements

- hc-review: add --quiz comprehension gate before commit
- hc-cook: offer quiz in Ship after autonomous runs

### 🐛 Fixes

- readme: correct guard-rail hook names in security section

---

## [1.13.0] (2026-07-07)

### 🚀 Improvements

- cli: add cross-review command for different-provider AI review
- hc-plan: add --cross stage after Red Team and Validation
- hc-review: add --cross advisory stage after Simplification
- hc-cook: forward --cross to the Verify review
- model-map: add cline and ollama provider entries

---

## [1.12.7] (2026-07-06)

### 🚀 Improvements

- hc-plan: add precedent mining to Codebase Analysis
- hc-cook: add precedent mining to Recon stage
- hc-plan: add real-time deviation log to phase template
- haily-implementor: log deviations live in phase file
- Explore agent: pin to fast model tier

---

## [1.12.6] (2026-07-04)

### 🐛 Fixes

- haily-git-manager: add tag protocol with verified SHA sequencing
- haily-project-manager: add evidence grounding to prevent fabricated claims
- hc-ship: verify release commit before tagging in step 13

---

## [1.12.5] (2026-07-04)

### 🚀 Improvements

- hl-write: add IMPORT mode for continuing existing manuscripts
- hl-write: add prose-craft knowledge and style-stats script
- skills: add WebFetch fallback guidance for blocked pages
- cli: add prose-compression tool and overhead measurement script
- agents: add output contracts to reduce narrative token cost
- rules: add output economy guidance for terse responses
- kit: compress rules and standards prose for token efficiency

---

## [1.12.0] (2026-07-03)

### 🚀 Improvements

- skills: add hs-assess red-team recon and pentest skill
- skills: add hs-harden blue-team CIS and STIG hardening skill
- skills: add hs-dfir blue-team forensics and incident response skill
- installer: upgrade Zed provider for native skills and instructions
- hl-write: write business plans, reports, essays, stories, and books
- agents: add haily-writer and haily-editor for writing

---

## [1.10.14] (2026-07-01)

### 🚀 Improvements

- installer: implement Lazy Reference Loading for flat skill providers (Antigravity & Gemini CLI), reducing flat skill file sizes by ~90% (~15KB vs ~150KB) and referencing central catalog files in ~/.hailykit/kit/skills/
- installer: automatically sync central catalog (~/.hailykit/kit) during installation and self-upgrades

---

## [1.10.13] (2026-07-01)

### 🚀 Improvements

- hc-review: simplification scan, add ceiling + trigger markers
- installer: add cline provider
- installer: self-upgrade CLI binary when a newer release is detected

### 🐛 Bug Fixes

- installer: fix Antigravity provider global install path + skill

---

## [1.10.8] (2026-06-23)

### 🚀 Improvements

- hc-git: add pr --merge review-gated batch merge workflow
- hooks: bold model name in agent trace output
- hooks: resolve inherit to actual session model name in agent trace
- hl-help: surface hc-git pr --merge in quick-start and skill list
- readme: document hc-git pr --merge in skills table
- license: switch from PolyForm Noncommercial to GPL-3.0-only

---

## [1.10.5] (2026-06-22)

### 🚀 Improvements

- model-map: rename deep tier to ultra, add Fable 5 for Anthropic
- agents: add model_max ceiling field to cap escalation per agent
- installer: update ModelTier type and resolvers to support ultra tier
- skills: replace --ultra Mode section with Session Model behavior docs
- ci: extend cross-ref validator to check model_max tier validity
- readme: update skill count to 34 and remove hl-ultra references

### ❌ Removed

- skill hl-ultra

---

## [1.10.3] (2026-06-21)

### 🚀 Improvements

- hailykit git-insights: churn, bus factor, velocity, change-impact
- hailykit secrets: native secret and vulnerability scanners
- hailykit contracts: extract exports, signatures, endpoints
- hailykit test-detect: framework and coverage normalization
- hailykit deps-audit: unified advisory schema across package managers
- hailykit adr-next: ADR, license, and secret-safe pack tools
- cli/lib: shared zero-dep git, fs-scan, spawn primitives
- hc-spec: EARS-notation acceptance criteria with approval gate
- hc-adr: capture or auto-discover architectural decisions
- hc-review: batch mode and OWASP Agentic checks
- hc-debug: SUSPECTED/PROBABLE/CONFIRMED confidence levels
- hc-scout: cross-repo consumer tracing via --deps flag
- hc-plan: memory-augmented planning via --resume flag
- Codex provider: register agents in config.toml sentinel block
- Codex provider: escape developer_instructions for TOML multiline
- Codex hooks: bake per-hook timeout into generated wrappers
- Codex hooks: strip additionalContext for non-accepting events
- Codex hooks: warn when codex CLI is missing or outdated
- Codex agents: infer sandbox_mode from agent tools list
- Codex agents: preserve unknown model id as comment
- Codex config.toml: atomic writes via temp-file rename
- Codex config.toml: self-healing features.hooks flag writer
- Codex hooks: install on Windows using node invocation
- hc-ship: embed changelog format constraint inline in step 8

### 🐛 Fixes

- hailykit upgrade: version always read from kit/metadata.json
- release:pack: stamp correct version into kit/metadata.json before zip
- Codex hooks: parser matches bash -c runner command shape

---

## [1.9.0] (2026-06-19)

### 🚀 Improvements

- hailykit install: retry logic for GitHub API and downloads
- hc-git issues: discover and triage open GitHub issues
- hc-goal: clarify-or-assume replaces halt-on-ambiguity
- hc-goal: no-new-failures regression gate with ledger compaction
- hc-cook: baseline-relative no-new-failures regression gate
- hc-cook: --strict restores full-suite-green requirement
- hc-review: user-defined per-repo check criteria via checks/*.yaml
- hc-debug: oracle escalation after 3 failed fix attempts
- hc-plan: scout-report.md reused by review and debug agents

---

## [1.8.0] (2026-06-12)

### 🚀 Improvements

- haily-statusline: live session summary in status line

---

## [1.7.0] (2026-06-12)

### 🚀 Improvements

- hailykit stats: zero-dep code statistics CLI
- hl-stats: code metrics skill

---

## [1.6.7] (2026-06-12)

### 🚀 Improvements

- hailykit stats: Gleam language support
- haily-tracer: model tracer and usage enabled by default

### 🐛 Fixes

- hailykit upgrade: fix version detection and upgrade logic
- haily-tracer: dead hook revived, output now visible
- hailykit release: fall back to upload when create fails

---

## [1.5.0] (2026-06-11)

### 🚀 Improvements

- hl-ultra: opt-in deep-model escalation skill

### 🐛 Fixes

- Gemini, Codex, Zed: upgrade path fixes
- converter tests: HAILYKIT_HOME guard for test isolation

---

## [1.4.0] (2026-06-10)

### 🚀 Improvements

- installer: block auto deep-research and dynamic workflows
- hl-research: cost discipline and claim refutation
- hailykit uninstall: strip dangling hook references

---

## [1.3.0] (2026-06-09)

### 🚀 Improvements

- hailykit: add uninstall command and --help flag
- hc-ship: auto-detect git and release automation regime

### 🐛 Fixes

- hc-cop: reachable from domain routing files
- CI: enforce skill cross-reference check on push

---

## [1.2.1] (2026-06-08)

### 🚀 Improvements

- hc-ship, hc-docs, hc-new: skill upgrades
- AGENTS.md: canonical project context file
- skills: add cross-links between related skills
- providers: add multi-provider spec files
- hc-goal: autonomous plan to cook to review loop

### 🐛 Fixes

- Crush: skills install as hc-name/SKILL.md path
- skills: remove non-spec user-invocable field

---

## [1.1.0] (2026-06-07)

### 🚀 Improvements

- providers: add Kimi and Crush provider support

### 🐛 Fixes

- providers: model stripping for user-configured providers
- OpenCode: globalDir path on macOS and Windows

---

## [1.0.0] (2026-06-04)

### 🚀 Improvements

- engine: zero-dep TypeScript NDJSON-over-stdio tool execution
- CLI: list, run, and info commands
- installer: multi-provider support for six providers
- skills: 30 skills across hc and hl prefixes
- installer: install, upgrade, and status commands
- converter: per-provider SKILL.md conversion pipeline
- settings: deny rules with union-add and atomic writes
- hooks: secret block and opt-in PII guard
- installer: non-destructive settings migration with deletions array

---
