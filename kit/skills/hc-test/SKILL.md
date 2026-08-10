---
name: hc-test
description: "Run unit/integration/e2e tests with coverage analysis and build verification. Supports JS/TS, Python, Go, Rust, Flutter. --web activates Playwright, k6, a11y, visual regression, and Core Web Vitals testing."
when_to_use: "Invoke when running test suites, measuring coverage, or writing new tests."
user-invocable: true
argument-hint: "[scope] [--web] [--mutation]"
metadata:
  category: workflow
  keywords: [test, unit, integration, e2e, coverage, playwright, k6, a11y, visual-regression, mutation]
---

# Test — Test Suite Execution Pipeline

Run the validation pipeline for the final code that will be reviewed and merged: typecheck → tests → coverage → build. Detect language and framework automatically.

## Usage

```
{skill:hc-test} [scope] [--web] [--mutation]
```

- *(none)* Standard pipeline: typecheck → tests → coverage → build.
- `--web` Load Playwright, k6, a11y, visual regression, and Core Web Vitals references.
- `--mutation` Run mutation testing on critical-path modules; nightly/pre-merge tier, not the inner loop.

No args runs the full project. Scope may be a path; `--web` enables browser checks and `--mutation` enables periodic mutation audit.

## Constraints

> **Required — never-ignore-failures:** Fix root causes. Never mock, stub, or skip tests merely to force green.

> **Required — evidence-before-claims:** Run and read the full test command before claiming pass/fail.

## Process

1. **Route** — parse scope/mode; log `✓ Route: mode=[standard|web], scope=[arg or 'all']`.
2. **Recon** — run `hailykit test-detect <path> --json`; if framework is unknown, inspect manually.
3. **Verify** — follow `references/flow-execution.md`: typecheck/lint, tests, `hailykit coverage-parse <file> --json` against threshold, production build. Retry configuration failures; stop and escalate code regressions.
4. **Report** — write `.agents/reports/` QA evidence using `references/quality-report.md`.

## --web Mode

With `--web`, load the relevant subset: `references/tech-playwright.md`, `references/tech-k6.md`, `references/tech-a11y.md`, `references/tech-visual-regression.md`, `references/tech-core-web-vitals.md`, `references/quality-cross-browser.md`, `references/flow-ui.md`.

Use `{skill:hc-browser}` for interactive sessions/screenshots; use `gemini` for screenshot issue descriptions.

## --mutation Mode

With `--mutation`, load `references/tech-mutation.md`, detect Stryker/mutmut, limit to passed or critical-path scope, and report score plus surviving mutants. It is never a per-commit gate.

## Routing

Code failure → `{skill:hc-debug}` then `{skill:hc-fix}`; security audit → `{skill:hc-security}`; complex analysis → `{skill:hl-reasoning}`.

## Workflow Position

**Follows:** `{skill:hc-cook}`, `{skill:hc-fix}`
**Precedes:** `{skill:hc-review}`, `{skill:hc-optimize}`
**Related:** `{skill:hc-cook}`, `{skill:hc-fix}`

Run `--mutation` only after the standard suite, nightly/pre-merge or explicitly.

## References

Core: `references/flow-execution.md`, `references/quality-report.md`, `references/tech-mutation.md`.

Web: `references/tech-playwright.md`, `references/tech-k6.md`, `references/tech-a11y.md`, `references/tech-visual-regression.md`, `references/tech-core-web-vitals.md`, `references/quality-cross-browser.md`, `references/flow-ui.md`.
