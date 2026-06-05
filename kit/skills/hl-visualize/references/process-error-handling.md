# Error Handling

Error conditions, fallback actions, and user-facing messages for `hl:visualize`.

| Error | Action |
|-------|--------|
| Empty topic | Ask user to provide a topic |
| Flag given without topic | Ask: "Please provide a topic: `{skill:hl-visualize} --explain <topic>`" |
| Topic empty after sanitization | Ask for a topic containing alphanumeric characters |
| File write failure | Report error; suggest checking disk space and permissions |
| Server startup failure | Check if port already in use; suggest `{skill:hl-visualize} --stop` first |
| No generation flag + unresolvable path | Ask user to clarify which file they meant |
| Existing file at output path | Overwrite silently |
| Server already running | Reuse existing instance, open new URL |
| Parent `.agents/` dir missing | Create directories recursively before writing |
| `--diff` without git repo | "No git repo detected. Run inside a git repository." |
| `--plan-review` without plan | "Provide a plan file path or run from a session with an active plan." |
| `--recap` without git history | "No git history found. Run inside a git repository with commits." |
| `--html --ascii` combination | Not supported — `--ascii` is terminal-only. Suggest `--html --diagram` instead. |
| `--diff` with PR number but `gh` missing | "GitHub CLI (gh) is required for PR diffs. Install from https://cli.github.com/" |
