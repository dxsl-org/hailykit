# Project Roadmap

## 2026-08

- Complete: remaining rules and skill prompt compression
  - Goal: remove narrative and basic duplicated HOW from the remaining high-exposure prompt bodies while retaining process, commands, WHY, safety, and provider-neutral routing.
  - Status: implemented locally; the scoped catalog total fell from 128,200 to 78,731 normalized bytes (`-38.59%`). Build, 664/664 tests, 1,046 cross-references, and a 1,235-row static inventory pass. A minimum two-call live smoke found one candidate omission of the single-agent fallback; no installer architecture changed and behavioral equivalence remains unproven.
- Complete: follow-up prompt optimization and MCP evaluator repair
  - Goal: make MCP checks resilient to valid paraphrases, remove remaining generated-rule duplication, and compress the next high-exposure skill prompts without weakening release, licensing, canon, or evidence contracts.
  - Status: grouped/negation-aware evaluator fixtures and all four prompt batches are implemented locally. Always-on rules fell 26.29%, `hc-ship`/`hc-cop` 52.12%, and the installed `hl-write` bundle 46.08%; final static inventory has 1,235 rows. No new paid live run or behavior-equivalence claim was made.
- Complete: single-pass benchmark evaluation and routing-rule compression
  - Goal: score explicit workflow contracts without a second model call and remove repeated routing prose without losing unique behavior.
  - Status: implemented locally; raw answers are digest-only in artifacts, legacy `--evidence` remains available, and the two routing files are 41.59% smaller by normalized bytes. Build/skill checks and 635/635 tests pass; static benchmark emits 1,235 rows. No paid live run was performed in this implementation wave.
- Complete: hook, guardrail, harness, and skill prompt optimization
  - Goal: measure every injected Markdown class, remove storytelling/repeated simple HOW, and process skills in small independently tested batches.
  - Status: Phases 0-6 complete locally — net source footprint fell by 81,896 normalized bytes, static/hook artifacts and semantic gates pass, and the full suite passes 628/628. Two live pairs averaged 10.36% fewer total tokens; an exploratory rubric scored both arms 8/8, while canonical behavior equivalence remains inconclusive and observed USD cost is unavailable.
- Complete: subagent prompt optimization
  - Goal: compress all 25 `kit/agents/*.md` prompt bodies while preserving behavior, safety, schemas, and benchmark evidence.
  - Status: implemented locally; final snapshot refreshed from `collectAgentBodyBaseline()`, `npm run check:skills` passes, and `npm test` retains the known date-pinned benchmark assertion.
- Complete: Scout deduplication optimization
  - Goal: make scout reuse machine-readable, converge caller recon through `hc-scout`, and pin the behavior with static contract tests and workflow fixtures.
  - Status: implemented locally; targeted scout tests pass 20/20; full suite is 594/595 with the unchanged date-sensitive benchmark failure; build, skill checks, and diff checks pass.
- Complete: docs generation policy cleanup
  - Goal: make `hc-new` hand off docs and rules generation to `hc-docs init`, keep root `README.md` as the only brief project-story surface, and keep generated docs operational.
  - Status: policy and regression test updates implemented locally; typecheck and skill checks pass; full test suite remains 574/575 with the unchanged date-sensitive baseline failure.
- Complete: HailyKit effectiveness benchmark V2 implementation
  - Goal: normalize static footprint, hook replay, workflow trials, and legacy reasoning artifacts into one benchmark surface for before/after optimization work.
  - Status: implementation, 572-test verification, skill checks, offline smoke, and final quality/risk reviews pass. Codex live calibration now has two backends: the default CLI parser and the new App Server session backend. Decision-grade spend still fails closed where observed USD cost is unavailable.
