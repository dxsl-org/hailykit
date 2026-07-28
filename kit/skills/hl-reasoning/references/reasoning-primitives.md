# Reasoning Primitives

Five moves that make a reasoning step checkable by someone who did not watch it happen. Shared vocabulary across `{skill:hl-reasoning}`, `{skill:hc-debug}`, `{skill:hc-review}`, and `{skill:hc-plan}` — each skill decides *when* to apply them; this file defines *what they mean* so the four do not drift into four dialects.

These name observable moves, not a required sequence. Applying one because it fits beats walking all five in order.

## Outcome Floor

State what must hold for the answer to be usable, before producing the answer. The floor is a property of the deliverable, not a promise about effort: "the migration must be reversible without data loss", not "I will think carefully about rollback".

The floor earns its place by being falsifiable. If it cannot hold, saying so is the deliverable — a stated impossibility is more useful than an answer that quietly violates it.

## Discriminating Observation

The single observation that most changes what you believe. When several explanations survive, prefer the check that splits them apart over the check that adds detail to the leading one.

A check that confirms what you already expect is worth little; a check whose two outcomes point at different causes is worth the most. Naming the discriminating observation is also how a stalled investigation becomes a next action instead of another opinion.

## Cheap Disconfirming Check

The lowest-cost attempt to prove yourself wrong. Ordered by cost, not by how likely it is to succeed — a five-second grep that could falsify the conclusion runs before a ten-minute reproduction that would only confirm it.

Cost includes risk: a check that mutates state is not cheap regardless of how fast it runs.

## Negative-Space Scan

What is absent that should be present. Missing error branch, missing index, missing test for the path that just changed, missing rollback, a config key referenced but never defined.

Absence does not announce itself in a diff, so it needs its own deliberate pass — reading what is on the screen will not surface it.

## Rollback Check

How the change is undone, established before it is made. Distinct from a test: tests say the change works, rollback says what happens when it does not.

Answer three things — what reverses it, what cannot be reversed (data written, messages sent, caches warmed), and how the need to reverse would be noticed. A change whose irreversible part is unnamed has not been rollback-checked.

## Relationship To Claim Provenance

The primitives produce claims; `docs/engineering-standards.md` → Claim Provenance labels them. A discriminating observation yields OBSERVED, the conclusion drawn from it is DERIVED, and an outcome floor resting on unread config is ASSUMED until the config is read.

## Note On Injected Procedure

The SubagentStart hook can inject a compact procedural form of these primitives for judgment agents below the top tier (`kit/hooks/haily-lib/subagent.cjs` → `buildReasoningHarness`). Skills own the vocabulary and the routing; the hook owns whatever runtime procedure text exists. Do not restate the hook's procedure inside a skill or an agent file — the duplication costs tokens on every spawn and drifts the moment one copy is edited.

Measured caveat, recorded because it constrains future edits: on the Phase 3/4 eval fixtures, injecting procedural text of this shape scored *below* an empty prelude on weak models (`.agents/260726-1042-weak-model-reasoning-harness/reports/phase-04-measured-result.md`). The primitives are defined here as shared vocabulary for skill authors and human readers; treating them as a proven quality lever for weak models is not supported by the measurement that exists.
