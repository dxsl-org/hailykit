# Workflow Combos

Each `->` means "invoke the next skill after the previous step completes."

## Feature Development

```text
{skill:hl-brainstorm} "feature idea"
  -> {skill:hc-plan}
  -> {skill:hc-cook} <plan-path>
  -> {skill:hc-test}
  -> {skill:hc-review}
  -> {skill:hc-ship}
```

Fast variant:

```text
{skill:hc-plan} --quick "task" -> {skill:hc-cook} -> {skill:hc-ship}
```

Autonomous variant:

```text
{skill:hc-goal} "feature description" --auto
```

## Bugfix

```text
{skill:hc-scout} "auth flow"
  -> {skill:hc-debug} "symptom"
  -> {skill:hc-fix}
  -> {skill:hc-test}
  -> {skill:hc-review}
```

Shortcut:

```text
{skill:hc-fix} --auto "ci failing on tests"
```

## Risky Or Major Change

```text
{skill:hl-research} "topic"
  -> {skill:hl-brainstorm}
  -> {skill:hl-brainstorm} --debate
  -> {skill:hc-plan}
  -> {skill:hc-cook}
  -> {skill:hc-review}
```

## UI From Mockup

```text
{skill:hl-design} search.py --design-system
  -> {skill:hc-cook} screenshot.png
  -> {skill:hc-test} --web
```

## New Project Bootstrap

```text
{skill:hc-new} --auto "project description"
```

## AI Application Build

```text
{skill:hl-research} "agent framework comparison"
  -> {skill:hc-plan}
  -> {skill:hc-mcp-builder}
  -> {skill:hc-test}
  -> {skill:hc-review}
```

## Documentation

```text
{skill:hc-docs} init
{skill:hc-docs} update
{skill:hc-docs} summarize
{skill:hc-docs} extract <file.pdf>
{skill:hc-docs} llms
```

## Senior Dev Quick Start

```text
{skill:hc-git} analyze main..HEAD -> {skill:hc-review}
{skill:hc-spec} "feature description" -> {skill:hc-cook} <plan-path>
{skill:hc-debug} "symptom" -> {skill:hc-fix}
{skill:hc-plan} --resume "feature"
Task(subagent_type="haily-tech-analyst", prompt="audit src/ for P1-P2 debt")
{skill:hc-git} retro 2w --compare
```

## Session Wrap-Up

```text
{skill:hc-git} analyze
{skill:hl-log}
{skill:hc-git} retro
```
