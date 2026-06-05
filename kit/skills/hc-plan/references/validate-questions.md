# Validate Questions

Framework for generating and recording validation questions before implementation begins.

## Question Categories

| Category | What to detect in the plan |
|---|---|
| **Architecture** | Approach, pattern, data model, API design, database choice |
| **Assumptions** | Claims using "will", "should", "expect", "default", "assume" |
| **Tradeoffs** | Alternatives considered, "vs", "either/or", explicit choices |
| **Risks** | Blockers, dependencies, failure modes, "might", "could fail" |
| **Scope** | MVP boundary, deferred work, "out of scope", "phase N" references |

## Question Format

Each question must have:
- 2–4 concrete options (not open-ended)
- One option marked "(Recommended)" based on plan context
- "Other" is always available implicitly

**Good question:** "How should auth tokens be stored?"
Options: `httpOnly cookie (Recommended)` | `localStorage` | `sessionStorage`

**Bad question:** "Is the auth approach correct?" (Yes/No, no options)

## Recording Format

Append to `plan.md` after each validation session:

```markdown
## Validation Log

### {YYYY-MM-DD}
Questions asked: N | Decisions confirmed: N

#### Questions & Answers

1. **[{Category}]** {full question text}
   - Options: {A} | {B} | {C}
   - **Answer:** {chosen option}
   - **Impact:** {why this changes the implementation}

#### Decisions

- {topic}: {choice} — {one-line rationale}

#### Phase Updates

- Phase N: {what changes and why}
```

## Generation Rules

- Surface implicit decisions the plan author made without documenting
- Prioritize questions where a different answer changes implementation significantly
- Skip questions where only one answer is technically viable
- 3–8 questions per session; fewer is fine for simple plans

## Phase Propagation

When an answer changes a phase, update that phase file directly — do not just record the answer in the log. Changes propagate to:

| Answer type | Update target |
|---|---|
| Requirements change | Requirements section |
| Architecture change | Architecture section |
| Scope change | Overview + Implementation Steps |
| New risk identified | Risk Notes |
