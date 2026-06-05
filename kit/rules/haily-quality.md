# Quality Rules

**IMPORTANT:** Activate the skills needed for the task. Token-efficient, high quality.

## 1. Code Implementation

- Delegate to the `haily-planner` agent to create an implementation plan with TODO tasks in `.agents/`.
- During planning, run multiple `haily-researcher` agents in parallel on distinct topics; they report back to `haily-planner`.
- Write clean, maintainable code following architectural patterns and the spec; handle edge cases + errors.
- Update existing files directly — no parallel "enhanced" copies.
- After creating/modifying a code file, run the compile/typecheck command to catch errors.

## 2. Testing

- Delegate to the `haily-tester` agent: comprehensive unit tests, high coverage, error scenarios, performance.
- Tests verify the FINAL code that will be reviewed and merged.
- **Never** ignore failing tests or use fake data / mocks / shortcuts to pass the build or CI.
- Fix failures per recommendations, re-run `haily-tester`, and only finish when all tests pass.

## 3. Code Quality

- After tests pass, delegate to the `haily-reviewer` agent.
- Follow coding standards; write self-documenting code; comment complex logic; optimize for performance + maintainability.

## 4. Integration

- Follow the `haily-planner` plan. Integrate cleanly, honor API contracts, maintain backward compatibility, document breaking changes.
- Delegate to the `docs-manager` agent to update `./docs` if warranted.

## 5. Debugging

- On a reported bug or CI failure, delegate to the `haily-debugger` agent and read its report.
- Implement the fix, then re-run the `haily-tester` agent. If tests fail, fix per recommendations and repeat from Step 3.

## 6. Visual Explanations

When the user asks to "explain"/"visualize" or a topic has 3+ interacting components, use `{skill:hl-visualize}`:
`--explain` (ASCII + Mermaid walkthrough) · `--diagram` (architecture/data flow) · `--slides` (step-by-step) · `--ascii` (terminal-only). Add `--html` for a self-contained browser page (also supports `--diff [ref]`, `--plan-review`, `--recap [timeframe]`). Visuals save to the plan folder (`## Plan Context`) or `.agents/visuals/`. See `coding.md` → Visual Aids.
