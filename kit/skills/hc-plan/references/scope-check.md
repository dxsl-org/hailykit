# Scope Check

Confirm task boundaries before spending research cycles. Run before Research.

## Skip When

- Task description is unambiguous and under 20 words
- Task is clearly trivial (single file, config change, typo fix)
- User signals urgency: "just plan it", "quick", "I know what I want"

## Three Questions

### 1. What already exists?

Scan the codebase for code that partially or fully addresses the task:
- Existing utilities, services, or patterns that can be reused
- Similar features already implemented that could be extended
- If a full solution already exists: flag it — the plan may be unnecessary

### 2. What is the minimum change set?

Identify work that can be deferred without blocking the core goal:
- Features that are "nice to have" vs. required for the task to function
- Infrastructure that could be added incrementally after the core is working
- Out-of-scope concerns the user has mixed into the description

### 3. What are the primary risks?

Surface the top 1–3 risks before investing in planning:
- Unknowns that require a spike or proof-of-concept before planning
- Dependencies on external systems, APIs, or team decisions not yet resolved
- Technical constraints that could invalidate the proposed approach

## Checkpoint

Present findings via `AskUserQuestion` (header: "Scope Check"):

| Choice | Meaning | Action |
|---|---|---|
| **Proceed** | Scope confirmed, risks noted | Continue to Research with current scope |
| **Narrow** | Reduce to minimum viable | Re-confirm scope, then Research the narrowed version |
| **Expand** | More investigation needed | Activate `{skill:hc-scout}` first, or request more context |

Raise scope concerns here. After this Checkpoint, commit to the confirmed scope.
