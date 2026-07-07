# Hypothesis Panel (--deep)

Replaces a single investigation stream with 2–3 parallel `haily-debugger` streams, each mandated to falsify one candidate cause. Refines an existing investigation — the panel does not replace symptom routing; it only activates once the initial trace has produced a differential worth splitting across streams.

**Activation:** `{skill:hc-debug} [issue description] --deep`

## Differential Construction

Before spawning anything, build the differential from the evidence already gathered: 2–3 distinct, mutually exclusive candidate causes (e.g. data-shape mismatch, timing/race condition, stale cache/state, config drift). Each candidate must be falsifiable — state up front what evidence would disprove it. A differential with only one viable candidate does not warrant a panel; proceed with the normal single-stream path instead.

## Panel Assignment

Cap: **3 streams**, one hypothesis per stream.

- Never split one stream across two theories, never assign the same hypothesis to two streams.
- Each stream is a separate `haily-debugger` invocation carrying:
  - its one assigned hypothesis only — not the full differential, so competing theories don't anchor it
  - the shared evidence bundle collected so far (logs, stack traces, repro steps)
  - a falsification mandate: work to disprove the assigned hypothesis, not to confirm it
- Each stream applies the same evidence bar as normal debugging — no speculation, no shortcutting to a conclusion because the hypothesis "feels right."

> **Required — no cross-stream sharing:** streams run with no visibility into each other's progress or conclusions until every stream reports. Sharing conclusions mid-run collapses independence and produces false convergence.

## Convergence

Once all streams report a verdict (survived / falsified / inconclusive), spawn `haily-judge` with the streams' verdicts, evidence, and the resolution table below as the decision package to make the convergence call. If the ultra spawn is unavailable or errors, fall back to the session model with the notice `⚠ apex judge unavailable — verdict by session model` (best-effort: a skill cannot deterministically detect Task-spawn failure). Resolve against the existing confidence ladder (`references/confidence-signaling.md`) — the panel does not add a new tier:

| Outcome | Resolution |
|---|---|
| ≥2 streams converge on the same surviving cause | This **is** the ladder's "≥2 independent signal types agreeing" rule → **SUSPECTED escalates to PROBABLE** |
| Converged cause also has a hermetic/two-environment reproduction, and the losing hypotheses are eliminated by evidence | **CONFIRMED** — same bar as without a panel; convergence alone never reaches CONFIRMED |
| All streams falsify their own hypothesis (nothing survives) | Return to differential construction **once** with the panel's evidence merged in. Do not loop a second time — escalate to the user with what was ruled out and why |
| Streams diverge (no cause gets ≥2 votes — e.g. 3 streams surface 3 different survivors) | Do not average or arbitrarily pick one. Present the differential to the user |

**Divergence presentation** — for each surviving hypothesis, report: the stream's evidence for it, the falsification attempts that failed to rule it out, and what additional evidence would break the tie. Let the user pick the next falsification step or supply missing context (e.g. production access, a log source not available to the agent).

## Cost

Panel investigation runs at the shared `--deep` cost multiplier (`docs/engineering-standards.md` → Depth Tiers, 3–5× baseline) — bounded by the 3-stream cap so it never scales further with differential size. Reserve for cases where a wrong root cause is expensive to reverse: production incidents, data-integrity bugs, or a single-stream investigation that has stalled at SUSPECTED. `--deep` is always user-initiated or an explicit `haily.json` `deep.auto` opt-in — never triggered by inferring the issue "looks serious."

## Output

Each stream returns: hypothesis statement, falsification attempts made, verdict, supporting/disconfirming evidence. Merge into the standard debug report (`references/reporting-standards.md`) with an added `## Panel` section listing every stream's hypothesis and verdict, followed by the resolution row from the Convergence table above.
