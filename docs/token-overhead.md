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
a static file. Measured directly from `buildReasoningHarness`
(`kit/hooks/haily-lib/subagent.cjs`).

**Default cost is zero.** The harness is off unless `haily.json` sets
`reasoningHarness.enabled: true`; a default install pays nothing for it on any
tier or agent. The figures below are what an opted-in repo pays:

| Tier | Session model | Bytes | Est. tokens | Budget |
|---|---|---|---|---|
| `fast` / `medium` | Claude family | 422 | 106 | 120 |
| `fast` / `medium` | non-Claude | 410 | 103 | 120 |
| `thinking` | Claude family | 237 | 60 | 80 |
| `thinking` | non-Claude | 225 | 57 | 80 |
| `ultra`, empty, unrecognized | any | 0 | 0 | — |
| any tier, opt-in absent (default) | any | 0 | 0 | — |

One 2-line section (`## Reasoning Procedure`) replaces the former `think` +
`reason` pair, which cost 326 bytes / 82 est. tokens across 4 lines. The
`thinking` tier gets a compressed form; the Claude-family rows carry the extra
`ultrathink:` keyword, which is withheld from other providers because it is a
Claude-specific extended-thinking trigger.

Budgets are asserted at runtime by
`cli/tests/haily-subagent-reasoning-harness.test.ts`, not by the static
measurement script. When enabled, cost is paid only for judgment agents
(`haily-planner`, `haily-reviewer`, `haily-debugger`, `haily-brainstormer`) —
routing is derived from the exported `JUDGMENT_AGENTS` list — and only below
`ultra` tier; `HL_MODEL_TIER=ultra` or an empty/unrecognized value yields `[]`.

The four judgment agents each carry one added claim-provenance line in their
`## Report Contract` (60–80 est. tokens per spawn). That line is unconditional —
it is report vocabulary, not a reasoning boost, so it does not follow the
`reasoningHarness.enabled` gate.

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

## Benchmark tie-in

The new effectiveness benchmark is the formal companion to this document: use `hailykit benchmark static` for source and installed-footprint snapshots, `hailykit benchmark hooks` for hook replay overhead, `hailykit benchmark plan` / `run` for live-equivalent workflow evidence, and `hailykit benchmark report` for normalized V2 artifacts. This keeps token-overhead observations in the same reporting surface as quality, safety, efficiency, and provenance metrics instead of treating them as a one-off script result.

For decisions, read `quality` and `efficiency` separately. A footprint win is only descriptive if provider identity, live telemetry, or pair completeness is missing; the benchmark report encodes that distinction instead of collapsing everything into one score.

## Phase 0+1 Measurement (2026-08-09)

Measured against immutable baseline `7441899962523f563ed287283bbc64bdd8b12316` with `node dist/bin.js benchmark static --base-ref 7441899962523f563ed287283bbc64bdd8b12316 --json` after the contextual compaction and inventory expansion in this wave. This run produced `manifestHash=66bfbfad62794cca603b49199837751b815b479c267e464a8b49d59a41225b51`, `rows=1227`; the manifest hash is run-specific because installed-snapshot timestamps participate in its identity.

| Surface | Class | Count | Normalized bytes | Normalized delta vs baseline | Notes |
|---|---|---:|---:|---:|---|
| Contextual Markdown | `contextual-rule` | 3 | 8,961 | -4,765 | Real recurring shrink on the cooldown/full-build contextual slice. |
| Hot skill references | `skill-reference-hot` | 98 | 433,853 | 0 | New static inventory coverage only; no content edits in this phase. |
| Cold skill references | `skill-reference-cold` | 221 | 1,446,663 | 0 | New static inventory coverage only; no content edits in this phase. |

Per-file contextual savings:

| File | Before bytes | After bytes | Delta |
|---|---:|---:|---:|
| `kit/contextual/orchestration-protocol.md` | 5,090 | 2,897 | -2,193 |
| `kit/contextual/review-audit-self-decision.md` | 4,704 | 2,631 | -2,073 |
| `kit/contextual/team-coordination-rules.md` | 3,932 | 3,433 | -499 |

No `kit/rules/*.md` or subagent `econ` text changed in this phase. `scripts/measure-kit-overhead.mjs` intentionally remains narrow and keeps its legacy table shape; Phase 0 extends benchmark static coverage instead of changing that script's cost classes. Hook contract proof now includes a same-prompt cooldown equivalence test, so the compacted contextual files emit identical contextual bytes whether they arrive through the first full reminder build or the cooldown-only path.

## Core Skill Batch Measurement (2026-08-09)

The first five-skill batch keeps frontmatter, invocation syntax, required callouts, workflow position, reference paths, and safety/evidence/rollback markers under `cli/tests/skill-prompt-contracts.test.ts`. Against baseline `7441899962523f563ed287283bbc64bdd8b12316`, normalized `skill-body` bytes fell from `81,261` to `64,391`: `-16,870` bytes, about `-4,218` estimated tokens (`-20.76%`).

