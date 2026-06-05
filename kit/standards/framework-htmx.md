# htmx Standards

Detected via `htmx.org` in `package.json` deps.

## What htmx Is

A small (~14KB) JS library that lets you write **interactive HTML without writing JavaScript**. Add attributes like `hx-get`, `hx-post`, `hx-swap` and your server responses (HTML fragments) update the page.

Embraces **HATEOAS** — Hypertext As The Engine Of Application State. Server returns HTML; client just renders it.

## When to Use

- Server-rendered apps (Django, Rails, Laravel, Phoenix, Flask, Go) wanting dynamic UI without SPA complexity
- Internal tools / admin panels
- Forms, search, filters, infinite scroll, modals
- Teams that prefer one language (their backend) over JS/TS for UI

**Not for**: client-side heavy apps (canvas games, complex offline state), highly interactive UIs (drag-drop, real-time collab).

## Setup

```html
<script src="https://unpkg.com/htmx.org@2"></script>
```

Or self-host the file. ~14KB minified.

## Core Attributes

```html
<!-- Send GET on click, swap response into #result -->
<button hx-get="/api/random-quote" hx-target="#result" hx-swap="innerHTML">
    Get Quote
</button>
<div id="result"></div>

<!-- Submit form, swap response into #form-container -->
<form hx-post="/users" hx-target="#form-container" hx-swap="outerHTML">
    <input name="email" type="email">
    <button>Submit</button>
</form>

<!-- Search-as-you-type with debounce -->
<input
    name="q"
    hx-get="/search"
    hx-trigger="keyup changed delay:300ms"
    hx-target="#results"
    placeholder="Search...">
<div id="results"></div>
```

## Common Attributes

| Attribute | Purpose |
|---|---|
| `hx-get`, `hx-post`, `hx-put`, `hx-patch`, `hx-delete` | HTTP method + URL |
| `hx-trigger` | When to fire (`click`, `submit`, `every 5s`, `keyup changed`, etc.) |
| `hx-target` | Where to swap response (CSS selector, `closest`, `next`, `this`) |
| `hx-swap` | How to swap: `innerHTML` (default), `outerHTML`, `beforebegin`, `afterend`, `delete`, `none` |
| `hx-push-url` | Update browser URL + history |
| `hx-include` | Include other form fields in the request |
| `hx-vals` | Send extra data: `hx-vals='{"key": "value"}'` |
| `hx-headers` | Send extra headers |
| `hx-confirm` | "Are you sure?" prompt |
| `hx-disable` | Disable the element while request is in flight |
| `hx-indicator` | Show a loader element during request |

## Triggers

```html
<!-- Multiple triggers -->
<input hx-get="/search" hx-trigger="keyup changed delay:300ms, blur from:body">

<!-- Polling -->
<div hx-get="/status" hx-trigger="every 5s">Loading...</div>

<!-- Load on page load -->
<div hx-get="/comments" hx-trigger="load">Loading comments...</div>

<!-- Intersection (infinite scroll) -->
<div hx-get="/posts?page=2" hx-trigger="revealed" hx-swap="outerHTML">
    Load more...
</div>

<!-- Custom events -->
<div hx-get="/refresh" hx-trigger="userUpdated from:body">...</div>
```

## Out-of-Band Swaps

Update multiple parts of the page from one response:

```html
<!-- Server response: -->
<div id="primary">Main content updated</div>
<div id="notifications" hx-swap-oob="true">3 new notifications</div>
```

Both `#primary` (via `hx-target`) AND `#notifications` (via OOB) get updated.

## Server Response Conventions

Server returns **HTML fragments**, not JSON. The response replaces / merges with the DOM.

```html
<!-- POST /todos -->
<!-- Response: -->
<li class="todo" id="todo-42">
    Buy milk
    <button hx-delete="/todos/42" hx-target="closest li" hx-swap="outerHTML">×</button>
</li>
```

Inspect `Hx-Request: true` header on the server to detect htmx calls (vs full page loads) and return only the fragment.

## Special Response Headers

