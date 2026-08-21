# Attribution

Phase 4 adapts extension structure and guard concepts from MIT-licensed upstream
Pi examples without copying OMP or DeepSeek code.

- Pi: `earendil-works/pi` — MIT
  - `packages/coding-agent/examples/extensions/plan-mode/index.ts`
  - `packages/coding-agent/examples/extensions/preset.ts`
  - `packages/coding-agent/examples/extensions/permission-gate.ts`
  - `packages/coding-agent/examples/extensions/protected-paths.ts`
  - `packages/coding-agent/examples/extensions/confirm-destructive.ts`
  - `packages/coding-agent/examples/extensions/dirty-repo-guard.ts`
  - `packages/coding-agent/examples/extensions/project-trust.ts`
  - `packages/coding-agent/src/core/extensions/types.ts`
- DeepSeek Harness: concepts only for modular composition, normalized policy
  context, and compact diagnostics; no source copied.

Adapted HailyKit files in this overlay:

- `index.ts`, `config.ts`, `diagnostics.ts`
- `plan/*.ts`
- `presets/*.ts`
- `safety/*.ts`
