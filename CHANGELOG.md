# Changelog

All notable changes to this project will be documented in this file.
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### 🚀 Improvements

- ocr: add `hailykit ocr` — tiered docling → Gemini Flash → Gemini Pro pipeline for bulk PDF/scan → Markdown, with local/batch-API escalation, resume, and per-page manifests
- hc-ocr: add skill orchestrating the OCR CLI with mandatory language detection, multimodal sample verification, and cost/quality reporting
- hc-docs: add reciprocal disambiguation link to hc-ocr for mass conversion

## [1.14.10] (2026-07-21)

### 🚀 Improvements

- hl-write: ban cliché metaphor classes over exact strings
- hl-write: cover paraphrased class instances at emotional peaks

## [1.14.9] (2026-07-20)

### 🚀 Improvements

- installer: add flat_inline frontmatter for flat bundle embedding
- hl-write: inline anti-AI rubric on flat providers
- ci: validate flat_inline paths resolve

## [1.14.8] (2026-07-20)

### 🚀 Improvements

- hl-write: add single-agent host fallback section
- hl-write: move style seeding contract to skill reference
- hl-write: declare review rubrics role-neutral
- hl-write: repoint agent-file references to skill sources

## [1.14.7] (2026-07-20)

### 🚀 Improvements

- hl-write: extend Vietnamese cliché inventory from field findings
- hl-write: ban stock phrases inside emotional peak passages
- hl-write: add collocation misuse class to copyedit rubric
- agents: haily-writer anchors emotional peaks on concrete details

## [1.14.6] (2026-07-20)

### 🚀 Improvements

- hl-write: extract anti-AI-tone rubric into shared reference
- hl-write: apply anti-AI-tone checks to every prose genre
- hl-write: add Vietnamese-specific prose tells
- hl-write: cap rhetorical device density in speech
- hl-write: run style-stats for any multi-unit work
- style-stats: add sentence and paragraph burstiness metrics
- hl-write: forbid vocabulary word-lists in style seeding
- hl-write: require concrete particulars in narrative units

## [1.14.5] (2026-07-17)

### 🚀 Improvements

- hc-spec: add --quick lightweight spec tier for small tasks
- hc-spec: number acceptance criteria with test traceability anchors
- hc-spec: add version tracking and mid-Build re-approval rule
- hc-cook: split --tdd into red-green and snapshot cycles
- hc-cook: gate test immutability via test-only commit
- hc-cook: separate test-writer and implementor contexts under --tdd
- hc-cook: add ship-time spec-conformance check
- hc-test: add --mutation deep tier for critical-path modules
- hc-review: key spec-compliance pass by criterion with drift detection
- agents: haily-tester verifies red proof and flags TDD violations
- agents: haily-test-architect owns EARS to given-when-then translation
- readme, hl-help: add tiered SDD and TDD workflow guidance
- readme, hl-help: sync skill catalog and correct skill count

## [1.14.4] (2026-07-16)

### 🚀 Improvements

- installer: copy crush skill assets with user-invocable frontmatter
- hc-review: run quality and stress probe reviewers in parallel
- hc-review: resolve scout reuse-first before spawning
- hc-review: fold YAGNI taxonomy into quality reviewer prompt
- hc-review: skip scout under quick mode
- hc-review: reuse scout findings across batch targets
- hc-plan: run scout once with all aspects
- hc-plan: reuse session recon in codebase analysis
- hl-brainstorm: resolve recon reuse-first with quick scout
- hc-fix, hc-debug, hc-spec, hl-write: add reuse-first recon ladders
- hc-cook: stop per-phase scout re-spawn in exemplar pull
- hc-cook: demote scout ext to large-codebase escalation
- hc-docs: drop parallel doc-reader fan-out
- hc-docs: honor should_scan_codebase flag in summarize
- hc-test: use quick scout for UI discovery
- hc-security: batch dependency audit with secret detection
- hc-optimize: dry-run Measure command before iteration loop
- agents: reuse caller recon in reviewer and brainstormer

### 🐛 Fixes

- hc-ship: drop auto-created issues from ship steps
- kit: replace 112 legacy colon refs with canonical form
- kit: repoint dead hd script paths to hl-design
- ci: flag colon-form skill refs in cross-ref check
- hooks: point artifact gate message to current skill names
- changelog: restore released 1.14.2 section erased locally

## [1.14.3] (2026-07-14)

### 🚀 Improvements

