# SolidJS Standards

Detected via `solid-js` or `solid-start` in `package.json` deps.

## What SolidJS Is

Fine-grained reactive UI framework — JSX syntax like React, but **no virtual DOM, no re-renders**. Components run once; updates happen at the granular signal/derivation level. Fastest UI framework in most benchmarks.

## When to Use

- Performance-critical UIs (animation, charts, dashboards)
- Like React's JSX but want truly fast updates
- Want predictable rendering without React's gotchas (`useMemo`, `useCallback` ceremony)
- Greenfield projects open to a smaller ecosystem than React

vs **React**: SolidJS is 3-10x faster, smaller, but ecosystem is smaller. JSX is similar but semantics differ (no re-renders!).

## Setup

```bash
npm create solid@latest
# Or for SSR/full-stack: npm create solid@latest -- --template ssr
cd my-app
npm install
npm run dev
```

## Signals (Reactive Primitives)

```tsx
import { createSignal } from "solid-js";

function Counter() {
    const [count, setCount] = createSignal(0);

    return (
        <button onClick={() => setCount(count() + 1)}>
            Count: {count()}
        </button>
    );
}
```

**Critical:** `count()` is a function call, not a value access. This is how Solid tracks reactivity.

```tsx
const [user, setUser] = createSignal({ name: "Alice", age: 30 });

// Replace
setUser({ name: "Bob", age: 25 });

// Update based on previous
setCount((c) => c + 1);
```

## Components Don't Re-Render

Unlike React, components run **once**. JSX expressions stay reactive:

```tsx
function Component() {
    const [count, setCount] = createSignal(0);
    console.log("This logs once, not on every update!");

    return <p>{count() * 2}</p>;     // {count()} re-evaluates, the rest doesn't
}
```

This eliminates React's `useCallback`/`useMemo` boilerplate.

## Derivations

```tsx
import { createMemo } from "solid-js";

const [first, setFirst] = createSignal("Alice");
const [last, setLast] = createSignal("Smith");
const fullName = createMemo(() => `${first()} ${last()}`);

return <p>{fullName()}</p>;
```

`createMemo` caches; recomputes only when sources change. For cheap derivations, inline functions are fine too.

## Effects

```tsx
import { createEffect } from "solid-js";

createEffect(() => {
    console.log("count is now", count());
});

// Run once
import { onMount } from "solid-js";
onMount(() => {
    fetchData();
});

// Cleanup
import { onCleanup } from "solid-js";
const interval = setInterval(() => /* ... */, 1000);
onCleanup(() => clearInterval(interval));
```

`createEffect` runs after render + whenever its tracked signals change.

## Async Data — Resources

```tsx
import { createResource, Show } from "solid-js";

const [userId, setUserId] = createSignal(1);
const [user] = createResource(userId, async (id) => {
    const res = await fetch(`/api/users/${id}`);
    return res.json();
});

return (
    <Show when={!user.loading} fallback={<p>Loading...</p>}>
        {user()?.name}
    </Show>
);
```

`createResource` refetches when source signal changes.

## Control Flow Components

Solid replaces JS conditionals/loops with components that don't re-render:

```tsx
import { Show, For, Switch, Match } from "solid-js";

<Show when={user()} fallback={<p>Loading...</p>}>
    {(user) => <p>{user().name}</p>}
</Show>

<For each={posts()} fallback={<p>No posts</p>}>
    {(post) => <li>{post.title}</li>}
</For>

<Switch fallback={<p>Other</p>}>
    <Match when={status() === "loading"}><Spinner /></Match>
    <Match when={status() === "error"}><Error /></Match>
    <Match when={status() === "ok"}><Content /></Match>
</Switch>
```

`<For>` uses keyed reconciliation — items aren't re-created when reordered.

## Stores (Nested State)

For complex objects, use stores (mutable-looking but reactive):

```tsx
import { createStore } from "solid-js/store";

const [state, setState] = createStore({
    user: { name: "Alice", prefs: { theme: "dark" } },
    posts: [],
});

// Update nested
setState("user", "prefs", "theme", "light");
setState("posts", (posts) => [...posts, newPost]);
setState("posts", 0, "title", "Updated");      // by index

// Read — properties auto-track
state.user.name;
state.user.prefs.theme;
```

