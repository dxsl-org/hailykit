---
name: hl-brainstorm
description: "Brainstorm solutions with structured trade-off analysis. Default mode auto-selects persona and edge dimensions from the problem context. Explicit persona flags for targeted consultation. --debate for adversarial multi-persona review. --edges for 12-dimension edge case analysis. --deep is an alias for --debate --edges."
when_to_use: "Invoke before choosing among unclear technical options, or to get an expert lens on a specific question."
user-invocable: true
argument-hint: "[topic] [--architect|--scientist|--social-scientist|--philosopher|--economist|--strategist|--creative-director|--manager|--devil] [--debate] [--edges] [--deep]"
metadata:
  attribution: "Multi-persona debate pattern adapted from autoresearch by Udit Goenka (MIT)"
  category: thinking
  keywords: [ideation, tradeoffs, debate, decisions, personas, scenario, edge-cases]
---

# hl-brainstorm — Solution Design

Default: auto-select persona + edge dimensions. Explicit flags override auto-selection.

## Usage

```text
{skill:hl-brainstorm} <problem>
{skill:hl-brainstorm} --[persona] <question>
{skill:hl-brainstorm} --debate "<proposal>"
{skill:hl-brainstorm} --edges "<feature>"
{skill:hl-brainstorm} --debate --edges "<proposal>"
{skill:hl-brainstorm} --deep "<proposal>"
```

| Flag | Behavior |
|---|---|
| *(none)* | Auto-select 1–2 personas + 3–5 edge dimensions |
| `--architect` | System structure and evolvability |
| `--scientist` | Empirical validation and measurement |
| `--social-scientist` | Human and org behavior |
| `--philosopher` | Logic consistency and systems thinking |
| `--economist` | Incentives, opportunity cost, resource allocation |
| `--strategist` | Long-term positioning and competitive dynamics |
| `--creative-director` | Vision and experience integrity |
| `--manager` | Team capacity, operations, blast radius |
| `--devil` | Adversarial premise challenge; no scope restraint |
| `--debate` | All 9 personas analyze independently → GO / CAUTION / STOP |
| `--edges` | 12-dimension edge sweep |
| `--deep` | Alias for `--debate --edges`; no separate machinery. If a persona flag is also given, the persona flag wins and note that `--deep` was overridden. |

Persona consultation (`--[persona]`): answer immediately through that lens — no 5-item discovery, no plan handoff.

Scope range rule: higher-level personas can zoom into lower-level concerns when relevant; lower-level personas cannot zoom out beyond their natural scope.

## Constraints

> **Required — recon-first, reuse-first (full mode only):** When no persona flag and codebase context matters, reuse session recon or the active plan `scout-report.md`; else reuse the most relevant root `.agents/*/scout-report.md`; else run `{skill:hc-scout} --quick`. Report 3–6 bullets, then proceed.

> **Required — no implementation:** Do not write code or invoke implementation skills until the user has approved a design.

## Process

### Default Mode (auto-detect)

| Problem signals | Auto-selected personas | Auto-selected edge dimensions |
|---|---|---|
| architecture, schema, migration, LLM/system structure | Architect (+ Scientist for data-heavy topics) | Scale, State Transitions, Data Integrity |
| auth, security, outage, failure | Manager + Scientist (+ Devil for incidents) | Authorization, Error Cascades, Timing |
| performance, latency, bottleneck | Architect | Scale, Timing |
| user, UX, adoption, team | Social Scientist + Creative Director | User Types, Environment |
| cost, ROI, strategy, positioning | Economist + Strategist | Business Logic, Scale, Integration |
| should we / worth it / tradeoff | Philosopher + Strategist | Compliance, Business Logic |

Output: persona analysis → relevant edge cases → recommendation.

### Full Brainstorm

Use when there is no persona flag and the scope needs discovery.

1. Recon: reuse scout or run `{skill:hc-scout} --quick`.
2. Capture 5 items before proposing: output, acceptance criteria, scope boundary, constraints, touchpoints.
3. Split if there are 3+ independent concerns.
4. Research with `{skill:hc-lookup}`, `{skill:hl-reasoning}`, `WebSearch`, `psql`, or `haily-planner`.
5. Present 2–3 approaches.
6. After approval, hand off to `{skill:hc-plan}` or stop if the user only wanted options.

