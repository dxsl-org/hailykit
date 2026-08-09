# Rules — Review/Audit + Comments + Self-Decision

## 1. Verified Decisions Are Sticky

- Once verified by source, test, or experiment, mark it: `verified by {file:line}` or `verified by test {name}`.
- Audit or red-team pushback alone is not enough to reverse. Reverse only when the audit adds a new issue or the context changed.
- After verification, prune stale risk rows and unresolved questions.
- If audit contradicts a verified call, surface both: `audit says X, but Y is verified by {source}`. Do not silently flip.

## 2. Check the Real Threat Model

Before applying a "too narrow / too loose / risky" finding:

1. Identify what the code actually stores or protects.
2. Walk the flagged scenario through that threat model.
3. Split real risk from abstract worry. Real -> fix. Non-real -> document. Borderline -> ask.
4. Look for the missed failure mode; it is often adjacent to the flagged one.

Anti-pattern: widening checks because they sound safer without tracing the bad outcome.

## 3. Guard Confirmed User Decisions

**NEVER silently reverse decisions the user has already confirmed.**

Before cutting or changing anything from audit:

1. Trace whether the user explicitly chose it.
2. Categorize it:
   - Safe to apply: Claude-added items the user never confirmed.
   - Must confirm: user-picked thresholds, scope, library, schema, phase, feature include/exclude.
   - Never auto-reverse: business decisions, compliance, pricing, timing, scope boundaries.
3. Surface reversals with the original choice, audit reasoning, trade-off, and an explicit keep/change/hybrid ask.
4. Document drift with reason plus confirmation trail.

If unsure whether a cut reverses intent, ask.

## 4. Scout First, Then Ask

For anything grep/read can answer:

1. Scout live code first.
2. State confidence.
   - `>= 85%` -> answer with `path:line`.
   - `< 85%` -> ask.
3. Ask only for ambiguity, real source conflict, user judgment, or high-reversibility risk.

Good pattern: `verified at file:line, confidence 95%, applying X`.

## 5. No Plan References In Code Or Artifact Names

Do not reference phase numbers, finding codes, audit labels, or plan taxonomy in code comments, tests, migration names, or artifacts. Those labels drift; the reason for code must stay stable.

- Explain the why, not the origin.
- Migration filenames use domain slugs only.
- Test names describe the scenario, not the finding code.
- Commit messages describe the change, not the plan label.
- Plan refs belong in `.agents/.../phase-XX-*.md` and PR descriptions, not code.

Allowed: local symbols, RFC numbers, SQLSTATE, CVE IDs, durable issue numbers.
