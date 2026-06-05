# Red Team Review

Adversarially review a draft plan by spawning parallel reviewer subagents, each with a different hostile lens. The goal is to find fatal flaws before implementation begins.

## Plan Resolution

1. If `$ARGUMENTS` provided → use that path
2. Else check `## Plan Context` in injected context → use active plan path
3. If no plan found → ask user to specify path or run `{skill:hc-plan}` first

## Process

### Read Plan

Read the full plan directory:
- `plan.md` — overview, phases, dependencies
- All `phase-XX-*.md` files — full content, not just headers

### Scale Reviewer Count

| Phase count | Reviewers | Personas assigned |
|-------------|-----------|-------------------|
| 1–2 phases | 2 | Security Adversary + Assumption Destroyer |
| 3–5 phases | 3 | + Failure Mode Analyst |
| 6+ phases | 4 | + Dependency Trap Hunter |

**Personas** (from `references/review-lenses.md`):

| Persona | Hostile lens | Targets |
|---------|-------------|---------|
| **Security Adversary** | Assumes every external input is malicious | Auth gaps, injection paths, trust-boundary violations, data leaks |
| **Assumption Destroyer** | Rejects every unstated premise | "obvious" conventions, missing edge cases, implicit env assumptions |
| **Failure Mode Analyst** | Every integration point will fail at the worst moment | Network partitions, DB unavailability, timeout cascades, partial writes |
| **Dependency Trap Hunter** | Cross-cutting concerns will conflict under load | Shared state, lifecycle mismatches, ordering assumptions, circular deps |

### Spawn Reviewers

Spawn reviewer subagents in parallel, each assigned one persona. Each reviewer:
- Reads the full plan
- Adopts the assigned hostile lens
- Produces findings: each finding has a title, severity (Critical/Major/Minor), evidence, and recommended fix

### Collect and Deduplicate

After all reviewers complete:
- Merge findings across reviewers
- Deduplicate identical findings (keep highest severity)
- Cap at 3 Critical, 5 Major, 5 Minor — surface the most important ones only

### Evidence Filter

Discard findings that:
- Cannot cite a specific plan claim, phase, or implementation step as evidence
- Are preferences or style opinions without functional impact
- Duplicate a finding already in the plan's Risk Notes

### Adjudicate

For each surviving finding, classify:
- **Accept:** finding identifies a real gap; revise the plan
- **Reject:** finding is based on a misread or already addressed elsewhere; document why
- **Defer:** finding is valid but out of scope; add to Risk Notes for the relevant phase

### Checkpoint

Present adjudicated findings to user via `AskUserQuestion`:
- Show: accept list (plan will be revised), reject rationale, defer list
- User can reclassify any finding before plan is updated

### Apply to Plan

For each accepted finding:
- Update the affected phase file (add/revise steps, success criteria, or risk notes)
- Add a `## Red Team Review` section to `plan.md` summarising findings and resolutions

### Consistency Sweep

After all edits, run a fast scan across the plan to catch stale references introduced during revision. Spend ≤5 minutes.

Check for:
- File paths in `## Related Files` sections that were renamed or removed by an accepted finding
- Symbol or function names that a finding renamed — grep to confirm updated everywhere in the plan
- Phase dependency numbers (`dependencies: [N]`) still referencing valid phase numbers
- Feature/component names that changed during adjudication but weren't updated in all phases

Tag any stale claim `[STALE: reason]` and list in the output summary. If clean: "Consistency: OK".

## Output

After red-team completes, suggest next step:

```
Red team complete. Critical: N | Major: N | Minor: N | Consistency: OK|N stale
Suggest: {skill:hc-plan} validate {plan-path}
```
