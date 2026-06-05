---
name: hl-log
description: "Write a concise session log to .agents/logs/ — decisions made, lessons learned, next steps."
when_to_use: "Invoke after significant work sessions (implement, fix, ship, brainstorm) to record decisions and lessons for future reference."
user-invocable: true
argument-hint: "[topic or focus area]"
metadata:
  category: thinking
  keywords: [log, session, decisions, lessons, record, journal, reflection]
---

# Log — Session Record

Write a concise technical log entry about this session. Stored project-locally in `.agents/logs/` — easy to browse, gitignored, team-accessible.

## Output Location

```
.agents/logs/YYMMDD-HHMM-{slug}.md
```

`YYMMDD-HHMM` = date/time from `date +%y%m%d-%H%M` · `slug` = kebab-case topic (e.g. `260531-1430-skill-catalog-refactor.md`)

Create `.agents/logs/` if it doesn't exist.

## What to Capture

Signal only — skip anything obvious from the code or `git log`:

| Category | What to write |
|----------|--------------|
| **Decisions** | Architecture choices, trade-offs made, options rejected and why |
| **Changes** | Major things that changed and the reasoning behind them |
| **Lessons** | What worked, what didn't, what to watch out for next time |
| **Next steps** | Deferred work, follow-ups, open questions |

## Entry Format

```markdown
# {date} — {topic}

## What happened
[1-3 sentences summarizing the session work]

## Decisions
- [decision]: [why this over alternatives]

## Lessons
- [what worked / what to avoid]

## Next steps
- [deferred or follow-up tasks]
```

Keep under 30 lines. If nothing significant: skip writing the entry.

## Workflow Position

**Follows:** `{skill:hc-cook}`, `{skill:hc-ship}`, `{skill:hc-fix}`, `{skill:hc-review}`, `{skill:hc-optimize}`, `{skill:hc-cop}`, `{skill:hc-security}` — after implementation, review, optimization, porting, or security audit work where no persistent record was auto-generated.
**Terminal skill** — no typical successor.
