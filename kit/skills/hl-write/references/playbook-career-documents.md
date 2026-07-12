# Career-Documents Playbook — Resume/CV · Cover Letter

Two variants: **Resume/CV** (reverse-chronological default, with an academic-CV sub-variant inline) and
**Cover Letter**. **Pipeline inversion — the user IS the source:** `research-before-write` (`SKILL.md:44`) is
normally satisfied by ingested references or delegated research; here it is satisfied by the user's own career
facts, collected at Recon into `research/` as a facts inventory (roles, dates, metrics, skills, contact info).
Every bullet in the resume and every example in the cover letter traces to that inventory — never to a
plausible-sounding number the model supplies on its own.

**W1b asymmetry (vs. marketing):** a user is authoritative about their own work history — no third-party-consent
flag is needed for a career facts inventory, unlike a marketing testimonial, where the user is NOT authoritative
that a third party consented to an endorsement. Same pipeline inversion (user-supplied `research/`), opposite
trust model: here the user's word is ground truth; there it is not.

## Track

Short-form. Unit = one document (resume/CV or cover letter). An unbounded academic CV may split into one Build
unit per section (Publications, Grants, Teaching, Service) if length warrants — still short-form, no bible.

## Recon: Facts Inventory

Recon collects the user's career facts into `research/facts-inventory.md` (or equivalent) before Draft begins:
roles, employers, dates (with months), quantified outcomes already known to the user, skills actually held,
education, contact info, and (for academic CV) publications/grants/teaching/service history. This inventory IS
the research-before-write source for this genre — no web research substitutes for it.

- **W9(i) — `--auto` halt:** if Recon finds no user-supplied facts inventory and none can be elicited (`--auto`
  disables the interactive follow-up), **halt** with `facts inventory required — cannot author achievements
  without source facts` rather than proceeding — proceeding would force the model to invent the metrics the top
  guardrail below forbids.
- **W16 — PII action (not a warning):** the workspace holds the user's personal contact info (name, phone,
  email, address). Recon **adds the workspace path to the project's `.gitignore`** if the target is a git repo;
  if the target is not a git repo, Recon explicitly tells the user the workspace holds personal contact info and
  is untracked. This is an action taken at Recon, not a preference the user must remember to set later.

## Variant: Resume / CV

**Skeleton (reverse-chronological, default):** Contact → Summary → Skills → Experience (reverse-chronological,
XYZ-formula bullets) → Education. Single-column, standard section headers — no tables, graphics, columns, or
icons (ATS constraint, below).

**Academic CV (inline sub-variant, NOT a separate file):** same Contact/Summary skeleton, but Experience is
replaced/extended with reverse-chronological-by-category sections: Publications → Grants → Teaching → Service.
Unbounded length — a career-long CV grows continuously and is not compressed to fit a page count. This is a
structurally distinct document from the resume (different sections, no page cap), sharing only the same
facts-inventory sourcing and review criteria — not a "long resume."

**VN fresh-graduate ordering rule (moderate confidence — commercial CV-builder sources, not an official
standard):** fresh graduates put Học vấn (Education) before Kinh nghiệm (Experience); once the candidate has
1–2 internships, Experience moves first. Conditional ordering on the same skeleton, not a distinct document.

**XYZ bullet formula:** "Accomplished [X], measured by [Y], by doing [Z]." X = the accomplishment, Y = a number
(%, $, count, time) — the reviewable slot, Z = the method. **The Y slot is never invented:** if the facts
inventory has no verified number for a bullet, either write it qualitatively (no fabricated metric) or ask the
user for the missing number — never backfill a "reasonable-sounding" percentage.

**ATS constraints:** single-column layout; no tables, graphics, multi-column layouts, or icons; standard section
headers (Contact/Summary/Skills/Experience/Education); JD-keyword mirroring limited to skills the user actually
claims. 1 page for <5 years experience; 1–2 pages for 5–10+ years, capped at 2 — no 3-page industry resumes.
**Out of scope:** exact `.docx`/PDF ATS-safety (rendering, font embedding, parser compatibility) — the markdown
draft respects the single-column/no-graphics constraint structurally; producing a validated ATS-safe binary file
is outside this markdown pipeline's scope.

