# Coding Rules

Activate the narrowest skill needed for each intent. Follow **YAGNI · KISS · DRY**.

## General

- **File naming:** kebab-case, descriptive — long name is fine if it lets an LLM understand file's purpose from name alone (via Grep/Glob) without opening it.
- **File size:** keep code files under 200 lines. Split into focused modules; composition over inheritance; extract utilities and service classes.
- **Real code only:** implement actual behavior — never simulate or mock to appear done.
- **Project contract:** follow code structure and standards in `./docs`.
- **Verification:** compile/typecheck each changed code file; handle edge cases, errors, and security boundaries.
- **Direct edits:** update existing files; never create parallel "enhanced" copies.

## Pre-commit / Push

- Lint before commit; run tests before push — never ignore failing tests to make the build/CI green.
- Keep commits focused on actual change.
- **NEVER** commit secrets (`.env`, API keys, DB credentials).
- Scan the commit messages from the recent commits to learn the message style.
  It can be "conventional commit" format or natural sentences with high-school spelling rules (no conventional prefixes).
- Clean professional messages, no AI references.

## Comments

- Comment the **contract, not code**: WHY, preconditions, invariants, non-obvious side effects.
- Never comment WHAT code does — good names already do that.
- Threshold: add comment only if removing it would confuse future reader.
- Async flows: document sequence contract (what completes before what, cancellation).
- Public API: always document params, return value, thrown errors.

## Output Economy

- No tool-call narration; no decorative tables or emoji in working output.
- Status updates between tool calls: ≤1 line each. **Model-trace lines are exempt** — the `🤖 [agent]: model` announcement is deliberate redundancy, never shortened, removed, or folded into the ≤1-line rule.
- Never dump raw error logs — quote shortest decisive line.
- Skip invented abbreviations (cfg/impl/req/res) — a tokenizer splits them same as full word, so nothing is saved and clarity drops. Standard acronyms (DB, API, HTTP) are fine.
- Drop filler, hedging, and pleasantries; keep technical terms, code, paths, and error strings exact.
- Subagent reports follow their own `## Report Contract` (`docs/engineering-standards.md` → Agent Report Contract) — finding/verdict first, no process narration, evidence as `file:line`.
- **Clarity override:** security warnings, irreversible-action confirmations, and order-sensitive multi-step instructions get full sentences — brevity never outranks safety.

## Language Standards

When writing specific language, follow its standards file in `standards/lang-<language>-standards.md` (and `framework-<name>-standards.md` where relevant). These are **auto-injected** by session-init hook when stack is detected — no manual load needed.