| Skill | Before | After | Delta |
|---|---:|---:|---:|
| `hc-plan` | 13,084 | 9,476 | -3,608 |
| `hc-cook` | 15,518 | 12,493 | -3,025 |
| `hc-review` | 23,888 | 16,981 | -6,907 |
| `hc-fix` | 13,975 | 12,105 | -1,870 |
| `hc-scout` | 14,796 | 13,336 | -1,460 |

The static artifact has `rows=1227` and run-specific `manifestHash=1493947d5857a3fd68045160966b5359b5ddaed19ab8cd4480a4f7f98b1380ee`. These figures prove footprint reduction and contract-test parity, not live behavioral equivalence; a paired live A/B remains required for a quality claim.

## `hl-help` Progressive-Disclosure Batch (2026-08-09)

`hl-help` now keeps only discovery, prefix/routing, filter, and combo-entry contracts in its hot body. Normalized `skill-body` bytes fell from `29,537` to `4,630` (`-24,907`, about `-6,227` estimated tokens, `-84.32%`); the frontmatter-excluded body fell from `29,079` to `4,172`, and the file is now 105 lines instead of 634. Four cold reference files total `7,612` normalized bytes, so even body plus moved catalogs are `17,295` bytes smaller than the former monolith while routine invocation no longer pays for the catalogs.

The static artifact has `rows=1235` and run-specific `manifestHash=6dbe7f65eff9c5b357df4e8747d004a37ddb4257da16362fd8adbad2b7c7a5f9`. `cli/tests/hl-help-prompt-contract.test.ts` locks frontmatter, invocation syntax, routing/security distinctions, reference links, and the hot-body byte/line ceilings.

## Workflow Reference Batches (2026-08-09)

Phase 4 used two independently gated batches across `hc-plan`, `hc-cook`, `hc-review`, and `hc-fix`. Four normalized reference rows fell from `24,778` to `13,534` bytes: `-11,244` bytes, about `-2,811` estimated tokens (`-45.38%`).

| Reference | Before | After | Delta |
|---|---:|---:|---:|
| `hc-plan/references/task-management.md` | 5,904 | 2,807 | -3,097 |
| `hc-review/references/process-task-pipeline.md` | 5,629 | 2,814 | -2,815 |
| `hc-fix/references/task-orchestration.md` | 5,400 | 2,523 | -2,877 |
| `hc-cook/references/agent-invocations.md` | 7,845 | 5,390 | -2,455 |

The task-orchestration batch locks hydration, sync-back, fallback, dependency graphs, re-review caps, phase counts, ownership, failure, and finalization relations. The cook invocation batch locks agent spawn points, TDD context separation, deep/domain review, complexity thresholds, exemplars, finalization agents, parallel ownership, and tier routing. The final static artifact contains `1,235` benchmark observations with run-specific `manifestHash=c2729c2071312a0790e2d2f35ec231159b65c04aaf8d1c8541cc90a585624a77`. These remain static footprint and contract results, not live behavior-equivalence evidence.

## Cold Reference Library Batches (2026-08-09)

Phase 5 used three library-isolated batches. Eleven cold/on-demand references fell from `61,488` to `29,766` normalized bytes: `-31,722` bytes, about `-7,931` estimated tokens (`-51.59%`). This is storage and load-on-demand reduction, not recurring hot-path savings.

| Library | Files | Before | After | Delta |
|---|---:|---:|---:|---:|
| `hl-design` | 3 | 24,086 | 11,495 | -12,591 |
| `hc-mcp-builder` | 5 | 17,859 | 9,350 | -8,509 |
| `hl-write` | 3 | 19,543 | 8,921 | -10,622 |

The `hl-design` batch removes story-like design prose and redundant screenshot HOW while preserving dimensions, approval, accessibility, print, and canvas output constraints. The MCP batch preserves core/adapter ownership, transports, auth precedence, secret handling, deployment boundaries, and destructive-tool confirmation. The writing batch preserves routing, evidence/attribution floors, article publication integrity, academic structure, and citation verification. `hl-write`'s `flat_inline` declaration and inlined craft reference are unchanged; installer/provider tests pass.

The final static artifact contains `1,235` benchmark observations with run-specific `manifestHash=3b465824929f776da1ebcd0a720d47f321156a47a458812a4c3a850bd1c7a15d`. Static and contract evidence does not establish live behavioral equivalence.

## Final Consolidation (2026-08-09)

Across this plan, normalized source footprint fell by a net `81,896` bytes (about `20,474` tokens at the derived 4-bytes/token estimate). Do not read that as a per-request saving: it combines conditional contextual injection, invoked skill bodies, workflow references, cold libraries, and the new `hl-help` cold-reference offset.