Stores are reactive at every level — only the leaf that changed triggers updates.

## Solid Start (Full-Stack)

Solid's meta-framework (similar to Next.js / SvelteKit):

```tsx
// src/routes/users/[id].tsx
import { useParams } from "@solidjs/router";
import { createAsync } from "@solidjs/router";

async function fetchUser(id: string) {
    "use server";       // runs on server only
    return await db.user.findUnique({ where: { id } });
}

export default function UserPage() {
    const params = useParams();
    const user = createAsync(() => fetchUser(params.id));

    return (
        <Show when={user()}>
            <h1>{user()?.name}</h1>
        </Show>
    );
}
```

`"use server"` makes a function run server-only. Routing is file-based.

## Forms

```tsx
import { createSignal } from "solid-js";

function LoginForm() {
    const [email, setEmail] = createSignal("");
    const [password, setPassword] = createSignal("");

    const handleSubmit = async (e: SubmitEvent) => {
        e.preventDefault();
        await login(email(), password());
    };

    return (
        <form onSubmit={handleSubmit}>
            <input
                type="email"
                value={email()}
                onInput={(e) => setEmail(e.currentTarget.value)}
            />
            <input
                type="password"
                value={password()}
                onInput={(e) => setPassword(e.currentTarget.value)}
            />
            <button>Login</button>
        </form>
    );
}
```

In Solid Start, **server actions** simplify mutations:
```tsx
import { action, useAction } from "@solidjs/router";

const createUser = action(async (formData: FormData) => {
    "use server";
    return await db.user.create({ data: { ... } });
});

<form action={createUser} method="post">...</form>
```

## Styling

Same options as React: CSS Modules, Tailwind, vanilla-extract, etc. Solid has first-class support for **CSS-in-JS via @kobalte/core** and **solid-styled** for scoped styles.

## Testing

```tsx
import { render } from "@solidjs/testing-library";
import { expect, test } from "vitest";

test("counter increments", () => {
    const { getByText } = render(() => <Counter />);
    const button = getByText(/Count: 0/);
    button.click();
    expect(getByText(/Count: 1/)).toBeDefined();
});
```

`@solidjs/testing-library` mirrors `@testing-library/react`.

## Best Practices

- **Always call signals as functions**: `count()`, not `count`
- **`<For>` over `.map()`** in JSX — better reconciliation
- **`<Show>` over `&&` / ternaries** — true conditional removal, not just hidden
- **Stores for nested objects** — `createStore` over multiple `createSignal`s
- **Server functions** (`"use server"`) in Solid Start — keep DB code off the client
- **Avoid destructuring props** — breaks reactivity:
  ```tsx
  function MyComp(props: { name: string }) {
      // BAD: const { name } = props; — name won't update
      // GOOD: use props.name directly
      return <p>{props.name}</p>;
  }
  ```

## Common Pitfalls

- **Destructuring props** — breaks reactivity (props are getters under the hood)
- Forgetting `()` on signal access — passes the function, not the value
- Using React patterns directly — `useMemo`, `useState` don't exist; equivalents work differently
- Mutating signal values directly — `count = 5` is just a JS assignment, no reactivity; use `setCount(5)`
- Using `array.map` for lists — works but doesn't key properly; use `<For>` for performance
- Effects without cleanup — leaks timers / event listeners

## Solid vs React Cheatsheet

| React | Solid |
|---|---|
| `useState(0)` | `createSignal(0)` |
| `useMemo(() => x, [deps])` | `createMemo(() => x)` (auto-tracks) |
| `useEffect(() => {}, [deps])` | `createEffect(() => {})` (auto-tracks) |
| `useEffect(() => {}, [])` | `onMount(() => {})` |
| `array.map(x => <>)` | `<For each={array}>{x => <>}</For>` |
| `{cond && <X/>}` | `<Show when={cond}><X/></Show>` |
| Component re-renders | Component runs once |

## Resources

- Docs: https://www.solidjs.com/docs/latest
- SolidStart: https://start.solidjs.com
- Examples: https://www.solidjs.com/examples
- Solid in 1 hour (video): https://www.youtube.com/watch?v=hw3Bx5vxKl0
- Discord: https://discord.gg/solidjs
