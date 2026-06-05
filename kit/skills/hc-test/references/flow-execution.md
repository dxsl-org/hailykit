---
name: flow-execution
description: Test execution workflow — identify scope, run preflight checks, execute test suites per language/framework, analyze results, measure coverage, verify build.
---

# Test Execution Workflow

## Identify Scope

Determine what to test based on recent changes:
- New feature → full test suite + new test cases for the feature
- Bug fix → regression tests + targeted fix validation
- Refactor → existing test suite (no new tests unless gaps found)
- Coverage check → full suite with coverage flags

## Preflight Checks

Run syntax/type checks before tests to catch compile errors early:

```bash
# JavaScript/TypeScript
npx tsc --noEmit          # TypeScript check
npx eslint .              # Lint check

# Python
python -m py_compile file.py
flake8 .

# Flutter
flutter analyze

# Go
go vet ./...

# Rust
cargo check
```

## Execute Tests

### JavaScript/TypeScript

```bash
npm test                        # or yarn test / pnpm test / bun test
npm run test:coverage           # with coverage
npx vitest run                  # Vitest
npx jest --coverage             # Jest with coverage
```

### Python

```bash
pytest                                              # basic
pytest --cov=src --cov-report=term-missing          # with coverage
python -m unittest discover                         # unittest
```

### Go / Rust / Flutter

```bash
go test ./... -cover            # Go with coverage
cargo test                      # Rust
flutter test --coverage         # Flutter
```

## Analyze Results

Focus on:
- **Failing tests** — read error messages and stack traces in full before acting
- **Flaky tests** — intermittent pass/fail indicates race conditions or shared state leaks
- **Slow tests** — > 5s per test is suspicious; investigate bottleneck
- **Skipped tests** — verify skips are intentional, not hiding failures

## Coverage Analysis

Thresholds:
- Read from project config first: `jest.config.js` → `coverageThreshold`, `.nycrc` → `lines`/`branches`, `pytest.ini` → `--cov-fail-under`, `codecov.yml` → `coverage.status`
- Fallback when unconfigured: 80% line, 70% branch
- Prioritize critical paths: auth, payment, data mutations

Identify gaps:
- Uncovered error handlers
- Missing edge case branches
- Untested utility functions

## Build Verification

```bash
npm run build               # JS/TS production build
go build ./...              # Go
cargo build --release       # Rust
flutter build               # Flutter
```

Check for:
- Build warnings or deprecation notices
- Unresolved dependencies
- Production config correctness

## Quality Checklist

- [ ] All tests pass (zero failures)
- [ ] Coverage meets project threshold
- [ ] No flaky tests detected
- [ ] Build completes without errors
- [ ] Error scenarios tested
- [ ] Test isolation verified (no shared state)
- [ ] Test data cleaned up after execution
- [ ] Mocks/stubs properly configured
- [ ] Environment variables correctly set
