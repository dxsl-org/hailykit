# Svelte + SvelteKit Standards

Detected via `svelte` or `@sveltejs/kit` in `package.json` deps.

## When to Use

- Smaller bundle sizes than React/Vue (compiled, no virtual DOM)
- Reactive primitives via runes (Svelte 5)
- Server-rendered apps via SvelteKit
- Easy progressive enhancement (forms work without JS)

## Svelte 5 Runes

Svelte 5 introduced **runes** — explicit reactivity primitives. Use these for new code:

```svelte
<script lang="ts">
  // State
  let count = $state(0);

  // Derived (computed)
  let doubled = $derived(count * 2);

  // Effect (replaces $: side effects)
  $effect(() => {
    console.log(`count is ${count}`);
  });

  // Props
  let { name = 'World' } = $props();

  // Bindable prop
  let { value = $bindable() } = $props();
</script>

<button onclick={() => count++}>+</button>
<p>{count} → {doubled}</p>
```

**Don't mix legacy `$:` reactive statements with runes in same component** — pick one paradigm per file.

## SvelteKit Project Structure

```
src/
├── routes/
│   ├── +page.svelte          # / page UI
│   ├── +page.server.ts        # / server load + actions
│   ├── +layout.svelte         # Nested layout
│   ├── +error.svelte          # Error boundary
│   └── api/
│       └── posts/+server.ts   # /api/posts endpoint
├── lib/                       # Auto-aliased as $lib
│   ├── server/                # Server-only code (build-time enforced)
│   └── components/
├── app.html                   # HTML shell
├── app.d.ts                   # Ambient types
└── hooks.server.ts            # Server hooks (auth, logging)
```

## Routing

File-based with `+` prefix indicating role:
- `+page.svelte` — page UI
- `+page.ts` — universal load (runs on server + client)
- `+page.server.ts` — server-only load + form actions
- `+layout.svelte` — wraps child routes
- `+server.ts` — API endpoint (no UI)
- `+error.svelte` — error UI
- `(group)` — route grouping without URL segment

Dynamic: `[id]/+page.svelte` → `/123`. Optional: `[[id]]`. Rest: `[...slug]`.

## Load Functions

```ts
// +page.server.ts
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
  const post = await db.post.findUnique({ where: { id: params.id } });
  if (!post) throw error(404, 'Not found');
  return { post };
};
```

Returned data is available in the page via `let { data } = $props();`. **Server load** can use DB/secrets; **universal load** (`+page.ts`) runs both places — keep it pure.

## Form Actions

```ts
// +page.server.ts
import type { Actions } from './$types';

export const actions: Actions = {
  default: async ({ request }) => {
    const data = await request.formData();
    const title = data.get('title');
    await db.post.create({ data: { title } });
    return { success: true };
  },
  delete: async ({ request }) => { /* ... */ },
};
```

```svelte
<form method="POST" use:enhance>
  <input name="title" />
  <button>Create</button>
</form>

<!-- Multiple actions -->
<form method="POST" action="?/delete" use:enhance>
  <button>Delete</button>
</form>
```

`use:enhance` adds progressive enhancement — without JS, it's a regular form submission.

## API Endpoints

```ts
// src/routes/api/posts/+server.ts
import { json } from '@sveltejs/kit';

export async function GET() {
  return json({ posts: await db.post.findMany() });
}

export async function POST({ request }) {
  const body = await request.json();
  /* ... */
  return json({ ok: true }, { status: 201 });
}
```

## Server Hooks

```ts
// src/hooks.server.ts
import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
  event.locals.user = await getUserFromSession(event.cookies);
  return resolve(event);
};
```

`event.locals` is typed via `app.d.ts` and available in all server loads.

## Stores (Pre-Svelte-5)

Legacy stores still work; for new code prefer runes-in-classes pattern:

```ts
// lib/stores/counter.svelte.ts
class CounterStore {
  count = $state(0);
  increment() { this.count++; }
}
export const counter = new CounterStore();
```

```svelte
<script>
  import { counter } from '$lib/stores/counter.svelte';
</script>
<button onclick={() => counter.increment()}>{counter.count}</button>
```

## Best Practices

- **Use runes for new code** — don't mix with legacy `$:` reactive syntax
- `$lib` for shared code, `$lib/server` for server-only (enforced at build)
- `use:enhance` on forms for progressive enhancement
- Type loads via generated `./$types` imports
- Prefer **server actions** over API endpoints when the action ties to a page
- `+page.server.ts` for DB calls; `+page.ts` only for fetch from public APIs
- Snippet (`{#snippet name()}`) replaces slots for parametric reuse

## Common Pitfalls

- Mixing `$state` runes with legacy `let foo;` reactive declarations — confusing
- Putting secrets in `+page.ts` (it runs on client too!) — use `+page.server.ts`
- Forgetting `use:enhance` → full page reload on form submit
- Manual reactivity (`$:`) inside a `<script>` that also uses runes
- Importing `$lib/server/*` from client code → build error (correct behavior)

## Resources

- Docs: https://svelte.dev/docs
- SvelteKit: https://kit.svelte.dev/docs
- Runes: https://svelte.dev/docs/svelte/what-are-runes
