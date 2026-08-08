# Project Roadmap

## 2026-08

- Complete: docs generation policy cleanup
  - Goal: make `hc-new` hand off docs and rules generation to `hc-docs init`, keep root `README.md` as the only brief project-story surface, and keep generated docs operational.
  - Status: policy and regression test updates implemented locally; typecheck and skill checks pass; full test suite remains 574/575 with the unchanged date-sensitive baseline failure.
- Complete: HailyKit effectiveness benchmark V2 implementation
  - Goal: normalize static footprint, hook replay, workflow trials, and legacy reasoning artifacts into one benchmark surface for before/after optimization work.
  - Status: implementation, 572-test verification, skill checks, offline smoke, and final quality/risk reviews pass. Codex live calibration now has two backends: the default CLI parser and the new App Server session backend. Decision-grade spend still fails closed where observed USD cost is unavailable.