## Personas

- **Architect** — system structure; finds coupling, interface, and structural issues
- **Scientist** — empirical evidence; finds untestable claims and missing metrics
- **Social Scientist** — human/org behavior; finds adoption and workaround risks
- **Philosopher** — logic/systems thinking; finds hidden assumptions and ambiguity
- **Economist** — incentives/resources; finds trade-offs and perverse incentives
- **Strategist** — long-term position; finds lock-in and strategic debt
- **Creative Director** — vision/experience integrity; finds incoherence and design smell
- **Manager** — team capacity/operations; finds maintenance and reliability gaps
- **Devil** — adversarial premise challenge; finds fatal premise flaws and radical alternatives

## --debate Mode

all 9 personas analyze independently. No edge sweep unless `--edges` is added.

```text
{skill:hl-brainstorm} --debate "<proposal>" [--files <glob>]
{skill:hl-brainstorm} --debate --edges "<proposal>"
{skill:hl-brainstorm} --deep "<proposal>"
```

Use before major features, significant refactors, and architecture changes. Skip trivial changes and pure dependency bumps with no API change.

Debate protocol:

1. Each persona analyzes independently.
2. Identify agreements (6+ personas align) and conflicts.
3. Weigh trade-offs by impact.
4. Produce verdict: **GO** · **CAUTION** · **STOP**.

STOP triggers: auth bypass · design incompatibility · query explosion · invalidating false assumption · no rollback · untestable hypothesis · systemic adoption blocker.

Apex verdict (tier-gated): when `HL_MODEL_TIER` ranks below `ultra`, hand step 4 to the `haily-judge` agent once per debate using the persona analyses, agreements/conflicts, and STOP triggers as rubric. If the tier is `ultra`, unset, or unrecognized, keep the verdict at session tier. If unavailable, fall back with `⚠ apex judge unavailable — verdict by session model`.

### Debate Output

`Debate Report` must include: Verdict, Agreements, Conflicts & Resolutions, Risk Summary, Recommendations.

## --edges Mode

Standalone 12-dimension edge case analysis. Can combine with `--debate`.

| # | Dimension | What to surface |
|---|---|---|
| 1 | **User Types** | guest/admin/banned/power/bot |
| 2 | **Input Extremes** | empty/null/max/unicode/injection |
| 3 | **Timing** | concurrency/race/timeout/retry storms |
| 4 | **Scale** | 0/1/1M/pagination edges |
| 5 | **State Transitions** | first use/abort/resume/crash |
| 6 | **Environment** | mobile/low CPU/no JS/proxy/locale |
| 7 | **Error Cascades** | DB/API/disk/network failure |
| 8 | **Authorization** | expired token/wrong role/CORS/CSRF/escalation |
| 9 | **Data Integrity** | duplicate/orphan/encoding mismatch |
| 10 | **Integration** | replay/version mismatch/third-party outage |
| 11 | **Compliance** | deletion/audit/PII exposure |
| 12 | **Business Logic** | zero/negative/coupon stacking/free tier |

Filter to relevant dimensions, skip irrelevant ones explicitly, and output severity as Critical/High/Medium/Low.

## Session Model

Judgment agents (`haily-planner`, `haily-implementor`, `haily-reviewer`, `haily-brainstormer`, `haily-debugger`, ...) inherit the session model. Mechanical agents stay capped at `model_max`. Depth tiers use `fast|medium|thinking|ultra` via `HL_MODEL_TIER`; see `docs/engineering-standards.md` → Depth Tiers.

## Workflow Position

**Follows:** `{skill:hc-debug}`, `{skill:hc-scout}`
**Precedes:** `{skill:hc-plan}`, `{skill:hl-write}`
**Related:** `{skill:hl-reasoning}`, `{skill:hl-research}`, `{skill:hl-context-engineering}`
**For a single top-tier ruling:** escalate the prepared decision to `{skill:hl-advisor}`; `{skill:hl-advisor} --as <persona>` reuses the personas above.