**Mandatory evidence:** every bullet's X (accomplishment) and Z (method) trace to a role/task in the facts
inventory; every Y (metric) traces to a number the user supplied, or is explicitly omitted/flagged for the user
to provide. Academic-CV entries (publication title, venue, year, grant name/amount) trace to the same inventory.

**Fabrication risks:** invented or backfilled Y-slot metrics (the sharpest risk — plausible-sounding percentages
a model might supply to "complete" the formula); fictional employers, titles, or certifications; skills added
purely to mirror JD keywords without the user having claimed proficiency; gaps rewritten as a manufactured
narrative instead of stated plainly.

**Length:** resume 1 page (<5 yrs) / 1–2 pages (5–10+ yrs, cap 2). Academic CV: unbounded, sectioned.

**Unit:** one Build unit = the whole resume, or one section (Experience, Education, or one academic-CV category)
for a long academic CV.

## Variant: Cover Letter

**Skeleton (4 paragraphs, 250–400 words total):** Hook (50–75w — role + specific value/interest) → Evidence
(100–150w — 2–3 JD-matched examples: did X → outcome Y → relevance to this role) → Company-fit (1–2 sentences)
→ Close (30–50w — availability + a clear next step).

**Anti-pattern:** do not rehash resume bullets verbatim — the cover letter's job is *why this company/role*, the
resume's job is *what you did*. Repeating a resume bullet word-for-word wastes the letter's limited word budget
rather than reinforcing it.

**Mandatory evidence:** every Evidence-paragraph example (X → Y → relevance) traces to the same facts inventory
as the resume — no example invented for the letter that does not also exist in the user's facts; the Y slot
follows the identical never-invented rule as the resume's XYZ bullets.

**Fabrication risks:** an invented example not present in the facts inventory; a fabricated or overstated
availability/next-step claim; a company-fit claim not grounded in the job posting or user-supplied company
research.

**Length:** 250–400 words, 3–4 paragraphs.

**Unit:** one Build unit = the whole letter.

## Review Criteria (priority order, both variants)

1. Every quantified claim traces to the facts inventory in `research/` — no invented numbers, ever.
2. Tense consistency — past tense for past roles, present tense for the current role.
3. Zero first-person pronouns (I/my) anywhere in bullets or letter body.
4. JD-keyword alignment mirrors only skills the user actually listed in the facts inventory — never added
   purely to match a job description.
5. Gaps stated in ≤2 lines, months included (year-only reads as concealment), consistent across resume and
   cover letter — never a manufactured cover narrative.
6. Cover letter does not rehash resume bullets verbatim.

**Hard mechanics (unanimous convention, non-negotiable):** past tense for past roles, present tense for the
current role; NO first-person pronouns (I/my) in resume bullets or CV entries.

## Anti-Fabrication Guardrail

> **Required — facts-inventory-first (editor-enforced — fact-check: every bullet's claim must trace to the
> facts inventory in `research/`):** every claim in a resume, academic-CV entry, or cover-letter example traces
> to the user's Recon facts inventory. The Y (metric) slot of an XYZ bullet is never invented — if no verified
> number exists, omit the quantification or ask the user. This is the single highest-leverage anti-fabrication
> rule for this genre pair; any number the model supplies that the user did not provide is fabrication, full
> stop, including a "reasonable-sounding" backfilled percentage.

> **Required — no-unclaimed-skills (generation-time — the editor cannot know which skills the user truly holds
> beyond the inventory; this is Recon/writer guidance):** JD-keyword mirroring is limited to skills the user
> listed in the facts inventory. Adding a skill or tool purely to match job-description language, without the
> user having claimed proficiency, crosses from tailoring into misrepresentation.

> **Required — honest-dates (editor-enforced — fact-check: dates trace to the inventory — plus generation-time
> for the ≤2-line/months framing):** employment gaps are stated in ≤2 lines, with months (not year-only, which
> reads as concealment), consistent across resume and cover letter — never rewritten into a manufactured cover
> narrative. Untruthful dates are a firing-risk, not a style choice.
