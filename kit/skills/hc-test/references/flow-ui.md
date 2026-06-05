---
name: flow-ui
description: UI testing workflow — browser automation for visual regression, responsive layout, accessibility audits, auth-protected routes, and comprehensive UI reporting.
---

# UI Testing Workflow

Browser-based UI testing: visual regression, responsive checks, accessibility, auth-protected routes, and structured reporting.

## When to Use

- Visual regression after UI changes
- Responsive layout verification across viewports
- Accessibility audit (paired with `tech-a11y.md`)
- Testing auth-protected pages

## Tools

- **`{skill:hc-browser}`** — interactive browser sessions: console errors, network, screenshots, ARIA
- **Playwright** (project-native) — repeatable e2e and visual tests; see `references/tech-playwright.md`
- **Native Read tool** — describe UI issues from screenshots by reading the file directly

## Testing Protected Routes

### Playwright (recommended for repeatable tests)

Use API-level auth injection to avoid manual login:

```typescript
// fixtures/auth.ts
export const test = baseTest.extend<{ authPage: Page }>({
  authPage: [async ({ browser, request }, use) => {
    const res = await request.post('/api/auth', {
      data: { email: 'test@example.com', password: 'pass' }
    });
    const { token } = await res.json();
    const context = await browser.newContext();
    await context.addCookies([
      { name: 'token', value: token, domain: 'localhost', path: '/' }
    ]);
    const page = await context.newPage();
    await use(page);
    await context.close();
  }, { scope: 'worker' }]
});
```

### Manual cookie injection (one-off debugging)

Ask the user to:
1. Log in manually in their browser
2. Open DevTools → Application → Cookies
3. Copy the session cookie value

Then inject via Playwright `storageState`:
```bash
npx playwright codegen --save-storage=auth.json https://example.com
```

## Workflow

1. **Discover** — spawn `{skill:hc-scout}` or `{skill:hc-browser}` to identify all pages, routes, and components in scope
2. **Plan** — create test plan: pages, forms, navigation flows, responsive breakpoints, accessibility, performance
3. **Execute** — run parallel `haily-tester` subagents per concern area (pages, forms, navigation, a11y, responsive, performance)
4. **Analyze** — read collected screenshots with the native Read tool to describe UI issues
5. **Report** — generate Markdown report via `references/quality-report.md`; ask user if they want a visual preview with `{skill:hl-visualize}`

## Screenshots

Save all screenshots to the same report directory. Include paths directly in the report for easy access.

## Output Requirements

- Structured Markdown: headers, lists, code blocks
- Test results summary, key findings, screenshot references
- All failed assertions with file:line where possible
- Do not implement fixes — report findings only
