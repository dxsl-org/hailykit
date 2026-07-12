# Marketing-Copy Playbook — Press Release · Landing Page · Email Sequence

Three short-form, advocacy-driven variants — all written on behalf of a company, not neutrally. Boundary:
"announce/promote X on behalf of a company" routes here (advocacy POV permitted, company-controlled
boilerplate, exec-solicited quotes); "report on X neutrally, for a general publication" routes to the news
article variant in `playbook-article.md`. Both share the identical anti-fabrication floor — advocacy relaxes
stance, never factual/attribution discipline.

## Track

All three variants default to the short-form track — none approaches the ~8,000-word long-form threshold.

**Recon note (landing page):** confirm traffic temperature (cold/warm/hot) before drafting — it sets the
page's length target (see Variant: Landing Page below), the one place this playbook rejects a fixed norm.

## Variant: Press Release

**Skeleton (fixed):** `FOR IMMEDIATE RELEASE` or embargo line + media contact block → Headline (sentence
case) → Dateline (`CITY, State —`, em dash; 8 states never abbreviated: AK/HI/ID/IA/ME/OH/TX/UT) → Lede
25–40 words (5W1H) → body in descending importance with ≥1 named-exec quote → Boilerplate ("About
[Company]," ≤100 words, reused verbatim across releases) → media contact repeat → `###`.

**Mandatory evidence:** every exec quote traces to a real, named person; boilerplate is consistent with
prior releases; dateline format is correct.

**Embargo:** a trust convention, not a technical lock — model it as metadata plus a note-to-editors line
(`EMBARGOED UNTIL [time/date] — NOT FOR PUBLICATION BEFORE THAT TIME`, restated in a "Note to Editors").
The pipeline cannot verify per-journalist compliance, so embargo is never an enforced lock.

**Fabrication risks:** invented exec quotes; boilerplate or lede claims stated without substantiation;
a lede that oversells significance beyond what the body supports.

**Review criteria:**
1. Lede covers 5W1H in 25–40 words
2. Body runs in strict descending-importance order, with ≥1 quote from a named, real exec
3. Boilerplate present, ≤100 words, consistent with prior releases
4. Dateline format correct (`CITY, State —`; the 8 never-abbreviate states spelled out)
5. Embargo line present as a note-to-editors, never an enforced mechanism, if applicable

**Length:** 300–500 words (AP-style consensus). Treat 300 as the floor, not an error.

**Unit:** one Build unit = the whole document — too short to chapter.

## Variant: Landing Page

**Skeleton:** Hero (headline + subhead + one promise + primary CTA, message-matched to the referral source)
→ Problem/agitation → Benefits-before-features → Social proof (named) → Objection handling (FAQ: price,
time, trust, complexity) → repeated CTA with friction-reducing microcopy ("No credit card required").

**Mandatory evidence:** social proof is named and real; every objection is addressed before the final CTA.

**Length is a Recon-stage decision, not a fixed count:** cold traffic (first ad click, no prior trust) →
long-form, carrying the full persuasion case unaided. Warm traffic (email list, repeat visitor) → short,
straight to the offer. Hot traffic (retargeting, already-convinced) → short-to-medium, reinforce rather than
re-pitch. Higher price or product complexity pushes length up regardless of temperature — the real failure
mode is irrelevant words, not word count itself.

**One conversion goal per page:** a single CTA, repeated above the fold and after each major section.
Competing CTAs ("Sign up" vs. "Learn more") measurably dilute conversion — never introduce a second goal.

**Fabrication risks:** fake or unnamed social proof (see `testimonial-real` guardrail below — this playbook's
top-ranked risk); an unsubstantiated superlative claim in the hero or benefits copy.

**Review criteria:**
1. One promise above the fold, message-matched to the referral source
2. Benefits (outcome-framed) precede features (mechanism-framed)
3. Every objection (price/time/trust/complexity) is addressed before the final CTA
4. CTA is singular and repeated, never competing with a second goal
5. Social proof is named and real, placed where doubt naturally arises

**Length:** set at Recon by traffic temperature — cold traffic runs long-form, warm/hot short-to-medium; not
a fixed word count.

**Unit:** one Build unit = one on-page section (hero, problem, benefits, proof, objections, CTA) — mirrors
the objection-by-objection way marketers actually edit these pages.

## Variant: Email Sequence

**Skeleton:** 3–7 emails (4–6 most common), spaced days apart (Day 1/2/4/6-style cadence is a common
example, not a mandate), each ~300 words, one CTA per email, subject line 30–50 characters.

**Mandatory evidence:** every value claim or stat traces to `research/`; no testimonial appears without a
real, consenting source (see guardrail below).

**Content mix:** ~80% value (help/teach/inspire) / 20% offer-pitch **across the sequence**, not per email —
a single-CTA email measurably outperforms a multi-CTA one (HubSpot: up to 371% more clicks), so the one-CTA
rule is per-email while the 80/20 mix is a sequence-level property.

**W7 — cross-unit coherence wiring:** an email sequence has no short-form pass that checks properties spanning
multiple units (no bible, no style-stats script, ConStory is fiction-scoped). Fix: at Draft, the writer
records sequence-scope beats in `outline.md` — the 80/20 value-to-pitch target, a no-repeated-hook rule
across emails, and the sequence's overall arc — as explicit outline beats, not prose narration. The
whole-work Verify Structural pass (structure-vs-outline, `review-passes.md`'s Whole-work Verify sweep)
then checks these beats mechanically, the same way it checks any other planned beat's presence and order.

**Fabrication risks:** an invented testimonial or stat in any single email (highest severity — see guardrail
below); a repeated hook or filler email inserted only to hit a sequence-length count.

**Review criteria:**
1. Sequence length 3–7 emails
2. One CTA per email
3. Subject line 30–50 characters
4. ~80/20 value-to-pitch ratio held across the sequence (checked against the `outline.md` sequence-scope
   beats, per the W7 wiring above)
5. No hook repeated across emails
6. No unsubstantiated superlative, invented stat, or testimonial in any email

**Length:** ~300 words per email.

**Unit:** one Build unit = one email — each is independently sent, tested, and measured.

## Anti-Fabrication Guardrail (all variants)

**Recon-gate note:** testimonials, superlative proof documents, and exec quotes are user-supplied into
`research/` — a partial pipeline inversion, the same shape as career-documents' facts-inventory. But a
source existing in `research/` is not proof an endorsement is genuine or that its subject consented; see
the consent warning below.

> **Required — testimonial-real (editor-enforced):** no invented customer quote, review, or testimonial
> reaches a draft — every one must trace to a real, consenting person's endorsement recorded in
> `research/`. The FTC's 2024 Trade Regulation Rule on Consumer Reviews and Testimonials (effective
> 2024-10-21) makes a fake or nonexistent-person review a federal violation, up to **$51,744 per violation**
> plus consumer restitution — the sole item in this playbook with a codified bright-line penalty.
> **Critical, not Major** — this claim class is a `review-passes.md` W1a load-bearing-claim carve-out, so an
> Unsourced testimonial is Critical and `--auto` halts on a fabricated-testimonial draft; no separate
> `--auto` halt item is needed for this genre. **Consent gap (generation-time):** the fact-check pass only
> confirms a source exists in `research/`, never that the endorsement is genuine or that its subject
> consented — flag any testimonial with unconfirmed provenance/consent as `[UNVERIFIED-TESTIMONIAL]` at
> generation time, mirroring vn-administrative's `[VERIFY:]` căn cứ placeholder. **Recon must warn the user**
> that testimonials/reviews must come from real, consenting people, and that the pipeline cannot verify
> identity or consent. **Asymmetry vs. career-documents:** there the user IS the authoritative source for
> their own work history; here the user is NOT authoritative that a third party said or consented to an
> endorsement — the two genres invert differently.

> **Required — claim-substantiated (editor-enforced):** no superlative or statistic ("#1", "best", "only",
> "fastest", or VN "nhất/duy nhất/tốt nhất/số một") reaches a draft without a cited, dated proof document.
> US: FTC Act §5 deception standard via 16 CFR 255 substantiation. VN: Luật Quảng cáo 2012 Điều 8 khoản 11
> (as amended by Luật 35/2018/QH14) plus Thông tư 10/2013/TT-BVHTTDL Điều 2 — requires a specific, dated
> proof document (a licensed org's market-research report, or a contest/exhibition certificate), valid one
> year; an implementing circular takes effect 2026-07-05. Do not cite a VN fine amount — the Nghị định
> 38/2021 penalty schedule is unverified (source 403-blocked); state only the substantiation-document and
> 1-year-validity requirement.

> **Required — quote-attributed (editor-enforced):** every press-release exec quote must trace to a real,
> named person recorded in `research/` — mirrors `playbook-article.md`'s `attribution-before-print`
> guardrail, applied here to the advocacy variant.

**Out of scope (light note, not a checklist):** CAN-SPAM (truthful headers, a physical postal address, a
working opt-out honored within 10 business days, up to $16,000 per violating email) is a separate legal
floor from this playbook's craft guardrails — mention it, don't build a full compliance checklist against
it. Spam-trigger words are a minor courtesy check at most; sender reputation, authentication, and engagement
rate dominate actual deliverability, so don't over-index the guardrail on word-list avoidance.
