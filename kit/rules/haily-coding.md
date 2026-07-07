# Coding Rules

**IMPORTANT:** Activate the skills needed for the task as you go. ALWAYS follow **YAGNI · KISS · DRY**.

## General

- **File naming:** kebab-case, descriptive — long name is fine if it lets an LLM understand file's purpose from name alone (via Grep/Glob) without opening it.
- **File size:** keep code files under 200 lines. Split into focused modules; composition over inheritance; extract utilities and service classes.
- **Real code only:** implement actual behavior — never simulate or mock to appear done.
- **Follow `./docs`:** respect codebase structure and code standards documented there during implementation.

**Tools (use when needed):** `{skill:hc-lookup}` (latest library docs via context7) · `gh` (GitHub) · `psql` (Postgres debugging) · `gemini` CLI (describe images/video/docs) · `{skill:hl-design}` (brand assets + AI image/video/TTS/music) · `imagemagick` / `ffmpeg` CLI (edit media) · `{skill:hl-reasoning}` + `{skill:hc-debug}` (sequential analysis, debugging).

## Code Quality

- Read and follow code standards in `./docs`.
- No syntax errors; code must compile. Prioritize functionality + readability over strict style enforcement.
- try/catch error handling; cover security standards.
- Review with the `haily-reviewer` agent after every implementation.

## Pre-commit / Push

- Lint before commit; run tests before push — never ignore failing tests to make the build/CI green.
- Keep commits focused on actual change.
- **NEVER** commit secrets (`.env`, API keys, DB credentials).
- Conventional commit format; clean professional messages, no AI references.

## Code Implementation

- Clean, readable, maintainable; follow established architectural patterns and spec.
- Handle edge cases and error scenarios.
- **Update existing files directly** — do NOT create parallel "enhanced" copies.

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

## Visual Aids

Use `{skill:hl-visualize}` to explain complex logic or render diagrams: `--explain` (annotated walkthrough), `--diagram` (architecture/data flow), `--slides` (step-by-step), `--ascii` (terminal-friendly). Add `--html` for self-contained browser page. Visuals save to `{plan_dir}/visuals/` (from `## Plan Context`) or `.agents/visuals/`. For Mermaid syntax, use `{skill:hl-visualize} --mermaid`. See `quality.md` → Step 6.
