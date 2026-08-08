# Scout dedup policy fixtures

These fixtures lock the approved scout-dedup contract in a machine-readable way.

- Full orientation maps persist only to the root `scout-report.md` in the active plan directory.
- When a plan-authored report already exists, scout updates only the `## Scout Addendum` section instead of overwriting the plan-authored report or the whole report.
- Same-session targeted lookups emit `reconEnvelope` metadata for reuse, but they do not persist as full `scout-report.md` output.

The JSON fixtures below are consumed by the static checker and tests:

- `recon-envelope-valid.json` — valid machine-readable coverage metadata.
- `recon-envelope-invalid-overlap.json` — invalid nested `ownedPaths` coverage that must fail.
- `workflow-hc-new-docs.json` — one full scout, then verified-handoff reuse with a bounded delta.
- `workflow-cook-review.json` — one full scout, then active-plan reuse during review.
- `workflow-fix-debug.json` — quick incident recon reused by debug, with no pack or codebase-summary fallback.
