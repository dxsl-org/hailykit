# Summarize Workflow

Summarize or update docs for `$1` (default: all). Work from `docs/` and targeted grep; activate `{skill:hc-scout}` only when `$2` is `true` (default: `false`).

## Arguments
$1: Focused topics (default: all)
$2: Should scan codebase (`Boolean`, default: `false`)

## Important
- Update only operational docs touched by the focus. Do not maintain `docs/codebase-summary.md`.
- Grep-verify paths, symbols, config keys, and internal links before reporting.
- **Do not** start implementing.