- hl-advisor: apex ultra/ultra consultation skill + agent — package-in, advice-out; user ad-hoc + skill --deep decision points
- hl-brainstorm: --debate verdict adjudicated by haily-judge when session tier ranks below ultra — tier-gated, once per debate, session-model fallback
- hc-cook: --auto remediation selection adjudicated by haily-judge when session tier ranks below ultra — tier-gated, max twice per run, verdict logged for post-run audit; hard blocks still terminate with incident report
- hc-goal: --auto ambiguous-direction decisions consult haily-advisor when session tier ranks below ultra — tier-gated, once per run, recommendation logged in run ledger; critical blockers still escalate to user
- hooks: add tool-call activity log with rotation
- hooks: attribute hook-log lines with session id
- installer: migrate settings for activity-log hook

### 🐛 Fixes

- docs-pipeline: fix broken agent refs and gate

## [1.14.2] (2026-07-13)

### 🐛 Fixes

- package-lock: sync recorded version, stale since 1.10.1

## [1.14.1] (2026-07-13)

### 🚀 Improvements

- session: `haily-session.cjs` emits shipped-file standards visibility summary
- session: `context.cjs` emits unmapped-language note
- contextual rules: add kit/contextual directory and triggers match slash-command forms
- hl-write: add educational content, career document, speech, research proposal, marketing, academic thesis, dissertation and literary criticism playbooks
- haily-editor: streamline manifest handling for references and playbooks
- hl-research: add --type academic for scholarly and market for competitive research
- review-passes.md: designate load-bearing sourced claims as Critical
- hc-plan: add deviation-log examples to phase template
- hc-plan: add fact-vs-assumption exemplars to template
- hc-plan: add three-option red-team adjudication exemplar
- hc-goal: document --deep cost model
- hl-write: explain why --deep flag does not exist

### 🐛 Fixes

- haily-rules: fix UserPromptSubmit reminder hook wiring bug
- haily-rules: inject rules as real content again
- haily-rules: implement 5-minute TTL dedup capping
- hc-db: correct stale path reference
- installer: remove contextual/ and templates/ directory on uninstall
- context: guard injected plan paths from double-prefixing

## [1.14.0] (2026-07-08)

### 🚀 Improvements

- depth-tier: standardize --quick, normal, --deep axis
- depth-tier: frame cost as cheapest, baseline, 3–5×
- depth-tier: add haily.json deep.auto opt-in schema
- hc-plan: --deep runs 2-lens judge panel at Solution, adds red-team and validation
- hc-review: --deep adds refuter votes
- hc-security: --deep adds refuter votes
- hc-debug: --deep spawns parallel hypothesis panel
- hc-fix: --deep spawns parallel hypothesis panel
- hc-cook: --deep forwards judge-panel rigor through Verify
- hc-goal: --deep forwards judge-panel rigor through Verify
- hl-brainstorm: --deep aliases for --debate --edges
- cross-model review: never auto-activates from --deep alone and upgrades findings to confidence-raising
- session: add HL_MODEL_TIER (fast|medium|thinking|ultra) and write once at start
- hc-cook: suggest --deep for below-ultra below-risk domains
- hc-plan: suggest --deep for below-ultra below-risk domains
- hc-review: suggest --deep for below-ultra below-risk domains
- hc-fix: suggest --deep for below-ultra below-risk domains
- hc-debug: suggest --deep for below-ultra below-risk domains
- hc-cook: inject 2–3 idiomatic in-repo exemplars into prompt
- hc-cook: provide greenfield escape hatch when no precedent
- subagent context: add tier-gated reason scaffold and support existing think directive
- hc-review: append accepted findings to review-history.jsonl
- hc-fix: append accepted findings to review-history.jsonl
- hc-review: propose distillation target on third recurrence
- hc-fix: propose distillation target on third recurrence
- hc-plan: add Assumptions ledger to phase template
- hc-cook: verify top-3 low/medium-confidence assumptions
- hc-cook: halt or defer on failed assumption check
- hc-cook: add external-API contract check for untyped imports
- haily-artifact: make execution-evidence.json conditionally required

### 🐛 Fixes

- haily-artifact: fix readArtifacts return shape mismatch and enable artifact gate validation before ship

---

## [1.13.1] (2026-07-07)

### 🚀 Improvements

- hc-review: add --quiz comprehension gate before commit
- hc-cook: offer quiz in Ship after autonomous runs

### 🐛 Fixes

- readme: correct guard-rail hook names

---

## [1.13.0] (2026-07-07)

### 🚀 Improvements