Hot/conditional bodies fell by `46,542` bytes: contextual Markdown `-4,765`, five core skill bodies `-16,870`, and the `hl-help` hot body `-24,907`. Existing workflow/cold references fell by another `42,966` bytes, while four new `hl-help` cold references add `7,612` bytes and keep catalogs off its routine path.

Final artifacts: static `1,235` observations (`manifestHash=57b87c8ecc7e2390573177c2e44e5516b90f57d1933d4f1b42ae49617660ee05`) and hooks `16` observations (`manifestHash=3f7e6e4fa2db8acb84e6719d41b201c754a8ab58489c2242ef4e0d2ac19fffd9`). Full tests pass 628/628.

A schema-minimum live A/B then ran one fixture once per arm on verified `gpt-5.4-mini` (`manifestHash=fe1b47eeebf9cc49b232bca72b4bc6e9b7380c457f396148752450ec19c99ef3`). For that pair, treatment bytes fell 22.60%, input tokens 10.50%, and total tokens 10.21%; no tools, errors, or approvals occurred.

One additional raw-answer capture pair used the same fixture, model, and treatments. A reproducible eight-check workflow-contract rubric scored both arms `8/8`; across both pairs, candidate input tokens fell 10.50% and total tokens 10.36% on average. This is an exploratory behavior-retention PASS for one fixture, not a canonical quality decision. The canonical report remains `INCONCLUSIVE` because its rows have no evaluator evidence and are decision-ineligible; two pairs cannot establish latency, output-token, or general quality effects. Codex App Server emitted no observed USD cost, so the two `$0.10` values were reserve caps only.

## Agent prompt bodies

`kit/agents/*.md` are outside `measure-kit-overhead.mjs`; they are the recurring prompt bodies loaded for the selected subagent, not the shared rules/standards/skill-description classes above.

Fresh snapshot from `.agents/260808-2124-optimize-subagent-prompts/reports/final-agent-body-snapshot.json`: `89,005` bytes / `22,252` est. tokens down to `59,025` bytes / `14,757` est. tokens across 25 agents.

That catalog total is not a per-spawn bill. A spawn pays the chosen agent body plus the shared subagent reminder and the caller's runtime context, not the sum of all 25 bodies each time.

## Routing Rules Compression (2026-08-09)

`kit/rules/haily-domain.md` plus `haily-workflow.md` fell from `18,714` to `10,930` normalized bytes: `-7,784` bytes (`-41.59%`), about `-1,946` estimated tokens. The six-file rules layout is unchanged. Contract tests retain unique routes, review modes, spec gating, worktree setup, thinking utilities, and the separation between code security and authorized running-system operations.

This is a one-time cacheable-prefix reduction, not a per-turn saving. The deterministic single-pass evaluator added in the same wave removes the need for a separate raw-answer scoring call when a workflow fixture declares a complete local contract; no paid live run was performed for this implementation-only validation.

## UI and Monorepo Standards Compression (2026-08-09)

`kit/standards/framework-monorepo.md`, `framework-tailwind.md`, and `framework-shadcn.md` fell from `11,170` to `4,613` normalized bytes: `-6,557` bytes (`-58.70%`), about `-1,639` estimated tokens. This is detected-stack context, not universal per-request savings; it only applies when the hook injects these standards for a matching UI/monorepo workspace.

| Standard | Before | After | Delta |
|---|---:|---:|---:|
| `framework-monorepo.md` | 5,178 | 1,929 | -3,249 |
| `framework-tailwind.md` | 3,300 | 1,448 | -1,852 |
| `framework-shadcn.md` | 2,692 | 1,236 | -1,456 |

`cli/tests/standards-contracts.test.ts` locks the durable anchors for workspace detection, `workspace:*`, `^build`/`outputs`, affected/filter execution, remote-cache env names, Tailwind purge/theming/layer/a11y constraints, and shadcn ownership/theme/form/accessibility contracts. The batch passed `npm run pretest`, targeted contract tests, cross-reference validation, and `git diff --check`.

## Deploy and Browser Skill Compression (2026-08-09)

As a batch, `kit/skills/hc-deploy/SKILL.md` and `hc-browser/SKILL.md` fell from `13,075` to `6,418` normalized bytes: `-6,657` bytes (`-50.91%`), about `-1,664` estimated tokens. Each invocation loads one skill, so use the per-skill rows—not the combined batch total—to estimate a request's reduction. This is invoked-skill context, not universal per-request savings.

| Skill | Before | After | Delta |
|---|---:|---:|---:|
| `hc-deploy` | 6,860 | 4,042 | -2,818 |
| `hc-browser` | 6,215 | 2,376 | -3,839 |

