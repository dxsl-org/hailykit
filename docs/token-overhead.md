# Kit Content Token Overhead

> Honest numbers for HailyKit's own recurring context cost — inspired by the discipline in `juliusbrussee/caveman`'s `HONEST-NUMBERS.md`: publish where a change wins and where it doesn't.

## What actually gets injected, and when

| Cost class | Content | When it's paid |
|---|---|---|
| One-time cacheable prefix | `kit/rules/*.md` | Claude Code auto-loads `~/.claude/rules/` once per session |
| Recurring per turn, TTL-capped, main session | Rules/standards/paths/plan/naming/contextual block (`haily-rules.cjs` UserPromptSubmit hook) | Full block on first prompt per session+cwd scope, then suppressed for 5 minutes; contextual (keyword-matched) rules re-fire every matching prompt regardless of cooldown |
| Recurring per session, claude only | `kit/standards/*.md` | 1–3 files injected on demand per detected stack (`context.cjs`), folded into the block above |
| Recurring per session, all providers | Skill `description:` frontmatter | Every session's skill list |

Rules are cheap on a per-session basis because they're a cached prefix, not a re-sent payload. The `haily-rules.cjs` block, standards, and skill descriptions are the classes that actually recur.

> **Correction (2026-07-13):** the row above previously said the reminder hook "re-injects a path pointer, not the file body." That was wrong on two counts: the hook was calling `buildReminderContext` with the wrong argument shape and writing `[object Object]` to stdout since v1.0.0 (`93017b8`) — never a path pointer, never the file body, just an inert 16-byte string with no functional effect. The 5-minute TTL dedup existed in `context.cjs` but was never wired up either, so even a working hook would have re-injected the full block every turn. Both are fixed in the weak-model-lift-fixes wave (Phase 1); see the dedicated cost-class section below for the real, now-measured numbers.

## Measured (2026-07-03)

Reproduce with `node scripts/measure-kit-overhead.mjs` — before = last commit (`git show HEAD:<path>`), after = working tree.

| Cost class | Before (bytes / est. tokens) | After (bytes / est. tokens) | Delta |
|---|---|---|---|
| Rules (one-time cacheable prefix) | 27,192 / 6,798 | 27,566 / 6,892 | +1% |
| Standards (recurring, claude only) | 613,800 / 153,450 | 613,127 / 153,282 | 0% |
| Skill descriptions (recurring, all providers) | 7,856 / 1,964 | 7,825 / 1,956 | 0% |

Standards realistic exposure: 106 files, avg ~5.8KB each after compression. A session injects 1–3 of them (~1,450–4,340 tokens est.), never the full 613KB catalog.

**Rules grew, not shrank.** The compression pass (dropping articles/filler via `scripts/compress-kit-prose.mjs`) saved bytes, but this same change added a new `## Output Economy` section to `haily-coding.md`, and the net is a small increase. This is the honest result, not a rounding error — a compressor with no fixed floor can coexist with a file that gets bigger because new content was added. Reporting only the compressor's isolated effect would hide that.

**Standards and descriptions barely moved.** kit content is written tersely by mandate already (`docs/engineering-standards.md`), so there was little filler left to remove — matching the ~1–2% yield already observed when the compressor was first run in isolation, before other content additions.

## Post-Wave-2 Measurement (2026-07-07)

The 2026-07-03 table above predates the depth-tier plan (`--quick`/`--deep` standardization, `haily-judge`, exemplar injection, reasoning scaffolds, flywheel, assumption ledger, the evidence gate, and the haily-artifact wiring fix). Re-running `node scripts/measure-kit-overhead.mjs` after the full plan (both waves) lands, against the same `git show HEAD` baseline (v1.13.1):

| Cost class | Before (bytes / est. tokens) | After (bytes / est. tokens) | Delta |
|---|---|---|---|
| Rules (one-time cacheable prefix) | 27,566 / 6,892 | 28,907 / 7,227 | +5% |
| Standards (recurring, claude only) | 612,321 / 153,080 | 613,127 / 153,282 | 0% |
| Skill descriptions (recurring, all providers) | 7,825 / 1,956 | 8,025 / 2,006 | +3% |

**Rules grew +5% (+335 tokens est.), one-time cacheable cost.** `kit/rules/haily-domain.md`, `haily-workflow.md`, and `hailykit.md` gained routing/policy text for the depth axis and the new apex-judge model-tier category. This is a cached prefix, not a recurring per-session payload (see table at top of this doc) — the honest framing from the 2026-07-03 entry still applies: paid once, not per turn.