- cli: add cross-review command for different-provider AI
- hc-plan: add --cross stage after Red Team
- hc-review: add --cross advisory stage after Simplification
- hc-cook: forward --cross to Verify review
- model-map: add cline provider entry
- model-map: add ollama provider entry

---

## [1.12.7] (2026-07-06)

### 🚀 Improvements

- hc-plan: add precedent mining to Codebase Analysis
- hc-cook: add precedent mining to Recon stage
- hc-plan: add real-time deviation log to template
- haily-implementor: log deviations live in phase file
- explore: pin to fast model tier

---

## [1.12.6] (2026-07-04)

### 🐛 Fixes

- haily-git-manager: add tag protocol with SHA sequencing
- haily-project-manager: add evidence grounding to prevent fabrication
- hc-ship: verify release commit before tagging

---

## [1.12.5] (2026-07-04)

### 🚀 Improvements

- hl-write: add IMPORT mode for continuing manuscripts
- hl-write: add prose-craft knowledge and style-stats
- skills: add WebFetch fallback guidance for blocked pages
- cli: add prose-compression tool
- cli: add overhead measurement script
- agents: add output contracts to reduce narrative cost
- rules: add output economy guidance for terse responses
- kit: compress rules and standards prose

---

## [1.12.0] (2026-07-03)

### 🚀 Improvements

- skills: add hs-assess red-team recon and pentest
- skills: add hs-harden blue-team CIS hardening
- skills: add hs-harden blue-team STIG hardening
- skills: add hs-dfir blue-team forensics and incident response
- installer: upgrade Zed provider for native skills
- hl-write: add business plan playbook
- hl-write: add report playbook
- hl-write: add essay playbook
- hl-write: add story playbook
- hl-write: add book playbook
- agents: add haily-writer for authoring documents
- agents: add haily-editor for editing documents

---

## [1.10.14] (2026-07-01)

### 🚀 Improvements

- installer: implement Lazy Reference Loading for flat providers
- installer: reduce flat skill file sizes by 90%
- installer: reference central catalog files in ~/.hailykit/kit
- installer: sync central catalog during installation
- installer: sync central catalog during self-upgrades

---

## [1.10.13] (2026-07-01)

### 🚀 Improvements

- hc-review: add simplification scan ceiling and trigger
- installer: add cline provider
- installer: enable CLI binary self-upgrade on detection

### 🐛 Fixes

- installer: fix Antigravity provider global install path
- installer: fix Antigravity provider skill installation

---

## [1.10.8] (2026-06-23)

### 🚀 Improvements

- hc-git: add pr --merge review-gated batch workflow
- hooks: bold model name in agent trace output
- hooks: resolve inherit to actual session model
- hl-help: surface hc-git pr --merge in quick-start
- hl-help: surface hc-git pr --merge in skill list
- readme: document hc-git pr --merge in skills table
- license: switch to GPL-3.0-only

---

## [1.10.5] (2026-06-22)

### 🚀 Improvements

- model-map: rename deep tier to ultra
- model-map: add Fable 5 for Anthropic
- agents: add model_max ceiling field to agents
- installer: update ModelTier type for ultra tier
- skills: replace --ultra Mode with Session Model docs
- ci: extend cross-ref validator for model_max validity

### ❌ Removed

- skill hl-ultra

---

## [1.10.3] (2026-06-21)

### 🚀 Improvements

- hailykit git-insights: add churn metrics
- hailykit git-insights: add bus factor metrics
- hailykit git-insights: add velocity metrics
- hailykit git-insights: add change-impact metrics
- hailykit secrets: add native secret scanner
- hailykit secrets: add vulnerability scanner
- hailykit contracts: extract exports and signatures
- hailykit contracts: extract endpoints
- hailykit test-detect: add framework normalization
- hailykit test-detect: add coverage normalization
- hailykit deps-audit: unified advisory schema
- hailykit adr-next: pack ADR, license, and secrets
- cli/lib: add shared zero-dep git primitives
- cli/lib: add shared zero-dep fs-scan primitives
- cli/lib: add shared zero-dep spawn primitives
- hc-spec: add EARS-notation acceptance criteria
- hc-spec: add approval gate
- hc-adr: capture architectural decisions
- hc-adr: auto-discover architectural decisions
- hc-review: add batch mode
- hc-review: add OWASP Agentic checks
- hc-debug: add SUSPECTED confidence level
- hc-debug: add PROBABLE confidence level
- hc-debug: add CONFIRMED confidence level
- hc-scout: add cross-repo consumer tracing via --deps
- hc-plan: add memory-augmented planning via --resume
- codex-provider: register agents in config.toml sentinel
- codex-provider: escape developer_instructions for TOML
- codex-hooks: bake per-hook timeout into wrappers
- codex-hooks: strip additionalContext for non-accepting events
- codex-hooks: warn when codex CLI is missing
- codex-hooks: warn when codex CLI is outdated
- codex-agents: infer sandbox_mode from tools list
- codex-agents: preserve unknown model id as comment
- codex-config: atomic writes via temp-file rename
- codex-config: self-healing features.hooks flag writer
- codex-hooks: install on Windows using node
- hc-ship: embed changelog format constraint inline