The deploy body retains credential and scope boundaries, detect-first routing, live pricing verification, documentation fields, all platform references, and infrastructure escalation. The browser body retains public-page fallback limits, fresh snapshot references, read-only commands, and routing to debug/test workflows. `cli/tests/deploy-browser-skill-contracts.test.ts` locks these contracts and the byte ceiling. These figures prove footprint reduction and static contract retention, not live behavioral equivalence.

## DB and MCP Builder Skill Compression (2026-08-09)

As a batch, `kit/skills/hc-db/SKILL.md` and `hc-mcp-builder/SKILL.md` fell from `13,840` to `8,068` normalized bytes: `-5,772` bytes (`-41.71%`), about `-1,443` estimated tokens. Each invocation loads one skill, so the per-skill rows—not the batch total—describe request-level prompt reduction.

| Skill | Before | After | Delta |
|---|---:|---:|---:|
| `hc-db` | 7,792 | 3,988 | -3,804 |
| `hc-mcp-builder` | 6,048 | 4,080 | -1,968 |

`hc-db` retains datastore and access-layer routing, parameterization, pooling, migration/backup, Redis, and Supabase RLS contracts. `hc-mcp-builder` retains input/scope routing, workflow-first tools, bounded process testing, schemas/annotations, shared-core adapters, auth precedence, transport rules, registration, evaluation, and every reference path. `cli/tests/db-mcp-skill-contracts.test.ts` locks these markers and per-skill/batch byte ceilings.

The static artifact contains `1,235` observations with run-specific `manifestHash=78580f8f32b6bf9b9b705b63081b55423aaefbe5ce4a10b2841c5a9954a51de1`.

A two-fixture paired live semantic-contract smoke then ran once per arm on verified `gpt-5.4-mini` (`manifestHash=1bca300c20b6946695f3e1b764aee07e8417540ae00969b0b288fa0bcd8d9e6d`). Candidate mean input tokens fell `5.51%` and total tokens `6.63%`; the DB fixture changed from fail to pass, while MCP failed in both arms and reduced failed substring checks from five to two. No tools, errors, approvals, critical flags, raw answers, or observed USD cost were recorded. The canonical result remains `INCONCLUSIVE`: two pairs are underpowered and lack a frozen margin, complete calibration/provider footprints, and a private holdout. This is exploratory efficiency evidence plus one narrow DB semantic signal; MCP retention remains unproven, and neither general behavioral equivalence nor a latency claim is supported.

## Prompt Optimization Follow-up (2026-08-10)

The workflow evaluator now supports negation-aware `text_contracts`: each required contract declares acceptable expressions, failed IDs remain hashed, raw answers remain digest-only, empty contract sets are rejected, and five public MCP fixtures separate architecture, tool safety, auth/transport, bounded evaluation, and registration. This repairs the earlier exact-substring weakness but remains a deterministic heuristic; no new paid live run or behavioral-equivalence claim was made.

Four always-on generated-rule bodies fell from `17,255` to `12,718` normalized bytes: `-4,537` (`-26.29%`, about `-1,134` estimated tokens). `haily-quality.md` now owns delegation order, `haily-coding.md` owns implementation/output constraints, domain routing owns single-intent decisions, and workflow routing retains only multi-stage chains. Contract tests preserve quick/deep/migration routes, commit/push-only routing, security separation, and provider installation behavior.

| Always-on rules | Before | After | Delta |
|---|---:|---:|---:|
| coding + quality + domain + workflow | 17,255 | 12,718 | -4,537 |

`hc-ship` and `hc-cop` fell from `24,553` to `11,756` normalized bytes: `-12,797` (`-52.12%`, about `-3,199` estimated tokens). Release automation ownership, protected Git/tagging, CI/merge behavior, license-first classification, attribution, primary-source rewrite, and clean-room boundaries remain contract-tested.

| Skill | Before | After | Delta |
|---|---:|---:|---:|
| `hc-ship` | 12,964 | 6,406 | -6,558 |
| `hc-cop` | 11,589 | 5,350 | -6,239 |

`hl-write` was isolated because `craft-prose-antipatterns.md` is `flat_inline`. Its source hot pair fell from `37,362` to `17,932` bytes (`-52.00%`); the actual flat-provider bundle, including reference stubs, fell from `42,170` to `22,740` (`-19,430`, `-46.08%`). Tests retain genre collisions, evidence/citation floors, canon/ledger/import/style contracts, auto-mode halts, single-agent fallback, density ceilings, specificity, and fiction's separate brief/world/canon grounding.

Final static inventory: `1,235` observations, run-specific `manifestHash=1c783cea8bbd36faebe78da514b8f8f80120b038d11359b201e9eb5bea8b488c`. These are source/installed footprint and deterministic contract results, not live quality or latency evidence.