**Skill descriptions grew +3% (+50 tokens est.), recurring per session, all providers.** New `--deep`/`--quick` flag mentions in affected skills' frontmatter `description:` fields. This is the class that recurs every session regardless of which skill runs, so it is the number worth watching if it keeps climbing across future plans.

**Standards did not move (0%)** — this plan touched skill reference files (`references/*.md`) and hooks, not `kit/standards/*.md`, so the recurring-per-detected-stack class is unaffected.

See `## Subagent injection cost class` below for the `'think'`/`'reason'` runtime cost, which this script does not cover.

## Post-Weak-Model-Lift-Fixes Measurement (2026-07-13)

Re-running `node scripts/measure-kit-overhead.mjs` against this wave's working tree (base: `main@e257027`, same repo state as the Post-Wave-2 entry above plus the intervening hl-write/hl-research academic-genre commits, none of which touch `kit/rules`/`kit/standards`/skill `description:` fields):

| Cost class | Before (bytes / est. tokens) | After (bytes / est. tokens) | Delta |
|---|---|---|---|
| Rules (one-time cacheable prefix) | 29,952 / 7,488 | 30,376 / 7,594 | +1% |
| Standards (recurring, claude only) | 612,321 / 153,080 | 613,127 / 153,282 | 0% |
| Skill descriptions (recurring, all providers) | 8,291 / 2,073 | 8,291 / 2,073 | 0% |

**The +1% rules delta is a measurement artifact, not real content growth.** `git diff --stat kit/rules` is empty for this wave — zero lines changed. The gap comes from `core.autocrlf=true` on this Windows checkout: `git show HEAD:<path>` returns LF-normalized blob bytes, while `readFileSync` on the working-tree file returns CRLF bytes, inflating the raw byte count by ~2 bytes per line with no semantic difference. Verified per-file (`haily-domain.md`: 11,056 blob bytes vs 11,249 on-disk bytes). This is a pre-existing quirk of the script's `git show` vs `readFileSync` comparison on CRLF checkouts, not something this wave introduced — flagged here rather than silently reported as a content increase; a follow-up could normalize line endings before comparing bytes, but the script is outside this phase's file ownership.

**Standards and skill descriptions did not move** — this wave's file-ownership set (`kit/hooks/*.cjs`, `kit/contextual/*.md`, `docs/engineering-standards.md`, 6 `SKILL.md` bodies) touches none of `kit/standards/*.md` content or any `description:` frontmatter value.

**This script's 0%/+1% figures are NOT the wave's real story.** `measure-kit-overhead.mjs` only walks `kit/rules`, `kit/standards`, and skill `description:` frontmatter as static files — it has no visibility into `kit/hooks/*.cjs` runtime output or the new `kit/contextual/*.md` directory (a new on-demand-only injection source this wave adds, not yet covered by any script measurement). The actual token-relevant change is a previously-dead runtime injection coming back to life, measured directly below.

## Main-session injection cost class (revived — not covered by the script above)

`haily-rules.cjs` fires on every `UserPromptSubmit`. Before this wave it called `buildReminderContext` with the wrong argument shape (positional string instead of an options object) and wrote the resulting `[object Object]` to stdout — a 16-byte, functionally inert string, on every single prompt, since v1.0.0. No test covered this path. The dedup/TTL helpers `context.cjs` exports were never called, so even a working hook would have re-emitted the full block on every turn.

Phase 1 fixes both: the hook now emits `buildReminderContext`'s real `content` string, gated by a 5-minute TTL per session+cwd scope; contextual (keyword-matched) rules bypass the TTL and still fire every matching prompt per the hook's docstring contract (Phase 1 Deviation Log). Measured directly via manual smoke test (`echo '{"session_id":"...","prompt":"..."}' | node kit/hooks/haily-rules.cjs`), since this is runtime hook output, not a static file the measurement script walks:

| Turn | Prompt | Bytes | Est. tokens |
|---|---|---|---|
| 1st in scope, no contextual match | `"..."` (no trigger keyword) | 2,864 | 716 |
| 1st in scope, contextual match | `/hc-review the auth module` | 7,569 | 1,892 |
| 2nd in scope, within 5-min TTL, no contextual match | same prompt repeated | 0 | 0 |
| 2nd in scope, within 5-min TTL, contextual match | `/hc-review the auth module` repeated | 4,704 | 1,176 |

**This is the single most important number in the wave, and it is a genuine new per-turn cost — but it replaces a functional zero, not a smaller working payload.** Every default install has been paying nothing but 16 useless bytes for its rules/standards/paths/plan/naming injection since v1.0.0; this wave makes that injection real. Framing it as "overhead added" undercounts what was actually happening: weak-model sessions were silently missing rules, language/framework standards, path context, plan context, and naming conventions on every turn, with no visible failure. The 5-minute TTL caps the heavy block's steady-state cost to once per session+cwd per 5 minutes; only the contextual slice (0–4.7KB depending on keyword match) re-fires on every prompt inside that window, which is the accepted trade documented in Phase 1's Deviation Log rather than a full-block repeat.

