# Project Changelog

## Unreleased

- Tightened docs-generation policy so `hc-new` delegates to `hc-docs init`, root `README.md` keeps the only brief project narrative, and generated docs stay operational.
- Added a provider-neutral `hailykit benchmark` command family for static footprint, hook replay, workflow planning, offline workflow replay, legacy reasoning import, comparison, and report generation.
- Added benchmark methodology docs that separate quality, safety, efficiency, and provenance, including calibration-first live batches, private hash-only holdout handling, and effective-pair/bootstrap/permutation diagnostics.
- Added a benchmark tie-in to `docs/token-overhead.md` so static footprint measurements and live benchmark evidence live in the same measurement story.
- Added Codex live benchmark support for both the default CLI telemetry path and a new App Server session backend, with fresh-thread isolation and streamed token/context/tool telemetry. Live smoke now records the backend as `codex_app_server`, verifies the model, and still leaves `costUsd` unknown when Codex does not emit it.
- Hardened live execution against Windows model-argument injection, exhausted spend/wall/output budgets, evaluator scope traversal, and private-holdout extension aliases.
