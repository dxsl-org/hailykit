---
name: hc-browser
description: "AI-driven browser automation for long autonomous sessions."
when_to_use: "Invoke when running AI-driven browser sessions, Browserbase cloud automation, or reading a page that blocks plain fetch (403 bot wall, JS-rendered SPA returning an empty shell)."
user-invocable: true
argument-hint: "[url or task]"
metadata:
  category: dev-tools
  keywords: [browser, automation, playwright, testing]
---

# Browser — AI-Driven Automation

Use `agent-browser` for long sessions, cloud or multi-tab automation, recording, and public pages that plain fetch cannot render. Use `{skill:hc-debug}` for console, network, or performance diagnosis and `{skill:hc-test}` for reproducible browser QA.

## Usage

```text
{skill:hc-browser} https://example.com
{skill:hc-browser} "verify the checkout flow"
```

## Constraints

> **Required — public fallback only:** Use the read-only fallback only for a public page returning 403, a bot wall, or a near-empty JS-rendered response. Login-walled content is out of scope. Never bypass authentication or anti-bot controls.

> **Required — fresh references:** Run `agent-browser snapshot -i` before interacting. Use only current `@e1`-style references and re-snapshot after navigation or other state changes.

## Process

1. Confirm `agent-browser --version`. If unavailable, run `npm install -g agent-browser`, then `agent-browser install` (`--with-deps` on Linux). Consult `agent-browser --help` or `references/browserbase-cloud-setup.md` only when needed.
2. Open the target and run `agent-browser snapshot -i`.
3. Interact through current `@e1`-style references, using explicit waits for page, URL, or element state.
4. Re-snapshot after state changes, verify the requested outcome, and close the session.

## Read-Only Public-Page Fallback

```bash
agent-browser open <url>
agent-browser wait --idle
agent-browser get text
agent-browser close
```

Do not click, submit forms, persist authentication, or mutate remote state in fallback mode.

## Workflow Position

**Follows:** `{skill:hc-lookup}`, `{skill:hl-research}` — when plain fetch cannot read a public page
**Related:** `{skill:hc-debug}`, `{skill:hc-test}`

## References

| Need | Reference |
|---|---|
| Browserbase cloud setup | `references/browserbase-cloud-setup.md` |
| Tool selection | `references/agent-browser-vs-chrome-devtools.md` |