### 🐛 Fixes

- hailykit upgrade: read version from kit/metadata.json
- release:pack: stamp correct version before zip
- codex-hooks: fix parser bash -c runner shape

---

## [1.9.0] (2026-06-19)

### 🚀 Improvements

- hailykit install: add retry logic for GitHub API
- hailykit install: add retry logic for downloads
- hc-git issues: discover and triage open issues
- hc-goal: replace halt-on-ambiguity with clarify-or-assume
- hc-goal: add no-new-failures regression gate
- hc-goal: compact ledger
- hc-cook: add baseline-relative regression gate
- hc-cook: add --strict for full-suite-green requirement
- hc-review: add user-defined check criteria via checks/
- hc-debug: add oracle escalation after three failures
- hc-plan: reuse scout-report.md in review and debug

---

## [1.8.0] (2026-06-12)

### 🚀 Improvements

- haily-statusline: add live session summary in status

---

## [1.7.0] (2026-06-12)

### 🚀 Improvements

- hailykit stats: add zero-dep code statistics CLI
- hl-stats: add code metrics skill

---

## [1.6.7] (2026-06-12)

### 🚀 Improvements

- hailykit stats: add Gleam language support
- haily-tracer: enable model tracer by default
- haily-tracer: enable usage tracking by default

### 🐛 Fixes

- hailykit upgrade: fix version detection logic
- hailykit upgrade: fix upgrade logic
- haily-tracer: revive dead hook
- haily-tracer: make output visible
- hailykit release: fall back to upload on failure

---

## [1.5.0] (2026-06-11)

### 🚀 Improvements

- hl-ultra: add opt-in deep-model escalation skill

### 🐛 Fixes

- gemini provider: fix upgrade path
- codex provider: fix upgrade path
- zed provider: fix upgrade path
- converter tests: add HAILYKIT_HOME guard

---

## [1.4.0] (2026-06-10)

### 🚀 Improvements

- installer: block auto deep-research and workflows
- hl-research: add cost discipline
- hl-research: add claim refutation
- hailykit uninstall: strip dangling hook references

---

## [1.3.0] (2026-06-09)

### 🚀 Improvements

- hailykit: add uninstall command
- hailykit: add --help flag
- hc-ship: auto-detect git automation regime

### 🐛 Fixes

- hc-cop: make reachable from domain routing
- ci: enforce skill cross-reference check

---

## [1.2.1] (2026-06-08)

### 🚀 Improvements

- hc-ship: upgrade skill
- hc-docs: upgrade skill
- hc-new: upgrade skill
- AGENTS.md: add canonical project context
- skills: add cross-links between related skills
- providers: add multi-provider spec files
- hc-goal: add autonomous plan-cook-review loop

### 🐛 Fixes

- crush provider: install skills as hc-name/SKILL.md
- skills: remove non-spec user-invocable field

---

## [1.1.0] (2026-06-07)

### 🚀 Improvements

- providers: add Kimi provider support
- providers: add Crush provider support

### 🐛 Fixes

- providers: fix model stripping for user-configured
- opencode provider: fix globalDir path on macOS
- opencode provider: fix globalDir path on Windows

---

## [1.0.0] (2026-06-04)

### 🚀 Improvements

- engine: add zero-dep TypeScript NDJSON executor
- cli: add list command
- cli: add run command
- cli: add info command
- installer: add multi-provider support
- installer: support six providers
- skills: add 30 skills across hc and hl prefixes
- installer: add install command
- installer: add upgrade command
- installer: add status command
- converter: add per-provider SKILL.md pipeline
- settings: add deny rules with union-add
- settings: enable atomic writes
- hooks: add secret block
- hooks: add opt-in PII guard
- installer: add non-destructive settings migration

---
