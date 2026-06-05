# Qwik Standards

Detected via `@builder.io/qwik` or `@builder.io/qwik-city` in `package.json` deps.

## What Qwik Is

**Resumable** web framework — apps start instantly because they don't hydrate. Instead, the framework serializes the entire app state into the HTML and "resumes" execution on user interaction. JS is downloaded lazily on demand.

Performance claim: **O(1)** startup regardless of app size. Real apps see < 50ms time-to-interactive even for huge UIs.

## When to Use

- Cold-start performance critical (e-commerce, marketing)
- SEO + initial paint speed > all else
- Want React-like ergonomics with massive perf wins
- Building globally-distributed sites on edge

vs Next.js / Remix: those **hydrate** (re-run all components on client). Qwik **resumes** (no re-run; just attach event handlers as needed).

## Setup

```bash
npm create qwik@latest
# Pick: basic, starter, library, etc.
cd my-app
npm install
npm run dev
```

Includes Qwik City (the meta-framework — like Next.js for Qwik).

## Components

```tsx
import { component$, useSignal } from "@builder.io/qwik";

export const Counter = component$(() => {
    const count = useSignal(0);

    return (
        <button onClick$={() => count.value++}>
            Count: {count.value}
        </button>
    );
});
```

**The `$` suffix is critical** — it marks code that can be **lazily loaded**. The handler `onClick$` doesn't ship to the client until clicked.

| Suffix | Meaning |
|---|---|
| `component$` | Lazy-loaded component |
| `onClick$` | Lazy-loaded event handler |
| `useTask$` | Lazy-loaded task (effect) |
| `useVisibleTask$` | Lazy-loaded task that runs on visibility |
| `server$` | Server-only function (RPC) |

## Signals + Stores

```tsx
import { useSignal, useStore, component$ } from "@builder.io/qwik";

export const Profile = component$(() => {
    // Primitive
    const name = useSignal("Alice");

    // Object — use store
    const user = useStore({
        name: "Alice",
        prefs: { theme: "dark" },
    });

    return (
        <>
            <p>{user.name}</p>
            <p>Theme: {user.prefs.theme}</p>
            <button onClick$={() => user.prefs.theme = "light"}>Switch</button>
        </>
    );
});
```

Mutate `.value` on signals, mutate properties directly on stores. Qwik tracks reads for surgical updates.

## Lifecycle Tasks

```tsx
import { useTask$, useVisibleTask$ } from "@builder.io/qwik";

useTask$(({ track }) => {
    track(() => count.value);
    console.log("count changed to", count.value);
});

// Browser-only (after DOM is visible)
useVisibleTask$(() => {
    const interval = setInterval(() => /* ... */, 1000);
    return () => clearInterval(interval);   // cleanup
});
```

`useTask$` is the equivalent of Solid's `createEffect` or React's `useEffect`.

**`useVisibleTask$` is the only API that requires JS upfront** — use sparingly.

## Routing (Qwik City)

File-based routes in `src/routes/`:

```
src/routes/
├── index.tsx           → /
├── about/
│   └── index.tsx        → /about
└── users/
    └── [id]/
        └── index.tsx    → /users/:id
```

```tsx
// src/routes/users/[id]/index.tsx
import { component$ } from "@builder.io/qwik";
import { routeLoader$, useLocation } from "@builder.io/qwik-city";

export const useUser = routeLoader$(async ({ params, fail }) => {
    const user = await db.user.findUnique({ where: { id: parseInt(params.id) } });
    if (!user) throw fail(404, { message: "Not found" });
    return user;
});

export default component$(() => {
    const user = useUser();
    return <h1>{user.value.name}</h1>;
});
```

`routeLoader$` runs **on the server**, ships JSON to the client. Loaders re-run on navigation.

## Actions (Mutations)

```tsx
import { routeAction$, Form, zod$, z } from "@builder.io/qwik-city";

export const useCreateUser = routeAction$(
    async (data) => {
        const user = await db.user.create({ data });
        return { success: true, id: user.id };
    },
    zod$({
        email: z.string().email(),
        name: z.string().min(1),
    })
);

export default component$(() => {
    const create = useCreateUser();

    return (
        <Form action={create}>
            <input name="email" type="email" />
            <input name="name" type="text" />
            <button>Create</button>
            {create.value?.success && <p>User created!</p>}
        </Form>
    );
});
```

Forms work without JS. With JS, they enhance to client-side submission.

## Server Functions

For RPC-style calls outside loaders/actions:

```tsx
import { server$ } from "@builder.io/qwik-city";

const getStats = server$(async function () {
    return { users: await db.user.count(), posts: await db.post.count() };
});

export default component$(() => {
    const stats = useSignal<any>(null);

    return (
        <button onClick$={async () => stats.value = await getStats()}>
            Load Stats
        </button>
    );
});
```

## Styling

```tsx
import styles from "./Counter.css?inline";
import { useStylesScoped$ } from "@builder.io/qwik";

export const Counter = component$(() => {
    useStylesScoped$(styles);
    // ...
});
```

Or use Tailwind, CSS Modules, vanilla-extract — all supported.

## Best Practices

- **`$` everywhere lazy code is fine** — components, handlers, tasks
- **`routeLoader$`** for data on page load (runs on server, serialized to client)
- **`routeAction$`** for form mutations — built-in validation via `zod$`
- **Avoid `useVisibleTask$`** unless necessary — it's the one thing that bypasses lazy loading
- **Lean on Forms** for state — they work without JS, get enhanced with it
- **Pre-fetch** with `<Link prefetch>` for instant navigation
- **Test on slow networks** — Qwik shines under poor connectivity

## Common Pitfalls

- **Closing over non-serializable values** in `$` boundaries → "non-serializable value" error
  ```tsx
  // BAD: Date object isn't serializable across boundaries
  const date = new Date();
  return <button onClick$={() => console.log(date)}>...</button>;
  // GOOD: store as ISO string, or compute inside the handler
  ```
- Using `useVisibleTask$` everywhere → defeats Qwik's lazy advantage
- Treating Qwik like React — destructuring, `setState`, etc. won't work
- Forgetting `$` on closures → "QRL not found"
- Heavy `routeLoader$` → blocks page render; defer with `routeLoader$.lazy` patterns
- Trying to use NPM libs that aren't Qwik-aware — they ship full JS bundles (defeats the model)

## Qwik vs Other Frameworks

| Concept | React/Next.js | Qwik |
|---|---|---|
| Initial load | Hydrate (re-run everything on client) | Resume (don't re-run anything) |
| Code splitting | Manual (`dynamic()`) | Automatic (every `$` is a split point) |
| Event handlers | Loaded with component | Loaded only when needed |
| Best for | App complexity, ecosystem | Cold-start perf, large sites |

## Resources

- Docs: https://qwik.dev/docs
- Tutorial: https://qwik.dev/tutorial
- Qwik City: https://qwik.dev/docs/qwikcity
- Examples: https://qwik.dev/examples
- Discord: https://qwik.dev/community/discord
