# Kit Content Token Overhead

> Honest numbers for HailyKit's own recurring context cost — inspired by the discipline in `juliusbrussee/caveman`'s `HONEST-NUMBERS.md`: publish where a change wins and where it doesn't.

## What actually gets injected, and when

| Cost class | Content | When it's paid |
|---|---|---|
| One-time cacheable prefix | `kit/rules/*.md` | Claude Code auto-loads `~/.claude/rules/` once; a 5-minute-TTL reminder hook (`haily-rules.cjs`) re-injects a **path pointer**, not the file body |
| Recurring per session, claude only | `kit/standards/*.md` | 1–3 files injected on demand per detected stack (`context.cjs`) |
| Recurring per session, all providers | Skill `description:` frontmatter | Every session's skill list |

Rules are cheap on a per-session basis because they're a cached prefix, not a re-sent payload. Standards and skill descriptions are the two classes that actually recur.

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

Installed rules are post-resolution, not source bytes. `kit/rules` contains 160 `{skill:...}` refs and 0 `{agent:...}` refs. For the claude provider, `{skill:hc-x}` resolves to `/hc-x` (`merger.ts`) — this **shrinks** installed rules by roughly 7 bytes per ref (~1.1KB total here), on top of the source-level numbers above. `{agent:X}` resolves to a much longer sentence (`` Delegate to a **X** subagent — use `Task(subagent_type="X")`. ``), but that tag never appears in `kit/rules` — it lives in skill reference docs, which this measurement does not cover. Do not assume source-byte savings equal installed-byte savings without checking which ref types are actually present.

## What this does NOT save

- Skill and agent body prose (deliberately out of scope — wording precision matters more there than a few hundred bytes; see `scripts/compress-kit-prose.mjs` module header)
- Tool-call results injected into a running session
- The user's own prompts and file context, which dominate a real session's token spend

Session-level savings are always smaller than any single-class number above, because input context — not kit content — is most of what a coding agent reads per turn.

## Verify yourself

The only fully honest test is an A/B: run comparable sessions with and without this change and compare your provider's own usage page. Re-run `node scripts/measure-kit-overhead.mjs` after any future kit edit to get current numbers — this page's table is a snapshot, not a live figure.
