---
name: hc-test
description: "Run unit/integration/e2e tests with coverage analysis and build verification. Supports JS/TS, Python, Go, Rust, Flutter. --web activates Playwright, k6, a11y, visual regression, and Core Web Vitals testing."
when_to_use: "Invoke when running test suites, measuring coverage, or writing new tests."
user-invocable: true
argument-hint: "[scope] [--web]"
metadata:
  category: workflow
  keywords: [test, unit, integration, e2e, coverage, playwright, k6, a11y, visual-regression]
---

# Test — Test Suite Execution Pipeline

Runs the full validation pipeline: typecheck → tests → coverage → build verification. Detects language and framework automatically. `--web` loads web-specific tooling (Playwright, k6, a11y, visual regression, Core Web Vitals).

## Usage

```
{skill:hc-test} [scope] [--web]
```

| Flag | Behavior |
|------|----------|
| *(none)* | Run project test suite: typecheck → tests → coverage → build |
| `--web` | Web-specific testing: load Playwright, k6, a11y, visual regression, CWV references |

```
{skill:hc-test}                   # full suite
{skill:hc-test} src/auth/         # scoped to auth module
{skill:hc-test} --web             # full web test suite
{skill:hc-test} --web src/checkout # web tests scoped to checkout flow
```

No arguments: run the full project test suite. Add `--web` for web-specific testing.

## Constraints

> **Required — never-ignore-failures:** Fix root causes. Do not mock, stub, or skip tests to force a passing build. A passing build with hidden failures is worse than a failing build.

> **Required — evidence-before-claims:** Run the full test command and read its output before reporting pass/fail status.

## Process

1. **Route** — parse scope from args; select mode (standard or `--web`). Log `✓ Route: mode=[standard|web], scope=[arg or 'all']`

2. **Recon** — identify framework (Jest, Vitest, pytest, go test, cargo test, flutter test) from config files; locate test files; read coverage threshold from config. Log `✓ Recon: framework=[name], test files=[N]`

3. **Verify** — execute validation pipeline via `references/flow-execution.md`:
   - Run typecheck/lint (catch compile errors before tests)
   - Run test suite; on failure, classify: configuration issue (missing dep, wrong env var, broken import) → fix config and re-run; code bug (logic error, assertion failure, regression) → stop and escalate per § When NOT to Use
   - Generate coverage; compare against threshold
   - Run build verification (production build must exit 0)
   - For `--web`: load and run web-specific suites (see `## --web Mode`)
   - Log `✓ Verify: [N/N] tests passed — coverage=[X%] — build=[PASS|FAIL]`

4. **Report** — produce structured QA report to `.agents/reports/` via `references/quality-report.md`. Log `✓ Report: saved to .agents/reports/[filename]`

## --web Mode

Activated by `--web`. Load these references and run suites in the order that applies to the project:

| Reference | Coverage |
|-----------|----------|
| `references/tech-playwright.md` | E2E — authoring, selectors, fixtures, parallel execution |
| `references/tech-k6.md` | Load — scripts, thresholds, ramp-up patterns |
| `references/tech-a11y.md` | Accessibility — axe-core, ARIA audits, WCAG compliance |
| `references/tech-visual-regression.md` | Visual regression — screenshot diffing, baseline management |
| `references/tech-core-web-vitals.md` | Core Web Vitals — LCP, CLS, INP via Lighthouse CI |
| `references/quality-cross-browser.md` | Cross-browser — Safari/Firefox compat checklist |
| `references/flow-ui.md` | UI testing workflow — browser automation, auth, reporting |

Use `{skill:hc-browser}` for interactive browser sessions and screenshot analysis. Use `gemini` CLI for describing UI issues from screenshots.

## When NOT to Use

- Tests failing due to a code bug → `{skill:hc-debug}` to investigate, then `{skill:hc-fix}` to fix
- STRIDE/OWASP security audit → `{skill:hc-security}`
- Complex test failure analysis → activate `{skill:hl-reasoning}`

## Workflow Position

**Follows:** `{skill:hc-cook}` — test after implementation
**Follows:** `{skill:hc-fix}` — test after bug fix
**Precedes:** `{skill:hc-review}` — review after tests pass
**Related:** `{skill:hc-cook}`, `{skill:hc-fix}`

## References

| File | Content |
|------|---------|
| `references/flow-execution.md` | Test execution per framework, coverage analysis, build verification |
| `references/quality-report.md` | QA report template and formatting guidelines |
| `references/tech-playwright.md` | Playwright e2e testing — selectors, fixtures, parallel, sharding |
| `references/tech-k6.md` | k6 load testing — scripts, thresholds, stress tests |
| `references/tech-a11y.md` | Accessibility testing — axe-core, WCAG, manual checks |
| `references/tech-visual-regression.md` | Visual regression — screenshot diffing, baseline management |
| `references/tech-core-web-vitals.md` | Core Web Vitals — LCP/CLS/INP measurement, Lighthouse CI |
| `references/quality-cross-browser.md` | Cross-browser and responsive testing checklist |
| `references/flow-ui.md` | UI testing workflow — browser automation, auth injection, reporting |
