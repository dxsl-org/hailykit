---
name: hc-browser
description: "AI-driven browser automation for long autonomous sessions."
when_to_use: "Invoke when running AI-driven browser sessions or Browserbase cloud automation."
user-invocable: true
argument-hint: "[url or task]"
metadata:
  category: dev-tools
  keywords: [browser, automation, playwright, testing]
---

# Browser — AI-Driven Automation

Context-efficient browser automation via `agent-browser`. Uses "snapshot + refs" — 93% less context than Playwright MCP (~280 chars/snapshot vs 8K+).

**Use instead of `{skill:hc-debug}` when:** long autonomous sessions, context-constrained workflows, video recording, cloud browsers (Browserbase), multi-tab handling, or self-verifying build loops.

## Setup

```bash
npm install -g agent-browser
agent-browser install            # download Chromium (one-time)
agent-browser install --with-deps  # Linux: include system deps
agent-browser --version
```

## Core Workflow

```bash
# 1. Navigate
agent-browser open https://example.com

# 2. Snapshot — get interactive elements with refs
agent-browser snapshot -i
# Output: button "Sign In" @e1, textbox "Email" @e2, ...

# 3. Interact by ref
agent-browser fill @e2 "user@example.com"
agent-browser click @e1

# 4. Re-snapshot after page changes
agent-browser snapshot -i
```

## Command Reference

### Navigation & State
```bash
agent-browser open <url> | back | forward | reload | close
agent-browser viewport 1920 1080 | device "iPhone 14" | color-scheme dark
agent-browser headers '{"X-Custom":"val"}' | credentials user pass
agent-browser geolocation 40.7 -74.0 | offline true
```

### Snapshot (Analysis)
```bash
agent-browser snapshot           # full accessibility tree
agent-browser snapshot -i        # interactive elements only (recommended)
agent-browser snapshot -c        # compact output
agent-browser snapshot -d 3      # limit depth
agent-browser snapshot -s "nav"  # scope to CSS selector
```

### Interactions (use @refs from snapshot)
```bash
agent-browser click @e1 | dblclick @e1 | hover @e1 | scroll @e1
agent-browser fill @e2 "text" | type @e2 "text" | press Enter
agent-browser check @e3 | uncheck @e3 | select @e4 "opt"
agent-browser scroll down 500 | drag @e1 @e2 | upload @e5 file.pdf
```

### Information & State Checks
```bash
agent-browser get text|html|value|attr|title|url|count|box @e1
agent-browser is visible|enabled|checked @e1
```

### Media
```bash
agent-browser screenshot [--full] [-o ss.png] | pdf [-o page.pdf]
agent-browser record start | stop | restart
```

### Wait Conditions
```bash
agent-browser wait @e1 | --text "Success" | --url "/dashboard"
agent-browser wait --load | --idle | --fn "() => window.ready"
```

### Storage & Network
```bash
agent-browser cookies [set name=val | clear]
agent-browser storage local | session
agent-browser state save auth.json | load auth.json
agent-browser network route "**/*.jpg" --abort
agent-browser network route "**/api/*" --body '{"data":[]}'
agent-browser network unroute "**/*.jpg" | requests
```

### Semantic Finding & Advanced
```bash
agent-browser find role button | text "Submit" | label "Email"
agent-browser find placeholder "Search" | testid "login-btn"
agent-browser find first|last|nth 2 "li"
agent-browser tabs | tab new|2|close | frame 0
agent-browser dialog accept | dismiss | eval "document.title"
agent-browser highlight @e1 | mouse move 100 200 | mouse down | mouse up
```

## Global Options

| Option | Description |
|--------|-------------|
| `--session <name>` | Named session for parallel testing |
| `--json` | JSON output for parsing |
| `--headed` | Show browser window |
| `--cdp <port>` | Connect via Chrome DevTools Protocol |
| `-p <provider>` | Cloud browser provider |
| `--proxy <url>` | Proxy server |
| `--executable-path` | Custom browser binary |
| `--extension <path>` | Load browser extension |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `AGENT_BROWSER_SESSION` | Default session name |
| `AGENT_BROWSER_PROVIDER` | Cloud provider (e.g., `browserbase`) |
| `AGENT_BROWSER_EXECUTABLE_PATH` | Browser binary location |
| `AGENT_BROWSER_EXTENSIONS` | Comma-separated extension paths |
| `AGENT_BROWSER_STREAM_PORT` | WebSocket streaming port |
| `AGENT_BROWSER_HOME` | Custom installation directory |
| `AGENT_BROWSER_PROFILE` | Browser profile directory |
| `BROWSERBASE_API_KEY` | Browserbase API key |
| `BROWSERBASE_PROJECT_ID` | Browserbase project ID |

## Common Patterns

**Form submission:**
```bash
agent-browser open https://example.com/login && agent-browser snapshot -i
agent-browser fill @e1 "user@example.com" && agent-browser fill @e2 "password123"
agent-browser click @e3 && agent-browser wait url "/dashboard"
```

**Auth state persistence:**
```bash
agent-browser state save auth.json   # save after login
agent-browser state load auth.json   # reuse in future sessions
```

**Parallel sessions:**
```bash
agent-browser --session test1 open https://example.com  # terminal 1
agent-browser --session test2 open https://example.com  # terminal 2
```

## Cloud Browsers (Browserbase)

```bash
export BROWSERBASE_API_KEY="your-api-key"
export BROWSERBASE_PROJECT_ID="your-project-id"
agent-browser -p browserbase open https://example.com
```

See `references/browserbase-cloud-setup.md` for detailed setup.

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Command not found | `npm install -g agent-browser` |
| Chromium missing | `agent-browser install` |
| Linux deps missing | `agent-browser install --with-deps` |
| Session stale | `agent-browser close` |
| Element not found | Re-run `snapshot -i` after page changes |