**Not tuned down for this wave.** Per the Risk Assessment in phase-01 and phase-05, if this number proves alarming in practice (e.g. sustained multi-turn `/hc-review` sessions repeatedly paying the ~1,176-token contextual slice), the fix itself should not be reverted or silenced — a follow-up should narrow injection scope (e.g. TTL-gate contextual rules too, or trim per-file content), not resurrect the dead path.

## Subagent injection cost class (not covered by the script above)

`measure-kit-overhead.mjs` only walks `kit/rules`, `kit/standards`, and skill
`description:` frontmatter — it does not cover `kit/hooks/haily-subagent.cjs`
output, which is computed at runtime per `SubagentStart` event, not read from
a static file. Measured directly from `buildThinkSection`/`buildReasonSection`
(`kit/hooks/haily-lib/subagent.cjs`) with `HL_MODEL_TIER=thinking`:

| Section | Bytes | Est. tokens | Gate |
|---|---|---|---|
| `think` (Depth Directive) | 154 | 39 | `HL_MODEL_TIER` ∈ {thinking, medium, fast} |
| `reason` (Reasoning Contract) | 170 | 43 | same gate, same `JUDGMENT_AGENTS` rows |
| Combined | 326 | 82 | — |

Both sections are 2 lines each (4 lines combined), within the ≤5-line budget
from `phase-08-exemplar-injection-reasoning-scaffolds.md`. Cost is paid only
for judgment agents (`haily-planner`, `haily-reviewer`, `haily-debugger`,
`haily-brainstormer`) and only below `ultra` tier — `HL_MODEL_TIER=ultra` or
empty (unrecognized/non-Claude model) yields `[]` for both, i.e. zero added
cost on those sessions.

### `econ` section (Phase 11 — Agent Output Economy)

`buildEconSection` (`kit/hooks/haily-lib/subagent.cjs`) is the condensed Output
Economy reminder appended to every subagent's context, regardless of agent
type or `HL_MODEL_TIER` — unlike `think`/`reason` it is not tier-gated,
because concise reporting is a behavior contract, not a reasoning-budget
boost.

| Section | Bytes | Est. tokens | Gate |
|---|---|---|---|
| `econ` (Output Economy) | 144 | 36 | none — applied to all 24 `kit/agents/*.md` types |

**The trade this pays for:** the scout report backing this plan measured
45–80k-token subagent transcripts whose reports the caller never reads in
full. `econ` spends ~36 tokens per subagent call (paid every time, not
gated) to remind the agent of its own `## Report Contract` — mechanical
≤10 lines, discovery/research ≤40 lines, judgment ~5 lines/finding + verdict
header. A single judgment-agent report that would otherwise run 200+ lines
of narration collapsing to the budgeted shape saves far more than 36 tokens
back into the orchestrator's context; the reminder cost is fixed and small,
the report savings scale with how verbose the agent would otherwise have
been. This does not touch model-trace announcements (`haily-tracer.cjs`),
which remain full-cost, always-on, and unrelated to this trade.

## Ref-expansion caveat

Installed rules are post-resolution, not source bytes. `kit/rules` contains 174 `{skill:...}` refs (2026-07-13; was 160 at last measurement) and 0 `{agent:...}` refs. For the claude provider, `{skill:hc-x}` resolves to `/hc-x` (`merger.ts`) — this **shrinks** installed rules by roughly 7 bytes per ref (~1.2KB total here), on top of the source-level numbers above. `{agent:X}` resolves to a much longer sentence (`` Delegate to a **X** subagent — use `Task(subagent_type="X")`. ``), but that tag never appears in `kit/rules` — it lives in skill reference docs, which this measurement does not cover. Do not assume source-byte savings equal installed-byte savings without checking which ref types are actually present.

## What this does NOT save

- Skill and agent body prose (deliberately out of scope — wording precision matters more there than a few hundred bytes; see `scripts/compress-kit-prose.mjs` module header)
- Tool-call results injected into a running session
- The user's own prompts and file context, which dominate a real session's token spend

Session-level savings are always smaller than any single-class number above, because input context — not kit content — is most of what a coding agent reads per turn.

## Verify yourself

The only fully honest test is an A/B: run comparable sessions with and without this change and compare your provider's own usage page. Re-run `node scripts/measure-kit-overhead.mjs` after any future kit edit to get current numbers — this page's table is a snapshot, not a live figure.
