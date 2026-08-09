# Project Changelog

## Unreleased

- Completed the subagent prompt optimization pass: added agent-body linting/measurement, kept frontmatter stable across 25 agents, and reduced runtime agent-body footprint from `89,005` bytes / `22,252` est. tokens to `59,025` bytes / `14,757` est. tokens.
- Verified scout dedup delivery: targeted scout tests pass 20/20, the full suite passes 594/595 with only the unchanged date-sensitive benchmark baseline failure, and the work stopped short of commit/push/release.
- Added machine-readable `ReconEnvelope` coverage metadata and active-plan-first routing so scout work is reused when current, narrowed to uncovered deltas when partial, and partitioned by exclusive owned paths when parallel work is required.
- Converged Scout steps in new/plan/docs/cook/review/fix/debug/goal workflows on `hc-scout`, while preserving separate Explore branches used only for hypothesis falsification.
- Added deterministic scout-dedup workflow fixtures for `hc-new → hc-plan → hc-docs init`, `hc-cook → hc-review`, and `hc-fix → hc-debug`, plus static tests that assert max full-scout count, reuse hits, quick-delta counts, and no direct-Explore scout fallback.
- Extended the static skill-contract validator so scout-dedup policy is checked alongside cross-reference, model-tier, and References-table integrity.
- Tightened docs-generation policy so `hc-new` delegates to `hc-docs init`, root `README.md` keeps the only brief project narrative, and generated docs stay operational.
- Added a provider-neutral `hailykit benchmark` command family for static footprint, hook replay, workflow planning, offline workflow replay, legacy reasoning import, comparison, and report generation.
- Added benchmark methodology docs that separate quality, safety, efficiency, and provenance, including calibration-first live batches, private hash-only holdout handling, and effective-pair/bootstrap/permutation diagnostics.
- Added a benchmark tie-in to `docs/token-overhead.md` so static footprint measurements and live benchmark evidence live in the same measurement story.
- Added Codex live benchmark support for both the default CLI telemetry path and a new App Server session backend, with fresh-thread isolation and streamed token/context/tool telemetry. Live smoke now records the backend as `codex_app_server`, verifies the model, and still leaves `costUsd` unknown when Codex does not emit it.
- Hardened live execution against Windows model-argument injection, exhausted spend/wall/output budgets, evaluator scope traversal, and private-holdout extension aliases.
