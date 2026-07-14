---
name: hl-advisor
description: "Consult the top-tier advisor on one prepared decision — assembles a question package (context, options, the specific question, cited files) from the current session and returns a recommendation with rationale, risks, and rejected alternatives. Invoke only when the user explicitly types /hl-advisor. Do not auto-trigger from natural language — every call runs on the top tier and costs real money."
when_to_use: "Invoke only when the user explicitly types /hl-advisor to get a top-tier recommendation on one specific decision."
user-invocable: true
category: thinking
keywords: [advisor, consult, recommendation, decision, second-opinion, top-tier]
argument-hint: "[--as <persona>] <the decision or question to consult on>"
---

# hl-advisor — Top-tier advice on one prepared decision

Consult the apex `haily-advisor` agent for a recommendation on a single decision. This skill assembles a question package from the current session and relays the advice back — it does not draft, edit, or explore. Use it when a session on a lower-tier model needs one high-stakes call made well.

**Not `{skill:hl-brainstorm}`:** brainstorm explores breadth (multiple personas/options) at whatever tier the session already runs — cheap, and the model can invoke it on its own judgment. This skill forces one decisive recommendation from the `ultra` tier regardless of session tier — expensive, and only ever runs on your explicit typing. Reach for brainstorm to widen the option set; reach for this once the options are framed and you want the strongest available model's single call.

## Usage

```
/hl-advisor <the decision or question to consult on>
/hl-advisor --as <persona> <the decision or question>
```

A vantage point sharpens a decisive recommendation the same way it sharpens exploration — reuse `{skill:hl-brainstorm}`'s Personas table (Architect, Scientist, Social Scientist, Philosopher, Economist, Strategist, Creative Director, Manager, Devil) rather than naming the persona in prose; no new persona catalog here, no flag needed on hl-brainstorm's side. Omit `--as` for a general top-tier read.

Examples:

```
/hl-advisor should this cache be write-through or write-behind given the consistency needs in src/cache/*
/hl-advisor --as economist pick between optimistic-locking and a queue for the checkout race
/hl-advisor
```

The last form (no argument) prompts for the decision before proceeding.

## Constraints

> **Required — explicit-only:** Run only when the user explicitly types `/hl-advisor`. Never auto-trigger from natural language — every call runs at the top tier and costs real money.

> **Required — package-first:** Spawn the agent only with a complete question package (context summary, options under consideration, the specific question, cited file:line list). If session context is too thin to build one, ask the user before spawning — an ungrounded consult wastes an `ultra` call.

## Process

1. **Route** — read the argument as the decision to consult on; if it starts with `--as <persona>`, extract the persona and validate it against `{skill:hl-brainstorm}`'s Personas table (unknown name → ask which of the nine to use, do not invent a new one). If the remaining argument is empty, use `AskUserQuestion` to capture the specific decision and its candidate options.
2. **Assemble** — build the question package from session context: a context summary (naming the persona vantage point if `--as` was given, per `{skill:hl-brainstorm}`'s Personas table entry for it), the options/approach under consideration, the one specific question, and a cited file:line list the agent may read. Mirror the `haily-advisor` Input Contract.
3. **Consult** — spawn `Task(subagent_type="haily-advisor")` with the package. The agent runs at `ultra` and returns an advice block (Recommendation / Rationale / Risks / Rejected alternatives / Evidence).
4. **Relay** — return the advice block to the user substantially verbatim; do not act on it automatically.

## Fallback

If the `ultra` spawn errors or the model is unavailable to the account (locked, deprecated, quota-denied), fall back best-effort to the session model and prepend the notice `⚠ advisor unavailable — advice by session model`. Durable fix: pin `ultra` to an accessible model in `~/.hailykit/model-map.json` and re-run the installer.

## Workflow Position

**Related:** `{skill:hl-brainstorm}` — interactive multi-lens exploration at session tier, model-invocable on its own judgment; use it to widen options. Use `/hl-advisor` instead when the options are already framed and you need one top-tier recommendation on a single decision — explicit-only, never model-invoked, since every call runs at `ultra` and costs real money. `--as <persona>` borrows brainstorm's Personas table for the vantage point; it does not duplicate or replace brainstorm's persona mode. For a verdict on a pre-assembled candidate set inside a `--deep` workflow, the `haily-judge` agent adjudicates; `/hl-advisor` recommends, it does not rule.
