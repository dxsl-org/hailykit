# Business Report Playbook — Business Plan · Market Research Report · Business/Technical Report

One skeleton, three named variants. All three share an evidence-backed, exec-summary-first, findings-to-recommendations mode — they differ only in which sections are mandatory and how deep the market-sizing evidence goes. báo cáo hành chính theo thể thức NĐ30 (cơ quan context) → `playbook-vn-administrative.md`.

## Shared Skeleton

Exec Summary (stands alone, skims via bolded claims) → Context/Scope → Methodology or Market Analysis → Findings/Analysis → Recommendations or Ask → Appendix. Each variant below names the exact section sequence for that document type.

## Track

All three variants default to the short-form track — this genre's evidence model (exec summary, findings, recommendations) doesn't need chapter-level canon tracking even when a draft runs long. If a draft's length grows past the norms below, keep it a single long document rather than switching to a chaptered long-form workspace.

## Variant: Business Plan

**Skeleton:** Exec Summary → Company/Problem → Market Analysis (TAM/SAM/SOM, competitors) → Product/Service → Org & Management → Marketing & Sales → Financial Projections → Funding Ask → Appendix.

**Mandatory evidence:** top-down TAM sized against a bottom-up SOM cross-check; named competitor comps; unit-economics assumptions bound to a source, never asserted from memory.

**Fabrication risks:** invented market-size figures; fabricated competitor claims; revenue projections stated as fact rather than labeled assumptions.

**Review criteria:**
1. Financials internally consistent — P&L, cash flow, and funding ask agree with each other
2. Market-sizing method disclosed (formula shown), not just a bare number
3. Differentiation claim is specific to this business, not generic category boilerplate
4. Funding ask matches the stated use-of-funds and milestones

**Length:** traditional plan 20–40 pages (~7,500–15,000 words); a Lean Canvas variant is 1 page — confirm which format the brief wants before drafting rather than defaulting to full length.

**Unit:** one Build unit = one skeleton section (Market Analysis, Financial Projections, etc. each close as a unit).

## Variant: Market Research Report

**Skeleton:** Objective/Scope → Methodology (sources, sample size, dates) → Market Definition & Sizing (TAM/SAM/SOM) → Segmentation & Customer Insight → Competitive Analysis → Findings/Implications → Limitations.

**Mandatory evidence:** 5–10 interviews or a ≥30-response survey; at least one indirect competitor or status-quo alternative; every source dated.

**Fabrication risks:** invented survey or interview data; phantom competitors; TAM/SAM/SOM numbers presented without a stated calculation path.

**Review criteria:**
1. Methodology and sample size are stated, not implied
2. TAM/SAM/SOM triangulated two independent ways
3. Sources are dated and cited
4. Limitations and bias are disclosed, not omitted

**Length:** no rigid industry standard exists for this genre — treat 10–25 pages (~3,000–8,000 words) as a working default, not a hard rule, and adjust to the brief's stated depth.

**Unit:** one Build unit = one skeleton section.

## Variant: Business / Technical Report

**Skeleton:** Executive Summary (Situation-Complication-Resolution) → Background/Scope → Methodology/Approach → Findings/Analysis → Recommendations (prioritized, actionable) → Conclusion → Appendices. Engineering-audience reports map Methods/Results directly onto Methodology/Findings (IMRaD-compatible) — confirm which tradition (consulting SCR vs. engineering IMRaD-style) the brief targets, since the two don't share one norm.

**Mandatory evidence:** every finding traceable to the stated methodology or data source; engineering variants keep the Methods section detailed enough to reproduce.

**Fabrication risks:** fabricated data or results; invented supporting citations; causal claims the described methodology cannot support.

**Review criteria:**
1. Exec summary stands alone and skims via bolded claims
2. Findings trace back to the stated method/data
3. Recommendations are prioritized and actionable, not a wish list
4. Every claim is sourced

**Length:** highly context-dependent — an internal memo runs ~5 pages, a board report 20+; there is no single norm, state the range the brief implies rather than assuming one.

**Unit:** one Build unit = one skeleton section.

## Anti-Fabrication Guardrail (all variants)

> **Required — cite-before-claim:** every statistic, market-size figure, or competitor comp binds to a source note in `research/` before Ship. TAM/SAM/SOM figures require a stated calculation path (formula plus cross-check), never a bare number. Unsourced claims get flagged for the writer to source or hedge, never silently invented — this is the single highest cross-genre fabrication risk researched for this skill.
