# Catalog And Filters

## `--list`

Read `.claude/scripts/skills_data.yaml`, group by `category`, print the full prefixed name, and sort alphabetically inside each group. Keep the core workflow skills visible near the top.

Example headings:

```text
## Core Workflow
## Thinking & Analysis
## Security
## Design & Visual
## Backend Development
## Infrastructure & DevOps
## Development Tools
## Senior Dev Workflows
## Project Management
## Utilities
```

## Category Grouping Map

| yaml `category` | Display heading |
|---|---|
| `workflow` | Core Workflow |
| `thinking` | Thinking & Analysis |
| `security` | Security |
| `frontend` | Frontend & Design |
| `backend` | Backend Development |
| `infrastructure` | Infrastructure & DevOps |
| `database` | Database |
| `dev-tools` | Development Tools |
| `ai-ml` | AI / LLM |
| `frameworks` | Frameworks & Platforms |
| `multimedia` | Multimedia |
| `project` | Project Management |
| `utilities` | Utilities |
| `other` | Other |

## `--search <keyword>`

Case-insensitive match on `name`, `description`, or `keywords`.

Example:

```text
{skill:hl-help} --search browser
Search results for "browser":
  {skill:hc-browser}
```

## `--prefix <domain>`

Match by skill name prefix:

| Prefix arg | Shows |
|---|---|
| `hl` | Universal skills |
| `hc` | Coding skills |
| `hs` | Security-ops skills for running systems |

## `--domain <area>`

Map aliases to categories before filtering:

| Alias | Matches category |
|---|---|
| `frontend`, `ui`, `design` | frontend |
| `backend`, `api` | backend |
| `db`, `database` | database |
| `devops`, `infra` | infrastructure |
| `security`, `sec` | security |
| `ai`, `llm`, `ml` | ai-ml |
| `media`, `docs`, `office` | multimedia |
| `test`, `testing` | workflow |
| `util`, `tools` | utilities |
| `project`, `pm` | project |
| `thinking`, `analysis` | thinking |

## `--all`

Use the same category routing as `--list`, but do not truncate descriptions.

## Auto-Injected Standards

Language and framework standards are auto-loaded at session start when the stack is detected. They are not separate help-skill invocations.