| Header | Purpose |
|---|---|
| `HX-Redirect` | Tell browser to navigate to a new URL |
| `HX-Refresh` | Trigger a full page reload |
| `HX-Trigger` | Fire JS events: `{ "myEvent": { "level": "info" } }` |
| `HX-Reswap` | Override `hx-swap` from server |
| `HX-Retarget` | Override `hx-target` from server |
| `HX-Push-Url` | Push a URL to history without navigating |
| `HX-Location` | Like `HX-Redirect` but uses htmx navigation |

## Forms + Validation

```html
<form hx-post="/users" hx-target="#form-container">
    <input name="email" required>
    <span class="error" id="email-error"></span>

    <button>Submit</button>
</form>
```

Server returns:
```html
<!-- On validation error (HTTP 422) -->
<form hx-post="/users" hx-target="#form-container">
    <input name="email" value="invalid" aria-invalid="true">
    <span class="error">Invalid email</span>
    <button>Submit</button>
</form>
```

Re-renders the entire form with validation messages. No JS state to manage.

## Loading States

```html
<button hx-post="/submit" hx-indicator="#spinner">
    Save
    <span id="spinner" class="htmx-indicator">Saving...</span>
</button>

<style>
    .htmx-indicator { display: none; }
    .htmx-request .htmx-indicator { display: inline; }
    .htmx-request.htmx-indicator { display: inline; }
</style>
```

`.htmx-request` class auto-added while request is in flight.

## Hyperscript (Optional Companion)

For tiny interactivity that doesn't need a server roundtrip:

```html
<script src="https://unpkg.com/hyperscript.org"></script>

<button _="on click toggle .hidden on #panel">Toggle</button>
<div id="panel" class="hidden">Hello</div>
```

Hyperscript is htmx's official scripting language — natural language, no JS needed for simple toggles.

Or just use **Alpine.js** for richer client-side state:
```html
<div x-data="{ open: false }">
    <button @click="open = !open">Toggle</button>
    <div x-show="open">Content</div>
</div>
```

## Testing

htmx is just HTML — test via Playwright, Cypress, or even Selenium:

```ts
// Playwright
await page.click("button[hx-post='/submit']");
await expect(page.locator("#result")).toHaveText("Saved!");
```

Or test server endpoints directly (they return HTML, easy to assert).

## Best Practices

- **Server returns HTML fragments**, not JSON
- Check `request.headers["HX-Request"]` to distinguish htmx from full-page loads
- Use **`hx-trigger="keyup changed delay:300ms"`** for search boxes — built-in debounce
- **`hx-confirm`** for destructive actions
- **`hx-indicator`** for loading feedback
- **OOB swaps** to update notifications/badges from any response
- Use **Alpine.js** or **hyperscript** for client-only interactivity (toggles, dropdowns) that doesn't need server
- **CSRF**: include token in `hx-headers` or use server middleware that auto-adds it
- **Progressive enhancement**: forms should work without htmx as fallback

## Common Pitfalls

- Returning JSON from htmx endpoints → swaps `{}` as text; return HTML
- Forgetting to detect `HX-Request` header → returns full page wrapped in layout
- Swap target doesn't exist → silent no-op; check selectors
- Heavy client logic → wrong tool; reach for React/Svelte/Vue
- `hx-trigger="load"` on hidden elements → fires immediately when shown unexpectedly
- Long polling with `every Ns` + no cleanup → keeps polling after element removed
- Caching issues: htmx caches GET responses by default — add `hx-disable-cache="true"` if needed

## Stack Patterns

| Backend | Common pairing |
|---|---|
| Django | htmx + django-htmx + alpine.js |
| Rails | Hotwire/Turbo (similar concept, Rails-native) |
| Phoenix | LiveView (similar but server-rendered with WebSocket) |
| Laravel | htmx + Livewire (Laravel-native), or htmx with Blade templates |
| Go (Echo/Gin/Fiber) | htmx + templ (type-safe templates) |
| FastAPI | htmx + Jinja2 templates |

## Resources

- Docs: https://htmx.org/docs
- Examples: https://htmx.org/examples
- Essays: https://htmx.org/essays — "HATEOAS", "Hypermedia-Driven Apps"
- Book: https://hypermedia.systems (free online)
- Hyperscript: https://hyperscript.org
