# Input Detection

Detect input type and flags before any other step.

## Detection Algorithm

```
FUNCTION detect(args):

  # Step 1: Extract flags
  flags = []
  IF args contains "--auto":  flags.add("auto")
  IF args contains "--tdd":   flags.add("tdd")
  firstArg   = firstPositionalArg(args)   # first token that is not a flag
  taskText   = remainingText(args)        # everything after firstArg (may be empty)

  # Step 2: Detect input type from first positional arg
  IF firstArg matches /\.(png|jpg|jpeg|webp)$/i:
    inputType = "layout-screenshot"
  ELSE IF firstArg matches /\.(mp4|webm)$/i:
    inputType = "layout-video"
  ELSE IF firstArg matches /^https?:\/\/(?:www\.)?figma\.com/i:
    inputType = "layout-figma"
  ELSE IF firstArg matches /^https?:\/\/(?:www\.)?framer\.com/i:
    inputType = "layout-framer"
  ELSE IF firstArg matches /\.md$/ AND fileExists(firstArg):
    inputType = "plan-path"
  ELSE:
    inputType = "task"
    taskText = args  # full input is the task description

  # Step 3: Override layout → task when intent signals non-layout use
  IF inputType starts with "layout":
    overrideWords = ["fix", "debug", "reference", "about", "regarding"]
    IF any(word in lowercase(taskText) for word in overrideWords):
      inputType = "task"  # image/video is context, not spec

  RETURN { inputType, flags, taskText }
```

## Input Types

| First argument | Input type | Workflow loaded |
|---|---|---|
| `*.png` / `*.jpg` / `*.webp` | `layout-screenshot` | `references/layout/flow-screenshot.md` |
| `*.mp4` / `*.webm` | `layout-video` | `references/layout/flow-video.md` |
| `https://figma.com/...` | `layout-figma` | `references/layout/flow-figma.md` |
| `https://framer.com/...` | `layout-framer` | `references/layout/flow-figma.md` |
| `*.md` (exists on disk) | `plan-path` | Execute existing plan |
| anything else | `task` | Full pipeline from scratch |

## Flags

| Flag | Effect |
|------|--------|
| `--auto` | Skip all human gates; auto-parallelize independent phases |
| `--tdd` | Behavioral modifier: write tests before each phase, verify after |

Flags are composable with any input type.

## Behavior by Input Type

| Input type | Research | Scout | Requirements gate | Plan gate | Test | Review gates |
|---|---|---|---|---|---|---|
| `task` | ✓ | ✓ | ✓ | ✓ | ✓ | Stops (unless `--auto`) |
| `task` + `--auto` | ✓ | ✓ | ✗ skipped | ✗ skipped | ✓ | Auto-approved |
| `plan-path` | ✗ | ✗ | ✗ | ✗ | ✓ | Stops (unless `--auto`) |
| `layout-*` | ✗ | ✗ | ✗ visual=spec | ✓ | ✓ | Stops (unless `--auto`) |

## Phase Dependency Analysis (`--auto`)

After haily-planner produces a plan (or when a plan-path is provided), analyze the phase graph:

```
FOR each phase in plan:
  IF phase.blockedBy is empty
  AND phase does not share file ownership with any running phase:
    → run in parallel (worktree isolation)
  ELSE:
    → run sequentially after its blockers complete
```

In **interactive mode**: if parallelizable phases are detected, present via `AskUserQuestion`:
> "Phase X and Phase Y are independent. Run them in parallel?"
> Options: "Yes — parallel" / "No — sequential"

In **`--auto` mode**: auto-parallelize without prompting. Log:
`✓ Phase analysis: N phases total, M can run in parallel`

## Conflict Resolution

When multiple signals exist, priority order:
1. Explicit flags (`--auto`, `--tdd`)
2. File extension detection (image/video)
3. Domain detection (figma.com, framer.com)
4. `.md` path detection
5. Default → `task`

## Examples

```
{skill:hc-cook} "Add JWT refresh token rotation"
→ inputType: task | flags: [] | interactive, sequential

{skill:hc-cook} "Add JWT refresh token rotation" --auto
→ inputType: task | flags: [auto] | autonomous, parallel when phases are independent

{skill:hc-cook} .agents/260531-auth/plan.md
→ inputType: plan-path | flags: [] | execute plan, stops at gates

{skill:hc-cook} .agents/260531-auth/plan.md --auto
→ inputType: plan-path | flags: [auto] | execute plan, no stops, parallel when safe

{skill:hc-cook} mockup.png
→ inputType: layout-screenshot | flags: [] | screenshot workflow, stops at gates

{skill:hc-cook} https://figma.com/file/abc123
→ inputType: layout-figma | flags: [] | Figma/describe workflow

{skill:hc-cook} "Refactor auth middleware" --tdd
→ inputType: task | flags: [tdd] | interactive, tests-first per phase

{skill:hc-cook} mockup.png "fix the button alignment"
→ inputType: task (override: "fix" in task text) | image is context, not spec

{skill:hc-cook} design.mp4 --auto
→ inputType: layout-video | flags: [auto] | video workflow, no stops
```
